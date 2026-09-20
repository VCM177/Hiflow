import request from 'supertest';
import { bearer, createE2eApp, E2eContext, loginAs } from './helpers/e2e-app';

interface Req {
  id: string;
  code: string;
  title: string;
  status: string;
  department: { id: string; name: string } | null;
  position: { id: string; name: string } | null;
  createdBy: { id: string; name: string } | null;
  approvedBy: { id: string; name: string } | null;
  approvedAt: string | null;
  rejectReason: string | null;
  quantity: number;
  budgetMin: number | null;
  budgetMax: number | null;
  expectedStartDate: string | null;
}
interface Page {
  items: Req[];
  meta: { total: number; totalPages: number };
}
interface Evt {
  event: string;
  actor: { name: string } | null;
  note: string | null;
}

const TITLE = 'E2E-REQ';

describe('Requisitions (e2e)', () => {
  let ctx: E2eContext;
  let manager: string;
  let hr: string;
  let admin: string;
  let recruiter: string;
  let interviewer: string;
  let salesId: string;
  let engId: string;
  let devId: string;
  let qaId: string;

  const cleanup = async () => {
    await ctx.dataSource.query(
      `DELETE FROM activity_logs WHERE entity_type = 'Requisition'
         AND entity_id IN (SELECT id::text FROM requisitions WHERE title LIKE '${TITLE}%')`,
    );
    await ctx.dataSource.query(
      `DELETE FROM requisitions WHERE title LIKE '${TITLE}%'`,
    );
  };

  const idOf = async (table: string, code: string) => {
    const rows: { id: string }[] = await ctx.dataSource.query(
      `SELECT id FROM ${table} WHERE code = $1`,
      [code],
    );
    return rows[0].id;
  };

  const make = async (
    label: string,
    token = manager,
    extra: object = {},
  ): Promise<Req> => {
    const response = await request(ctx.server)
      .post('/requisitions')
      .set(bearer(token))
      .send({
        title: `${TITLE} ${label}`,
        positionId: devId,
        quantity: 2,
        ...extra,
      })
      .expect(201);
    return response.body as Req;
  };

  const act = (
    token: string,
    id: string,
    action: 'submit' | 'approve' | 'reject' | 'close',
    body: object = {},
  ) =>
    request(ctx.server)
      .post(`/requisitions/${id}/${action}`)
      .set(bearer(token))
      .send(body);

  const get = (token: string, id: string) =>
    request(ctx.server).get(`/requisitions/${id}`).set(bearer(token));

  beforeAll(async () => {
    ctx = await createE2eApp();
    manager = await loginAs(ctx.server, 'manager@hiflow.local');
    hr = await loginAs(ctx.server, 'hr@hiflow.local');
    admin = await loginAs(ctx.server, 'admin@hiflow.local');
    recruiter = await loginAs(ctx.server, 'recruiter@hiflow.local');
    interviewer = await loginAs(ctx.server, 'interviewer@hiflow.local');
    salesId = await idOf('departments', 'SALES');
    engId = await idOf('departments', 'ENG');
    devId = await idOf('job_positions', 'DEV');
    qaId = await idOf('job_positions', 'QA');
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await ctx.app.close();
  });

  describe('access', () => {
    it('requires authentication', () => {
      return request(ctx.server).get('/requisitions').expect(401);
    });

    it('forbids roles without list permission', () => {
      return request(ctx.server)
        .get('/requisitions')
        .set(bearer(interviewer))
        .expect(403);
    });

    it('forbids creating without create permission (recruiter, HR)', async () => {
      for (const token of [recruiter, hr]) {
        await request(ctx.server)
          .post('/requisitions')
          .set(bearer(token))
          .send({
            title: `${TITLE} nope`,
            positionId: devId,
            quantity: 1,
            departmentId: salesId,
          })
          .expect(403);
      }
    });
  });

  describe('creating', () => {
    it('creates a draft in the manager’s own department with a generated code', async () => {
      const req = await make('own dept');

      expect(req.status).toBe('DRAFT');
      expect(req.code).toMatch(/^REQ-\d{4}-\d{4}$/);
      expect(req.department?.id).toBe(salesId);
      expect(req.createdBy?.name).toBe('Phạm Minh Tuấn');
      expect(req.approvedBy).toBeNull();
    });

    it('never reuses a code', async () => {
      const [a, b] = await Promise.all([make('code a'), make('code b')]);

      expect(a.code).not.toBe(b.code);
    });

    it('stops a manager creating for another department', async () => {
      await request(ctx.server)
        .post('/requisitions')
        .set(bearer(manager))
        .send({
          title: `${TITLE} other dept`,
          positionId: devId,
          quantity: 1,
          departmentId: engId,
        })
        .expect(403);
    });

    it('lets an admin create for any department, but requires one', async () => {
      const req = await make('admin eng', admin, { departmentId: engId });
      expect(req.department?.id).toBe(engId);

      await request(ctx.server)
        .post('/requisitions')
        .set(bearer(admin))
        .send({ title: `${TITLE} no dept`, positionId: devId, quantity: 1 })
        .expect(400);
    });

    it.each([
      ['a zero quantity', { quantity: 0 }],
      ['a huge quantity', { quantity: 100000 }],
      ['a fractional quantity', { quantity: 1.5 }],
      ['a blank title', { title: '   ' }],
      ['a malformed position id', { positionId: 'nope' }],
      ['a negative budget', { budgetMin: -1 }],
      ['a malformed start date', { expectedStartDate: 'soon' }],
      ['an unexpected field', { status: 'APPROVED' }],
    ])('rejects %s', async (_label, override) => {
      await request(ctx.server)
        .post('/requisitions')
        .set(bearer(manager))
        .send({
          title: `${TITLE} bad`,
          positionId: devId,
          quantity: 1,
          ...override,
        })
        .expect(400);
    });

    it('rejects a maximum budget below the minimum, and an unknown position', async () => {
      await request(ctx.server)
        .post('/requisitions')
        .set(bearer(manager))
        .send({
          title: `${TITLE} budget`,
          positionId: devId,
          quantity: 1,
          budgetMin: 20000000,
          budgetMax: 10000000,
        })
        .expect(400);

      await request(ctx.server)
        .post('/requisitions')
        .set(bearer(manager))
        .send({
          title: `${TITLE} pos`,
          positionId: '00000000-0000-4000-8000-000000000000',
          quantity: 1,
        })
        .expect(400);
    });

    it('stores budget and start date, keeping only the date part', async () => {
      const req = await make('money', manager, {
        budgetMin: 10000000,
        budgetMax: 20000000,
        expectedStartDate: '2026-11-01T09:30:00.000Z',
      });

      expect(req.budgetMin).toBe(10000000);
      expect(req.budgetMax).toBe(20000000);
      expect(req.expectedStartDate).toBe('2026-11-01');
    });
  });

  describe('visibility', () => {
    let engReq: Req;
    let salesReq: Req;

    beforeAll(async () => {
      engReq = await make('vis eng', admin, { departmentId: engId });
      salesReq = await make('vis sales');
    });

    it('shows a manager only their own department', async () => {
      const page = (
        await request(ctx.server)
          .get(`/requisitions?search=${TITLE}&limit=100`)
          .set(bearer(manager))
          .expect(200)
      ).body as Page;

      const ids = page.items.map((r) => r.id);
      expect(ids).toContain(salesReq.id);
      expect(ids).not.toContain(engReq.id);
      expect(page.items.every((r) => r.department?.id === salesId)).toBe(true);
    });

    it('answers 404, not 403, for another department’s requisition', async () => {
      await get(manager, engReq.id).expect(404);
      await request(ctx.server)
        .get(`/requisitions/${engReq.id}/history`)
        .set(bearer(manager))
        .expect(404);
      await act(manager, engReq.id, 'submit').expect(404);
    });

    it('shows HR and admin every department', async () => {
      const page = (
        await request(ctx.server)
          .get(`/requisitions?search=${TITLE}&limit=100`)
          .set(bearer(hr))
          .expect(200)
      ).body as Page;

      const ids = page.items.map((r) => r.id);
      expect(ids).toEqual(expect.arrayContaining([engReq.id, salesReq.id]));
      await get(hr, engReq.id).expect(200);
    });
  });

  describe('listing', () => {
    beforeAll(async () => {
      for (const n of ['list 1', 'list 2', 'list 3']) await make(n);
    });

    it('filters, searches, sorts and paginates', async () => {
      const first = (
        await request(ctx.server)
          .get(
            `/requisitions?search=${encodeURIComponent(`${TITLE} list`)}&limit=2&page=1&sortBy=title&sortDir=asc`,
          )
          .set(bearer(hr))
          .expect(200)
      ).body as Page;

      expect(first.items.map((r) => r.title)).toEqual([
        `${TITLE} list 1`,
        `${TITLE} list 2`,
      ]);
      expect(first.meta).toMatchObject({ total: 3, totalPages: 2 });

      const byStatus = (
        await request(ctx.server)
          .get(`/requisitions?search=${TITLE}&status=APPROVED`)
          .set(bearer(hr))
          .expect(200)
      ).body as Page;
      expect(byStatus.items.every((r) => r.status === 'APPROVED')).toBe(true);
    });

    it('finds a requisition by its code', async () => {
      const req = await make('by code');
      const page = (
        await request(ctx.server)
          .get(`/requisitions?search=${req.code}`)
          .set(bearer(hr))
          .expect(200)
      ).body as Page;

      expect(page.items.map((r) => r.id)).toEqual([req.id]);
    });

    it('filters by created date, treating "to" as the whole day', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000)
        .toISOString()
        .slice(0, 10);
      const url = (q: string) =>
        request(ctx.server)
          .get(`/requisitions?search=${TITLE}&limit=100&${q}`)
          .set(bearer(hr));

      const inclusive = (
        await url(`createdFrom=${today}&createdTo=${today}`).expect(200)
      ).body as Page;
      const past = (await url(`createdTo=${yesterday}`).expect(200))
        .body as Page;

      expect(inclusive.items.length).toBeGreaterThan(0);
      expect(past.items).toHaveLength(0);
    });

    it('rejects bad query values', async () => {
      for (const q of [
        'status=WIZARD',
        'sortBy=passwordHash',
        'createdFrom=yesterday',
        'limit=0',
      ]) {
        await request(ctx.server)
          .get(`/requisitions?${q}`)
          .set(bearer(hr))
          .expect(400);
      }
    });
  });

  describe('approval flow', () => {
    it('follows draft → pending → rejected → resubmitted → approved → closed', async () => {
      const req = await make('flow');

      // A draft cannot be approved directly.
      const skipped = await act(hr, req.id, 'approve').expect(409);
      expect((skipped.body as { message: string }).message).toMatch(
        /Nháp.*Đã duyệt/,
      );

      // Submit.
      expect(
        ((await act(manager, req.id, 'submit').expect(200)).body as Req).status,
      ).toBe('PENDING_APPROVAL');

      // Locked while pending: no edit, no delete.
      await request(ctx.server)
        .patch(`/requisitions/${req.id}`)
        .set(bearer(manager))
        .send({ title: `${TITLE} edited` })
        .expect(409);
      await request(ctx.server)
        .delete(`/requisitions/${req.id}`)
        .set(bearer(manager))
        .expect(409);

      // The manager cannot approve their own request; the reason is mandatory.
      await act(manager, req.id, 'approve').expect(403);
      await act(hr, req.id, 'reject', {}).expect(400);
      await act(hr, req.id, 'reject', { reason: '   ' }).expect(400);

      const rejected = (
        await act(hr, req.id, 'reject', { reason: 'Ngân sách chưa đủ' }).expect(
          200,
        )
      ).body as Req;
      expect(rejected.status).toBe('REJECTED');
      expect(rejected.rejectReason).toBe('Ngân sách chưa đủ');

      // Fix and resubmit; the old rejection reason is cleared.
      const fixed = (
        await request(ctx.server)
          .patch(`/requisitions/${req.id}`)
          .set(bearer(manager))
          .send({ quantity: 1, positionId: qaId })
          .expect(200)
      ).body as Req;
      expect(fixed.quantity).toBe(1);
      expect(fixed.position?.id).toBe(qaId);

      const resubmitted = (await act(manager, req.id, 'submit').expect(200))
        .body as Req;
      expect(resubmitted.status).toBe('PENDING_APPROVAL');
      expect(resubmitted.rejectReason).toBeNull();

      // Approve records who and when.
      const approved = (await act(hr, req.id, 'approve').expect(200))
        .body as Req;
      expect(approved.status).toBe('APPROVED');
      expect(approved.approvedBy?.name).toBe('Lê Thu Hà');
      expect(approved.approvedAt).not.toBeNull();

      // Approved is final except for closing; a second approval is refused.
      await act(hr, req.id, 'approve').expect(409);
      await request(ctx.server)
        .patch(`/requisitions/${req.id}`)
        .set(bearer(manager))
        .send({ title: `${TITLE} late` })
        .expect(409);

      // Only HR/admin may close.
      await act(manager, req.id, 'close').expect(403);
      expect(
        ((await act(hr, req.id, 'close').expect(200)).body as Req).status,
      ).toBe('CLOSED');
      await act(hr, req.id, 'close').expect(409);
    });

    it('lets only one of two simultaneous approvals win', async () => {
      const req = await make('race');
      await act(manager, req.id, 'submit').expect(200);

      const results = await Promise.all([
        act(hr, req.id, 'approve'),
        act(admin, req.id, 'approve'),
      ]);
      const statuses = results.map((r) => r.status).sort();

      expect(statuses).toEqual([200, 409]);
      expect(((await get(hr, req.id).expect(200)).body as Req).status).toBe(
        'APPROVED',
      );
    });

    it('lets a reject and an approve race without both taking effect', async () => {
      const req = await make('race 2');
      await act(manager, req.id, 'submit').expect(200);

      const results = await Promise.all([
        act(hr, req.id, 'approve'),
        act(hr, req.id, 'reject', { reason: 'Không phù hợp' }),
      ]);

      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    });

    it('only deletes a draft', async () => {
      const draft = await make('delete me');
      await request(ctx.server)
        .delete(`/requisitions/${draft.id}`)
        .set(bearer(manager))
        .expect(204);
      await get(manager, draft.id).expect(404);
    });
  });

  describe('history', () => {
    it('records the timeline with actors and the rejection reason', async () => {
      const req = await make('timeline');
      await act(manager, req.id, 'submit').expect(200);
      await act(hr, req.id, 'reject', { reason: 'Cần bổ sung lý do' }).expect(
        200,
      );
      await act(manager, req.id, 'submit').expect(200);
      await act(hr, req.id, 'approve').expect(200);

      // The audit write is fire-and-forget, so wait for it to land.
      let events: Evt[] = [];
      for (let i = 0; i < 40 && events.length < 5; i++) {
        events = (
          await request(ctx.server)
            .get(`/requisitions/${req.id}/history`)
            .set(bearer(hr))
            .expect(200)
        ).body as Evt[];
        if (events.length < 5) await new Promise((r) => setTimeout(r, 50));
      }

      expect(events.map((e) => e.event)).toEqual([
        'CREATED',
        'SUBMITTED',
        'REJECTED',
        'SUBMITTED',
        'APPROVED',
      ]);
      expect(events.map((e) => e.actor?.name)).toEqual([
        'Phạm Minh Tuấn',
        'Phạm Minh Tuấn',
        'Lê Thu Hà',
        'Phạm Minh Tuấn',
        'Lê Thu Hà',
      ]);
      expect(events[2].note).toBe('Cần bổ sung lý do');
      expect(events[0].note).toBeNull();
    });
  });

  describe('editing', () => {
    it('updates only the supplied fields and validates the merged budget', async () => {
      const req = await make('edit', manager, {
        budgetMin: 5000000,
        budgetMax: 9000000,
      });

      const updated = (
        await request(ctx.server)
          .patch(`/requisitions/${req.id}`)
          .set(bearer(manager))
          .send({ title: `${TITLE} edit v2` })
          .expect(200)
      ).body as Req;
      expect(updated.title).toBe(`${TITLE} edit v2`);
      expect(updated.budgetMin).toBe(5000000);

      // Lowering the max below the stored min is caught even though min was not resent.
      await request(ctx.server)
        .patch(`/requisitions/${req.id}`)
        .set(bearer(manager))
        .send({ budgetMax: 1000000 })
        .expect(400);
    });

    it('cannot move a requisition to another department', async () => {
      const req = await make('no move');

      await request(ctx.server)
        .patch(`/requisitions/${req.id}`)
        .set(bearer(manager))
        .send({ departmentId: engId })
        .expect(400);
    });
  });
});
