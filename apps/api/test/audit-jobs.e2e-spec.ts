import request from 'supertest';
import { auditEvents, rowChanges } from './helpers/audit';
import { bearer, createE2eApp, E2eContext } from './helpers/e2e-app';
import { approvedRequisition, idByCode } from './helpers/factories';
import { createFlow, FlowTokens, loginAll } from './helpers/flow';

const TAG = 'E2E-AUDJOB';

describe('Audit trail: jobs (e2e)', () => {
  let ctx: E2eContext;
  let t: FlowTokens;
  let flow: ReturnType<typeof createFlow>;
  let devId: string;
  let recruiterId: string;
  let n = 0;

  const newJob = async (): Promise<string> => {
    const req = await approvedRequisition(
      ctx.server,
      { creator: t.manager, approver: t.hr },
      { title: `${TAG} req ${++n}`, positionId: devId, quantity: 5 },
    );
    return (
      (
        await flow
          .post(t.recruiter, '/jobs', { requisitionId: req.id })
          .expect(201)
      ).body as { id: string }
    ).id;
  };

  const trail = (id: string) => auditEvents(ctx, { entityId: id });

  beforeAll(async () => {
    ctx = await createE2eApp();
    t = await loginAll(ctx);
    flow = createFlow(ctx, t, TAG);
    devId = await idByCode(ctx.maintenance, 'job_positions', 'DEV');
    recruiterId = (
      await ctx.maintenance.query<{ id: string }[]>(
        `SELECT id FROM users WHERE email = 'recruiter@hiflow.local'`,
      )
    )[0].id;
    await flow.cleanup();
  });

  afterAll(async () => {
    await flow.cleanup();
    await ctx.app.close();
  });

  it('records the creation by the recruiter, with the row it inserted', async () => {
    const id = await newJob();

    const [event] = await trail(id);
    expect(event).toMatchObject({
      event: 'JOB_CREATED',
      entity_type: 'Job',
      actor_id: recruiterId,
      actor_role: 'RECRUITER',
      data: {},
    });
    const [change] = await rowChanges(ctx, event);
    expect(change).toMatchObject({ op: 'I', table_name: 'jobs', row_id: id });
    expect(change.changes).toMatchObject({ status: 'DRAFT' });
  });

  it('records the fields an edit changed, and nothing for one that changed none', async () => {
    const id = await newJob();
    const patch = (body: object) =>
      request(ctx.server)
        .patch(`/jobs/${id}`)
        .set(bearer(t.recruiter))
        .send(body);

    await patch({ location: 'Hà Nội', salaryMin: 15000000 }).expect(200);
    await patch({ location: 'Hà Nội' }).expect(200);

    const updates = (await trail(id)).filter((e) => e.event === 'JOB_UPDATED');
    expect(updates).toHaveLength(1);
    expect(updates[0].data).toEqual({
      changedFields: ['salaryMin', 'location'],
    });
    expect((await rowChanges(ctx, updates[0]))[0].changes).toMatchObject({
      location: [null, 'Hà Nội'],
    });
  });

  it('records publishing and stopping, each with the status the row really moved through', async () => {
    const id = await newJob();

    await flow.post(t.recruiter, `/jobs/${id}/publish`).expect(200);
    await flow.post(t.recruiter, `/jobs/${id}/stop`).expect(200);

    const events = await trail(id);
    expect(events.map((e) => e.event)).toEqual([
      'JOB_CREATED',
      'JOB_PUBLISHED',
      'JOB_STOPPED',
    ]);
    expect((await rowChanges(ctx, events[1]))[0].changes).toMatchObject({
      status: ['DRAFT', 'OPEN'],
    });
    expect((await rowChanges(ctx, events[2]))[0].changes).toEqual({
      status: ['OPEN', 'CLOSED'],
    });
  });

  it('records the removal of a draft', async () => {
    const id = await newJob();

    await request(ctx.server)
      .delete(`/jobs/${id}`)
      .set(bearer(t.recruiter))
      .expect(204);

    const deleted = (await trail(id)).at(-1)!;
    expect(deleted).toMatchObject({
      event: 'JOB_DELETED',
      actor_id: recruiterId,
    });
    expect((await rowChanges(ctx, deleted))[0]).toMatchObject({
      op: 'D',
      row_id: id,
    });
  });

  it('writes one event when two people publish at once, and none for a refused move', async () => {
    const id = await newJob();

    const results = await Promise.all([
      flow.post(t.recruiter, `/jobs/${id}/publish`),
      flow.post(t.admin, `/jobs/${id}/publish`),
    ]);
    await request(ctx.server)
      .delete(`/jobs/${id}`)
      .set(bearer(t.recruiter))
      .expect(409);

    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      (await trail(id)).filter((e) => e.event === 'JOB_PUBLISHED'),
    ).toHaveLength(1);
    expect((await trail(id)).some((e) => e.event === 'JOB_DELETED')).toBe(
      false,
    );
  });
});
