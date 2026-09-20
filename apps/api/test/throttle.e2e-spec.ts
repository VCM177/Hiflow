import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
// Must stay before e2e-app: it sets the env the app reads when first imported.
import { restoreThrottleEnv } from './helpers/real-throttle-env';
import { createE2eApp } from './helpers/e2e-app';

const LOGIN_IP_LIMIT = 10;
const LOGIN_ACCOUNT_LIMIT = 20;

describe('Login rate limiting (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let ipCounter = 0;

  // A fresh address per call, so one test's attempts never count against another's.
  const nextIp = () => `198.51.100.${++ipCounter}`;

  const attempt = (email: string, ip: string) =>
    request(server)
      .post('/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ email, password: 'wrong-password' });

  beforeAll(async () => {
    const ctx = await createE2eApp();
    app = ctx.app;
    server = ctx.server;
  });

  afterAll(async () => {
    await app.close();
    restoreThrottleEnv();
  });

  it('answers 429 with Retry-After once one address has used up its attempts', async () => {
    const ip = nextIp();

    for (let i = 0; i < LOGIN_IP_LIMIT; i++) {
      await attempt(`e2e-ip-${i}@hiflow.local`, ip).expect(401);
    }

    const blocked = await attempt('e2e-ip-x@hiflow.local', ip).expect(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });

  it("does not let one address's block spill onto another address", async () => {
    const other = nextIp();

    await attempt('e2e-other@hiflow.local', other).expect(401);
  });

  it('blocks a guessed account even when every attempt comes from a different address', async () => {
    const email = 'e2e-target@hiflow.local';

    for (let i = 0; i < LOGIN_ACCOUNT_LIMIT; i++) {
      await attempt(email, nextIp()).expect(401);
    }

    await attempt(email, nextIp()).expect(429);
    // The email is matched ignoring case, so a different spelling is the same account.
    await attempt(email.toUpperCase(), nextIp()).expect(429);
  });

  it('does not throttle a different account from a fresh address', async () => {
    await attempt('e2e-bystander@hiflow.local', nextIp()).expect(401);
  });

  it('still counts a request whose body has no usable email, by address', async () => {
    const ip = nextIp();

    for (let i = 0; i < LOGIN_IP_LIMIT; i++) {
      await request(server)
        .post('/auth/login')
        .set('X-Forwarded-For', ip)
        .send({ email: { $ne: '' }, password: 'x' })
        .expect(400);
    }

    await request(server)
      .post('/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ email: { $ne: '' }, password: 'x' })
      .expect(429);
  });

  it('never throttles the health check that the keep-alive job calls', async () => {
    const ip = nextIp();

    for (let i = 0; i < LOGIN_IP_LIMIT * 3; i++) {
      await request(server)
        .get('/health')
        .set('X-Forwarded-For', ip)
        .expect(200);
    }
  });
});
