import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { createE2eApp, E2eContext } from './helpers/e2e-app';

describe('Uploaded files are private (e2e)', () => {
  let ctx: E2eContext;
  let root: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'hiflow-e2e-'));
    await mkdir(join(root, 'cv'), { recursive: true });
    await writeFile(join(root, 'cv', 'sample.pdf'), '%PDF-1.4 e2e body');
    await writeFile(join(root, 'cv', '.hidden'), 'top-secret');

    // ConfigService prefers process.env over the .env file.
    process.env.UPLOAD_DIR = root;
    ctx = await createE2eApp();
  });

  afterAll(async () => {
    await ctx.app.close();
    delete process.env.UPLOAD_DIR;
    await rm(root, { recursive: true, force: true });
  });

  it.each([
    '/uploads/cv/sample.pdf',
    '/cv/sample.pdf',
    '/uploads/cv/',
    '/uploads/cv/.hidden',
    '/uploads/cv/..%2F..%2Fsample.pdf',
  ])('does not serve the upload folder over HTTP: %s', async (path) => {
    const response = await request(ctx.server).get(path);

    // 401 or 404 both mean "not served"; what matters is that no bytes leak.
    expect([401, 404]).toContain(response.status);
    expect(response.text).not.toContain('e2e body');
    expect(response.text).not.toContain('top-secret');
  });
});
