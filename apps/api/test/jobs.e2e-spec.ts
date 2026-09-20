import request from 'supertest';
import { bearer, createE2eApp, E2eContext, loginAs } from './helpers/e2e-app';
import {
  approvedRequisition,
  idByCode,
  RequisitionLite,
} from './helpers/factories';

interface JobBody {
  id: string;
  title: string;
  status: string;
  quantity: number;
  salaryMin: number | null;
  salaryMax: number | null;
  publishedAt: string | null;
  applicationCount: number;
  requisition: { id: string; code: string } | null;
  department: { id: string; name: string } | null;
  position: { id: string; name: string } | null;
}
interface Page {
  items: JobBody[];
  meta: { total: number; totalPages: number };
}

const TAG = 'E2E-JOB';

describe('Jobs (e2e)', () => {
  let ctx: E2eContext;
  let manager: string;
  let hr: string;
  let admin: string;
  let recruiter: string;
  let interviewer: string;
  let salesId: string;
  let engId: string;
  let devId: string;

  const cleanup = async () => {
    await ctx.dataSource.query(
      `DELETE FROM activity_logs WHERE
         (entity_type = 'Job' AND entity_id IN (SELECT id::text FROM jobs WHERE title LIKE '${TAG}%'))
      OR (entity_type = 'Requisition' AND entity_id IN (SELECT id::text FROM requisitions WHERE title LIKE '${TAG}%'))`,
    );
    await ctx.dataSource.query(`DELETE FROM jobs WHERE title LIKE '${TAG}%'`);
    await ctx.dataSource.query(
      `DELETE FROM requisitions WHERE title LIKE '${TAG}%'`,
    );
  };

  let seq = 0;
  const approved = (quantity = 3, creator = manager, extra: object = {}) =>
    approvedRequisition(
      ctx.server,
      { creator, approver: hr },
      { title: `${TAG} req ${++seq}`, positionId: devId, quantity, ...extra },
    );

  const post = (token: string, path: string, body: object = {}) =>
    request(ctx.server).post(path).set(bearer(token)).send(body);
  const getJob = (token: string, id: string) =>
    request(ctx.server).get(`/jobs/${id}`).set(bearer(token));

  const makeJob = async (
    req: RequisitionLite,
    body: object = {},
    token = recruiter,
  ): Promise<JobBody> =>
    (await post(token, '/jobs', { requisitionId: req.id, ...body }).expect(201))
      .body as JobBody;

  beforeAll(async () => {
    ctx = await createE2eApp();
    manager = await loginAs(ctx.server, 'manager@hiflow.local');
    hr = await loginAs(ctx.server, 'hr@hiflow.local');
    admin = await loginAs(ctx.server, 'admin@hiflow.local');
    recruiter = await loginAs(ctx.server, 'recruiter@hiflow.local');
    interviewer = await loginAs(ctx.server, 'interviewer@hiflow.local');
    salesId = await idByCode(ctx.dataSource, 'departments', 'SALES');
    engId = await idByCode(ctx.dataSource, 'departments', 'ENG');
    devId = await idByCode(ctx.dataSource, 'job_positions', 'DEV');
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await ctx.app.close();
  });

  describe('access', () => {
    it('requires authentication and list permission', async () => {
      await request(ctx.server).get('/jobs').expect(401);
      await request(ctx.server)
        .get('/jobs')
        .set(bearer(interviewer))
        .expect(403);
    });

    it('lets only roles with create permission create (recruiter yes; manager, HR no)', async () => {
      const req = await approved();

      for (const token of [manager, hr]) {
        await post(token, '/jobs', { requisitionId: req.id }).expect(403);
      }
      await makeJob(req);
    });
  });

  describe('creating from a requisition', () => {
    it('inherits title, headcount, department and position from the requisition', async () => {
      const req = await approved(2);
      const job = await makeJob(req);

      expect(job.status).toBe('DRAFT');
      expect(job.title).toBe(req.title);
      expect(job.quantity).toBe(2);
      expect(job.department?.id).toBe(salesId);
      expect(job.position?.id).toBe(devId);
      expect(job.requisition?.code).toBe(req.code);
      expect(job.applicationCount).toBe(0);
    });

    it('lets the recruiter override title, headcount and details', async () => {
      const req = await approved(5);
      const job = await makeJob(req, {
        title: `${TAG} custom`,
        quantity: 2,
        salaryMin: 10000000,
        salaryMax: 20000000,
        location: 'Hà Nội',
        description: '<p>Mô tả công việc</p>',
      });

      expect(job).toMatchObject({
        title: `${TAG} custom`,
        quantity: 2,
        salaryMin: 10000000,
        salaryMax: 20000000,
      });
    });

    it('refuses a requisition that is not approved', async () => {
      const draft = (
        await post(manager, '/requisitions', {
          title: `${TAG} draft`,
          positionId: devId,
          quantity: 1,
        }).expect(201)
      ).body as RequisitionLite;

      const response = await post(recruiter, '/jobs', {
        requisitionId: draft.id,
      }).expect(409);
      expect((response.body as { message: string }).message).toMatch(
        /đã được duyệt/,
      );

      await post(manager, `/requisitions/${draft.id}/submit`).expect(200);
      await post(recruiter, '/jobs', { requisitionId: draft.id }).expect(409);
    });

    it.each([
      [
        'an unknown requisition',
        { requisitionId: '00000000-0000-4000-8000-000000000000' },
      ],
      ['a malformed requisition id', { requisitionId: 'nope' }],
      ['a missing requisition id', { requisitionId: undefined }],
      ['a zero headcount', { quantity: 0 }],
      ['a negative salary', { salaryMin: -5 }],
      [
        'a department override',
        { departmentId: '00000000-0000-4000-8000-000000000000' },
      ],
      ['a status override', { status: 'OPEN' }],
    ])('rejects %s', async (_label, override) => {
      const req = await approved(1);
      await post(recruiter, '/jobs', {
        requisitionId: req.id,
        ...override,
      }).expect(400);
    });

    it('rejects a maximum salary below the minimum', async () => {
      const req = await approved(1);
      await post(recruiter, '/jobs', {
        requisitionId: req.id,
        salaryMin: 20000000,
        salaryMax: 10000000,
      }).expect(400);
    });
  });

  describe('approved headcount', () => {
    it('never lets live jobs exceed what the requisition approved', async () => {
      const req = await approved(3);
      const first = await makeJob(req, { quantity: 2 });

      const over = await post(recruiter, '/jobs', {
        requisitionId: req.id,
        quantity: 2,
      }).expect(409);
      expect((over.body as { message: string }).message).toMatch(/còn lại 1/);

      const second = await makeJob(req, { quantity: 1 });
      await post(recruiter, '/jobs', {
        requisitionId: req.id,
        quantity: 1,
      }).expect(409);

      // A closed job frees its share again.
      await post(recruiter, `/jobs/${first.id}/publish`).expect(200);
      await post(recruiter, `/jobs/${first.id}/stop`).expect(200);
      await makeJob(req, { quantity: 2 });

      // Raising an existing job past the limit is refused too, but staying put is fine.
      await request(ctx.server)
        .patch(`/jobs/${second.id}`)
        .set(bearer(recruiter))
        .send({ quantity: 2 })
        .expect(409);
      await request(ctx.server)
        .patch(`/jobs/${second.id}`)
        .set(bearer(recruiter))
        .send({ quantity: 1 })
        .expect(200);
    });
  });

  describe('editing', () => {
    it('updates supplied fields only, and validates the merged salary range', async () => {
      const req = await approved(2);
      const job = await makeJob(req, {
        salaryMin: 5000000,
        salaryMax: 9000000,
      });

      const updated = (
        await request(ctx.server)
          .patch(`/jobs/${job.id}`)
          .set(bearer(recruiter))
          .send({ title: `${TAG} renamed` })
          .expect(200)
      ).body as JobBody;
      expect(updated.title).toBe(`${TAG} renamed`);
      expect(updated.salaryMin).toBe(5000000);

      await request(ctx.server)
        .patch(`/jobs/${job.id}`)
        .set(bearer(recruiter))
        .send({ salaryMax: 1000000 })
        .expect(400);
      await request(ctx.server)
        .patch(`/jobs/${job.id}`)
        .set(bearer(recruiter))
        .send({ requisitionId: req.id })
        .expect(400);
    });

    it('refuses to edit a closed job', async () => {
      const req = await approved(1);
      const job = await makeJob(req);
      await post(recruiter, `/jobs/${job.id}/publish`).expect(200);
      await post(recruiter, `/jobs/${job.id}/stop`).expect(200);

      await request(ctx.server)
        .patch(`/jobs/${job.id}`)
        .set(bearer(recruiter))
        .send({ title: `${TAG} late` })
        .expect(409);
    });
  });

  describe('publishing', () => {
    it('opens a draft, stamps the publish time, and closes it again', async () => {
      const req = await approved(1);
      const job = await makeJob(req);
      expect(job.publishedAt).toBeNull();

      const opened = (
        await post(recruiter, `/jobs/${job.id}/publish`).expect(200)
      ).body as JobBody;
      expect(opened.status).toBe('OPEN');
      expect(opened.publishedAt).not.toBeNull();

      await post(recruiter, `/jobs/${job.id}/publish`).expect(409);

      const closed = (await post(recruiter, `/jobs/${job.id}/stop`).expect(200))
        .body as JobBody;
      expect(closed.status).toBe('CLOSED');
      await post(recruiter, `/jobs/${job.id}/stop`).expect(409);
      await post(recruiter, `/jobs/${job.id}/publish`).expect(409);
    });

    it('cannot stop a job that was never published', async () => {
      const job = await makeJob(await approved(1));
      await post(recruiter, `/jobs/${job.id}/stop`).expect(409);
    });

    it('lets only one of two simultaneous publishes win', async () => {
      const job = await makeJob(await approved(1));
      const results = await Promise.all([
        post(recruiter, `/jobs/${job.id}/publish`),
        post(admin, `/jobs/${job.id}/publish`),
      ]);

      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    });

    it('refuses to publish once the requisition is no longer approved', async () => {
      const req = await approved(1);
      const job = await makeJob(req);
      await post(hr, `/requisitions/${req.id}/close`).expect(200);

      // Closing the requisition also closed the draft, so publishing is refused either way.
      await post(recruiter, `/jobs/${job.id}/publish`).expect(409);
    });
  });

  describe('deleting', () => {
    it('deletes a draft but not a published job', async () => {
      const req = await approved(2);
      const draft = await makeJob(req, { quantity: 1 });
      const live = await makeJob(req, { quantity: 1 });
      await post(recruiter, `/jobs/${live.id}/publish`).expect(200);

      await request(ctx.server)
        .delete(`/jobs/${draft.id}`)
        .set(bearer(recruiter))
        .expect(204);
      await getJob(recruiter, draft.id).expect(404);
      await request(ctx.server)
        .delete(`/jobs/${live.id}`)
        .set(bearer(recruiter))
        .expect(409);
    });
  });

  describe('closing a requisition', () => {
    it('stops every draft and open job created from it', async () => {
      const req = await approved(3);
      const draft = await makeJob(req, { quantity: 1 });
      const open = await makeJob(req, { quantity: 1 });
      await post(recruiter, `/jobs/${open.id}/publish`).expect(200);

      await post(hr, `/requisitions/${req.id}/close`).expect(200);

      expect(
        ((await getJob(recruiter, draft.id).expect(200)).body as JobBody)
          .status,
      ).toBe('CLOSED');
      expect(
        ((await getJob(recruiter, open.id).expect(200)).body as JobBody).status,
      ).toBe('CLOSED');
    });
  });

  describe('visibility and listing', () => {
    it('shows a department manager only their own department’s jobs', async () => {
      const salesReq = await approved(1);
      const engReq = await approved(1, admin, { departmentId: engId });
      const salesJob = await makeJob(salesReq);
      const engJob = await makeJob(engReq);

      const page = (
        await request(ctx.server)
          .get(`/jobs?search=${TAG}&limit=100`)
          .set(bearer(manager))
          .expect(200)
      ).body as Page;
      const ids = page.items.map((j) => j.id);

      expect(ids).toContain(salesJob.id);
      expect(ids).not.toContain(engJob.id);
      await getJob(manager, engJob.id).expect(404);
      await getJob(hr, engJob.id).expect(200);
    });

    it('filters, sorts and paginates', async () => {
      const req = await approved(3);
      const [a, b, c] = [
        await makeJob(req, { title: `${TAG} list A`, quantity: 1 }),
        await makeJob(req, { title: `${TAG} list B`, quantity: 1 }),
        await makeJob(req, { title: `${TAG} list C`, quantity: 1 }),
      ];
      await post(recruiter, `/jobs/${b.id}/publish`).expect(200);

      const first = (
        await request(ctx.server)
          .get(
            `/jobs?requisitionId=${req.id}&limit=2&page=1&sortBy=title&sortDir=asc`,
          )
          .set(bearer(hr))
          .expect(200)
      ).body as Page;
      expect(first.items.map((j) => j.id)).toEqual([a.id, b.id]);
      expect(first.meta).toMatchObject({ total: 3, totalPages: 2 });

      const open = (
        await request(ctx.server)
          .get(`/jobs?requisitionId=${req.id}&status=OPEN`)
          .set(bearer(hr))
          .expect(200)
      ).body as Page;
      expect(open.items.map((j) => j.id)).toEqual([b.id]);

      const found = (
        await request(ctx.server)
          .get(`/jobs?search=${encodeURIComponent(`${TAG} list C`)}`)
          .set(bearer(hr))
          .expect(200)
      ).body as Page;
      expect(found.items.map((j) => j.id)).toEqual([c.id]);
    });

    it('rejects bad query values', async () => {
      for (const q of [
        'status=WIZARD',
        'sortBy=description',
        'departmentId=nope',
        'limit=500',
      ]) {
        await request(ctx.server).get(`/jobs?${q}`).set(bearer(hr)).expect(400);
      }
    });

    it('answers 404 for an unknown job and 400 for a malformed id', async () => {
      await getJob(hr, '00000000-0000-4000-8000-000000000000').expect(404);
      await getJob(hr, 'nope').expect(400);
    });
  });
});
