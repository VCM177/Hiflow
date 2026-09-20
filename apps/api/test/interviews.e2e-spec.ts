import request from 'supertest';
import { bearer, createE2eApp, E2eContext } from './helpers/e2e-app';
import {
  createFlow,
  FlowTokens,
  loginAll,
  userIdByEmail,
} from './helpers/flow';

interface Ivw {
  id: string;
  round: number;
  result: string;
  feedback: string | null;
  scheduledAt: string;
  interviewer: { id: string; name: string } | null;
  application: {
    id: string;
    candidate: { fullName: string } | null;
    job: { title: string } | null;
  } | null;
}
interface Page {
  items: Ivw[];
  meta: { total: number; totalPages: number };
}

const MINUTE = 60_000;
const plus = (iso: string, minutes: number) =>
  new Date(new Date(iso).getTime() + minutes * MINUTE).toISOString();

describe('Interviews (e2e)', () => {
  let ctx: E2eContext;
  let t: FlowTokens;
  let flow: ReturnType<typeof createFlow>;
  let interviewerId: string;
  let hrId: string;
  let jobId: string;

  const get = (token: string, path: string) =>
    request(ctx.server).get(path).set(bearer(token));
  const patch = (token: string, id: string, body: object) =>
    request(ctx.server)
      .patch(`/interviews/${id}`)
      .set(bearer(token))
      .send(body);
  const create = (body: object, token = () => t.recruiter) =>
    request(ctx.server).post('/interviews').set(bearer(token())).send(body);
  const result = (token: string, id: string, body: object) =>
    flow.post(token, `/interviews/${id}/result`, body);

  beforeAll(async () => {
    ctx = await createE2eApp();
    t = await loginAll(ctx);
    flow = createFlow(ctx, t, 'E2E-IVW');
    interviewerId = await userIdByEmail(ctx, 'interviewer@hiflow.local');
    hrId = await userIdByEmail(ctx, 'hr@hiflow.local');
    await flow.cleanup();
    jobId = await flow.openJob();
  });

  afterAll(async () => {
    await flow.cleanup();
    await ctx.app.close();
  });

  describe('access', () => {
    it('requires authentication', () =>
      request(ctx.server).get('/interviews').expect(401));

    it('forbids a role without interview permissions (department manager)', () =>
      get(t.manager, '/interviews').expect(403));

    it('lets HR read the schedule but not create', async () => {
      await get(t.hr, '/interviews').expect(200);
      const appId = await flow.toInterviewStage(jobId);
      await create(
        { applicationId: appId, interviewerId, scheduledAt: flow.futureSlot() },
        () => t.hr,
      ).expect(403);
    });
  });

  describe('scheduling', () => {
    it('creates a pending interview in round 1', async () => {
      const appId = await flow.toInterviewStage(jobId);
      const at = flow.futureSlot();

      const ivw = (
        await create({
          applicationId: appId,
          interviewerId,
          scheduledAt: at,
        }).expect(201)
      ).body as Ivw;

      expect(ivw).toMatchObject({
        round: 1,
        result: 'PENDING',
        feedback: null,
      });
      expect(new Date(ivw.scheduledAt).toISOString()).toBe(at);
      expect(ivw.interviewer?.id).toBe(interviewerId);
      expect(ivw.application?.id).toBe(appId);
    });

    it('only schedules for an application in the interview stage', async () => {
      const fresh = await flow.application(jobId);
      const screening = await flow.application(jobId);
      await flow.move(screening, 'SCREENING').expect(200);

      for (const appId of [fresh, screening]) {
        const response = await create({
          applicationId: appId,
          interviewerId,
          scheduledAt: flow.futureSlot(),
        }).expect(409);
        expect((response.body as { message: string }).message).toMatch(
          /Phỏng vấn/,
        );
      }
    });

    it('allows one open interview per application at a time, then numbers the next round', async () => {
      const appId = await flow.toInterviewStage(jobId);
      const first = await flow.scheduleInterview(appId);

      const blocked = await create({
        applicationId: appId,
        interviewerId,
        scheduledAt: flow.futureSlot(),
      }).expect(409);
      expect((blocked.body as { message: string }).message).toMatch(
        /chưa có kết quả/,
      );

      await result(t.interviewer, first.id, { result: 'PASSED' }).expect(200);
      const second = await flow.scheduleInterview(appId);
      expect(second.round).toBe(2);
    });

    it('refuses an explicit round that already has an active interview', async () => {
      const appId = await flow.toInterviewStage(jobId);
      const first = await flow.scheduleInterview(appId, { round: 3 });
      await result(t.interviewer, first.id, { result: 'PASSED' }).expect(200);

      await create({
        applicationId: appId,
        interviewerId,
        scheduledAt: flow.futureSlot(),
        round: 3,
      }).expect(409);
    });

    it('frees a round again once its interview is cancelled', async () => {
      const appId = await flow.toInterviewStage(jobId);
      const first = await flow.scheduleInterview(appId);
      await flow
        .post(t.recruiter, `/interviews/${first.id}/cancel`)
        .expect(200);

      expect((await flow.scheduleInterview(appId)).round).toBe(1);
    });

    it.each([
      ['a time in the past', () => ({ scheduledAt: '2020-01-01T09:00:00Z' })],
      ['a non-date time', () => ({ scheduledAt: 'tomorrow morning' })],
      ['an impossible date', () => ({ scheduledAt: '2030-13-45T09:00:00Z' })],
      ['a round of zero', () => ({ round: 0 })],
      ['a round above the maximum', () => ({ round: 11 })],
      [
        'an unknown application',
        () => ({ applicationId: '00000000-0000-4000-8000-000000000000' }),
      ],
      ['a malformed interviewer id', () => ({ interviewerId: 'nope' })],
      ['an unexpected field', () => ({ result: 'PASSED' })],
    ])('rejects %s', async (_label, override) => {
      const appId = await flow.toInterviewStage(jobId);
      await create({
        applicationId: appId,
        interviewerId,
        scheduledAt: flow.futureSlot(),
        ...override(),
      }).expect(400);
    });

    it('rejects an interviewer who cannot interview, or who does not exist', async () => {
      const appId = await flow.toInterviewStage(jobId);
      const recruiterId = await userIdByEmail(ctx, 'recruiter@hiflow.local');

      for (const bad of [recruiterId, '00000000-0000-4000-8000-000000000000']) {
        await create({
          applicationId: appId,
          interviewerId: bad,
          scheduledAt: flow.futureSlot(),
        }).expect(400);
      }
    });

    it('lets an HR manager or department manager sit on a panel', async () => {
      const appId = await flow.toInterviewStage(jobId);
      const ivw = await flow.scheduleInterview(appId, { interviewerId: hrId });

      expect(ivw.id).toBeDefined();
    });
  });

  describe('double booking', () => {
    it('refuses an overlapping slot for the same interviewer, but not a clean hour apart', async () => {
      const base = flow.futureSlot();
      const [a, b, c, d] = [
        await flow.toInterviewStage(jobId),
        await flow.toInterviewStage(jobId),
        await flow.toInterviewStage(jobId),
        await flow.toInterviewStage(jobId),
      ];
      await flow.scheduleInterview(a, { at: base });

      for (const clash of [
        base,
        plus(base, 30),
        plus(base, -30),
        plus(base, 59),
      ]) {
        const response = await create({
          applicationId: b,
          interviewerId,
          scheduledAt: clash,
        }).expect(409);
        expect((response.body as { message: string }).message).toMatch(
          /khung giờ/,
        );
      }

      // Exactly one slot apart on either side is free.
      await flow.scheduleInterview(c, { at: plus(base, 60) });
      await flow.scheduleInterview(d, { at: plus(base, -60) });
    });

    it('does not block a different interviewer at the same time', async () => {
      const base = flow.futureSlot();
      const [a, b] = [
        await flow.toInterviewStage(jobId),
        await flow.toInterviewStage(jobId),
      ];
      await flow.scheduleInterview(a, { at: base });

      await flow.scheduleInterview(b, { at: base, interviewerId: hrId });
    });

    it('frees the slot when the interview is cancelled', async () => {
      const base = flow.futureSlot();
      const [a, b] = [
        await flow.toInterviewStage(jobId),
        await flow.toInterviewStage(jobId),
      ];
      const first = await flow.scheduleInterview(a, { at: base });
      await flow
        .post(t.recruiter, `/interviews/${first.id}/cancel`)
        .expect(200);

      await flow.scheduleInterview(b, { at: base });
    });
  });

  describe('rescheduling', () => {
    it('moves a pending interview and changes the interviewer', async () => {
      const appId = await flow.toInterviewStage(jobId);
      const ivw = await flow.scheduleInterview(appId);
      const newTime = flow.futureSlot();

      const moved = (
        await patch(t.recruiter, ivw.id, { scheduledAt: newTime }).expect(200)
      ).body as Ivw;
      expect(new Date(moved.scheduledAt).toISOString()).toBe(newTime);

      const reassigned = (
        await patch(t.recruiter, ivw.id, { interviewerId: hrId }).expect(200)
      ).body as Ivw;
      expect(reassigned.interviewer?.id).toBe(hrId);
    });

    it('checks the clash again when rescheduling, but ignores the interview’s own slot', async () => {
      const base = flow.futureSlot();
      const [a, b] = [
        await flow.toInterviewStage(jobId),
        await flow.toInterviewStage(jobId),
      ];
      const first = await flow.scheduleInterview(a, { at: base });
      const second = await flow.scheduleInterview(b, { at: flow.futureSlot() });

      await patch(t.recruiter, second.id, {
        scheduledAt: plus(base, 15),
      }).expect(409);
      // Nudging an interview within its own hour is not a clash with itself.
      await patch(t.recruiter, first.id, {
        scheduledAt: plus(base, 10),
      }).expect(200);
    });

    it('refuses a past time, an empty change is harmless, and finished interviews are frozen', async () => {
      const appId = await flow.toInterviewStage(jobId);
      const ivw = await flow.scheduleInterview(appId);

      await patch(t.recruiter, ivw.id, {
        scheduledAt: '2020-01-01T09:00:00Z',
      }).expect(400);
      await patch(t.recruiter, ivw.id, {}).expect(200);

      await result(t.interviewer, ivw.id, { result: 'PASSED' }).expect(200);
      await patch(t.recruiter, ivw.id, {
        scheduledAt: flow.futureSlot(),
      }).expect(409);
    });

    it('is forbidden without update permission', async () => {
      const appId = await flow.toInterviewStage(jobId);
      const ivw = await flow.scheduleInterview(appId);

      await patch(t.hr, ivw.id, { scheduledAt: flow.futureSlot() }).expect(403);
      await patch(t.interviewer, ivw.id, {
        scheduledAt: flow.futureSlot(),
      }).expect(403);
    });
  });

  describe('cancelling', () => {
    it('cancels a pending interview once', async () => {
      const appId = await flow.toInterviewStage(jobId);
      const ivw = await flow.scheduleInterview(appId);

      const cancelled = (
        await flow.post(t.recruiter, `/interviews/${ivw.id}/cancel`).expect(200)
      ).body as Ivw;
      expect(cancelled.result).toBe('CANCELLED');

      await flow.post(t.recruiter, `/interviews/${ivw.id}/cancel`).expect(409);
      await result(t.interviewer, ivw.id, { result: 'PASSED' }).expect(409);
    });

    it('is forbidden without cancel permission', async () => {
      const appId = await flow.toInterviewStage(jobId);
      const ivw = await flow.scheduleInterview(appId);

      await flow
        .post(t.interviewer, `/interviews/${ivw.id}/cancel`)
        .expect(403);
    });
  });

  describe('recording a result', () => {
    it('lets the assigned interviewer record a pass with feedback', async () => {
      const appId = await flow.toInterviewStage(jobId);
      const ivw = await flow.scheduleInterview(appId);

      const done = (
        await result(t.interviewer, ivw.id, {
          result: 'PASSED',
          feedback: '  Kỹ năng tốt  ',
        }).expect(200)
      ).body as Ivw;
      expect(done).toMatchObject({ result: 'PASSED', feedback: 'Kỹ năng tốt' });
    });

    it('requires feedback for a fail, and refuses results that are not pass/fail', async () => {
      const appId = await flow.toInterviewStage(jobId);
      const ivw = await flow.scheduleInterview(appId);

      await result(t.interviewer, ivw.id, { result: 'FAILED' }).expect(400);
      await result(t.interviewer, ivw.id, { result: 'PENDING' }).expect(400);
      await result(t.interviewer, ivw.id, { result: 'CANCELLED' }).expect(400);
      await result(t.interviewer, ivw.id, {}).expect(400);

      const failed = (
        await result(t.interviewer, ivw.id, {
          result: 'FAILED',
          feedback: 'Thiếu kinh nghiệm',
        }).expect(200)
      ).body as Ivw;
      expect(failed.result).toBe('FAILED');
    });

    it('cannot be recorded twice', async () => {
      const appId = await flow.toInterviewStage(jobId);
      const ivw = await flow.scheduleInterview(appId);
      await result(t.interviewer, ivw.id, { result: 'PASSED' }).expect(200);

      await result(t.interviewer, ivw.id, {
        result: 'FAILED',
        feedback: 'đổi ý',
      }).expect(409);
    });

    it('keeps an interviewer out of other people’s interviews', async () => {
      const appId = await flow.toInterviewStage(jobId);
      const theirs = await flow.scheduleInterview(appId, {
        interviewerId: hrId,
      });

      await get(t.interviewer, `/interviews/${theirs.id}`).expect(404);
      await result(t.interviewer, theirs.id, { result: 'PASSED' }).expect(404);
    });

    it('forbids roles without result permission, but lets an admin record for anyone', async () => {
      const appId = await flow.toInterviewStage(jobId);
      const ivw = await flow.scheduleInterview(appId);

      await result(t.recruiter, ivw.id, { result: 'PASSED' }).expect(403);
      await result(t.hr, ivw.id, { result: 'PASSED' }).expect(403);
      await result(t.admin, ivw.id, { result: 'PASSED' }).expect(200);
    });

    it('lets only one of two simultaneous results win', async () => {
      const appId = await flow.toInterviewStage(jobId);
      const ivw = await flow.scheduleInterview(appId);

      const outcomes = await Promise.all([
        result(t.interviewer, ivw.id, { result: 'PASSED' }),
        result(t.admin, ivw.id, {
          result: 'FAILED',
          feedback: 'Không phù hợp',
        }),
      ]);

      expect(outcomes.map((r) => r.status).sort()).toEqual([200, 409]);
    });

    it('feeds the application: its detail lists interviews by round', async () => {
      const appId = await flow.toInterviewStage(jobId);
      const first = await flow.scheduleInterview(appId);
      await result(t.interviewer, first.id, { result: 'PASSED' }).expect(200);
      await flow.scheduleInterview(appId);

      const detail = (
        await get(t.recruiter, `/applications/${appId}`).expect(200)
      ).body as {
        interviews: { round: number; result: string }[];
      };
      expect(detail.interviews.map((i) => `${i.round}:${i.result}`)).toEqual([
        '1:PASSED',
        '2:PENDING',
      ]);
    });
  });

  describe('listing', () => {
    it('sorts upcoming first, filters and paginates', async () => {
      const own = createFlow(ctx, t, 'E2E-IVW');
      const [x, y, z] = [
        await own.toInterviewStage(jobId),
        await own.toInterviewStage(jobId),
        await own.toInterviewStage(jobId),
      ];
      const ix = await own.scheduleInterview(x);
      const iy = await own.scheduleInterview(y, { interviewerId: hrId });
      const iz = await own.scheduleInterview(z);
      await result(t.interviewer, iz.id, { result: 'PASSED' }).expect(200);

      const scoped = (q: string) =>
        get(t.hr, `/interviews?applicationId=${x}&${q}`);
      const mine = [ix.id, iy.id, iz.id];

      const all = (await get(t.hr, '/interviews?limit=100').expect(200))
        .body as Page;
      const order = all.items
        .filter((i) => mine.includes(i.id))
        .map((i) => i.id);
      expect(order).toEqual(
        [ix.id, iy.id, iz.id].sort(
          (a, b) =>
            Date.parse(all.items.find((i) => i.id === a)!.scheduledAt) -
            Date.parse(all.items.find((i) => i.id === b)!.scheduledAt),
        ),
      );

      const passed = (
        await get(t.hr, '/interviews?result=PASSED&limit=100').expect(200)
      ).body as Page;
      expect(passed.items.map((i) => i.id)).toContain(iz.id);
      expect(passed.items.every((i) => i.result === 'PASSED')).toBe(true);

      const byPerson = (
        await get(t.hr, `/interviews?interviewerId=${hrId}&limit=100`).expect(
          200,
        )
      ).body as Page;
      expect(byPerson.items.map((i) => i.id)).toContain(iy.id);
      expect(byPerson.items.map((i) => i.id)).not.toContain(ix.id);

      expect(
        ((await scoped('limit=1').expect(200)).body as Page).items,
      ).toHaveLength(1);
    });

    it('searches by candidate name and filters by day', async () => {
      const own = createFlow(ctx, t, 'E2E-IVW');
      const cand = await own.candidate('find', 'Zzzz Tìm Kiếm');
      const appId = await own.application(jobId, cand.id);
      await own.move(appId, 'SCREENING').expect(200);
      await own.move(appId, 'INTERVIEW').expect(200);
      const ivw = await own.scheduleInterview(appId);
      const day = ivw.scheduledAt.slice(0, 10);

      const byName = (
        await get(
          t.hr,
          `/interviews?search=${encodeURIComponent('Zzzz Tìm')}`,
        ).expect(200)
      ).body as Page;
      expect(byName.items.map((i) => i.id)).toEqual([ivw.id]);

      const onDay = (
        await get(
          t.hr,
          `/interviews?scheduledFrom=${day}&scheduledTo=${day}&limit=100`,
        ).expect(200)
      ).body as Page;
      expect(onDay.items.map((i) => i.id)).toContain(ivw.id);
      const before = (
        await get(t.hr, `/interviews?scheduledTo=2020-01-01`).expect(200)
      ).body as Page;
      expect(before.items).toHaveLength(0);
    });

    it('shows an interviewer only their own interviews', async () => {
      const appId = await flow.toInterviewStage(jobId);
      const mine = await flow.scheduleInterview(appId);
      const otherApp = await flow.toInterviewStage(jobId);
      const notMine = await flow.scheduleInterview(otherApp, {
        interviewerId: hrId,
      });

      const list = (
        await get(t.interviewer, '/interviews?limit=100').expect(200)
      ).body as Page;
      const ids = list.items.map((i) => i.id);

      expect(ids).toContain(mine.id);
      expect(ids).not.toContain(notMine.id);
      expect(list.items.every((i) => i.interviewer?.id === interviewerId)).toBe(
        true,
      );
    });

    it('rejects bad query values and unknown ids', async () => {
      for (const q of [
        'result=NOPE',
        'sortBy=feedback',
        'round=0',
        'round=99',
        'scheduledFrom=soon',
        'limit=999',
      ]) {
        await get(t.hr, `/interviews?${q}`).expect(400);
      }
      await get(
        t.hr,
        '/interviews/00000000-0000-4000-8000-000000000000',
      ).expect(404);
      await get(t.hr, '/interviews/nope').expect(400);
    });
  });
});
