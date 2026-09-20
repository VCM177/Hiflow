import request from 'supertest';
import { bearer, createE2eApp, E2eContext, loginAs } from './helpers/e2e-app';
import { seedPassword } from './../src/database/seeds/base.seeder';

interface UserBody {
  id: string;
  email: string;
  fullName: string;
  role: string;
  departmentId: string | null;
  departmentName: string | null;
  isActive: boolean;
}
interface Page {
  items: UserBody[];
  meta: { total: number; totalPages: number };
}

const PREFIX = 'e2e-users-';
const STRONG = 'Sturdy-Pass-42';

describe('Users and profile (e2e)', () => {
  let ctx: E2eContext;
  let admin: string;
  let hr: string;
  let interviewer: string;

  const cleanup = () =>
    ctx.dataSource.query(`DELETE FROM users WHERE email LIKE '${PREFIX}%'`);

  const createUser = (body: object, token = hr) =>
    request(ctx.server).post('/users').set(bearer(token)).send(body);

  const newUser = async (suffix: string, role = 'RECRUITER', token = hr) => {
    const response = await createUser(
      {
        email: `${PREFIX}${suffix}@hiflow.local`,
        fullName: `E2E ${suffix}`,
        role,
        password: STRONG,
      },
      token,
    ).expect(201);
    return response.body as UserBody;
  };

  const login = (email: string, password: string) =>
    request(ctx.server).post('/auth/login').send({ email, password });

  beforeAll(async () => {
    ctx = await createE2eApp();
    admin = await loginAs(ctx.server, 'admin@hiflow.local');
    hr = await loginAs(ctx.server, 'hr@hiflow.local');
    interviewer = await loginAs(ctx.server, 'interviewer@hiflow.local');
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await ctx.app.close();
  });

  describe('listing', () => {
    it('lets HR list users and hides password hashes', async () => {
      const page = (
        await request(ctx.server).get('/users').set(bearer(hr)).expect(200)
      ).body as Page;

      expect(page.items.length).toBeGreaterThanOrEqual(5);
      expect(JSON.stringify(page)).not.toMatch(/password|\$2[aby]\$/i);
    });

    it('forbids a role without user.list.view', () => {
      return request(ctx.server)
        .get('/users')
        .set(bearer(interviewer))
        .expect(403);
    });

    it('filters by role and searches by name or email', async () => {
      const byRole = (
        await request(ctx.server)
          .get('/users?role=INTERVIEWER')
          .set(bearer(hr))
          .expect(200)
      ).body as Page;
      expect(byRole.items.every((u) => u.role === 'INTERVIEWER')).toBe(true);

      const bySearch = (
        await request(ctx.server)
          .get('/users?search=hr@hiflow')
          .set(bearer(hr))
          .expect(200)
      ).body as Page;
      expect(bySearch.items.map((u) => u.email)).toContain('hr@hiflow.local');
    });

    it('filters by active state', async () => {
      const inactive = (
        await request(ctx.server)
          .get('/users?isActive=false')
          .set(bearer(hr))
          .expect(200)
      ).body as Page;

      expect(inactive.items.every((u) => u.isActive === false)).toBe(true);
    });

    it('includes the department name and rejects a bad filter value', async () => {
      const page = (
        await request(ctx.server)
          .get('/users?search=hr@hiflow')
          .set(bearer(hr))
          .expect(200)
      ).body as Page;
      expect(page.items[0].departmentName).toBe('Nhân sự');

      await request(ctx.server)
        .get('/users?role=WIZARD')
        .set(bearer(hr))
        .expect(400);
      await request(ctx.server)
        .get('/users?isActive=maybe')
        .set(bearer(hr))
        .expect(400);
    });
  });

  describe('creating', () => {
    it('creates an account that can log in immediately', async () => {
      const user = await newUser('login');

      expect(user.role).toBe('RECRUITER');
      expect(user.isActive).toBe(true);
      expect(JSON.stringify(user)).not.toMatch(/password/i);

      await login(user.email, STRONG).expect(200);
    });

    it('lowercases the email and rejects a duplicate', async () => {
      const first = await newUser('dup');
      const response = await createUser({
        email: first.email.toUpperCase(),
        fullName: 'Someone',
        role: 'RECRUITER',
        password: STRONG,
      }).expect(409);

      expect((response.body as { message: string }).message).toMatch(/Email/);
    });

    it.each([
      ['a password that is too short', { password: 'a1' }],
      ['a password without a digit', { password: 'onlyletters' }],
      ['a password without a letter', { password: '12345678' }],
      ['a password over the bcrypt limit', { password: `a1${'x'.repeat(80)}` }],
      ['an unknown role', { role: 'WIZARD' }],
      ['a malformed email', { email: 'not-an-email' }],
      ['an unexpected field', { isActive: false }],
    ])('rejects %s', async (_label, override) => {
      await createUser({
        email: `${PREFIX}bad@hiflow.local`,
        fullName: 'Bad Input',
        role: 'RECRUITER',
        password: STRONG,
        ...override,
      }).expect(400);
    });

    it('rejects an unknown department with a clear message', async () => {
      const response = await createUser({
        email: `${PREFIX}nodept@hiflow.local`,
        fullName: 'No Dept',
        role: 'RECRUITER',
        password: STRONG,
        departmentId: '00000000-0000-4000-8000-000000000000',
      }).expect(400);

      expect((response.body as { message: string }).message).toMatch(
        /Phòng ban/,
      );
    });

    it('forbids a role without user.account.create', () => {
      return createUser(
        {
          email: `${PREFIX}x@hiflow.local`,
          fullName: 'X',
          role: 'RECRUITER',
          password: STRONG,
        },
        interviewer,
      ).expect(403);
    });
  });

  describe('privilege escalation', () => {
    it('stops HR granting the admin role at creation', async () => {
      await createUser({
        email: `${PREFIX}sneaky@hiflow.local`,
        fullName: 'Sneaky',
        role: 'ADMIN',
        password: STRONG,
      }).expect(403);
    });

    it('lets an admin create another admin', async () => {
      const user = await newUser('admin2', 'ADMIN', admin);
      expect(user.role).toBe('ADMIN');
    });

    it('stops HR editing, demoting, locking or resetting an admin account', async () => {
      const target = await newUser('admin3', 'ADMIN', admin);
      const send = (method: 'patch' | 'post', path: string, body: object) =>
        request(ctx.server)
          [method](`/users/${target.id}${path}`)
          .set(bearer(hr))
          .send(body);

      await send('patch', '', { fullName: 'Hacked' }).expect(403);
      await send('patch', '/role', { role: 'RECRUITER' }).expect(403);
      await send('patch', '/status', { isActive: false }).expect(403);
      await send('post', '/reset-password', {
        newPassword: 'Hacked-Pass-1',
      }).expect(403);

      await login(target.email, STRONG).expect(200);
    });

    it('stops HR promoting someone to admin', async () => {
      const user = await newUser('promote');

      await request(ctx.server)
        .patch(`/users/${user.id}/role`)
        .set(bearer(hr))
        .send({ role: 'ADMIN' })
        .expect(403);
    });

    it('stops anyone changing their own role or locking themselves out', async () => {
      const me = (
        await request(ctx.server).get('/profile').set(bearer(admin)).expect(200)
      ).body as UserBody;

      await request(ctx.server)
        .patch(`/users/${me.id}/role`)
        .set(bearer(admin))
        .send({ role: 'RECRUITER' })
        .expect(403);
      await request(ctx.server)
        .patch(`/users/${me.id}/status`)
        .set(bearer(admin))
        .send({ isActive: false })
        .expect(403);
    });
  });

  describe('updating', () => {
    it('changes the name and department, and can clear the department', async () => {
      const user = await newUser('edit');
      const departments = (
        await request(ctx.server)
          .get('/departments')
          .set(bearer(hr))
          .expect(200)
      ).body as { items: { id: string; code: string }[] };
      const eng = departments.items.find((d) => d.code === 'ENG')!;

      const updated = (
        await request(ctx.server)
          .patch(`/users/${user.id}`)
          .set(bearer(hr))
          .send({ fullName: 'Tên mới', departmentId: eng.id })
          .expect(200)
      ).body as UserBody;
      expect(updated.fullName).toBe('Tên mới');
      expect(updated.departmentName).toBe('Kỹ thuật');

      const cleared = (
        await request(ctx.server)
          .patch(`/users/${user.id}`)
          .set(bearer(hr))
          .send({ departmentId: null })
          .expect(200)
      ).body as UserBody;
      expect(cleared.departmentId).toBeNull();
    });

    it('404s for an unknown user and 400s for a malformed id', async () => {
      await request(ctx.server)
        .patch('/users/00000000-0000-4000-8000-000000000000')
        .set(bearer(hr))
        .send({ fullName: 'x' })
        .expect(404);
      await request(ctx.server).get('/users/nope').set(bearer(hr)).expect(400);
    });
  });

  describe('role and status take effect immediately', () => {
    it('changes what an existing token can do as soon as the role changes', async () => {
      const user = await newUser('role');
      const own = (await login(user.email, STRONG).expect(200)).body as {
        accessToken: string;
      };

      const before = (
        await request(ctx.server)
          .get('/auth/me')
          .set(bearer(own.accessToken))
          .expect(200)
      ).body as { role: string };
      expect(before.role).toBe('RECRUITER');

      await request(ctx.server)
        .patch(`/users/${user.id}/role`)
        .set(bearer(hr))
        .send({ role: 'INTERVIEWER' })
        .expect(200);

      const after = (
        await request(ctx.server)
          .get('/auth/me')
          .set(bearer(own.accessToken))
          .expect(200)
      ).body as { role: string };
      expect(after.role).toBe('INTERVIEWER');
    });

    it('locks an account: the live token stops working and login is refused', async () => {
      const user = await newUser('lock');
      const { accessToken } = (await login(user.email, STRONG).expect(200))
        .body as {
        accessToken: string;
      };

      await request(ctx.server)
        .patch(`/users/${user.id}/status`)
        .set(bearer(hr))
        .send({ isActive: false })
        .expect(200);

      await request(ctx.server)
        .get('/auth/me')
        .set(bearer(accessToken))
        .expect(401);
      const refused = await login(user.email, STRONG).expect(403);
      expect((refused.body as { message: string }).message).toMatch(/khóa/);

      await request(ctx.server)
        .patch(`/users/${user.id}/status`)
        .set(bearer(hr))
        .send({ isActive: true })
        .expect(200);
      await login(user.email, STRONG).expect(200);
    });
  });

  describe('password reset', () => {
    it('replaces the password: the old one stops working', async () => {
      const user = await newUser('reset');

      await request(ctx.server)
        .post(`/users/${user.id}/reset-password`)
        .set(bearer(hr))
        .send({ newPassword: 'Brand-New-Pass-9' })
        .expect(204);

      await login(user.email, STRONG).expect(401);
      await login(user.email, 'Brand-New-Pass-9').expect(200);
    });

    it('applies the password policy', async () => {
      const user = await newUser('resetweak');

      await request(ctx.server)
        .post(`/users/${user.id}/reset-password`)
        .set(bearer(hr))
        .send({ newPassword: 'short' })
        .expect(400);
    });
  });

  describe('profile', () => {
    it('returns the caller with their department', async () => {
      const me = (
        await request(ctx.server).get('/profile').set(bearer(hr)).expect(200)
      ).body as UserBody;

      expect(me.email).toBe('hr@hiflow.local');
      expect(me.departmentName).toBe('Nhân sự');
    });

    it('requires authentication', () => {
      return request(ctx.server).get('/profile').expect(401);
    });

    it('renames the caller, and refuses an empty name', async () => {
      const user = await newUser('rename');
      const { accessToken } = (await login(user.email, STRONG).expect(200))
        .body as {
        accessToken: string;
      };

      const renamed = (
        await request(ctx.server)
          .patch('/profile')
          .set(bearer(accessToken))
          .send({ fullName: '  Họ Tên Mới  ' })
          .expect(200)
      ).body as UserBody;
      expect(renamed.fullName).toBe('Họ Tên Mới');

      await request(ctx.server)
        .patch('/profile')
        .set(bearer(accessToken))
        .send({ fullName: '   ' })
        .expect(400);
    });

    it('cannot change role or status through the profile endpoint', async () => {
      const user = await newUser('selfpromote');
      const { accessToken } = (await login(user.email, STRONG).expect(200))
        .body as {
        accessToken: string;
      };

      await request(ctx.server)
        .patch('/profile')
        .set(bearer(accessToken))
        .send({ fullName: 'Ok', role: 'ADMIN' })
        .expect(400);
    });

    it('changes the password only when the current one is right', async () => {
      const user = await newUser('changepw');
      const { accessToken } = (await login(user.email, STRONG).expect(200))
        .body as {
        accessToken: string;
      };
      const change = (body: object) =>
        request(ctx.server)
          .post('/profile/change-password')
          .set(bearer(accessToken))
          .send(body);

      await change({
        currentPassword: 'wrong-one',
        newPassword: 'Another-Pass-7',
      }).expect(400);
      await change({ currentPassword: STRONG, newPassword: STRONG }).expect(
        400,
      );
      await change({ currentPassword: STRONG, newPassword: 'weak' }).expect(
        400,
      );
      await change({
        currentPassword: STRONG,
        newPassword: 'Another-Pass-7',
      }).expect(204);

      await login(user.email, STRONG).expect(401);
      await login(user.email, 'Another-Pass-7').expect(200);
    });
  });

  it('never stores a password in the activity log', async () => {
    const user = await newUser('logcheck');
    await request(ctx.server)
      .post(`/users/${user.id}/reset-password`)
      .set(bearer(hr))
      .send({ newPassword: 'Secret-For-Log-5' })
      .expect(204);

    await new Promise((resolve) => setTimeout(resolve, 300));
    const rows: { payload: unknown }[] = await ctx.dataSource.query(
      `SELECT payload FROM activity_logs WHERE entity_type = 'User' AND entity_id = $1`,
      [user.id],
    );

    expect(rows.length).toBeGreaterThan(0);
    expect(JSON.stringify(rows)).not.toContain('Secret-For-Log-5');
    expect(JSON.stringify(rows)).not.toContain(seedPassword());
  });
});
