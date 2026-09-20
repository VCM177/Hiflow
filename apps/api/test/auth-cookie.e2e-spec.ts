import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { seedPassword } from './../src/database/seeds/base.seeder';
import { createE2eApp } from './helpers/e2e-app';

const COOKIE = 'hf_access_token';

interface LoginBody {
  accessToken: string;
  user: { email: string };
}

describe('Session cookie (e2e, seeded accounts)', () => {
  let app: INestApplication;
  let server: App;
  let dataSource: DataSource;

  const login = (email: string) =>
    request(server)
      .post('/auth/login')
      .send({ email, password: seedPassword() });

  const setCookieOf = (response: request.Response): string => {
    const header = response.headers['set-cookie'] as unknown as string[];
    return header.find((line) => line.startsWith(`${COOKIE}=`)) ?? '';
  };

  const logRowsFor = async (route: string): Promise<number> => {
    const rows: { count: string }[] = await dataSource.query(
      `SELECT COUNT(*) AS count FROM activity_logs WHERE payload->>'route' = $1`,
      [route],
    );
    return Number(rows[0].count);
  };

  beforeAll(async () => {
    const ctx = await createE2eApp();
    app = ctx.app;
    server = ctx.server;
    dataSource = ctx.dataSource;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('login', () => {
    it('sets a cookie that scripts cannot read, that needs HTTPS and that never travels cross-site', async () => {
      const response = await login('hr@hiflow.local').expect(200);
      const cookie = setCookieOf(response);

      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Secure');
      expect(cookie).toContain('SameSite=Strict');
      expect(cookie).toContain('Path=/');
      expect(cookie).toMatch(/Max-Age=\d+/);
    });

    it('keeps the token in the body for API clients, and the cookie carries the same token', async () => {
      const response = await login('hr@hiflow.local').expect(200);
      const body = response.body as LoginBody;

      expect(setCookieOf(response)).toContain(`${COOKIE}=${body.accessToken}`);
    });

    it('sets no cookie when the login fails', async () => {
      const response = await request(server)
        .post('/auth/login')
        .send({ email: 'hr@hiflow.local', password: 'wrong-password' })
        .expect(401);

      expect(response.headers['set-cookie']).toBeUndefined();
    });
  });

  describe('authenticating with the cookie', () => {
    it('accepts the cookie on its own', async () => {
      const token = ((await login('hr@hiflow.local')).body as LoginBody)
        .accessToken;

      const me = await request(server)
        .get('/auth/me')
        .set('Cookie', `${COOKIE}=${token}`)
        .expect(200);

      expect((me.body as { email: string }).email).toBe('hr@hiflow.local');
    });

    it('still accepts a Bearer header', async () => {
      const token = ((await login('hr@hiflow.local')).body as LoginBody)
        .accessToken;

      await request(server)
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('prefers an explicit Bearer header over a cookie', async () => {
      const hr = ((await login('hr@hiflow.local')).body as LoginBody)
        .accessToken;
      const admin = ((await login('admin@hiflow.local')).body as LoginBody)
        .accessToken;

      const me = await request(server)
        .get('/auth/me')
        .set('Authorization', `Bearer ${hr}`)
        .set('Cookie', `${COOKIE}=${admin}`)
        .expect(200);

      expect((me.body as { email: string }).email).toBe('hr@hiflow.local');
    });

    it.each([
      ['a garbage value', 'not-a-token'],
      ['an empty value', ''],
    ])('answers 401 for %s', async (_label, value) => {
      await request(server)
        .get('/auth/me')
        .set('Cookie', `${COOKIE}=${value}`)
        .expect(401);
    });

    it('answers 401 for a token whose signature was tampered with', async () => {
      const token = ((await login('hr@hiflow.local')).body as LoginBody)
        .accessToken;
      const tampered = `${token.slice(0, -4)}AAAA`;

      await request(server)
        .get('/auth/me')
        .set('Cookie', `${COOKIE}=${tampered}`)
        .expect(401);
    });

    it('answers 401 with no credentials at all', async () => {
      await request(server).get('/auth/me').expect(401);
    });
  });

  describe('logout', () => {
    it('clears the cookie with the same attributes, without needing a valid session', async () => {
      const response = await request(server).post('/auth/logout').expect(204);
      const cookie = setCookieOf(response);

      expect(cookie).toMatch(new RegExp(`^${COOKIE}=;`));
      expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/);
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Secure');
      expect(cookie).toContain('SameSite=Strict');
    });

    it('is not written to the activity log, like login', async () => {
      const before = await logRowsFor('/auth/logout');

      await request(server).post('/auth/logout').expect(204);
      await login('hr@hiflow.local').expect(200);

      // Give the fire-and-forget audit write time to land, then compare.
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(await logRowsFor('/auth/logout')).toBe(before);
      expect(await logRowsFor('/auth/login')).toBe(0);
    });
  });
});
