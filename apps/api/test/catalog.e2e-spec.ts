import request from 'supertest';
import { bearer, createE2eApp, E2eContext, loginAs } from './helpers/e2e-app';

interface Item {
  id: string;
  name: string;
  code: string;
}
interface Page {
  items: Item[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

describe.each([
  ['departments', 'E2EDEPT'],
  ['positions', 'E2EPOS'],
])('Catalog /%s (e2e)', (resource, prefix) => {
  let ctx: E2eContext;
  let admin: string;
  let hr: string;
  let interviewer: string;
  const created: string[] = [];

  const table = resource === 'departments' ? 'departments' : 'job_positions';

  // Only rows this suite created are ever touched; seeded data is off limits.
  // Members go first because users reference departments.
  const cleanup = async () => {
    await ctx.dataSource.query(
      `DELETE FROM users WHERE email LIKE 'e2e-member-%'`,
    );
    await ctx.dataSource.query(
      `DELETE FROM ${table} WHERE code LIKE '${prefix}%'`,
    );
  };

  const create = (body: object, token = admin) =>
    request(ctx.server).post(`/${resource}`).set(bearer(token)).send(body);

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

  it('requires authentication', () => {
    return request(ctx.server).get(`/${resource}`).expect(401);
  });

  it('lets a role with list permission read, and forbids one without', async () => {
    await request(ctx.server).get(`/${resource}`).set(bearer(hr)).expect(200);
    await request(ctx.server)
      .get(`/${resource}`)
      .set(bearer(interviewer))
      .expect(403);
  });

  it('creates an item, uppercasing the code', async () => {
    const response = await create({
      name: `${prefix} một`,
      code: `${prefix}_a`,
    }).expect(201);
    const item = response.body as Item;
    created.push(item.id);

    expect(item.code).toBe(`${prefix}_A`);
    expect(item.name).toBe(`${prefix} một`);
  });

  it('forbids creating without the create permission', async () => {
    await create({ name: 'x', code: `${prefix}_HR` }, hr).expect(403);
  });

  it('rejects a duplicate code with a readable 409', async () => {
    const response = await create({
      name: 'Tên khác',
      code: `${prefix}_A`,
    }).expect(409);

    expect((response.body as { message: string }).message).toMatch(
      /đã tồn tại/,
    );
  });

  it.each([
    ['missing name', { code: 'OKCODE' }],
    ['code with spaces', { name: 'Valid', code: 'bad code' }],
    ['code too short', { name: 'Valid', code: 'A' }],
    ['unexpected field', { name: 'Valid', code: 'OKCODE', extra: 1 }],
  ])('rejects %s with 400', async (_label, body) => {
    await create(body).expect(400);
  });

  it('paginates, sorts and searches', async () => {
    for (const suffix of ['B', 'C', 'D']) {
      const r = await create({
        name: `${prefix} ${suffix}`,
        code: `${prefix}_${suffix}`,
      }).expect(201);
      created.push((r.body as Item).id);
    }

    const firstPage = (
      await request(ctx.server)
        .get(
          `/${resource}?search=${prefix}&limit=2&page=1&sortBy=code&sortDir=asc`,
        )
        .set(bearer(admin))
        .expect(200)
    ).body as Page;

    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.items.map((i) => i.code)).toEqual([
      `${prefix}_A`,
      `${prefix}_B`,
    ]);
    expect(firstPage.meta).toMatchObject({
      page: 1,
      limit: 2,
      total: 4,
      totalPages: 2,
    });

    const secondPage = (
      await request(ctx.server)
        .get(
          `/${resource}?search=${prefix}&limit=2&page=2&sortBy=code&sortDir=asc`,
        )
        .set(bearer(admin))
        .expect(200)
    ).body as Page;

    expect(secondPage.items.map((i) => i.code)).toEqual([
      `${prefix}_C`,
      `${prefix}_D`,
    ]);
  });

  it('treats a % in the search as literal text, not a wildcard', async () => {
    const page = (
      await request(ctx.server)
        .get(`/${resource}?search=${encodeURIComponent('%')}`)
        .set(bearer(admin))
        .expect(200)
    ).body as Page;

    expect(page.items).toHaveLength(0);
  });

  it('rejects an out-of-range page size and an unknown sort field', async () => {
    await request(ctx.server)
      .get(`/${resource}?limit=1000`)
      .set(bearer(admin))
      .expect(400);
    await request(ctx.server)
      .get(`/${resource}?sortBy=passwordHash`)
      .set(bearer(admin))
      .expect(400);
  });

  it('updates an item and 404s on an unknown id', async () => {
    const id = created[0];
    const response = await request(ctx.server)
      .patch(`/${resource}/${id}`)
      .set(bearer(admin))
      .send({ name: `${prefix} đổi tên` })
      .expect(200);

    expect((response.body as Item).name).toBe(`${prefix} đổi tên`);

    await request(ctx.server)
      .patch(`/${resource}/00000000-0000-4000-8000-000000000000`)
      .set(bearer(admin))
      .send({ name: 'x' })
      .expect(404);
  });

  it('answers 400 for a malformed id', () => {
    return request(ctx.server)
      .get(`/${resource}/not-a-uuid`)
      .set(bearer(admin))
      .expect(400);
  });

  it('deletes an unused item', async () => {
    const id = created.pop() as string;

    await request(ctx.server)
      .delete(`/${resource}/${id}`)
      .set(bearer(admin))
      .expect(204);
    await request(ctx.server)
      .get(`/${resource}/${id}`)
      .set(bearer(admin))
      .expect(404);
  });

  if (resource === 'departments') {
    it('refuses to delete a department that has members, and keeps the members', async () => {
      const department = (
        await create({ name: `${prefix} used`, code: `${prefix}_USED` }).expect(
          201,
        )
      ).body as Item;
      const email = `e2e-member-${prefix.toLowerCase()}@hiflow.local`;

      await ctx.dataSource.query(
        `INSERT INTO users (email, password_hash, full_name, role, department_id)
         VALUES ($1, 'not-a-real-hash', 'E2E Member', 'INTERVIEWER', $2)`,
        [email, department.id],
      );

      const response = await request(ctx.server)
        .delete(`/departments/${department.id}`)
        .set(bearer(admin))
        .expect(409);

      expect((response.body as { message: string }).message).toMatch(
        /đang được sử dụng/,
      );

      // Nothing was deleted and the member was not detached.
      await request(ctx.server)
        .get(`/departments/${department.id}`)
        .set(bearer(admin))
        .expect(200);
      const rows: { department_id: string }[] = await ctx.dataSource.query(
        `SELECT department_id FROM users WHERE email = $1`,
        [email],
      );
      expect(rows[0].department_id).toBe(department.id);
    });
  }
});
