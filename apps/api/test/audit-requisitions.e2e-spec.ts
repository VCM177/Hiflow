import request from 'supertest';
import { auditEvents, AuditEventRow, rowChanges } from './helpers/audit';
import { bearer, createE2eApp, E2eContext } from './helpers/e2e-app';
import { idByCode } from './helpers/factories';
import { createFlow, FlowTokens, loginAll } from './helpers/flow';

const TAG = 'E2E-AUDREQ';

interface Req {
  id: string;
  code: string;
}

describe('Audit trail: requisitions (e2e)', () => {
  let ctx: E2eContext;
  let t: FlowTokens;
  let flow: ReturnType<typeof createFlow>;
  let devId: string;
  let managerId: string;
  let hrId: string;
  let n = 0;

  const idOf = async (email: string): Promise<string> =>
    (
      await ctx.maintenance.query<{ id: string }[]>(
        `SELECT id FROM users WHERE email = $1`,
        [email],
      )
    )[0].id;

  const create = async (extra: object = {}): Promise<Req> =>
    (
      await flow
        .post(t.manager, '/requisitions', {
          title: `${TAG} yêu cầu ${++n}`,
          positionId: devId,
          quantity: 2,
          ...extra,
        })
        .expect(201)
    ).body as Req;

  const act = (token: string, id: string, action: string, body: object = {}) =>
    flow.post(token, `/requisitions/${id}/${action}`, body);

  const events = (id: string, name?: string): Promise<AuditEventRow[]> =>
    auditEvents(ctx, { entityId: id, event: name });

  beforeAll(async () => {
    ctx = await createE2eApp();
    t = await loginAll(ctx);
    flow = createFlow(ctx, t, TAG);
    devId = await idByCode(ctx.maintenance, 'job_positions', 'DEV');
    managerId = await idOf('manager@hiflow.local');
    hrId = await idOf('hr@hiflow.local');
    await flow.cleanup();
  });

  afterAll(async () => {
    await flow.cleanup();
    await ctx.app.close();
  });

  it('records the creation with its code, by the manager, tied to the new row', async () => {
    const req = await create();

    const [event] = await events(req.id);
    expect(event).toMatchObject({
      event: 'REQUISITION_CREATED',
      entity_type: 'Requisition',
      actor_id: managerId,
      actor_role: 'DEPT_MANAGER',
      data: { code: req.code },
    });
    const [change] = await rowChanges(ctx, event);
    expect(change).toMatchObject({
      op: 'I',
      table_name: 'requisitions',
      row_id: req.id,
    });
    expect(change.changes).toMatchObject({ status: 'DRAFT', code: req.code });
  });

  it('records the fields an edit changed, and nothing for an edit that changed none', async () => {
    const req = await create();
    const patch = (body: object) =>
      request(ctx.server)
        .patch(`/requisitions/${req.id}`)
        .set(bearer(t.manager))
        .send(body);

    await patch({ quantity: 5, reason: 'Mở rộng nhóm' }).expect(200);
    await patch({ quantity: 5 }).expect(200);

    const updates = await events(req.id, 'REQUISITION_UPDATED');
    expect(updates).toHaveLength(1);
    expect(updates[0].data).toEqual({
      code: req.code,
      changedFields: ['quantity', 'reason'],
    });
    expect((await rowChanges(ctx, updates[0]))[0].changes).toEqual({
      quantity: [2, 5],
      reason: [null, 'Mở rộng nhóm'],
    });
  });

  it('records submit, approve and the reason of a rejection, in order, by the right people', async () => {
    const req = await create();
    await act(t.manager, req.id, 'submit').expect(200);
    await act(t.hr, req.id, 'reject', { reason: 'Thiếu ngân sách' }).expect(
      200,
    );
    await request(ctx.server)
      .patch(`/requisitions/${req.id}`)
      .set(bearer(t.manager))
      .send({ budgetMax: 90000000 })
      .expect(200);
    await act(t.manager, req.id, 'submit').expect(200);
    await act(t.hr, req.id, 'approve').expect(200);

    const trail = await events(req.id);
    expect(trail.map((e) => [e.event, e.actor_role])).toEqual([
      ['REQUISITION_CREATED', 'DEPT_MANAGER'],
      ['REQUISITION_SUBMITTED', 'DEPT_MANAGER'],
      ['REQUISITION_REJECTED', 'HR_MANAGER'],
      ['REQUISITION_UPDATED', 'DEPT_MANAGER'],
      ['REQUISITION_SUBMITTED', 'DEPT_MANAGER'],
      ['REQUISITION_APPROVED', 'HR_MANAGER'],
    ]);
    expect(trail[2].data).toEqual({
      code: req.code,
      reason: 'Thiếu ngân sách',
    });
    expect(trail[2].actor_id).toBe(hrId);

    // The row change in the same transaction shows the status really moved.
    const approved = await rowChanges(ctx, trail[5]);
    expect(approved[0].changes).toMatchObject({
      status: ['PENDING_APPROVAL', 'APPROVED'],
      approved_by_id: [null, hrId],
    });
  });

  it('records a delete of a draft and keeps the trail after the row is gone', async () => {
    const req = await create();

    await request(ctx.server)
      .delete(`/requisitions/${req.id}`)
      .set(bearer(t.manager))
      .expect(204);

    const deleted = (await events(req.id, 'REQUISITION_DELETED'))[0];
    expect(deleted.data).toEqual({ code: req.code });
    expect((await rowChanges(ctx, deleted))[0]).toMatchObject({
      op: 'D',
      row_id: req.id,
    });
  });

  it('records a close together with the jobs it stopped, in one transaction', async () => {
    const jobId = await flow.openJob();
    const [{ requisition_id: reqId }] = await ctx.maintenance.query<
      { requisition_id: string }[]
    >(`SELECT requisition_id FROM jobs WHERE id = $1`, [jobId]);

    await act(t.hr, reqId, 'close').expect(200);

    const [closed] = await events(reqId, 'REQUISITION_CLOSED');
    expect(closed.actor_id).toBe(hrId);
    const changes = await rowChanges(ctx, closed);
    expect(changes.map((c) => c.table_name).sort()).toEqual([
      'jobs',
      'requisitions',
    ]);
    expect(changes.find((c) => c.table_name === 'jobs')?.changes).toEqual({
      status: ['OPEN', 'CLOSED'],
    });
  });

  it('leaves no event, and no change, for a move that was refused or lost', async () => {
    const req = await create();
    await act(t.manager, req.id, 'submit').expect(200);
    const before = (await events(req.id)).length;

    // Approving from DRAFT is not allowed; a second submit is out of order.
    await act(t.manager, req.id, 'submit').expect(409);
    await act(t.hr, req.id, 'close').expect(409);
    // Two approvals at once: exactly one wins and exactly one event is written.
    const results = await Promise.all([
      act(t.hr, req.id, 'approve'),
      act(t.admin, req.id, 'approve'),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const trail = await events(req.id);
    expect(trail.length).toBe(before + 1);
    expect(trail.at(-1)?.event).toBe('REQUISITION_APPROVED');
  });
});
