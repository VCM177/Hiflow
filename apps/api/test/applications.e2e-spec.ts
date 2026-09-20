import request from 'supertest';
import { bearer, createE2eApp, E2eContext, loginAs } from './helpers/e2e-app';
import { approvedRequisition, idByCode } from './helpers/factories';

interface Item {
  id: string;
  status: string;
  appliedAt: string;
  candidate: { id: string; fullName: string; email: string } | null;
  job: { id: string; title: string; status: string } | null;
  assignee: { id: string; name: string } | null;
}
interface Detail extends Item {
  note: string | null;
  candidateDetail: { phone: string | null; hasCv: boolean } | null;
  history: {
    fromStatus: string | null;
    toStatus: string;
    note: string | null;
    changedBy: { name: string } | null;
  }[];
  interviews: { round: number; result: string }[];
  offer: { status: string } | null;
}
interface Page {
  items: Item[];
  meta: { total: number; totalPages: number };
}

const TAG = 'E2E-APP';
const MAIL = 'e2e-app-';

describe('Applications (e2e)', () => {
  let ctx: E2eContext;
  let manager: string;
  let hr: string;
  let admin: string;
  let recruiter: string;
  let interviewer: string;
  let interviewerId: string;
  let recruiterId: string;
  let engId: string;
  let devId: string;
  /** One open job (sales department) that tests share unless they need their own. */
  let sharedJobId: string;
  let seq = 0;

  const cleanup = async () => {
    const q = (sql: string) => ctx.dataSource.query(sql);
    await q(`DELETE FROM activity_logs WHERE
      (entity_type = 'Application' AND entity_id IN (SELECT a.id::text FROM applications a JOIN candidates c ON c.id = a.candidate_id WHERE c.email LIKE '${MAIL}%'))
      OR (entity_type = 'Candidate' AND entity_id IN (SELECT id::text FROM candidates WHERE email LIKE '${MAIL}%'))
      OR (entity_type = 'Job' AND entity_id IN (SELECT id::text FROM jobs WHERE title LIKE '${TAG}%'))
      OR (entity_type = 'Requisition' AND entity_id IN (SELECT id::text FROM requisitions WHERE title LIKE '${TAG}%'))`);
    await q(
      `DELETE FROM applications WHERE candidate_id IN (SELECT id FROM candidates WHERE email LIKE '${MAIL}%')`,
    );
    await q(`DELETE FROM candidates WHERE email LIKE '${MAIL}%'`);
    await q(`DELETE FROM jobs WHERE title LIKE '${TAG}%'`);
    await q(`DELETE FROM requisitions WHERE title LIKE '${TAG}%'`);
  };

  const post = (token: string, path: string, body: object = {}) =>
    request(ctx.server).post(path).set(bearer(token)).send(body);
  const get = (token: string, path: string) =>
    request(ctx.server).get(path).set(bearer(token));

  /** An OPEN job: approved requisition → job → published. */
  const openJob = async (opts: { creator?: string; extra?: object } = {}) => {
    const req = await approvedRequisition(
      ctx.server,
      { creator: opts.creator ?? manager, approver: hr },
      {
        title: `${TAG} req ${++seq}`,
        positionId: devId,
        quantity: 5,
        ...opts.extra,
      },
    );
    const job = (
      await post(recruiter, '/jobs', { requisitionId: req.id }).expect(201)
    ).body as { id: string };
    await post(recruiter, `/jobs/${job.id}/publish`).expect(200);
    return job.id;
  };

  const newCandidate = async (label = 'c', fullName?: string) =>
    (
      await post(recruiter, '/candidates', {
        fullName: fullName ?? `Ứng viên ${label} ${++seq}`,
        email: `${MAIL}${label}-${seq}@example.com`,
      }).expect(201)
    ).body as { id: string };

  const apply = async (
    jobId: string,
    candidateId?: string,
    extra: object = {},
  ) => {
    const cid = candidateId ?? (await newCandidate()).id;
    return (
      await post(recruiter, '/applications', {
        candidateId: cid,
        jobId,
        ...extra,
      }).expect(201)
    ).body as Detail;
  };

  const move = (token: string, id: string, toStatus: string, note?: string) =>
    post(
      token,
      `/applications/${id}/status`,
      note === undefined ? { toStatus } : { toStatus, note },
    );

  const addInterview = (appId: string, result: string, round = 1) =>
    ctx.dataSource.query(
      `INSERT INTO interviews (application_id, round, scheduled_at, interviewer_id, result)
       VALUES ($1, $2, now() + interval '1 day', $3, $4)`,
      [appId, round, interviewerId, result],
    );
  const addOffer = (appId: string, status: string) =>
    ctx.dataSource.query(
      `INSERT INTO offers (application_id, salary, start_date, status, created_by_id)
       VALUES ($1, 20000000, current_date + 30, $2, $3)`,
      [appId, status, recruiterId],
    );
  const statusOf = async (id: string) =>
    ((await get(recruiter, `/applications/${id}`).expect(200)).body as Detail)
      .status;

  beforeAll(async () => {
    ctx = await createE2eApp();
    manager = await loginAs(ctx.server, 'manager@hiflow.local');
    hr = await loginAs(ctx.server, 'hr@hiflow.local');
    admin = await loginAs(ctx.server, 'admin@hiflow.local');
    recruiter = await loginAs(ctx.server, 'recruiter@hiflow.local');
    interviewer = await loginAs(ctx.server, 'interviewer@hiflow.local');
    engId = await idByCode(ctx.dataSource, 'departments', 'ENG');
    devId = await idByCode(ctx.dataSource, 'job_positions', 'DEV');
    const ids: { email: string; id: string }[] = await ctx.dataSource.query(
      `SELECT email, id FROM users WHERE email IN ('interviewer@hiflow.local','recruiter@hiflow.local')`,
    );
    interviewerId = ids.find((u) => u.email.startsWith('interviewer'))!.id;
    recruiterId = ids.find((u) => u.email.startsWith('recruiter'))!.id;
    await cleanup();
    sharedJobId = await openJob();
  });

  afterAll(async () => {
    await cleanup();
    await ctx.app.close();
  });

  describe('access', () => {
    it('requires authentication', () =>
      request(ctx.server).get('/applications').expect(401));

    it('forbids creating without create permission (HR, department manager)', async () => {
      const jobId = await openJob();
      const c = await newCandidate();
      for (const token of [hr, manager]) {
        await post(token, '/applications', { candidateId: c.id, jobId }).expect(
          403,
        );
      }
    });

    it('forbids an interviewer from changing status, assigning or deleting', async () => {
      const app = await apply(sharedJobId);
      await addInterview(app.id, 'PENDING');

      await move(interviewer, app.id, 'SCREENING').expect(403);
      await request(ctx.server)
        .patch(`/applications/${app.id}/assignee`)
        .set(bearer(interviewer))
        .send({ assigneeId: null })
        .expect(403);
      await request(ctx.server)
        .delete(`/applications/${app.id}`)
        .set(bearer(interviewer))
        .expect(403);
    });
  });

  describe('creating', () => {
    it('starts as NEW, records the first history row and defaults the assignee to the recruiter', async () => {
      const app = await apply(sharedJobId);

      expect(app.status).toBe('NEW');
      expect(app.assignee?.id).toBe(recruiterId);
      expect(app.history).toHaveLength(1);
      expect(app.history[0]).toMatchObject({
        fromStatus: null,
        toStatus: 'NEW',
        note: 'Tạo hồ sơ',
      });
      expect(app.history[0].changedBy?.name).toBe('Nguyễn Ngọc Lan');
      expect(app.interviews).toEqual([]);
    });

    it('rejects a second application by the same candidate to the same job', async () => {
      const jobId = await openJob();
      const c = await newCandidate();
      await apply(jobId, c.id);

      const dup = await post(recruiter, '/applications', {
        candidateId: c.id,
        jobId,
      }).expect(409);
      expect((dup.body as { message: string }).message).toMatch(/đã nộp/);
    });

    it('lets the same candidate apply to different jobs', async () => {
      const c = await newCandidate();
      await apply(await openJob(), c.id);
      await apply(await openJob(), c.id);
    });

    it('only accepts applications to an open job', async () => {
      const c = await newCandidate();
      const req = await approvedRequisition(
        ctx.server,
        { creator: manager, approver: hr },
        { title: `${TAG} req ${++seq}`, positionId: devId, quantity: 1 },
      );
      const draft = (
        await post(recruiter, '/jobs', { requisitionId: req.id }).expect(201)
      ).body as { id: string };
      await post(recruiter, '/applications', {
        candidateId: c.id,
        jobId: draft.id,
      }).expect(409);

      await post(recruiter, `/jobs/${draft.id}/publish`).expect(200);
      await post(recruiter, `/jobs/${draft.id}/stop`).expect(200);
      await post(recruiter, '/applications', {
        candidateId: c.id,
        jobId: draft.id,
      }).expect(409);
    });

    it.each([
      [
        'an unknown candidate',
        () => ({ candidateId: '00000000-0000-4000-8000-000000000000' }),
      ],
      [
        'an unknown job',
        () => ({ jobId: '00000000-0000-4000-8000-000000000000' }),
      ],
      ['a malformed candidate id', () => ({ candidateId: 'nope' })],
      ['an unexpected field', () => ({ status: 'HIRED' })],
      [
        'an assignee who is an interviewer',
        () => ({ assigneeId: interviewerId }),
      ],
      [
        'an unknown assignee',
        () => ({ assigneeId: '00000000-0000-4000-8000-000000000000' }),
      ],
    ])('rejects %s', async (_label, override) => {
      const jobId = await openJob();
      const c = await newCandidate();
      await post(recruiter, '/applications', {
        candidateId: c.id,
        jobId,
        ...override(),
      }).expect(400);
    });

    it('lets an admin create with an explicit assignee, and none by default', async () => {
      const jobId = await openJob();
      const c1 = await newCandidate();
      const c2 = await newCandidate();

      const withAssignee = (
        await post(admin, '/applications', {
          candidateId: c1.id,
          jobId,
          assigneeId: recruiterId,
        }).expect(201)
      ).body as Detail;
      const without = (
        await post(admin, '/applications', {
          candidateId: c2.id,
          jobId,
        }).expect(201)
      ).body as Detail;

      expect(withAssignee.assignee?.id).toBe(recruiterId);
      expect(without.assignee).toBeNull();
    });
  });

  describe('status flow', () => {
    it('walks NEW → SCREENING → INTERVIEW and records each step with its author', async () => {
      const app = await apply(sharedJobId);

      expect(
        (
          (
            await move(recruiter, app.id, 'SCREENING', 'Hồ sơ phù hợp').expect(
              200,
            )
          ).body as Detail
        ).status,
      ).toBe('SCREENING');
      const inInterview = (
        await move(recruiter, app.id, 'INTERVIEW').expect(200)
      ).body as Detail;

      expect(inInterview.status).toBe('INTERVIEW');
      expect(
        inInterview.history.map((h) => `${h.fromStatus}→${h.toStatus}`),
      ).toEqual(['null→NEW', 'NEW→SCREENING', 'SCREENING→INTERVIEW']);
      expect(inInterview.history[1].note).toBe('Hồ sơ phù hợp');
      expect(inInterview.history[2].changedBy?.name).toBe('Nguyễn Ngọc Lan');
    });

    it.each([
      ['NEW', 'INTERVIEW'],
      ['NEW', 'OFFER'],
      ['NEW', 'HIRED'],
      ['NEW', 'NEW'],
    ])('refuses to jump from %s to %s', async (_from, to) => {
      const app = await apply(sharedJobId);
      const response = await move(recruiter, app.id, to).expect(409);
      expect((response.body as { message: string }).message).toMatch(
        /Không thể chuyển/,
      );
    });

    it('rejects an unknown target status and an unexpected field', async () => {
      const app = await apply(sharedJobId);
      await move(recruiter, app.id, 'DONE').expect(400);
      await post(recruiter, `/applications/${app.id}/status`, {
        toStatus: 'SCREENING',
        force: true,
      }).expect(400);
    });

    it('requires a reason to reject, then stores it and locks the application', async () => {
      const app = await apply(sharedJobId);
      await move(recruiter, app.id, 'REJECTED').expect(400);
      await move(recruiter, app.id, 'REJECTED', '   ').expect(400);

      const rejected = (
        await move(
          recruiter,
          app.id,
          'REJECTED',
          'Không đủ kinh nghiệm',
        ).expect(200)
      ).body as Detail;
      expect(rejected.status).toBe('REJECTED');
      expect(rejected.history.at(-1)?.note).toBe('Không đủ kinh nghiệm');

      for (const to of ['SCREENING', 'WITHDRAWN', 'HIRED']) {
        await move(recruiter, app.id, to, 'x').expect(409);
      }
    });

    it('lets the candidate withdraw at any active stage', async () => {
      const app = await apply(sharedJobId);
      await move(recruiter, app.id, 'SCREENING').expect(200);

      expect(
        (
          (await move(recruiter, app.id, 'WITHDRAWN').expect(200))
            .body as Detail
        ).status,
      ).toBe('WITHDRAWN');
    });

    it('lets only one of two simultaneous changes win, and writes one history row for it', async () => {
      const app = await apply(sharedJobId);
      await move(recruiter, app.id, 'SCREENING').expect(200);

      const results = await Promise.all([
        move(recruiter, app.id, 'INTERVIEW'),
        move(admin, app.id, 'REJECTED', 'Không phù hợp'),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);

      const detail = (
        await get(recruiter, `/applications/${app.id}`).expect(200)
      ).body as Detail;
      expect(detail.history).toHaveLength(3);
      expect(detail.history.at(-1)?.toStatus).toBe(detail.status);
    });
  });

  describe('moving to OFFER', () => {
    const toInterview = async () => {
      const app = await apply(sharedJobId);
      await move(recruiter, app.id, 'SCREENING').expect(200);
      await move(recruiter, app.id, 'INTERVIEW').expect(200);
      return app;
    };

    it('needs at least one passed interview', async () => {
      const app = await toInterview();

      const none = await move(recruiter, app.id, 'OFFER').expect(409);
      expect((none.body as { message: string }).message).toMatch(
        /phỏng vấn đạt/,
      );

      await addInterview(app.id, 'FAILED');
      await move(recruiter, app.id, 'OFFER').expect(409);
      expect(await statusOf(app.id)).toBe('INTERVIEW');
    });

    it('is blocked while an interview still has no result', async () => {
      const app = await toInterview();
      await addInterview(app.id, 'PASSED', 1);
      await addInterview(app.id, 'PENDING', 2);

      const blocked = await move(recruiter, app.id, 'OFFER').expect(409);
      expect((blocked.body as { message: string }).message).toMatch(
        /chưa có kết quả/,
      );
    });

    it('is allowed once a round passed and none are pending', async () => {
      const app = await toInterview();
      await addInterview(app.id, 'PASSED');

      expect(
        ((await move(recruiter, app.id, 'OFFER').expect(200)).body as Detail)
          .status,
      ).toBe('OFFER');
    });
  });

  describe('moving to HIRED', () => {
    const toOffer = async () => {
      const app = await apply(sharedJobId);
      await move(recruiter, app.id, 'SCREENING').expect(200);
      await move(recruiter, app.id, 'INTERVIEW').expect(200);
      await addInterview(app.id, 'PASSED');
      await move(recruiter, app.id, 'OFFER').expect(200);
      return app;
    };

    it('requires the candidate to have accepted an offer', async () => {
      const app = await toOffer();

      const noOffer = await move(recruiter, app.id, 'HIRED').expect(409);
      expect((noOffer.body as { message: string }).message).toMatch(
        /chấp nhận/,
      );

      await addOffer(app.id, 'PENDING');
      await move(recruiter, app.id, 'HIRED').expect(409);
    });

    it('is allowed after the offer is accepted', async () => {
      const app = await toOffer();
      await addOffer(app.id, 'ACCEPTED');

      expect(
        ((await move(recruiter, app.id, 'HIRED').expect(200)).body as Detail)
          .status,
      ).toBe('HIRED');
    });
  });

  describe('releasing pending work', () => {
    it.each(['REJECTED', 'WITHDRAWN'])(
      '%s cancels pending interviews and declines a pending offer',
      async (target) => {
        const app = await apply(sharedJobId);
        await move(recruiter, app.id, 'SCREENING').expect(200);
        await move(recruiter, app.id, 'INTERVIEW').expect(200);
        await addInterview(app.id, 'PASSED', 1);
        await addInterview(app.id, 'PENDING', 2);
        await addOffer(app.id, 'PENDING');

        await move(recruiter, app.id, target, 'Lý do').expect(200);

        const detail = (
          await get(recruiter, `/applications/${app.id}`).expect(200)
        ).body as Detail;
        expect(detail.interviews.map((i) => i.result)).toEqual([
          'PASSED',
          'CANCELLED',
        ]);
        expect(detail.offer?.status).toBe('DECLINED');
      },
    );
  });

  describe('detail visibility', () => {
    it('shows the offer only to roles allowed to see offers', async () => {
      const app = await apply(sharedJobId);
      await addOffer(app.id, 'PENDING');

      const asRecruiter = (
        await get(recruiter, `/applications/${app.id}`).expect(200)
      ).body as Detail;
      const asHr = (await get(hr, `/applications/${app.id}`).expect(200))
        .body as Detail;

      expect(asRecruiter.offer?.status).toBe('PENDING');
      expect(asHr.offer).toBeNull();
    });

    it('includes candidate contact details and the CV link', async () => {
      const c = (
        await post(recruiter, '/candidates', {
          fullName: 'Có SĐT',
          email: `${MAIL}phone-${++seq}@example.com`,
          phone: '0901234567',
        }).expect(201)
      ).body as { id: string };
      const app = await apply(await openJob(), c.id);

      expect(app.candidateDetail).toEqual({
        phone: '0901234567',
        hasCv: false,
      });
    });
  });

  describe('scoping', () => {
    it('shows a department manager only their department’s applications', async () => {
      const salesApp = await apply(sharedJobId);
      const engApp = await apply(
        await openJob({ creator: admin, extra: { departmentId: engId } }),
      );

      const list = (
        await get(
          manager,
          `/applications?search=${encodeURIComponent('Ứng viên')}&limit=100`,
        ).expect(200)
      ).body as Page;
      const ids = list.items.map((a) => a.id);

      expect(ids).toContain(salesApp.id);
      expect(ids).not.toContain(engApp.id);
      await get(manager, `/applications/${engApp.id}`).expect(404);
      await get(hr, `/applications/${engApp.id}`).expect(200);
    });

    it('shows an interviewer only the applications they are scheduled for', async () => {
      const mine = await apply(sharedJobId);
      const other = await apply(sharedJobId);
      await addInterview(mine.id, 'PENDING');

      const list = (
        await get(
          interviewer,
          `/applications?search=${encodeURIComponent('Ứng viên')}&limit=100`,
        ).expect(200)
      ).body as Page;
      const ids = list.items.map((a) => a.id);

      expect(ids).toContain(mine.id);
      expect(ids).not.toContain(other.id);
      await get(interviewer, `/applications/${other.id}`).expect(404);
      await get(interviewer, `/applications/${mine.id}`).expect(200);
    });

    it('lets an interviewer see the candidate they interview, and only that one', async () => {
      const mine = await apply(sharedJobId);
      const other = await apply(sharedJobId);
      await addInterview(mine.id, 'PENDING');

      await get(interviewer, `/candidates/${mine.candidate!.id}`).expect(200);
      await get(interviewer, `/candidates/${other.candidate!.id}`).expect(404);
    });
  });

  describe('assignee, note and deletion', () => {
    it('reassigns and clears the assignee, and refuses an invalid one', async () => {
      const app = await apply(sharedJobId);
      const patch = (body: object) =>
        request(ctx.server)
          .patch(`/applications/${app.id}/assignee`)
          .set(bearer(recruiter))
          .send(body);

      const cleared = (await patch({ assigneeId: null }).expect(200))
        .body as Detail;
      expect(cleared.assignee).toBeNull();

      const hrRows: { id: string }[] = await ctx.dataSource.query(
        `SELECT id FROM users WHERE email = 'hr@hiflow.local'`,
      );
      const hrId = hrRows[0].id;
      expect(
        ((await patch({ assigneeId: hrId }).expect(200)).body as Detail)
          .assignee?.name,
      ).toBe('Lê Thu Hà');

      await patch({ assigneeId: interviewerId }).expect(400);
      await patch({}).expect(400);
    });

    it('sets, replaces and clears the note', async () => {
      const app = await apply(sharedJobId);
      const put = (note: string, token = recruiter) =>
        request(ctx.server)
          .put(`/applications/${app.id}/note`)
          .set(bearer(token))
          .send({ note });

      expect(
        ((await put('Ứng viên tiềm năng').expect(200)).body as Detail).note,
      ).toBe('Ứng viên tiềm năng');
      expect(((await put('').expect(200)).body as Detail).note).toBeNull();
      await put('x'.repeat(2001)).expect(400);
      await put('HR cannot', hr).expect(403);
    });

    it('deletes only an application that is still NEW', async () => {
      const fresh = await apply(sharedJobId);
      const moved = await apply(sharedJobId);
      await move(recruiter, moved.id, 'SCREENING').expect(200);

      await request(ctx.server)
        .delete(`/applications/${fresh.id}`)
        .set(bearer(recruiter))
        .expect(204);
      await get(recruiter, `/applications/${fresh.id}`).expect(404);
      await request(ctx.server)
        .delete(`/applications/${moved.id}`)
        .set(bearer(recruiter))
        .expect(409);
    });

    it('blocks deleting a candidate or a job that has applications', async () => {
      const jobId = await openJob();
      const app = await apply(jobId);

      await request(ctx.server)
        .delete(`/candidates/${app.candidate!.id}`)
        .set(bearer(recruiter))
        .expect(409);
      await request(ctx.server)
        .delete(`/jobs/${jobId}`)
        .set(bearer(recruiter))
        .expect(409);
    });
  });

  describe('listing', () => {
    it('filters, sorts and paginates, and counts applications on the job', async () => {
      const jobId = await openJob();
      const a = await apply(
        jobId,
        (await newCandidate('la', 'Aaa Listing')).id,
      );
      const b = await apply(
        jobId,
        (await newCandidate('lb', 'Bbb Listing')).id,
      );
      const c = await apply(
        jobId,
        (await newCandidate('lc', 'Ccc Listing')).id,
      );
      await move(recruiter, b.id, 'SCREENING').expect(200);

      const first = (
        await get(
          hr,
          `/applications?jobId=${jobId}&limit=2&page=1&sortBy=candidateName&sortDir=asc`,
        ).expect(200)
      ).body as Page;
      expect(first.items.map((i) => i.id)).toEqual([a.id, b.id]);
      expect(first.meta).toMatchObject({ total: 3, totalPages: 2 });

      const screening = (
        await get(hr, `/applications?jobId=${jobId}&status=SCREENING`).expect(
          200,
        )
      ).body as Page;
      expect(screening.items.map((i) => i.id)).toEqual([b.id]);

      const byName = (
        await get(hr, `/applications?search=Ccc%20Listing`).expect(200)
      ).body as Page;
      expect(byName.items.map((i) => i.id)).toEqual([c.id]);

      const job = (await get(hr, `/jobs/${jobId}`).expect(200)).body as {
        applicationCount: number;
      };
      expect(job.applicationCount).toBe(3);
    });

    it('filters by assignee and by applied date, treating "to" as the whole day', async () => {
      const jobId = await openJob();
      const mine = await apply(jobId);
      const noOne = (
        await post(admin, '/applications', {
          candidateId: (await newCandidate()).id,
          jobId,
        }).expect(201)
      ).body as Detail;
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000)
        .toISOString()
        .slice(0, 10);

      const byAssignee = (
        await get(
          hr,
          `/applications?jobId=${jobId}&assigneeId=${recruiterId}`,
        ).expect(200)
      ).body as Page;
      expect(byAssignee.items.map((i) => i.id)).toEqual([mine.id]);
      expect(byAssignee.items.map((i) => i.id)).not.toContain(noOne.id);

      const inclusive = (
        await get(
          hr,
          `/applications?jobId=${jobId}&appliedFrom=${today}&appliedTo=${today}`,
        ).expect(200)
      ).body as Page;
      const past = (
        await get(
          hr,
          `/applications?jobId=${jobId}&appliedTo=${yesterday}`,
        ).expect(200)
      ).body as Page;
      expect(inclusive.items).toHaveLength(2);
      expect(past.items).toHaveLength(0);
    });

    it('rejects bad query values and unknown ids', async () => {
      for (const q of [
        'status=NOPE',
        'sortBy=note',
        'jobId=nope',
        'appliedFrom=soon',
        'limit=0',
      ]) {
        await get(hr, `/applications?${q}`).expect(400);
      }
      await get(
        hr,
        '/applications/00000000-0000-4000-8000-000000000000',
      ).expect(404);
      await get(hr, '/applications/nope').expect(400);
    });
  });
});
