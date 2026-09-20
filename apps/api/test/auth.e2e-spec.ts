import { PERMISSIONS } from '@hiflow/shared-types';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { seedBase, seedPassword } from './../src/database/seeds/base.seeder';

interface LoginBody {
  accessToken: string;
  user: { role: string; permissions: string[]; email: string };
}

describe('Auth (e2e, seeded accounts)', () => {
  let app: INestApplication<App>;
  const password = seedPassword();

  const login = (email: string, pass = password) =>
    request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: pass });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    await seedBase(app.get(DataSource), password);
  });

  afterAll(async () => {
    await app.close();
  });

  it('logs a seeded HR manager in and returns a signed token', async () => {
    const response = await login('hr@hiflow.local').expect(200);
    const body = response.body as LoginBody;

    expect(body.user.role).toBe('HR_MANAGER');
    expect(body.accessToken.split('.')).toHaveLength(3);
  });

  it('gives the admin every permission and an interviewer only a few', async () => {
    const admin = (await login('admin@hiflow.local').expect(200))
      .body as LoginBody;
    const interviewer = (await login('interviewer@hiflow.local').expect(200))
      .body as LoginBody;

    expect(admin.user.permissions).toEqual(['*']);
    expect(interviewer.user.permissions).toContain(
      PERMISSIONS.interview.resultRecord,
    );
    expect(interviewer.user.permissions).not.toContain(
      PERMISSIONS.requisition.approve,
    );
  });

  it('accepts the token on a protected route and returns the same identity', async () => {
    const { accessToken } = (await login('recruiter@hiflow.local').expect(200))
      .body as LoginBody;

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect((me.body as { email: string }).email).toBe('recruiter@hiflow.local');
  });

  it('rejects a wrong password and an unknown email identically', async () => {
    const wrongPassword = await login(
      'hr@hiflow.local',
      'not-the-password',
    ).expect(401);
    const unknownEmail = await login('nobody@hiflow.local').expect(401);

    expect((wrongPassword.body as { message: string }).message).toBe(
      (unknownEmail.body as { message: string }).message,
    );
  });

  it('rejects a forged token', () => {
    return request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer not.a.realtoken')
      .expect(401);
  });

  it('rejects a malformed login body before it reaches the service', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'not-an-email', password: '' })
      .expect(400);
  });

  it('rejects unexpected fields in the login body', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'hr@hiflow.local', password, role: 'ADMIN' })
      .expect(400);
  });
});
