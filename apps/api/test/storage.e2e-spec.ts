import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';

describe('Uploaded files (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;
  let root: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'hiflow-e2e-'));
    await mkdir(join(root, 'cv'), { recursive: true });
    await writeFile(join(root, 'cv', 'sample.pdf'), '%PDF-1.4 e2e body');
    await writeFile(join(root, 'cv', '.hidden'), 'top-secret');

    // ConfigService prefers process.env over the .env file.
    process.env.UPLOAD_DIR = root;

    // Deliberately NestFactory (as main.ts does), not Test.createTestingModule:
    // ServeStaticModule picks its loader while providers are built, which in a
    // testing module happens before the HTTP adapter exists and yields a no-op
    // loader that silently serves nothing.
    app = await NestFactory.create<NestExpressApplication>(AppModule, {
      logger: false,
    });
    configureApp(app);
    await app.init();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
    delete process.env.UPLOAD_DIR;
    await rm(root, { recursive: true, force: true });
  });

  it('serves a stored file as a non-sniffable attachment', async () => {
    const response = await request(server)
      .get('/uploads/cv/sample.pdf')
      .expect(200);

    expect(response.headers['content-disposition']).toBe('attachment');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.body).toBeDefined();
  });

  it('answers 404 for a file that does not exist', () => {
    return request(server).get('/uploads/cv/missing.pdf').expect(404);
  });

  it('does not list the directory', async () => {
    const response = await request(server).get('/uploads/cv/');

    expect(response.status).not.toBe(200);
    expect(response.text).not.toContain('sample.pdf');
  });

  it('refuses dotfiles', async () => {
    const response = await request(server).get('/uploads/cv/.hidden');

    expect(response.status).not.toBe(200);
    expect(response.text).not.toContain('top-secret');
  });
});
