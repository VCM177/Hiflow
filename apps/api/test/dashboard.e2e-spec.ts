import request from 'supertest';
import { bearer, createE2eApp, E2eContext, loginAs } from './helpers/e2e-app';
import { idByCode } from './helpers/factories';
import { createFlow, FlowTokens, loginAll } from './helpers/flow';

interface Overview {
  period: { from: string; to: string };
  cards: {
    pendingRequisitions: number;
    openJobs: number;
    newApplications: number;
    upcomingInterviews: number;
    hiredInPeriod: number;
  };
  funnel: { stage: string; label: string; count: number }[];
  outcomes: { rejected: number; withdrawn: number };
  todo: { type: string; label: string; count: number; href: string }[];
}

const DAY_MS = 86_400_000;
const daysFromNow = (n: number) => new Date(Date.now() + n * DAY_MS);
const day = (n: number) => daysFromNow(n).toISOString().slice(0, 10);

describe('Dashboard (e2e)', () => {
  let ctx: E2eContext;
  let t: FlowTokens;
  let flow: ReturnType<typeof createFlow>;
  let engId: string;
  let salesId: string;

  const overview = async (token: string, query = ''): Promise<Overview> =>
    (
      await request(ctx.server)
        .get(`/dashboard/overview${query}`)
        .set(bearer(token))
        .expect(200)
    ).body as Overview;
  const funnel = (o: Overview, stage: string) =>
    o.funnel.find((f) => f.stage === stage)!.count;
  const todo = (o: Overview, type: string) =>
    o.todo.find((x) => x.type === type)?.count;

  /** A requisition that has been submitted but not yet decided. */
  const pendingRequisition = async (creator: string, extra: object = {}) => {
    const devId = await idByCode(ctx.dataSource, 'job_positions', 'DEV');
    const created = (
      await flow
        .post(creator, '/requisitions', {
          title: `E2E-DSH pending ${Math.random().toString(36).slice(2, 8)}`,
          positionId: devId,
          quantity: 1,
          ...extra,
        })
        .expect(201)
    ).body as { id: string };
    await flow.post(creator, `/requisitions/${created.id}/submit`).expect(200);
  };

  beforeAll(async () => {
    ctx = await createE2eApp();
    t = await loginAll(ctx);
    flow = createFlow(ctx, t, 'E2E-DSH');
    engId = await idByCode(ctx.dataSource, 'departments', 'ENG');
    salesId = await idByCode(ctx.dataSource, 'departments', 'SALES');
    await flow.cleanup();
  });

  afterAll(async () => {
    await flow.cleanup();
    await ctx.app.close();
  });

  describe('access', () => {
    it('requires authentication', () =>
      request(ctx.server).get('/dashboard/overview').expect(401));

    it('forbids an interviewer, who has no dashboard permission', () =>
      request(ctx.server)
        .get('/dashboard/overview')
        .set(bearer(t.interviewer))
        .expect(403));

    it.each(['hr', 'admin', 'recruiter', 'manager'] as const)(
      'lets %s in',
      async (role) => {
        await overview(t[role]);
      },
    );
  });

  describe('shape', () => {
    it('reports a 30-day period ending today by default', async () => {
      const o = await overview(t.hr);

      expect(o.period.to).toBe(day(0));
      expect(o.period.from).toBe(day(-29));
    });

    it('lists the five funnel stages in order with Vietnamese labels', async () => {
      const o = await overview(t.hr);

      expect(o.funnel.map((f) => f.stage)).toEqual([
        'NEW',
        'SCREENING',
        'INTERVIEW',
        'OFFER',
        'HIRED',
      ]);
      expect(o.funnel.map((f) => f.label)).toEqual([
        'Mới',
        'Sàng lọc',
        'Phỏng vấn',
        'Đề nghị',
        'Nhận việc',
      ]);
      expect(o.funnel.every((f) => Number.isInteger(f.count))).toBe(true);
    });

    it('shows each role only the tasks it can act on', async () => {
      const types = async (token: string) =>
        (await overview(token)).todo.map((x) => x.type);

      expect(await types(t.hr)).toEqual([
        'REQUISITIONS_TO_APPROVE',
        'INTERVIEWS_TODAY',
      ]);
      expect(await types(t.recruiter)).toEqual([
        'UNASSIGNED_APPLICATIONS',
        'INTERVIEWS_TODAY',
        'OFFERS_EXPIRING',
      ]);
      expect(await types(t.manager)).toEqual([]);
      expect(await types(t.admin)).toHaveLength(4);
    });

    it('links each task to a screen', async () => {
      const o = await overview(t.admin);

      expect(
        o.todo.every((x) => x.href.startsWith('/') && x.label.length > 0),
      ).toBe(true);
    });
  });

  describe('numbers follow the data', () => {
    it('counts requisitions waiting for approval', async () => {
      const before = await overview(t.hr);

      await pendingRequisition(t.manager);

      const after = await overview(t.hr);
      expect(after.cards.pendingRequisitions).toBe(
        before.cards.pendingRequisitions + 1,
      );
      expect(todo(after, 'REQUISITIONS_TO_APPROVE')).toBe(
        todo(before, 'REQUISITIONS_TO_APPROVE')! + 1,
      );
    });

    it('counts open jobs, applications and the funnel as work progresses', async () => {
      const before = await overview(t.hr);
      const jobId = await flow.openJob();
      const a = await flow.application(jobId);
      const b = await flow.application(jobId);
      await flow.application(jobId);
      await flow.move(a, 'SCREENING').expect(200);
      await flow.move(b, 'SCREENING').expect(200);
      await flow.move(b, 'INTERVIEW').expect(200);

      const after = await overview(t.hr);

      expect(after.cards.openJobs).toBe(before.cards.openJobs + 1);
      expect(after.cards.newApplications).toBe(
        before.cards.newApplications + 3,
      );
      // The funnel counts who ever reached a stage, so it is cumulative.
      expect(funnel(after, 'NEW')).toBe(funnel(before, 'NEW') + 3);
      expect(funnel(after, 'SCREENING')).toBe(funnel(before, 'SCREENING') + 2);
      expect(funnel(after, 'INTERVIEW')).toBe(funnel(before, 'INTERVIEW') + 1);
    });

    it('keeps counting an application at a stage it has since left', async () => {
      const jobId = await flow.openJob();
      const before = await overview(t.hr);
      const appId = await flow.toInterviewStage(jobId);
      await flow.move(appId, 'REJECTED', 'Không phù hợp').expect(200);

      const after = await overview(t.hr);

      expect(funnel(after, 'INTERVIEW')).toBe(funnel(before, 'INTERVIEW') + 1);
      expect(after.outcomes.rejected).toBe(before.outcomes.rejected + 1);
    });

    it('counts unassigned new applications for recruiters', async () => {
      const jobId = await flow.openJob();
      const before = await overview(t.recruiter);
      const candidate = await flow.candidate();
      await flow
        .post(t.admin, '/applications', { candidateId: candidate.id, jobId })
        .expect(201);

      const after = await overview(t.recruiter);
      expect(todo(after, 'UNASSIGNED_APPLICATIONS')).toBe(
        todo(before, 'UNASSIGNED_APPLICATIONS')! + 1,
      );
    });

    it('counts interviews in the next week, and today’s separately', async () => {
      const jobId = await flow.openJob();
      const before = await overview(t.hr);
      const soon = await flow.toInterviewStage(jobId);
      // The demo data books the interviewer two and four days out, and the
      // double-booking rule (rightly) refuses anything within an hour of those.
      await flow.scheduleInterview(soon, { at: daysFromNow(3).toISOString() });
      const later = await flow.toInterviewStage(jobId);
      await flow.scheduleInterview(later, {
        at: daysFromNow(20).toISOString(),
      });

      const after = await overview(t.hr);

      expect(after.cards.upcomingInterviews).toBe(
        before.cards.upcomingInterviews + 1,
      );
      expect(todo(after, 'INTERVIEWS_TODAY')).toBe(
        todo(before, 'INTERVIEWS_TODAY'),
      );
    });

    it('counts a hire and an offer close to expiring', async () => {
      const jobId = await flow.openJob();
      const before = await overview(t.admin);

      const hired = await flow.toOfferStage(jobId);
      await flow
        .post(t.recruiter, `/applications/${hired}/offer`, flow.offerBody())
        .expect(201);
      await flow
        .post(t.recruiter, `/applications/${hired}/offer/response`, {
          accepted: true,
        })
        .expect(200);

      const expiring = await flow.toOfferStage(jobId);
      await flow
        .post(
          t.recruiter,
          `/applications/${expiring}/offer`,
          flow.offerBody({ expiresAt: day(2), startDate: day(10) }),
        )
        .expect(201);

      const after = await overview(t.admin);
      expect(after.cards.hiredInPeriod).toBe(before.cards.hiredInPeriod + 1);
      expect(funnel(after, 'HIRED')).toBe(funnel(before, 'HIRED') + 1);
      expect(funnel(after, 'OFFER')).toBe(funnel(before, 'OFFER') + 2);
      expect(todo(after, 'OFFERS_EXPIRING')).toBe(
        todo(before, 'OFFERS_EXPIRING')! + 1,
      );
    });
  });

  describe('period', () => {
    it('leaves out work done outside the requested days', async () => {
      const jobId = await flow.openJob();
      const yesterday = `?from=${day(-1)}&to=${day(-1)}`;
      const before = await overview(t.hr, yesterday);
      await flow.application(jobId);

      const after = await overview(t.hr, yesterday);

      expect(after.period).toEqual({ from: day(-1), to: day(-1) });
      expect(after.cards.newApplications).toBe(before.cards.newApplications);
      expect(funnel(after, 'NEW')).toBe(funnel(before, 'NEW'));
      // Open jobs are a snapshot, not a period figure.
      const today = await overview(t.hr, `?from=${day(0)}&to=${day(0)}`);
      expect(today.cards.newApplications).toBeGreaterThan(0);
    });

    it.each([
      ['a start after the end', `?from=${day(0)}&to=${day(-5)}`],
      ['a span over a year', `?from=${day(-400)}&to=${day(0)}`],
      ['a malformed date', '?from=soon'],
      ['an unexpected parameter', '?period=week'],
      ['a malformed department id', '?departmentId=nope'],
    ])('rejects %s', async (_label, query) => {
      await request(ctx.server)
        .get(`/dashboard/overview${query}`)
        .set(bearer(t.hr))
        .expect(400);
    });
  });

  describe('department scope', () => {
    it('shows a department manager only their own department', async () => {
      const managerBefore = await overview(t.manager);
      const hrBefore = await overview(t.hr);

      // Work in the engineering department, which the sales manager cannot see.
      await pendingRequisition(t.admin, { departmentId: engId });
      const engJob = await flow.openJob({
        creator: t.admin,
        extra: { departmentId: engId },
      });
      await flow.application(engJob);

      const managerAfter = await overview(t.manager);
      const hrAfter = await overview(t.hr);

      expect(managerAfter.cards).toEqual(managerBefore.cards);
      expect(hrAfter.cards.pendingRequisitions).toBe(
        hrBefore.cards.pendingRequisitions + 1,
      );
      expect(hrAfter.cards.openJobs).toBe(hrBefore.cards.openJobs + 1);
      expect(hrAfter.cards.newApplications).toBe(
        hrBefore.cards.newApplications + 1,
      );
    });

    it('lets HR narrow to one department, and the department’s figures add up', async () => {
      const engJob = await flow.openJob({
        creator: t.admin,
        extra: { departmentId: engId },
      });
      await flow.application(engJob);
      const before = await overview(t.hr, `?departmentId=${engId}`);
      await flow.application(engJob);

      const after = await overview(t.hr, `?departmentId=${engId}`);
      const sales = await overview(t.hr, `?departmentId=${salesId}`);
      const everyone = await overview(t.hr);

      expect(after.cards.newApplications).toBe(
        before.cards.newApplications + 1,
      );
      // Two departments can never add up to more than the whole company.
      expect(everyone.cards.newApplications).toBeGreaterThanOrEqual(
        after.cards.newApplications + sales.cards.newApplications,
      );
    });

    it('lets a manager ask for their own department, but not another', async () => {
      await overview(t.manager, `?departmentId=${salesId}`);
      await request(ctx.server)
        .get(`/dashboard/overview?departmentId=${engId}`)
        .set(bearer(t.manager))
        .expect(403);
    });
  });

  describe('caching', () => {
    it('serves a cached answer within the TTL, while the uncached app sees new data', async () => {
      process.env.CACHE_TTL_SECONDS = '60';
      const cached = await createE2eApp();
      delete process.env.CACHE_TTL_SECONDS;

      try {
        const token = await loginAs(cached.server, 'hr@hiflow.local');
        const read = async () =>
          (
            await request(cached.server)
              .get('/dashboard/overview')
              .set(bearer(token))
              .expect(200)
          ).body as Overview;

        const first = await read();
        await pendingRequisition(t.manager);

        expect((await read()).cards.pendingRequisitions).toBe(
          first.cards.pendingRequisitions,
        );
        expect((await overview(t.hr)).cards.pendingRequisitions).toBe(
          first.cards.pendingRequisitions + 1,
        );
      } finally {
        await cached.app.close();
      }
    });
  });
});
