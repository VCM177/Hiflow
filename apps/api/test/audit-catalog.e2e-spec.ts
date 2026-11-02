import request from 'supertest';
import { auditEvents, rowChanges } from './helpers/audit';
import { bearer, createE2eApp, E2eContext, loginAs } from './helpers/e2e-app';

const PREFIX = 'E2E_AUDCAT';

interface Item {
  id: string;
  name: string;
  code: string;
}

const LISTS = [
  {
    path: '/departments',
    table: 'departments',
    entityType: 'Department',
    events: {
      created: 'DEPARTMENT_CREATED',
      updated: 'DEPARTMENT_UPDATED',
      deleted: 'DEPARTMENT_DELETED',
    },
  },
  {
    path: '/positions',
    table: 'job_positions',
    entityType: 'JobPosition',
    events: {
      created: 'POSITION_CREATED',
      updated: 'POSITION_UPDATED',
      deleted: 'POSITION_DELETED',
    },
  },
] as const;

describe('Audit trail: departments and positions (e2e)', () => {
  let ctx: E2eContext;
  let admin: string;
  let adminId: string;
  let adminName: string;
  let n = 0;

  const purge = async () => {
    for (const table of ['departments', 'job_positions']) {
      await ctx.maintenance.query(
        `DELETE FROM ${table} WHERE code LIKE '${PREFIX}%'`,
      );
    }
  };

  beforeAll(async () => {
    ctx = await createE2eApp();
    admin = await loginAs(ctx.server, 'admin@hiflow.local');
    const rows = await ctx.maintenance.query<
      { id: string; full_name: string }[]
    >(`SELECT id, full_name FROM users WHERE email = 'admin@hiflow.local'`);
    adminId = rows[0].id;
    adminName = rows[0].full_name;
    await purge();
  });

  afterAll(async () => {
    await purge();
    await ctx.app.close();
  });

  describe.each(LISTS)('$path', ({ path, table, entityType, events }) => {
    const create = async (): Promise<Item> => {
      const code = `${PREFIX}_${++n}`;
      return (
        await request(ctx.server)
          .post(path)
          .set(bearer(admin))
          .send({ name: `Mục kiểm toán ${code}`, code })
          .expect(201)
      ).body as Item;
    };

    it('records who created it and what the row looked like', async () => {
      const item = await create();

      const [event] = await auditEvents(ctx, { entityId: item.id });
      expect(event).toMatchObject({
        event: events.created,
        entity_type: entityType,
        actor_id: adminId,
        actor_name: adminName,
        actor_role: 'ADMIN',
        data: {},
      });
      const [change] = await rowChanges(ctx, event);
      expect(change).toMatchObject({
        op: 'I',
        table_name: table,
        row_id: item.id,
      });
      expect(change.changes).toMatchObject({
        name: item.name,
        code: item.code,
      });
    });

    it('records the fields an update changed, and nothing when it changed none', async () => {
      const item = await create();
      const patch = (body: object) =>
        request(ctx.server)
          .patch(`${path}/${item.id}`)
          .set(bearer(admin))
          .send(body);

      await patch({ name: 'Tên mới của mục' }).expect(200);
      await patch({ name: 'Tên mới của mục', code: item.code }).expect(200);

      const updates = (await auditEvents(ctx, { entityId: item.id })).filter(
        (e) => e.event === events.updated,
      );
      expect(updates).toHaveLength(1);
      expect(updates[0].data).toEqual({ changedFields: ['name'] });
      expect((await rowChanges(ctx, updates[0]))[0].changes).toEqual({
        name: [item.name, 'Tên mới của mục'],
      });
    });

    it('records a delete, and keeps the record after the row is gone', async () => {
      const item = await create();

      await request(ctx.server)
        .delete(`${path}/${item.id}`)
        .set(bearer(admin))
        .expect(204);

      const deleted = (await auditEvents(ctx, { entityId: item.id })).find(
        (e) => e.event === events.deleted,
      );
      expect(deleted?.actor_id).toBe(adminId);
      expect((await rowChanges(ctx, deleted!))[0]).toMatchObject({
        op: 'D',
        row_id: item.id,
        changes: { name: item.name },
      });
    });

    it('records nothing for a duplicate, an unknown id, or an item still in use', async () => {
      const item = await create();
      const before = (await auditEvents(ctx, { entityId: item.id })).length;

      await request(ctx.server)
        .post(path)
        .set(bearer(admin))
        .send({ name: 'Khác tên', code: item.code })
        .expect(409);
      await request(ctx.server)
        .delete(`${path}/00000000-0000-4000-8000-000000000000`)
        .set(bearer(admin))
        .expect(404);

      expect((await auditEvents(ctx, { entityId: item.id })).length).toBe(
        before,
      );
    });
  });

  it('keeps a department that people still belong to, and says nothing about it', async () => {
    const rows = await ctx.maintenance.query<{ id: string }[]>(
      `SELECT d.id FROM departments d JOIN users u ON u.department_id = d.id LIMIT 1`,
    );
    const inUse = rows[0].id;
    const before = (await auditEvents(ctx, { entityId: inUse })).length;

    await request(ctx.server)
      .delete(`/departments/${inUse}`)
      .set(bearer(admin))
      .expect(409);

    expect((await auditEvents(ctx, { entityId: inUse })).length).toBe(before);
  });
});
