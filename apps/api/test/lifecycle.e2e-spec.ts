import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { bearer, createE2eApp, E2eContext } from './helpers/e2e-app';
import { idByCode } from './helpers/factories';
import {
  createFlow,
  FlowTokens,
  loginAll,
  userIdByEmail,
} from './helpers/flow';

const TAG = 'E2E-LIFE';
const PDF = Buffer.from('%PDF-1.4\n% cv of the lifecycle candidate\n');
const NIL = '00000000-0000-4000-8000-000000000000';

interface Req {
  id: string;
  code: string;
  status: string;
  quantity: number;
  rejectReason: string | null;
  approvedBy: { name: string } | null;
}
interface Overview {
  cards: {
    hiredInPeriod: number;
    openJobs: number;
    pendingRequisitions: number;
  };
  funnel: { stage: string; count: number }[];
}
interface Detail {
  status: string;
  history: {
    fromStatus: string | null;
    toStatus: string;
    note: string | null;
    changedBy: { name: string } | null;
  }[];
  interviews: { round: number; result: string; feedback: string | null }[];
  offer: { status: string } | null;
  candidateDetail: { hasCv: boolean } | null;
}

/**
 * The whole recruitment story, told through the public API exactly as the web
 * app will: a manager asks for a hire, HR approves, a recruiter posts the job,
 * a candidate is interviewed, receives an offer and accepts.
 */
