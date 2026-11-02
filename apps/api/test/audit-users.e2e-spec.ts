import request from 'supertest';
import { auditEvents, AuditEventRow, dbNow, rowChanges } from './helpers/audit';
import { bearer, createE2eApp, E2eContext, loginAs } from './helpers/e2e-app';

const PREFIX = 'e2e-audusr-';
const STRONG = 'Sturdy-Pass-42';

interface UserBody {
  id: string;
  email: string;
  fullName: string;
}

describe('Audit trail: sessions, users and profile (e2e)', () => {
  let ctx: E2eContext;
  let hr: string;
  let hrName: string;
  let hrId: string;
  let n = 0;

  const cleanup = () =>
    ctx.maintenance.query(`DELETE FROM users WHERE email LIKE '${PREFIX}%'`);

  const createUser = async (role = 'RECRUITER'): Promise<UserBody> =>
    (
      await request(ctx.server)
        .post('/users')
        .set(bearer(hr))
        .send({
          email: `${PREFIX}${++n}-${Date.now()}@hiflow.local`,
          fullName: `E2E Audit ${n}`,
          role,
          password: STRONG,
        })
        .expect(201)
    ).body as UserBody;

  const loginWith = (email: string, password: string, agent = 'e2e-agent/1') =>
    request(ctx.server)
      .post('/auth/login')
      .set('User-Agent', agent)
      .send({ email, password });

  const only = async (
    entityId: string,
    event: string,
  ): Promise<AuditEventRow[]> => auditEvents(ctx, { entityId, event });

  beforeAll(async () => {
    ctx = await createE2eApp();
    hr = await loginAs(ctx.server, 'hr@hiflow.local');
    const rows = await ctx.maintenance.query<
      { id: string; full_name: string }[]
    >(`SELECT id, full_name FROM users WHERE email = 'hr@hiflow.local'`);
    hrId = rows[0].id;
    hrName = rows[0].full_name;
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await ctx.app.close();
  });

  describe('sessions', () => {
    it('records a login with who, from where and with what', async () => {
      const user = await createUser();

      await loginWith(user.email, STRONG, 'e2e-agent/login').expect(200);

      const [event] = await only(user.id, 'AUTH_LOGIN_SUCCEEDED');
      expect(event).toMatchObject({
        entity_type: 'User',
        actor_id: user.id,
        actor_name: user.fullName,
        actor_role: 'RECRUITER',
        origin: 'e2e',
        user_agent: 'e2e-agent/login',
        data: {},
      });
      expect(event.ip).toMatch(/^(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$/);
      expect(event.request_id).not.toBeNull();
    });

    it('records a wrong password against the account, with no actor and no password', async () => {
      const user = await createUser();

      await loginWith(user.email, 'Wrong-Pass-99').expect(401);

      const events = await only(user.id, 'AUTH_LOGIN_FAILED');
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        actor_id: null,
        data: { reason: 'INVALID_CREDENTIALS' },
      });
      expect(JSON.stringify(events)).not.toContain('Wrong-Pass-99');
    });

    it('records an unknown email without keeping it', async () => {
      const since = await dbNow(ctx);
      const typed = `${PREFIX}stranger-${Date.now()}@example.com`;

      await loginWith(typed, STRONG).expect(401);

      const events = (
        await auditEvents(ctx, { event: 'AUTH_LOGIN_FAILED', since })
      ).filter((e) => e.entity_id === null);
      expect(events).toHaveLength(1);
      expect(events[0].data).toEqual({ reason: 'INVALID_CREDENTIALS' });
      expect(JSON.stringify(events)).not.toContain(typed);
    });

    it('records a locked account only when the password was right', async () => {
      const user = await createUser();
      await request(ctx.server)
        .patch(`/users/${user.id}/status`)
        .set(bearer(hr))
        .send({ isActive: false })
        .expect(200);

      await loginWith(user.email, 'Wrong-Pass-99').expect(401);
      await loginWith(user.email, STRONG).expect(403);

      const reasons = (await only(user.id, 'AUTH_LOGIN_FAILED')).map(
        (e) => e.data.reason,
      );
      expect(reasons).toEqual(['INVALID_CREDENTIALS', 'ACCOUNT_LOCKED']);
    });

    it('records a logout by someone whose token still verifies, and nothing for anyone else', async () => {
      const user = await createUser();
      const token = (
        (await loginWith(user.email, STRONG).expect(200)).body as {
          accessToken: string;
        }
      ).accessToken;

      await request(ctx.server)
        .post('/auth/logout')
        .set(bearer(token))
        .expect(204);
      await request(ctx.server).post('/auth/logout').expect(204);
      await request(ctx.server)
        .post('/auth/logout')
        .set(bearer('not.a.token'))
        .expect(204);

      const [event] = await only(user.id, 'AUTH_LOGGED_OUT');
      expect(event).toMatchObject({
        actor_id: user.id,
        actor_role: 'RECRUITER',
      });
      expect(await only(user.id, 'AUTH_LOGGED_OUT')).toHaveLength(1);
    });
  });

  describe('users', () => {
    it('records a creation by the person who made it, tied to the row and its secret hidden', async () => {
      const user = await createUser();

      const [event] = await only(user.id, 'USER_CREATED');
      expect(event).toMatchObject({
        entity_type: 'User',
        actor_id: hrId,
        actor_name: hrName,
        actor_role: 'HR_MANAGER',
        origin: 'e2e',
      });

      const changes = await rowChanges(ctx, event);
      expect(changes).toHaveLength(1);
      expect(changes[0]).toMatchObject({
        op: 'I',
        table_name: 'users',
        row_id: user.id,
        actor_id: hrId,
      });
      expect(changes[0].changes).toMatchObject({
        email: user.email,
        role: 'RECRUITER',
        password_hash: '[REDACTED]',
      });
      expect(JSON.stringify(changes)).not.toContain('$2');
    });

    it('records which fields an update changed, and nothing for one that changed none', async () => {
      const user = await createUser();
      const patch = (body: object) =>
        request(ctx.server)
          .patch(`/users/${user.id}`)
          .set(bearer(hr))
          .send(body);

      await patch({ fullName: 'Tên mới' }).expect(200);
      await patch({ fullName: 'Tên mới' }).expect(200);

      const events = await only(user.id, 'USER_UPDATED');
      expect(events).toHaveLength(1);
      expect(events[0].data).toEqual({ changedFields: ['fullName'] });
      expect((await rowChanges(ctx, events[0]))[0].changes).toEqual({
        full_name: [user.fullName, 'Tên mới'],
      });
    });

    it('records a role change with the old and the new role', async () => {
      const user = await createUser('INTERVIEWER');
      const assign = (role: string) =>
        request(ctx.server)
          .patch(`/users/${user.id}/role`)
          .set(bearer(hr))
          .send({ role });

      await assign('RECRUITER').expect(200);
      await assign('RECRUITER').expect(200);

      const events = await only(user.id, 'USER_ROLE_CHANGED');
      expect(events).toHaveLength(1);
      expect(events[0].data).toEqual({ from: 'INTERVIEWER', to: 'RECRUITER' });
    });

    it('records a lock and an unlock', async () => {
      const user = await createUser();
      const set = (isActive: boolean) =>
        request(ctx.server)
          .patch(`/users/${user.id}/status`)
          .set(bearer(hr))
          .send({ isActive });

      await set(false).expect(200);
      await set(true).expect(200);

      const events = await only(user.id, 'USER_STATUS_CHANGED');
      expect(events.map((e) => e.data)).toEqual([
        { from: true, to: false },
        { from: false, to: true },
      ]);
    });

    it('records a password reset without the password, with the hash redacted', async () => {
      const user = await createUser();

      await request(ctx.server)
        .post(`/users/${user.id}/reset-password`)
        .set(bearer(hr))
        .send({ newPassword: 'Another-Pass-77' })
        .expect(204);

      const [event] = await only(user.id, 'USER_PASSWORD_RESET');
      expect(event.actor_id).toBe(hrId);
      expect(JSON.stringify(event)).not.toContain('Another-Pass-77');
      const changes = await rowChanges(ctx, event);
      expect(changes[0].changes).toEqual({
        password_hash: ['[REDACTED]', '[REDACTED]'],
      });
    });

    it('records nothing for a creation that failed, and the failed row is not left', async () => {
      const user = await createUser();

      await request(ctx.server)
        .post('/users')
        .set(bearer(hr))
        .send({
          email: user.email,
          fullName: 'Trùng email',
          role: 'RECRUITER',
          password: STRONG,
        })
        .expect(409);

      expect(await only(user.id, 'USER_CREATED')).toHaveLength(1);
    });
  });

  describe('own profile', () => {
    const own = async () => {
      const user = await createUser();
      const token = (
        (await loginWith(user.email, STRONG).expect(200)).body as {
          accessToken: string;
        }
      ).accessToken;
      return { user, token };
    };

    it('records a name change by the person themselves, once', async () => {
      const { user, token } = await own();
      const patch = (fullName: string) =>
        request(ctx.server)
          .patch('/profile')
          .set(bearer(token))
          .send({ fullName });

      await patch('Tên đã đổi').expect(200);
      await patch('Tên đã đổi').expect(200);

      const events = await only(user.id, 'PROFILE_UPDATED');
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        actor_id: user.id,
        data: { changedFields: ['fullName'] },
      });
    });

    it('records a password change without either password', async () => {
      const { user, token } = await own();

      await request(ctx.server)
        .post('/profile/change-password')
        .set(bearer(token))
        .send({ currentPassword: STRONG, newPassword: 'Fresh-Pass-88' })
        .expect(204);

      const [event] = await only(user.id, 'PASSWORD_CHANGED');
      expect(event.actor_id).toBe(user.id);
      expect(JSON.stringify(event)).not.toMatch(/Fresh-Pass-88|Sturdy-Pass-42/);
      // A wrong current password changes nothing and records nothing.
      await request(ctx.server)
        .post('/profile/change-password')
        .set(bearer(token))
        .send({
          currentPassword: 'Wrong-Pass-99',
          newPassword: 'Third-Pass-99',
        })
        .expect(400);
      expect(await only(user.id, 'PASSWORD_CHANGED')).toHaveLength(1);
    });
  });
});
