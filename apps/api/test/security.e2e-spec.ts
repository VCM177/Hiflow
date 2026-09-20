import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
// Must stay before e2e-app: it sets the env the app reads when first imported.
import {
  ALLOWED_ORIGIN,
  PROXY_SECRET,
  restoreSecurityEnv,
} from './helpers/security-env';
import { createE2eApp } from './helpers/e2e-app';

const HEADER = 'x-hiflow-proxy-secret';

describe('Proxy secret and CORS (e2e)', () => {
  let app: INestApplication;
  let server: App;

  beforeAll(async () => {
    const ctx = await createE2eApp();
    app = ctx.app;
    server = ctx.server;
  });

  afterAll(async () => {
    await app.close();
    restoreSecurityEnv();
  });

  describe('proxy secret', () => {
    it('answers 404 to a call that skipped the proxy, on every kind of route', async () => {
      await request(server).get('/health').expect(404);
      await request(server)
        .post('/auth/login')
        .send({ email: 'admin@hiflow.local', password: 'x' })
        .expect(404);
      await request(server).get('/candidates').expect(404);
    });

    it('answers 404 to a wrong secret, with the same body as an unknown route', async () => {
      const wrong = await request(server)
        .get('/health')
        .set(HEADER, 'not-the-secret')
        .expect(404);
      const unknown = await request(server)
        .get('/does-not-exist')
        .set(HEADER, 'not-the-secret')
        .expect(404);

      expect(wrong.body).toMatchObject({ error: 'Not Found', statusCode: 404 });
      expect(unknown.body).toMatchObject({
        error: 'Not Found',
        statusCode: 404,
      });
    });

    it('lets a call through when it carries the secret', async () => {
      await request(server)
        .get('/health')
        .set(HEADER, PROXY_SECRET)
        .expect(200);
    });
  });

  describe('CORS', () => {
    const preflight = (origin: string) =>
      request(server)
        .options('/health')
        .set(HEADER, PROXY_SECRET)
        .set('Origin', origin)
        .set('Access-Control-Request-Method', 'GET');

    it('echoes an allowed origin exactly, with credentials, never a wildcard', async () => {
      const response = await preflight(ALLOWED_ORIGIN);

      expect(response.headers['access-control-allow-origin']).toBe(
        ALLOWED_ORIGIN,
      );
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('sends no CORS header to an origin that is not listed', async () => {
      const response = await preflight('https://evil.example');

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('does not treat a look-alike of an allowed origin as allowed', async () => {
      for (const origin of [
        `${ALLOWED_ORIGIN}.evil.example`,
        'http://hiflow.example',
        'null',
      ]) {
        const response = await preflight(origin);

        expect(response.headers['access-control-allow-origin']).toBeUndefined();
      }
    });
  });
});