describe('Recruitment lifecycle (e2e)', () => {
  let ctx: E2eContext;
  let t: FlowTokens;
  let flow: ReturnType<typeof createFlow>;
  let uploadRoot: string;
  let devId: string;
  let interviewerId: string;

  // State handed from one step of the story to the next.
  const s = {
    requisitionId: '',
    requisitionCode: '',
    requisitionTitle: '',
    jobId: '',
    candidateId: '',
    otherCandidateId: '',
    applicationId: '',
    interviewId: '',
    overviewBefore: undefined as Overview | undefined,
  };

  const call = (
    method: 'get' | 'post' | 'patch' | 'put',
    token: string,
    path: string,
    body?: object,
  ) => {
    const req = request(ctx.server)[method](path).set(bearer(token));
    return body === undefined ? req : req.send(body);
  };
  const overview = async (token = t.hr) =>
    (await call('get', token, '/dashboard/overview').expect(200))
      .body as Overview;
  const reached = (o: Overview, stage: string) =>
    o.funnel.find((f) => f.stage === stage)!.count;
  const application = async (token = t.recruiter) =>
    (await call('get', token, `/applications/${s.applicationId}`).expect(200))
      .body as Detail;

  beforeAll(async () => {
    uploadRoot = await mkdtemp(join(tmpdir(), 'hiflow-life-'));
    process.env.UPLOAD_DIR = uploadRoot;

    ctx = await createE2eApp();
    t = await loginAll(ctx);
    flow = createFlow(ctx, t, TAG);
    devId = await idByCode(ctx.dataSource, 'job_positions', 'DEV');
    interviewerId = await userIdByEmail(ctx, 'interviewer@hiflow.local');
    await flow.cleanup();
    s.overviewBefore = await overview();
  });

  afterAll(async () => {
    await flow.cleanup();
    await ctx.app.close();
    delete process.env.UPLOAD_DIR;
    await rm(uploadRoot, { recursive: true, force: true });
  });

  describe('the story', () => {
    it('1. the department manager raises a requisition for two hires and submits it', async () => {
      const created = (
        await call('post', t.manager, '/requisitions', {
          title: `${TAG} Tuyển 2 lập trình viên`,
          positionId: devId,
          quantity: 2,
          reason: 'Mở rộng đội ngũ',
          budgetMin: 15000000,
          budgetMax: 25000000,
        }).expect(201)
      ).body as Req;

      expect(created.status).toBe('DRAFT');
      s.requisitionId = created.id;
      s.requisitionCode = created.code;
      s.requisitionTitle = `${TAG} Tuyển 2 lập trình viên`;

      const submitted = (
        await call(
          'post',
          t.manager,
          `/requisitions/${s.requisitionId}/submit`,
        ).expect(200)
      ).body as Req;
      expect(submitted.status).toBe('PENDING_APPROVAL');
    });

    it('2. HR sees it waiting, rejects it with a reason; the manager fixes and resubmits; HR approves', async () => {
      const waiting = await overview(t.hr);
      expect(waiting.cards.pendingRequisitions).toBeGreaterThan(
        s.overviewBefore!.cards.pendingRequisitions - 1,
      );
      const queue = (
        await call(
          'get',
          t.hr,
          `/requisitions?status=PENDING_APPROVAL&search=${TAG}`,
        ).expect(200)
      ).body as { items: Req[] };
      expect(queue.items.map((r) => r.id)).toContain(s.requisitionId);

      await call('post', t.hr, `/requisitions/${s.requisitionId}/reject`, {
        reason: 'Ngân sách chưa hợp lý',
      }).expect(200);

      const rejected = (
        await call('get', t.manager, `/requisitions/${s.requisitionId}`).expect(
          200,
        )
      ).body as Req;
      expect(rejected).toMatchObject({
        status: 'REJECTED',
        rejectReason: 'Ngân sách chưa hợp lý',
      });

      await call('patch', t.manager, `/requisitions/${s.requisitionId}`, {
        quantity: 1,
        budgetMax: 20000000,
      }).expect(200);
      await call(
        'post',
        t.manager,
        `/requisitions/${s.requisitionId}/submit`,
      ).expect(200);

      const approved = (
        await call(
          'post',
          t.hr,
          `/requisitions/${s.requisitionId}/approve`,
        ).expect(200)
      ).body as Req;
      expect(approved.status).toBe('APPROVED');
      expect(approved.approvedBy?.name).toBe('Lê Thu Hà');
      expect(approved.quantity).toBe(1);
    });

    it('3. the recruiter turns the approved requisition into a job and publishes it', async () => {
      const job = (
        await call('post', t.recruiter, '/jobs', {
          requisitionId: s.requisitionId,
          description: '<p>Mô tả</p>',
        }).expect(201)
      ).body as {
        id: string;
        status: string;
        quantity: number;
      };
      expect(job).toMatchObject({ status: 'DRAFT', quantity: 1 });
      s.jobId = job.id;

      const open = (
        await call('post', t.recruiter, `/jobs/${s.jobId}/publish`).expect(200)
      ).body as { status: string; publishedAt: string | null };
      expect(open.status).toBe('OPEN');
      expect(open.publishedAt).not.toBeNull();
    });

    it('4. the recruiter records a candidate and uploads their CV, which can be downloaded again', async () => {
      const candidate = await flow.candidate('life', 'Nguyễn Hoàng Nam');
      s.candidateId = candidate.id;
      s.otherCandidateId = (await flow.candidate('other', 'Trần Thị Khác')).id;

      const withCv = (
        await request(ctx.server)
          .post(`/candidates/${s.candidateId}/cv`)
          .set(bearer(t.recruiter))
          .attach('file', PDF, { filename: 'cv.pdf' })
          .expect(200)
      ).body as { hasCv: boolean };
      expect(withCv.hasCv).toBe(true);

      const download = await request(ctx.server)
        .get(`/candidates/${s.candidateId}/cv`)
        .set(bearer(t.recruiter))
        .expect(200);
      expect(Buffer.from(download.body as Buffer).equals(PDF)).toBe(true);
    });

    it('5. the candidate applies and moves through screening to the interview stage', async () => {
      const app = (
        await call('post', t.recruiter, '/applications', {
          candidateId: s.candidateId,
          jobId: s.jobId,
        }).expect(201)
      ).body as { id: string; status: string };
      s.applicationId = app.id;
      expect(app.status).toBe('NEW');
      // A second applicant who will never be scheduled, to prove the interviewer's view is narrow.
      await call('post', t.recruiter, '/applications', {
        candidateId: s.otherCandidateId,
        jobId: s.jobId,
      }).expect(201);

      await call(
        'post',
        t.recruiter,
        `/applications/${s.applicationId}/status`,
        { toStatus: 'SCREENING', note: 'Hồ sơ phù hợp' },
      ).expect(200);
      await call(
        'post',
        t.recruiter,
        `/applications/${s.applicationId}/status`,
        { toStatus: 'INTERVIEW' },
      ).expect(200);
      expect((await application()).status).toBe('INTERVIEW');
    });

    it('6. an interview is scheduled; the interviewer sees only their own and records a pass', async () => {
      const interview = (
        await call('post', t.recruiter, '/interviews', {
          applicationId: s.applicationId,
          interviewerId,
          scheduledAt: flow.futureSlot(),
        }).expect(201)
      ).body as { id: string; round: number; result: string };
      expect(interview).toMatchObject({ round: 1, result: 'PENDING' });
      s.interviewId = interview.id;

      const mine = (
        await call('get', t.interviewer, '/interviews?limit=100').expect(200)
      ).body as { items: { id: string }[] };
      expect(mine.items.map((i) => i.id)).toContain(s.interviewId);

      // The interviewer can open this candidate and application, but not the other applicant.
      await call(
        'get',
        t.interviewer,
        `/applications/${s.applicationId}`,
      ).expect(200);
      await call('get', t.interviewer, `/candidates/${s.candidateId}`).expect(
        200,
      );
      await call(
        'get',
        t.interviewer,
        `/candidates/${s.otherCandidateId}`,
      ).expect(404);

      const done = (
        await call(
          'post',
          t.interviewer,
          `/interviews/${s.interviewId}/result`,
          { result: 'PASSED', feedback: 'Kỹ năng tốt, giao tiếp rõ ràng' },
        ).expect(200)
      ).body as { result: string };
      expect(done.result).toBe('PASSED');
    });

    it('7. the recruiter makes an offer and the candidate accepts, which hires them', async () => {
      await call(
        'post',
        t.recruiter,
        `/applications/${s.applicationId}/status`,
        { toStatus: 'OFFER' },
      ).expect(200);
      const offer = (
        await call(
          'post',
          t.recruiter,
          `/applications/${s.applicationId}/offer`,
          flow.offerBody({ salary: 22000000 }),
        ).expect(201)
      ).body as {
        status: string;
        salary: number;
      };
      expect(offer).toMatchObject({ status: 'PENDING', salary: 22000000 });

      const answered = (
        await call(
          'post',
          t.recruiter,
          `/applications/${s.applicationId}/offer/response`,
          { accepted: true },
        ).expect(200)
      ).body as {
        status: string;
      };
      expect(answered.status).toBe('ACCEPTED');
    });

    it('8. the application timeline tells the whole story, and only the right people see the offer', async () => {
      const detail = await application();

      expect(detail.status).toBe('HIRED');
      expect(
        detail.history.map((h) => `${h.fromStatus}→${h.toStatus}`),
      ).toEqual([
        'null→NEW',
        'NEW→SCREENING',
        'SCREENING→INTERVIEW',
        'INTERVIEW→OFFER',
        'OFFER→HIRED',
      ]);
      expect(
        detail.history.every((h) => h.changedBy?.name === 'Nguyễn Ngọc Lan'),
      ).toBe(true);
      expect(detail.history[1].note).toBe('Hồ sơ phù hợp');
      expect(detail.interviews).toEqual([
        expect.objectContaining({
          round: 1,
          result: 'PASSED',
          feedback: 'Kỹ năng tốt, giao tiếp rõ ràng',
        }),
      ]);
      expect(detail.offer?.status).toBe('ACCEPTED');
      expect(detail.candidateDetail?.hasCv).toBe(true);

      // HR can follow the application but is not allowed to see the offer.
      expect((await application(t.hr)).offer).toBeNull();
    });

    it('9. the requisition timeline records every decision, in order, with who made it', async () => {
      type Event = {
        event: string;
        actor: { name: string } | null;
        note: string | null;
      };
      let events: Event[] = [];
      for (let i = 0; i < 60 && events.length < 6; i++) {
        events = (
          await call(
            'get',
            t.hr,
            `/requisitions/${s.requisitionId}/history`,
          ).expect(200)
        ).body as Event[];
        if (events.length < 6) await new Promise((r) => setTimeout(r, 50));
      }

      expect(events.map((e) => e.event)).toEqual([
        'CREATED',
        'SUBMITTED',
        'REJECTED',
        'UPDATED',
        'SUBMITTED',
        'APPROVED',
      ]);
      expect(events.map((e) => e.actor?.name)).toEqual([
        'Phạm Minh Tuấn',
        'Phạm Minh Tuấn',
        'Lê Thu Hà',
        'Phạm Minh Tuấn',
        'Phạm Minh Tuấn',
        'Lê Thu Hà',
      ]);
      expect(events[2].note).toBe('Ngân sách chưa hợp lý');
    });

    it('10. the dashboard and the reports reflect the hire', async () => {
      const after = await overview();
      const before = s.overviewBefore!;

      expect(after.cards.hiredInPeriod).toBe(before.cards.hiredInPeriod + 1);
      expect(reached(after, 'HIRED')).toBe(reached(before, 'HIRED') + 1);
      expect(reached(after, 'OFFER')).toBe(reached(before, 'OFFER') + 1);

      const jobs = (await call('get', t.hr, '/reports/job-results').expect(200))
        .body as { rows: Record<string, string | number>[] };
      expect(
        jobs.rows.find((r) => r.title === s.requisitionTitle),
      ).toMatchObject({
        applications: 2,
        screened: 1,
        interviewed: 1,
        offered: 1,
        hired: 1,
        hireRate: 50,
      });

      const reqs = (
        await call('get', t.hr, '/reports/requisition-progress').expect(200)
      ).body as { rows: Record<string, string | number>[] };
      expect(reqs.rows.find((r) => r.code === s.requisitionCode)).toMatchObject(
        { quantity: 1, hired: 1, fillRate: 100, statusLabel: 'Đã duyệt' },
      );
    });

    it('11. once the position is filled HR closes the requisition, which also closes its job', async () => {
      await call('post', t.hr, `/requisitions/${s.requisitionId}/close`).expect(
        200,
      );

      const job = (
        await call('get', t.recruiter, `/jobs/${s.jobId}`).expect(200)
      ).body as { status: string; applicationCount: number };
      expect(job).toMatchObject({ status: 'CLOSED', applicationCount: 2 });

      const late = await flow.candidate('late');
      await call('post', t.recruiter, '/applications', {
        candidateId: late.id,
        jobId: s.jobId,
      }).expect(409);
    });

    it('12. the admin can audit every step, and no password was ever written down', async () => {
      const untilLogged = async (query: string, atLeast: number) => {
        type Entry = {
          actor: { name: string } | null;
          route: string | null;
          entityType: string;
        };
        let items: Entry[] = [];
        for (let i = 0; i < 60 && items.length < atLeast; i++) {
          items = (
            (
              await call(
                'get',
                t.admin,
                `/activity-logs?${query}&limit=100`,
              ).expect(200)
            ).body as { items: Entry[] }
          ).items;
          if (items.length < atLeast)
            await new Promise((r) => setTimeout(r, 50));
        }
        return items;
      };

      const requisition = await untilLogged(
        `entityType=Requisition&entityId=${s.requisitionId}`,
        7,
      );
      expect(requisition.map((e) => e.route)).toContain(
        '/requisitions/:id/approve',
      );
      expect(requisition.map((e) => e.route)).toContain(
        '/requisitions/:id/close',
      );

      const app = await untilLogged(
        `entityType=Application&entityId=${s.applicationId}`,
        5,
      );
      const routes = app.map((e) => e.route);
      expect(routes).toEqual(
        expect.arrayContaining([
          '/applications',
          '/applications/:id/status',
          '/applications/:id/offer',
          '/applications/:id/offer/response',
        ]),
      );

      expect(
        (await untilLogged(`entityType=Job&entityId=${s.jobId}`, 2)).map(
          (e) => e.route,
        ),
      ).toContain('/jobs/:id/publish');
      expect(
        (
          await untilLogged(`entityType=Interview&entityId=${s.interviewId}`, 1)
        ).map((e) => e.route),
      ).toContain('/interviews/:id/result');
      expect(
        (
          await untilLogged(`entityType=Candidate&entityId=${s.candidateId}`, 2)
        ).map((e) => e.route),
      ).toContain('/candidates/:id/cv');

      const everything = JSON.stringify(
        (await call('get', t.admin, '/activity-logs?limit=100').expect(200))
          .body,
      );
      expect(everything).not.toMatch(/Sturdy|Hiflow@2026|"password":"[^[]/);
    });

    it('13. the data ends up consistent in the database', async () => {
      const rows: { n: string }[] = await ctx.dataSource.query(
        `SELECT
           (SELECT COUNT(*) FROM application_status_histories WHERE application_id = $1 AND to_status = 'HIRED') AS hired_rows,
           (SELECT COUNT(*) FROM offers WHERE application_id = $1 AND status = 'ACCEPTED') AS accepted_offers,
           (SELECT COUNT(*) FROM interviews WHERE application_id = $1 AND result = 'PENDING') AS pending_interviews`,
        [s.applicationId],
      );

      expect(rows[0]).toMatchObject({
        hired_rows: '1',
        accepted_offers: '1',
        pending_interviews: '0',
      });
    });
  });

  describe('every endpoint is guarded', () => {
    it('answers 401 to an anonymous caller on every route except the deliberately public ones', async () => {
      const document = SwaggerModule.createDocument(
        ctx.app,
        new DocumentBuilder().build(),
      );
      // Every entry here is a decision: add one only for a route that must work
      // without a login, and give it its own protections (see docs section 6).
      const publicRoutes = new Set([
        'get /health',
        'post /auth/login',
        'post /auth/logout',
        'get /public/jobs',
        'get /public/jobs/{id}',
      ]);
      const anonymous: string[] = [];
      let checked = 0;

      for (const [path, methods] of Object.entries(document.paths)) {
        for (const method of Object.keys(methods)) {
          const concrete = path
            .replace('{type}', 'job-results')
            .replace(/\{[^}]+\}/g, NIL);
          const response = await request(ctx.server)[method as 'get'](concrete);
          checked++;

          if (
            response.status !== 401 &&
            !publicRoutes.has(`${method} ${path}`)
          ) {
            anonymous.push(
              `${method.toUpperCase()} ${path} -> ${response.status}`,
            );
          }
        }
      }

      // The API documents 75 operations today. This only guards against a
      // route silently dropping out of the document (and so out of this check).
      expect(checked).toBeGreaterThanOrEqual(75);
      expect(anonymous).toEqual([]);
    });

    it('keeps the public routes public', async () => {
      await request(ctx.server).get('/health').expect(200);
      await request(ctx.server)
        .post('/auth/login')
        .send({ email: 'nobody@hiflow.local', password: 'x' })
        .expect(401);
      await request(ctx.server).post('/auth/logout').expect(204);
    });
  });

  describe('roles are kept in their lane', () => {
    const forbidden: [keyof FlowTokens, 'get' | 'post' | 'patch', string][] = [
      ['interviewer', 'get', '/requisitions'],
      ['interviewer', 'post', '/requisitions'],
      ['interviewer', 'get', '/jobs'],
      ['interviewer', 'post', '/jobs'],
      ['interviewer', 'get', '/users'],
      ['interviewer', 'get', '/dashboard/overview'],
      ['interviewer', 'get', '/reports/job-results'],
      ['interviewer', 'get', '/activity-logs'],
      ['interviewer', 'post', '/candidates'],
      ['interviewer', 'post', '/applications'],
      ['interviewer', 'post', `/applications/${NIL}/status`],
      ['interviewer', 'post', '/interviews'],
      ['interviewer', 'get', `/applications/${NIL}/offer`],
      ['manager', 'get', '/candidates'],
      ['manager', 'post', '/candidates'],
      ['manager', 'post', '/jobs'],
      ['manager', 'post', '/applications'],
      ['manager', 'get', '/interviews'],
      ['manager', 'post', '/interviews'],
      ['manager', 'get', '/users'],
      ['manager', 'get', '/reports/job-results'],
      ['manager', 'get', '/activity-logs'],
      ['manager', 'post', `/requisitions/${NIL}/approve`],
      ['manager', 'get', `/applications/${NIL}/offer`],
      ['recruiter', 'post', '/requisitions'],
      ['recruiter', 'post', `/requisitions/${NIL}/approve`],
      ['recruiter', 'post', `/requisitions/${NIL}/reject`],
      ['recruiter', 'get', '/users'],
      ['recruiter', 'post', '/users'],
      ['recruiter', 'post', '/departments'],
      ['recruiter', 'get', '/reports/job-results'],
      ['recruiter', 'get', '/activity-logs'],
      ['recruiter', 'post', `/interviews/${NIL}/result`],
      ['hr', 'post', '/jobs'],
      ['hr', 'post', '/candidates'],
      ['hr', 'post', '/applications'],
      ['hr', 'post', '/interviews'],
      ['hr', 'post', `/applications/${NIL}/offer`],
      ['hr', 'get', `/applications/${NIL}/offer`],
      ['hr', 'post', '/departments'],
      ['hr', 'get', '/activity-logs'],
    ];

    it.each(forbidden)('%s may not %s %s', async (role, method, path) => {
      await request(ctx.server)
        [method](path)
        .set(bearer(t[role]))
        .send({})
        .expect(403);
    });

    it('lets the admin through everywhere it is asked to', async () => {
      for (const path of [
        '/users',
        '/departments',
        '/positions',
        '/requisitions',
        '/jobs',
        '/candidates',
        '/applications',
        '/interviews',
        '/dashboard/overview',
        '/reports/job-results',
        '/activity-logs',
        '/profile',
      ]) {
        await call('get', t.admin, path).expect(200);
      }
    });
  });
});
