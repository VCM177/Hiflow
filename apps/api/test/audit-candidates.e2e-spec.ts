import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { auditEvents, rowChanges } from './helpers/audit';
import { bearer, createE2eApp, E2eContext } from './helpers/e2e-app';
import { createFlow, FlowTokens, loginAll } from './helpers/flow';

const TAG = 'E2E-AUDCAN';
const PDF = Buffer.from('%PDF-1.4\n% cv for the audit trail\n');

describe('Audit trail: candidates (e2e)', () => {
  let ctx: E2eContext;
  let t: FlowTokens;
  let flow: ReturnType<typeof createFlow>;
  let uploadRoot: string;
  let recruiterId: string;
  let hrId: string;
  const tracked: string[] = [];

  const idOf = async (email: string) =>
    (
      await ctx.maintenance.query<{ id: string }[]>(
        `SELECT id FROM users WHERE email = $1`,
        [email],
      )
    )[0].id;

  const candidate = async (): Promise<{ id: string; email: string }> => {
    const created = await flow.candidate('aud');
    tracked.push(created.id);
    return created;
  };
  const trail = (id: string) => auditEvents(ctx, { entityId: id });
  const upload = (id: string, token = t.recruiter) =>
    request(ctx.server)
      .post(`/candidates/${id}/cv`)
      .set(bearer(token))
      .attach('file', PDF, { filename: 'cv.pdf' });

  const purge = async () => {
    const jobs = `job_id IN (SELECT id FROM jobs WHERE title LIKE '${TAG}%')`;
    const ids = [
      ...tracked,
      ...(
        await ctx.maintenance.query<{ candidate_id: string }[]>(
          `SELECT DISTINCT candidate_id FROM applications WHERE ${jobs}`,
        )
      ).map((r) => r.candidate_id),
    ];
    await ctx.maintenance.query(`DELETE FROM applications WHERE ${jobs}`);
    await ctx.maintenance.query(`DELETE FROM candidates WHERE id = ANY($1)`, [
      ids,
    ]);
    await flow.cleanup();
  };

  beforeAll(async () => {
    uploadRoot = await mkdtemp(join(tmpdir(), 'hiflow-audcan-'));
    process.env.UPLOAD_DIR = uploadRoot;

    ctx = await createE2eApp();
    t = await loginAll(ctx);
    flow = createFlow(ctx, t, TAG);
    recruiterId = await idOf('recruiter@hiflow.local');
    hrId = await idOf('hr@hiflow.local');
    await purge();
  });

  afterAll(async () => {
    await purge();
    await ctx.app.close();
    delete process.env.UPLOAD_DIR;
    await rm(uploadRoot, { recursive: true, force: true });
  });

  it('records the creation by the recruiter, with what was inserted', async () => {
    const created = await candidate();

    const [event] = await trail(created.id);
    expect(event).toMatchObject({
      event: 'CANDIDATE_CREATED',
      entity_type: 'Candidate',
      actor_id: recruiterId,
      data: {},
    });
    const [change] = await rowChanges(ctx, event);
    expect(change.changes).toMatchObject({ email: created.email });
  });

  it('records the fields an edit changed, and nothing for one that changed none', async () => {
    const created = await candidate();
    const patch = (body: object) =>
      request(ctx.server)
        .patch(`/candidates/${created.id}`)
        .set(bearer(t.recruiter))
        .send(body);

    await patch({ phone: '0912345678', source: 'REFERRAL' }).expect(200);
    await patch({ phone: '0912345678' }).expect(200);

    const updates = (await trail(created.id)).filter(
      (e) => e.event === 'CANDIDATE_UPDATED',
    );
    expect(updates).toHaveLength(1);
    expect(updates[0].data).toEqual({ changedFields: ['phone', 'source'] });
    expect((await rowChanges(ctx, updates[0]))[0].changes).toMatchObject({
      phone: [null, '0912345678'],
      source: ['OTHER', 'REFERRAL'],
    });
  });

  it('records a note change without putting the note in the event', async () => {
    const created = await candidate();
    const put = (note: string) =>
      request(ctx.server)
        .put(`/candidates/${created.id}/note`)
        .set(bearer(t.recruiter))
        .send({ note });

    await put('Ứng viên rất tiềm năng').expect(200);
    await put('Ứng viên rất tiềm năng').expect(200);

    const events = (await trail(created.id)).filter(
      (e) => e.event === 'CANDIDATE_NOTE_UPDATED',
    );
    expect(events).toHaveLength(1);
    expect(events[0].data).toEqual({});
    expect(JSON.stringify(events)).not.toContain('tiềm năng');
  });

  it('records a CV upload, every download of it, and its removal', async () => {
    const created = await candidate();

    await upload(created.id).expect(200);
    await request(ctx.server)
      .get(`/candidates/${created.id}/cv`)
      .set(bearer(t.hr))
      .expect(200);
    await request(ctx.server)
      .get(`/candidates/${created.id}/cv`)
      .set(bearer(t.recruiter))
      .expect(200);
    await request(ctx.server)
      .delete(`/candidates/${created.id}/cv`)
      .set(bearer(t.recruiter))
      .expect(200);

    const events = await trail(created.id);
    expect(events.map((e) => [e.event, e.actor_role])).toEqual([
      ['CANDIDATE_CREATED', 'RECRUITER'],
      ['CANDIDATE_CV_UPLOADED', 'RECRUITER'],
      ['CANDIDATE_CV_DOWNLOADED', 'HR_MANAGER'],
      ['CANDIDATE_CV_DOWNLOADED', 'RECRUITER'],
      ['CANDIDATE_CV_REMOVED', 'RECRUITER'],
    ]);
    // A download changes no row, so it has none; the upload shows the column set.
    expect(await rowChanges(ctx, events[2])).toEqual([]);
    expect(JSON.stringify(await rowChanges(ctx, events[1]))).toContain(
      'cv_file_key',
    );
  });

  it('records no download when the candidate has no CV or the caller may not see them', async () => {
    const created = await candidate();

    await request(ctx.server)
      .get(`/candidates/${created.id}/cv`)
      .set(bearer(t.hr))
      .expect(404);
    await request(ctx.server)
      .get(`/candidates/${created.id}/cv`)
      .set(bearer(t.manager))
      .expect(403);

    expect(
      (await trail(created.id)).some(
        (e) => e.event === 'CANDIDATE_CV_DOWNLOADED',
      ),
    ).toBe(false);
  });

  it('records a delete, and refuses one that the database forbids without a trace', async () => {
    const gone = await candidate();
    const used = await candidate();
    const jobId = await flow.openJob();
    await flow.application(jobId, used.id);

    await request(ctx.server)
      .delete(`/candidates/${gone.id}`)
      .set(bearer(t.recruiter))
      .expect(204);
    await request(ctx.server)
      .delete(`/candidates/${used.id}`)
      .set(bearer(t.recruiter))
      .expect(409);

    expect((await trail(gone.id)).at(-1)?.event).toBe('CANDIDATE_DELETED');
    expect(
      (await trail(used.id)).some((e) => e.event === 'CANDIDATE_DELETED'),
    ).toBe(false);
  });

  it('records an anonymisation by HR, and the same transaction shows what was erased', async () => {
    const created = await candidate();
    await request(ctx.server)
      .patch(`/candidates/${created.id}`)
      .set(bearer(t.recruiter))
      .send({ phone: '0987654321' })
      .expect(200);

    await flow.post(t.hr, `/candidates/${created.id}/anonymize`).expect(200);

    const event = (await trail(created.id)).at(-1)!;
    expect(event).toMatchObject({
      event: 'CANDIDATE_ANONYMIZED',
      actor_id: hrId,
      data: { trigger: 'REQUEST' },
    });
    const change = (await rowChanges(ctx, event)).find(
      (c) => c.table_name === 'candidates',
    );
    expect(change?.changes).toMatchObject({
      phone: ['0987654321', null],
      full_name: [expect.any(String) as unknown, 'Ứng viên đã ẩn danh'],
    });
  });
});
