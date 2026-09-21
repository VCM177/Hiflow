import request from 'supertest';
import { bearer, createE2eApp, E2eContext } from './helpers/e2e-app';
import { approvedRequisition, idByCode } from './helpers/factories';
import { createFlow, FlowTokens, loginAll } from './helpers/flow';

interface PublicJob {
  id: string;
  title: string;
  department: string | null;
  position: string | null;
  location: string | null;
  description: string | null;
  quantity: number;
  salaryMin: number | null;
  salaryMax: number | null;
  publishedAt: string | null;
}
interface Page {
  items: PublicJob[];
  meta: { total: number; totalPages: number; page: number; limit: number };
}

const NIL = '00000000-0000-4000-8000-000000000000';
const TAG = 'E2E-pubjobs';

describe('Public job board (e2e)', () => {
  let ctx: E2eContext;
  let t: FlowTokens;
  let flow: ReturnType<typeof createFlow>;
  let devId: string;
  let engId: string;
  let seq = 0;

  const get = (path: string) => request(ctx.server).get(path);

  /** A job in the requested state, created through the API like a recruiter would. */
  const makeJob = async (
    state: 'draft' | 'open' | 'closed',
    extra: Record<string, unknown> = {},
    title = `${TAG} job ${++seq}`,
    departmentId?: string,
  ): Promise<string> => {
    // The department comes from the requisition, so a specific one needs an
    // admin (a department manager can only ask for their own).
    const requisition = await approvedRequisition(
      ctx.server,
      { creator: departmentId ? t.admin : t.manager, approver: t.hr },
      {
        title: `${TAG} req ${seq}`,
        positionId: devId,
        quantity: 5,
        ...(departmentId ? { departmentId } : {}),
      },
    );
    const job = (
      await request(ctx.server)
        .post('/jobs')
        .set(bearer(t.recruiter))
        .send({ requisitionId: requisition.id, title, ...extra })
        .expect(201)
    ).body as { id: string };

    if (state !== 'draft') {
      await request(ctx.server)
        .post(`/jobs/${job.id}/publish`)
        .set(bearer(t.recruiter))
        .expect(200);
    }
    if (state === 'closed') {
      await request(ctx.server)
        .post(`/jobs/${job.id}/stop`)
        .set(bearer(t.recruiter))
        .expect(200);
    }
    return job.id;
  };

  beforeAll(async () => {
    ctx = await createE2eApp();
    t = await loginAll(ctx);
    flow = createFlow(ctx, t, TAG);
    devId = await idByCode(ctx.dataSource, 'job_positions', 'DEV');
    engId = await idByCode(ctx.dataSource, 'departments', 'ENG');
  });

  afterAll(async () => {
    await flow.cleanup();
    await ctx.app.close();
  });

  it('needs no login', async () => {
    await get('/public/jobs').expect(200);
    await get(`/public/jobs/${await makeJob('open')}`).expect(200);
  });

  describe('which jobs are public', () => {
    it('lists an open job and leaves out drafts and closed jobs', async () => {
      const open = await makeJob('open', {}, `${TAG} visible`);
      const draft = await makeJob('draft', {}, `${TAG} hidden draft`);
      const closed = await makeJob('closed', {}, `${TAG} hidden closed`);

      const ids = (
        (await get(`/public/jobs?search=${TAG}&limit=100`).expect(200))
          .body as Page
      ).items.map((job) => job.id);

      expect(ids).toContain(open);
      expect(ids).not.toContain(draft);
      expect(ids).not.toContain(closed);
    });

    it('answers 404 for a draft, a closed job and an unknown id, all alike', async () => {
      const draft = await get(`/public/jobs/${await makeJob('draft')}`).expect(
        404,
      );
      const closed = await get(
        `/public/jobs/${await makeJob('closed')}`,
      ).expect(404);
      const unknown = await get(`/public/jobs/${NIL}`).expect(404);

      expect(draft.body).toEqual(unknown.body);
      expect(closed.body).toEqual(unknown.body);
    });

    it('stops showing a job as soon as it is closed', async () => {
      const id = await makeJob('open');
      await get(`/public/jobs/${id}`).expect(200);

      await request(ctx.server)
        .post(`/jobs/${id}/stop`)
        .set(bearer(t.recruiter))
        .expect(200);

      await get(`/public/jobs/${id}`).expect(404);
    });

    it('rejects a malformed id with 400, not a server error', async () => {
      await get('/public/jobs/not-a-uuid').expect(400);
    });
  });

  describe('what a visitor sees', () => {
    it('shows the salary and the fields written for candidates', async () => {
      const id = await makeJob('open', {
        salaryMin: 15000000,
        salaryMax: 25000000,
        location: 'Hà Nội',
        description: '<p>Mô tả công việc</p>',
      });

      const job = (await get(`/public/jobs/${id}`).expect(200))
        .body as PublicJob;

      expect(job).toMatchObject({
        id,
        department: expect.any(String) as string,
        position: 'Lập trình viên',
        location: 'Hà Nội',
        description: '<p>Mô tả công việc</p>',
        salaryMin: 15000000,
        salaryMax: 25000000,
      });
    });

    it('never leaks internal fields, in the list or in the detail', async () => {
      const id = await makeJob('open');
      const allowed = [
        'department',
        'description',
        'id',
        'location',
        'position',
        'publishedAt',
        'quantity',
        'salaryMax',
        'salaryMin',
        'title',
      ];

      const detail = (await get(`/public/jobs/${id}`).expect(200))
        .body as PublicJob;
      const listed = (
        (await get(`/public/jobs?search=${TAG}&limit=100`).expect(200))
          .body as Page
      ).items.find((job) => job.id === id)!;

      expect(Object.keys(detail).sort()).toEqual(allowed);
      expect(Object.keys(listed).sort()).toEqual(allowed);

      const raw = JSON.stringify([detail, listed]);
      for (const internal of [
        'requisition',
        'createdBy',
        'applicationCount',
        'status',
        'REQ-',
        '@hiflow.local',
      ]) {
        expect(raw).not.toContain(internal);
      }
    });
  });

  describe('listing', () => {
    it('filters by department and by title', async () => {
      const a = await makeJob('open', {}, `${TAG} filter alpha`, engId);
      const b = await makeJob('open', {}, `${TAG} filter beta`);

      const byTitle = (
        (
          await get(
            `/public/jobs?search=${encodeURIComponent(`${TAG} filter alpha`)}`,
          ).expect(200)
        ).body as Page
      ).items.map((job) => job.id);
      expect(byTitle).toEqual([a]);

      const byDepartment = (
        (
          await get(
            `/public/jobs?departmentId=${engId}&search=${TAG}&limit=100`,
          ).expect(200)
        ).body as Page
      ).items.map((job) => job.id);
      expect(byDepartment).toContain(a);
      expect(byDepartment).not.toContain(b);
    });

    it('treats search text literally, so % and _ are not wildcards', async () => {
      await makeJob('open', {}, `${TAG} plain title`);

      const page = (
        await get(`/public/jobs?search=${encodeURIComponent('%')}`).expect(200)
      ).body as Page;

      expect(page.items.every((job) => job.title.includes('%'))).toBe(true);
    });

    it('paginates and sorts by a whitelisted column only', async () => {
      await makeJob('open', {}, `${TAG} sort a`);
      await makeJob('open', {}, `${TAG} sort b`);

      const first = (
        await get(
          `/public/jobs?search=${encodeURIComponent(`${TAG} sort`)}&sortBy=title&sortDir=asc&limit=1&page=1`,
        ).expect(200)
      ).body as Page;
      expect(first.items.map((job) => job.title)).toEqual([`${TAG} sort a`]);
      expect(first.meta).toMatchObject({ total: 2, totalPages: 2, limit: 1 });

      for (const bad of [
        'sortBy=createdById',
        'sortBy=status',
        'limit=1000',
        'page=0',
        'departmentId=nope',
        'status=DRAFT',
      ]) {
        await get(`/public/jobs?${bad}`).expect(400);
      }
    });

    it('ignores a status filter smuggled in: drafts stay hidden', async () => {
      const draft = await makeJob('draft', {}, `${TAG} smuggled draft`);

      const response = await get(`/public/jobs?status=DRAFT&search=${TAG}`);

      // Unknown query fields are refused by validation rather than obeyed.
      expect(response.status).toBe(400);
      const ids = (
        (
          await get(
            `/public/jobs?search=${encodeURIComponent(`${TAG} smuggled`)}`,
          ).expect(200)
        ).body as Page
      ).items.map((job) => job.id);
      expect(ids).not.toContain(draft);
    });
  });
});
