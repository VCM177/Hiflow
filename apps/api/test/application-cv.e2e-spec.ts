import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import request from 'supertest';
import { StorageService } from './../src/modules/storage/storage.service';
import { bearer, createE2eApp, E2eContext } from './helpers/e2e-app';
import { idByCode } from './helpers/factories';
import { createFlow, FlowTokens, loginAll } from './helpers/flow';

const PDF = Buffer.from('%PDF-1.4\n% cv sent with an application\n');

interface Detail {
  hasCv: boolean;
  candidateDetail: { hasCv: boolean } | null;
}

describe('CV that comes with an application (e2e)', () => {
  let ctx: E2eContext;
  let t: FlowTokens;
  let flow: ReturnType<typeof createFlow>;
  let uploadRoot: string;

  const cvOf = (appId: string, token: string) =>
    request(ctx.server).get(`/applications/${appId}/cv`).set(bearer(token));
  const detailOf = async (appId: string, token = t.recruiter) =>
    (
      await request(ctx.server)
        .get(`/applications/${appId}`)
        .set(bearer(token))
        .expect(200)
    ).body as Detail;

  /** Stores a real file through the storage port and links it to the application. */
  const attachCv = async (appId: string): Promise<string> => {
    const { key } = await ctx.app.get(StorageService).upload({
      originalname: 'cv.pdf',
      mimetype: 'application/pdf',
      size: PDF.length,
      buffer: PDF,
    });
    await ctx.dataSource.query(
      `UPDATE applications SET cv_file_key = $1 WHERE id = $2`,
      [key, appId],
    );
    return key;
  };

  beforeAll(async () => {
    uploadRoot = await mkdtemp(join(tmpdir(), 'hiflow-appcv-'));
    process.env.UPLOAD_DIR = uploadRoot;

    ctx = await createE2eApp();
    t = await loginAll(ctx);
    flow = createFlow(ctx, t, 'E2E-appcv');
  });

  afterAll(async () => {
    await flow.cleanup();
    await ctx.app.close();
    delete process.env.UPLOAD_DIR;
    await rm(uploadRoot, { recursive: true, force: true });
  });

  it('says so in the detail, without exposing where the file is', async () => {
    const appId = await flow.application(await flow.openJob());
    expect((await detailOf(appId)).hasCv).toBe(false);

    await attachCv(appId);
    const detail = await detailOf(appId);

    expect(detail.hasCv).toBe(true);
    expect(JSON.stringify(detail)).not.toContain('cv/');
  });

  it('keeps the application CV apart from the candidate profile CV', async () => {
    const appId = await flow.application(await flow.openJob());
    await attachCv(appId);

    expect((await detailOf(appId)).candidateDetail?.hasCv).toBe(false);
  });

  it('downloads as a private, non-sniffable attachment named after the application', async () => {
    const appId = await flow.application(await flow.openJob());
    await attachCv(appId);

    const download = await cvOf(appId, t.recruiter).expect(200);

    expect(download.headers['content-type']).toContain('application/pdf');
    expect(download.headers['content-disposition']).toBe(
      `attachment; filename="CV-${appId}.pdf"`,
    );
    expect(download.headers['x-content-type-options']).toBe('nosniff');
    expect(download.headers['cache-control']).toBe('private, no-store');
    expect(Buffer.from(download.body as Buffer).equals(PDF)).toBe(true);
  });

  it('answers 404 when the application has no CV, and 401 without a login', async () => {
    const appId = await flow.application(await flow.openJob());

    await cvOf(appId, t.recruiter).expect(404);
    await request(ctx.server).get(`/applications/${appId}/cv`).expect(401);
    await cvOf('00000000-0000-4000-8000-000000000000', t.recruiter).expect(404);
  });

  describe('scope', () => {
    it('lets a department manager download only for their own department', async () => {
      const engId = await idByCode(ctx.dataSource, 'departments', 'ENG');
      const ownApp = await flow.application(await flow.openJob());
      const otherApp = await flow.application(
        await flow.openJob({
          creator: t.admin,
          extra: { departmentId: engId },
        }),
      );
      await attachCv(ownApp);
      await attachCv(otherApp);

      await cvOf(ownApp, t.manager).expect(200);
      // Out of scope looks exactly like "does not exist".
      await cvOf(otherApp, t.manager).expect(404);
    });

    it('lets an interviewer download only for applications they interview', async () => {
      const jobId = await flow.openJob();
      const scheduled = await flow.toInterviewStage(jobId);
      const stranger = await flow.toInterviewStage(jobId);
      await attachCv(scheduled);
      await attachCv(stranger);
      await flow.scheduleInterview(scheduled);

      await cvOf(scheduled, t.interviewer).expect(200);
      await cvOf(stranger, t.interviewer).expect(404);
    });
  });

  it('deletes the file together with the application', async () => {
    const appId = await flow.application(await flow.openJob());
    const key = await attachCv(appId);
    const onDisk = join(uploadRoot, 'cv', basename(key));
    expect(existsSync(onDisk)).toBe(true);

    await request(ctx.server)
      .delete(`/applications/${appId}`)
      .set(bearer(t.recruiter))
      .expect(204);

    expect(existsSync(onDisk)).toBe(false);
  });
});
