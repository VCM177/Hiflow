import request from 'supertest';
import { bearer, createE2eApp, E2eContext } from './helpers/e2e-app';
import { createFlow, FlowTokens, loginAll } from './helpers/flow';

const SYSTEM_EMAIL = 'system@hiflow.local';

describe('Built-in system user (e2e)', () => {
  let ctx: E2eContext;
  let t: FlowTokens;
  let systemId: string;

  beforeAll(async () => {
    ctx = await createE2eApp();
    t = await loginAll(ctx);
    const rows: { id: string }[] = await ctx.dataSource.query(
      `SELECT id FROM users WHERE is_system`,
    );
    systemId = rows[0].id;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('exists exactly once, locked, with the least-privileged role', async () => {
    const rows: {
      email: string;
      role: string;
      is_active: boolean;
      password_hash: string;
    }[] = await ctx.dataSource.query(
      `SELECT email, role, is_active, password_hash FROM users WHERE is_system`,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      email: SYSTEM_EMAIL,
      role: 'INTERVIEWER',
      is_active: false,
    });
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$/);
  });

  it('cannot be duplicated: the database allows one system account only', async () => {
    await expect(
      ctx.dataSource.query(
        `INSERT INTO users (email, password_hash, full_name, role, is_active, is_system)
         VALUES ('e2e-second-system@hiflow.local', 'x', 'E2E second', 'INTERVIEWER', false, true)`,
      ),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('is invisible in the user list, in search and in every filter', async () => {
    for (const query of [
      '',
      '?search=system',
      '?role=INTERVIEWER',
      '?isActive=false',
      '?limit=100',
    ]) {
      const list = (
        await request(ctx.server)
          .get(`/users${query}`)
          .set(bearer(t.admin))
          .expect(200)
      ).body as { items: { id: string; email: string }[] };

      expect(list.items.map((user) => user.id)).not.toContain(systemId);
      expect(list.items.map((user) => user.email)).not.toContain(SYSTEM_EMAIL);
    }
  });

  it('answers 404 to every way of reading or changing it, even for an admin', async () => {
    await request(ctx.server)
      .get(`/users/${systemId}`)
      .set(bearer(t.admin))
      .expect(404);
    await request(ctx.server)
      .patch(`/users/${systemId}`)
      .set(bearer(t.admin))
      .send({ fullName: 'Hijacked' })
      .expect(404);
    await request(ctx.server)
      .patch(`/users/${systemId}/status`)
      .set(bearer(t.admin))
      .send({ isActive: true })
      .expect(404);
    await request(ctx.server)
      .patch(`/users/${systemId}/role`)
      .set(bearer(t.admin))
      .send({ role: 'ADMIN' })
      .expect(404);
    await request(ctx.server)
      .post(`/users/${systemId}/reset-password`)
      .set(bearer(t.admin))
      .send({ newPassword: 'Str0ng!Passw0rd#1' })
      .expect(404);

    const rows: { full_name: string; is_active: boolean; role: string }[] =
      await ctx.dataSource.query(
        `SELECT full_name, is_active, role FROM users WHERE id = $1`,
        [systemId],
      );
    expect(rows[0]).toEqual({
      full_name: 'Ứng viên (Website)',
      is_active: false,
      role: 'INTERVIEWER',
    });
  });

  it('cannot log in, whatever password is tried', async () => {
    for (const password of ['', 'password', 'Hiflow@2026', 'system']) {
      const response = await request(ctx.server)
        .post('/auth/login')
        .send({ email: SYSTEM_EMAIL, password: password || 'x' });

      expect([401, 403]).toContain(response.status);
      expect(response.body).not.toHaveProperty('accessToken');
    }
  });

  it('is refused as an application assignee and as an interviewer', async () => {
    const flow = createFlow(ctx, t, 'E2E-sysuser');

    try {
      const jobId = await flow.openJob();
      const appId = await flow.toInterviewStage(jobId);

      await request(ctx.server)
        .patch(`/applications/${appId}/assignee`)
        .set(bearer(t.recruiter))
        .send({ assigneeId: systemId })
        .expect(400);
      await flow
        .post(t.recruiter, '/interviews', {
          applicationId: appId,
          interviewerId: systemId,
          scheduledAt: flow.futureSlot(),
        })
        .expect(400);
    } finally {
      await flow.cleanup();
    }
  });
});
