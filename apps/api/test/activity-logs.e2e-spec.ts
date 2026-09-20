import request from 'supertest';
import { bearer, createE2eApp, E2eContext } from './helpers/e2e-app';
import { createFlow, FlowTokens, loginAll } from './helpers/flow';

interface Entry {
  id: string;
  actor: { id: string; name: string; email: string } | null;
  action: string;
  entityType: string;
  entityId: string | null;
  route: string | null;
  body: Record<string, unknown> | null;
  createdAt: string;
}
interface Page {
  items: Entry[];
  meta: { total: number; totalPages: number };
}

describe('Activity logs (e2e)', () => {
  let ctx: E2eContext;
  let t: FlowTokens;
  let flow: ReturnType<typeof createFlow>;
  let candidateId: string;
  let recruiterId: string;

  const list = (query = '', token = t.admin) =>
    request(ctx.server).get(`/activity-logs${query}`).set(bearer(token));

  /** The audit write is fire-and-forget, so wait until the entries have landed. */
  const untilLogged = async (query: string, atLeast: number): Promise<Page> => {
    let page: Page = { items: [], meta: { total: 0, totalPages: 1 } };
    for (let i = 0; i < 60 && page.items.length < atLeast; i++) {
      page = (await list(query).expect(200)).body as Page;
      if (page.items.length < atLeast)
        await new Promise((r) => setTimeout(r, 50));
    }
    return page;
  };

  beforeAll(async () => {
    ctx = await createE2eApp();
    t = await loginAll(ctx);
    flow = createFlow(ctx, t, 'E2E-LOG');
    await flow.cleanup();

    const rows: { id: string }[] = await ctx.dataSource.query(
      `SELECT id FROM users WHERE email = 'recruiter@hiflow.local'`,
    );
    recruiterId = rows[0].id;

    // Three writes by the recruiter against one candidate, one carrying a secret-looking field.
    const created = await flow.candidate('log');
    candidateId = created.id;
    await request(ctx.server)
      .patch(`/candidates/${candidateId}`)
      .set(bearer(t.recruiter))
      .send({ fullName: 'Tên đã đổi' })
      .expect(200);
    await request(ctx.server)
      .put(`/candidates/${candidateId}/note`)
      .set(bearer(t.recruiter))
      .send({ note: 'Ghi chú thử' })
      .expect(200);
    await untilLogged(`?entityId=${candidateId}`, 3);
  });

  afterAll(async () => {
    await flow.cleanup();
    await ctx.app.close();
  });

  describe('access', () => {
    it('requires authentication', async () => {
      await request(ctx.server).get('/activity-logs').expect(401);
      await request(ctx.server).get('/activity-logs/export').expect(401);
    });

    it.each(['hr', 'recruiter', 'manager', 'interviewer'] as const)(
      'is closed to %s',
      async (role) => {
        await list('', t[role]).expect(403);
        await request(ctx.server)
          .get('/activity-logs/export')
          .set(bearer(t[role]))
          .expect(403);
      },
    );

    it('is open to an admin', async () => {
      await list().expect(200);
    });
  });

  describe('what is recorded', () => {
    it('records each write with who, what, and where', async () => {
      const page = await untilLogged(
        `?entityId=${candidateId}&sortBy=createdAt&sortDir=asc`,
        3,
      );

      expect(page.items.map((e) => `${e.action} ${e.route}`)).toEqual([
        'POST /candidates',
        'PATCH /candidates/:id',
        'PUT /candidates/:id/note',
      ]);
      for (const entry of page.items) {
        expect(entry.entityType).toBe('Candidate');
        expect(entry.entityId).toBe(candidateId);
        expect(entry.actor).toEqual({
          id: recruiterId,
          name: 'Nguyễn Ngọc Lan',
          email: 'recruiter@hiflow.local',
        });
      }
      expect(page.items[1].body).toEqual({ fullName: 'Tên đã đổi' });
    });

    it('never records reads or logins', async () => {
      await request(ctx.server)
        .get(`/candidates/${candidateId}`)
        .set(bearer(t.recruiter))
        .expect(200);
      await new Promise((r) => setTimeout(r, 300));

      const all = (await list(`?entityId=${candidateId}`).expect(200))
        .body as Page;
      expect(all.items.every((e) => e.action !== 'GET')).toBe(true);

      const logins = (await list('?entityType=Auth').expect(200)).body as Page;
      expect(logins.items).toHaveLength(0);
    });

    it('never stores a password, even in nested data', async () => {
      const email = `${flow.mailPrefix}secret@example.com`;
      const user = await request(ctx.server)
        .post('/users')
        .set(bearer(t.hr))
        .send({
          email,
          fullName: 'Secret Holder',
          role: 'RECRUITER',
          password: 'Sturdy-Pass-42',
        })
        .expect(201);
      const userId = (user.body as { id: string }).id;

      try {
        const page = await untilLogged(
          `?entityType=User&entityId=${userId}`,
          1,
        );
        const text = JSON.stringify(page.items);

        expect(text).toContain('[REDACTED]');
        expect(text).not.toContain('Sturdy-Pass-42');
      } finally {
        await ctx.dataSource.query(
          `DELETE FROM activity_logs WHERE entity_type = 'User' AND entity_id = $1`,
          [userId],
        );
        await ctx.dataSource.query(`DELETE FROM users WHERE id = $1`, [userId]);
      }
    });
  });

  describe('listing', () => {
    it('filters by actor, action, entity type and day', async () => {
      const byActor = (
        await list(`?actorId=${recruiterId}&entityId=${candidateId}`).expect(
          200,
        )
      ).body as Page;
      expect(byActor.items).toHaveLength(3);

      const byAction = (
        await list(`?action=PATCH&entityId=${candidateId}`).expect(200)
      ).body as Page;
      expect(byAction.items.map((e) => e.action)).toEqual(['PATCH']);

      const byType = (
        await list(`?entityType=Candidate&entityId=${candidateId}`).expect(200)
      ).body as Page;
      expect(byType.items).toHaveLength(3);

      const today = new Date().toISOString().slice(0, 10);
      const inclusive = (
        await list(`?from=${today}&to=${today}&entityId=${candidateId}`).expect(
          200,
        )
      ).body as Page;
      expect(inclusive.items).toHaveLength(3);
      const past = (
        await list(`?to=2020-01-01&entityId=${candidateId}`).expect(200)
      ).body as Page;
      expect(past.items).toHaveLength(0);
    });

    it('searches by actor name and paginates newest first', async () => {
      const page = (
        await list(
          `?search=${encodeURIComponent('Ngọc Lan')}&limit=2&page=1`,
        ).expect(200)
      ).body as Page;

      expect(page.items).toHaveLength(2);
      expect(page.meta.total).toBeGreaterThanOrEqual(3);
      const times = page.items.map((e) => Date.parse(e.createdAt));
      expect(times[0]).toBeGreaterThanOrEqual(times[1]);
    });

    it.each([
      ['an unknown action', '?action=GET'],
      ['a malformed actor id', '?actorId=nope'],
      ['a malformed date', '?from=soon'],
      ['an unknown sort field', '?sortBy=payload'],
      ['an oversized page', '?limit=999'],
    ])('rejects %s', async (_label, query) => {
      await list(query).expect(400);
    });
  });

  describe('detail', () => {
    it('returns one entry, and 404s or 400s for bad ids', async () => {
      const first = (await list(`?entityId=${candidateId}&limit=1`).expect(200))
        .body as Page;
      const id = first.items[0].id;

      const one = (
        await request(ctx.server)
          .get(`/activity-logs/${id}`)
          .set(bearer(t.admin))
          .expect(200)
      ).body as Entry;
      expect(one.id).toBe(id);
      expect(one.entityId).toBe(candidateId);

      await request(ctx.server)
        .get('/activity-logs/00000000-0000-4000-8000-000000000000')
        .set(bearer(t.admin))
        .expect(404);
      await request(ctx.server)
        .get('/activity-logs/nope')
        .set(bearer(t.admin))
        .expect(400);
    });
  });

  describe('export', () => {
    it('downloads a CSV of the filtered entries with Vietnamese headers', async () => {
      const response = await request(ctx.server)
        .get(`/activity-logs/export?entityId=${candidateId}`)
        .set(bearer(t.admin))
        .expect(200);

      expect(response.headers['content-type']).toMatch(/^text\/csv/);
      expect(response.headers['content-disposition']).toMatch(
        /^attachment; filename="activity-logs_\d{4}-\d{2}-\d{2}\.csv"$/,
      );
      const lines = response.text.trim().split('\r\n');

      expect(response.text.charCodeAt(0)).toBe(0xfeff);
      expect(lines[0].replace('﻿', '')).toBe(
        'Thời gian,Người thực hiện,Thao tác,Đối tượng,Mã đối tượng,Đường dẫn',
      );
      expect(lines).toHaveLength(4);
      expect(response.text).toContain('Nguyễn Ngọc Lan');
      expect(response.text).toContain('/candidates/:id/note');
    });

    it('applies the same filters and validation as the list', async () => {
      await request(ctx.server)
        .get('/activity-logs/export?action=GET')
        .set(bearer(t.admin))
        .expect(400);

      const none = await request(ctx.server)
        .get('/activity-logs/export?to=2020-01-01')
        .set(bearer(t.admin))
        .expect(200);
      expect(none.text.trim().split('\r\n')).toHaveLength(1);
    });
  });
});
