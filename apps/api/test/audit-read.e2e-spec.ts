import request from 'supertest';
import { auditEvents, dbNow } from './helpers/audit';
import { bearer, createE2eApp, E2eContext } from './helpers/e2e-app';
import { idByCode } from './helpers/factories';
import { createFlow, FlowTokens, loginAll } from './helpers/flow';

const TAG = 'E2E-AUDREAD';

interface EventView {
  id: string;
  event: string;
  label: string;
  entityType: string;
  entityId: string | null;
  actor: { id: string | null; name: string | null; role: string | null };
  origin: string;
  txId: string;
  data: Record<string, unknown>;
  occurredAt: string;
}
interface Page {
  items: EventView[];
  meta: { total: number; totalPages: number; page: number; limit: number };
}
interface Detail extends EventView {
  rowChanges: { op: string; tableName: string; rowId: string }[];
}

describe('Audit trail: reading it back (e2e)', () => {
  let ctx: E2eContext;
  let t: FlowTokens;
  let flow: ReturnType<typeof createFlow>;
  let reqId: string;
  let hrId: string;

  const get = (token: string, path: string) =>
    request(ctx.server).get(path).set(bearer(token));
  const list = async (query: string): Promise<Page> =>
    (await get(t.admin, `/audit-events?${query}`).expect(200)).body as Page;

  beforeAll(async () => {
    ctx = await createE2eApp();
    t = await loginAll(ctx);
    flow = createFlow(ctx, t, TAG);
    hrId = (
      await ctx.maintenance.query<{ id: string }[]>(
        `SELECT id FROM users WHERE email = 'hr@hiflow.local'`,
      )
    )[0].id;
    await flow.cleanup();

    const devId = await idByCode(ctx.maintenance, 'job_positions', 'DEV');
    reqId = (
      (
        await flow
          .post(t.manager, '/requisitions', {
            title: `${TAG} yêu cầu`,
            positionId: devId,
            quantity: 1,
          })
          .expect(201)
      ).body as { id: string }
    ).id;
    await flow.post(t.manager, `/requisitions/${reqId}/submit`).expect(200);
    await flow
      .post(t.hr, `/requisitions/${reqId}/reject`, {
        reason: 'Thiếu ngân sách',
      })
      .expect(200);
  });

  afterAll(async () => {
    await flow.cleanup();
    await ctx.app.close();
  });

  describe('who may read it', () => {
    it('lets only the admin in, and asks anonymous callers to log in', async () => {
      await get(t.admin, '/audit-events').expect(200);
      for (const token of [t.hr, t.recruiter, t.manager, t.interviewer]) {
        await get(token, '/audit-events').expect(403);
        await get(token, '/audit-events/export').expect(403);
      }
      await request(ctx.server).get('/audit-events').expect(401);
      await request(ctx.server).get('/audit-events/export').expect(401);
    });

    it('rejects a filter it does not understand instead of ignoring it', async () => {
      for (const query of [
        'event=NOT_AN_EVENT',
        'origin=elsewhere',
        'entityId=nope',
        'actorId=nope',
        'from=yesterday',
        'sortBy=event',
        'limit=500',
      ]) {
        await get(t.admin, `/audit-events?${query}`).expect(400);
      }
    });
  });

  describe('the list', () => {
    it('shows an event with a Vietnamese label and the actor as they were', async () => {
      const page = await list(`entityId=${reqId}&sortDir=asc`);

      expect(page.items.map((e) => e.event)).toEqual([
        'REQUISITION_CREATED',
        'REQUISITION_SUBMITTED',
        'REQUISITION_REJECTED',
      ]);
      expect(page.items[0]).toMatchObject({
        label: 'Tạo yêu cầu tuyển dụng',
        entityType: 'Requisition',
        origin: 'e2e',
        actor: { role: 'DEPT_MANAGER' },
      });
      expect(page.items[2].data).toMatchObject({ reason: 'Thiếu ngân sách' });
      expect(page.meta.total).toBe(3);
    });

    it('filters by event, actor, entity type and origin together', async () => {
      const byEvent = await list(
        `entityId=${reqId}&event=REQUISITION_REJECTED`,
      );
      expect(byEvent.items.map((e) => e.event)).toEqual([
        'REQUISITION_REJECTED',
      ]);

      const byActor = await list(`entityId=${reqId}&actorId=${hrId}`);
      expect(byActor.items.map((e) => e.event)).toEqual([
        'REQUISITION_REJECTED',
      ]);

      const mixed = await list(
        `entityId=${reqId}&entityType=Requisition&origin=e2e`,
      );
      expect(mixed.meta.total).toBe(3);
      const none = await list(`entityId=${reqId}&origin=seed`);
      expect(none.items).toEqual([]);
    });

    it('searches by the name the actor had, and sorts newest first by default', async () => {
      const name = (
        await ctx.maintenance.query<{ full_name: string }[]>(
          `SELECT full_name FROM users WHERE id = $1`,
          [hrId],
        )
      )[0].full_name;

      const found = await list(
        `entityId=${reqId}&search=${encodeURIComponent(name)}`,
      );
      expect(found.items.map((e) => e.event)).toEqual(['REQUISITION_REJECTED']);

      const newestFirst = await list(`entityId=${reqId}`);
      const times = newestFirst.items.map((e) => Date.parse(e.occurredAt));
      expect([...times].sort((a, b) => b - a)).toEqual(times);
    });

    it('limits by date, by whole days', async () => {
      const today = (await dbNow(ctx)).toISOString().slice(0, 10);

      expect(
        (await list(`entityId=${reqId}&from=${today}&to=${today}`)).meta.total,
      ).toBe(3);
      expect((await list(`entityId=${reqId}&to=2000-01-01`)).items).toEqual([]);
    });

    it('pages through the results', async () => {
      const first = await list(`entityId=${reqId}&limit=2&page=1&sortDir=asc`);
      const second = await list(`entityId=${reqId}&limit=2&page=2&sortDir=asc`);

      expect(first.items).toHaveLength(2);
      expect(second.items).toHaveLength(1);
      expect(first.meta).toMatchObject({ total: 3, totalPages: 2 });
      expect(second.items[0].event).toBe('REQUISITION_REJECTED');
    });
  });

  describe('one event', () => {
    it('shows what the database saw change in the same transaction', async () => {
      const [rejected] = await auditEvents(ctx, {
        entityId: reqId,
        event: 'REQUISITION_REJECTED',
      });
      const id = (await list(`entityId=${reqId}&event=REQUISITION_REJECTED`))
        .items[0].id;

      const detail = (await get(t.admin, `/audit-events/${id}`).expect(200))
        .body as Detail;

      expect(detail.txId).toBe(rejected.tx_id);
      expect(detail.rowChanges).toEqual([
        expect.objectContaining({
          op: 'U',
          tableName: 'requisitions',
          rowId: reqId,
          changes: expect.objectContaining({
            status: ['PENDING_APPROVAL', 'REJECTED'],
          }) as unknown,
        }) as unknown,
      ]);
    });

    it('answers 404 for an unknown event and 400 for something that is not an id', async () => {
      await get(
        t.admin,
        '/audit-events/00000000-0000-4000-8000-000000000000',
      ).expect(404);
      await get(t.admin, '/audit-events/nope').expect(400);
    });
  });

  describe('exporting it', () => {
    it('hands over a CSV that Excel reads as UTF-8 with Vietnamese headings, honouring the filter', async () => {
      const response = await get(
        t.admin,
        `/audit-events/export?entityId=${reqId}`,
      ).expect(200);
      const csv = response.text;

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toMatch(
        /attachment; filename="audit-events_\d{4}-\d{2}-\d{2}\.csv"/,
      );
      expect(csv.startsWith('﻿')).toBe(true);
      expect(csv).toContain('Thời gian,Hành động,Mã sự kiện,Người thực hiện');
      expect(csv).toContain('Từ chối yêu cầu tuyển dụng');
      expect(csv.trim().split('\n')).toHaveLength(1 + 3);
    });

    it('records that it was exported, by whom, with which filter and how many rows', async () => {
      const since = await dbNow(ctx);

      await get(
        t.admin,
        `/audit-events/export?entityId=${reqId}&origin=e2e`,
      ).expect(200);

      const [event] = await auditEvents(ctx, {
        event: 'AUDIT_LOG_EXPORTED',
        since,
      });
      expect(event).toMatchObject({
        entity_type: 'AuditLog',
        entity_id: null,
        actor_role: 'ADMIN',
        data: { filters: { entityId: reqId, origin: 'e2e' }, rows: 3 },
      });
    });

    it('records nothing for an export that was refused', async () => {
      const since = await dbNow(ctx);

      await get(t.hr, `/audit-events/export?entityId=${reqId}`).expect(403);

      expect(
        await auditEvents(ctx, { event: 'AUDIT_LOG_EXPORTED', since }),
      ).toEqual([]);
    });
  });

  describe('reports and the requisition history', () => {
    it('records who exported a report, with its filters and size, but not who read one', async () => {
      const since = await dbNow(ctx);

      await get(t.hr, '/reports/job-results?from=2026-01-01').expect(200);
      expect(
        await auditEvents(ctx, { event: 'REPORT_EXPORTED', since }),
      ).toEqual([]);

      await get(t.hr, '/reports/job-results/export?from=2026-01-01').expect(
        200,
      );

      const [event] = await auditEvents(ctx, {
        event: 'REPORT_EXPORTED',
        since,
      });
      expect(event).toMatchObject({
        entity_type: 'Report',
        actor_id: hrId,
        actor_role: 'HR_MANAGER',
      });
      expect(event.data).toMatchObject({
        report: 'job-results',
        filters: { from: '2026-01-01' },
      });
      expect(typeof event.data.rows).toBe('number');
    });

    it('builds a requisition’s timeline from the trail, with the reason of a rejection', async () => {
      const timeline = (
        await get(t.manager, `/requisitions/${reqId}/history`).expect(200)
      ).body as {
        event: string;
        actor: { id: string; name: string } | null;
        note: string | null;
      }[];

      expect(timeline.map((e) => e.event)).toEqual([
        'CREATED',
        'SUBMITTED',
        'REJECTED',
      ]);
      expect(timeline[2]).toMatchObject({
        actor: { id: hrId },
        note: 'Thiếu ngân sách',
      });
      expect(timeline[0].note).toBeNull();
    });
  });
});
