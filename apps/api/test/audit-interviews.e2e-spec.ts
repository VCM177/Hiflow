import request from 'supertest';
import { auditEvents, rowChanges } from './helpers/audit';
import { bearer, createE2eApp, E2eContext } from './helpers/e2e-app';
import { createFlow, FlowTokens, loginAll } from './helpers/flow';

const TAG = 'E2E-AUDIVW';

describe('Audit trail: interviews (e2e)', () => {
  let ctx: E2eContext;
  let t: FlowTokens;
  let flow: ReturnType<typeof createFlow>;
  let jobId: string;
  let recruiterId: string;
  let interviewerId: string;
  let hrId: string;

  const idOf = async (email: string) =>
    (
      await ctx.maintenance.query<{ id: string }[]>(
        `SELECT id FROM users WHERE email = $1`,
        [email],
      )
    )[0].id;
  const trail = (id: string) => auditEvents(ctx, { entityId: id });
  const scheduled = async (interviewer?: string) => {
    const appId = await flow.toInterviewStage(jobId);
    return flow.scheduleInterview(appId, { interviewerId: interviewer });
  };

  beforeAll(async () => {
    ctx = await createE2eApp();
    t = await loginAll(ctx);
    flow = createFlow(ctx, t, TAG);
    recruiterId = await idOf('recruiter@hiflow.local');
    interviewerId = await idOf('interviewer@hiflow.local');
    hrId = await idOf('hr@hiflow.local');
    await flow.cleanup();
    jobId = await flow.openJob();
  });

  afterAll(async () => {
    await flow.cleanup();
    await ctx.app.close();
  });

  it('records scheduling by the recruiter, with the interview row it inserted', async () => {
    const ivw = await scheduled();

    const [event] = await trail(ivw.id);
    expect(event).toMatchObject({
      event: 'INTERVIEW_SCHEDULED',
      entity_type: 'Interview',
      actor_id: recruiterId,
      actor_role: 'RECRUITER',
    });
    const [change] = await rowChanges(ctx, event);
    expect(change).toMatchObject({ op: 'I', table_name: 'interviews' });
    expect(change.changes).toMatchObject({
      interviewer_id: interviewerId,
      result: 'PENDING',
      round: 1,
    });
  });

  it('records which fields a reschedule changed, and nothing for one that changed none', async () => {
    const ivw = await scheduled();
    const patch = (body: object) =>
      request(ctx.server)
        .patch(`/interviews/${ivw.id}`)
        .set(bearer(t.recruiter))
        .send(body);

    await patch({ interviewerId: hrId, scheduledAt: flow.futureSlot() }).expect(
      200,
    );
    await patch({ interviewerId: hrId }).expect(200);

    const updates = (await trail(ivw.id)).filter(
      (e) => e.event === 'INTERVIEW_UPDATED',
    );
    expect(updates).toHaveLength(1);
    expect(updates[0].data).toEqual({
      changedFields: ['scheduledAt', 'interviewerId'],
    });
    expect((await rowChanges(ctx, updates[0]))[0].changes).toMatchObject({
      interviewer_id: [interviewerId, hrId],
    });
  });

  it('records a cancellation, tied to the result moving from pending to cancelled', async () => {
    const ivw = await scheduled();

    await flow.post(t.recruiter, `/interviews/${ivw.id}/cancel`).expect(200);

    const cancelled = (await trail(ivw.id)).at(-1)!;
    expect(cancelled).toMatchObject({
      event: 'INTERVIEW_CANCELLED',
      actor_id: recruiterId,
      data: { reason: null },
    });
    expect((await rowChanges(ctx, cancelled))[0].changes).toEqual({
      result: ['PENDING', 'CANCELLED'],
    });
  });

  it('records the result by the interviewer, and keeps the feedback out of the event', async () => {
    const ivw = await scheduled();

    await flow
      .post(t.interviewer, `/interviews/${ivw.id}/result`, {
        result: 'FAILED',
        feedback: 'Chưa đủ kinh nghiệm',
      })
      .expect(200);

    const recorded = (await trail(ivw.id)).at(-1)!;
    expect(recorded).toMatchObject({
      event: 'INTERVIEW_RESULT_RECORDED',
      actor_id: interviewerId,
      actor_role: 'INTERVIEWER',
      data: { result: 'FAILED' },
    });
    expect(JSON.stringify(recorded)).not.toContain('kinh nghiệm');
    // The feedback itself is data of the row, where the trigger saw it.
    expect((await rowChanges(ctx, recorded))[0].changes).toEqual({
      result: ['PENDING', 'FAILED'],
      feedback: [null, 'Chưa đủ kinh nghiệm'],
    });
  });

  it('records a result an HR manager gives for their own interview, and none for someone else’s', async () => {
    const own = await scheduled(hrId);
    const theirs = await scheduled();

    await flow
      .post(t.hr, `/interviews/${theirs.id}/result`, { result: 'PASSED' })
      .expect(403);
    await flow
      .post(t.hr, `/interviews/${own.id}/result`, { result: 'PASSED' })
      .expect(200);

    expect((await trail(theirs.id)).map((e) => e.event)).toEqual([
      'INTERVIEW_SCHEDULED',
    ]);
    expect((await trail(own.id)).at(-1)).toMatchObject({
      event: 'INTERVIEW_RESULT_RECORDED',
      actor_id: hrId,
      actor_role: 'HR_MANAGER',
    });
  });

  it('writes one event when two decisions arrive together', async () => {
    const ivw = await scheduled();

    const outcomes = await Promise.all([
      flow.post(t.interviewer, `/interviews/${ivw.id}/result`, {
        result: 'PASSED',
      }),
      flow.post(t.admin, `/interviews/${ivw.id}/result`, {
        result: 'FAILED',
        feedback: 'Không phù hợp',
      }),
    ]);

    expect(outcomes.map((o) => o.status).sort()).toEqual([200, 409]);
    expect(
      (await trail(ivw.id)).filter(
        (e) => e.event === 'INTERVIEW_RESULT_RECORDED',
      ),
    ).toHaveLength(1);
  });
});
