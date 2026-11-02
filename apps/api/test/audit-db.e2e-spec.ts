import { randomUUID } from 'node:crypto';
import { EntityManager } from 'typeorm';
import { DataSource } from 'typeorm';
import { ownerDataSourceOptions } from './../src/database/typeorm.config';
import { createE2eApp, E2eContext } from './helpers/e2e-app';

const PREFIX = 'E2E-AUD';

interface RowChange {
  op: string;
  table_name: string;
  row_id: string;
  changes: Record<string, unknown>;
  actor_id: string | null;
  request_id: string | null;
  origin: string;
}

describe('Audit database layer (e2e)', () => {
  let ctx: E2eContext;
  let actorId: string;
  let n = 0;

  /** Runs `work` as the API does: one transaction carrying the audit context. */
  const withContext = <T>(
    txId: string,
    work: (manager: EntityManager) => Promise<T>,
    requestId: string | null = randomUUID(),
  ): Promise<T> =>
    ctx.dataSource.transaction(async (manager) => {
      await manager.query(
        `SELECT set_config('hiflow.tx_id', $1, true),
                set_config('hiflow.actor_id', $2, true),
                set_config('hiflow.request_id', $3, true),
                set_config('hiflow.origin', 'e2e', true)`,
        [txId, actorId, requestId ?? ''],
      );
      return work(manager);
    });

  const changesOf = (txId: string): Promise<RowChange[]> =>
    ctx.maintenance.query<RowChange[]>(
      `SELECT op, table_name, row_id, changes, actor_id, request_id, origin
       FROM audit_row_changes WHERE tx_id = $1 ORDER BY id`,
      [txId],
    );

  const newDepartment = async (manager: EntityManager): Promise<string> => {
    const code = `${PREFIX}-${++n}-${randomUUID().slice(0, 6)}`;
    const rows = await manager.query<{ id: string }[]>(
      `INSERT INTO departments (name, code) VALUES ($1, $1) RETURNING id`,
      [code],
    );
    return rows[0].id;
  };

  const purgeOwnData = async (): Promise<void> => {
    await ctx.maintenance.query(
      `DELETE FROM departments WHERE code LIKE '${PREFIX}%'`,
    );
    await ctx.maintenance.query(
      `DELETE FROM users WHERE email LIKE 'e2e-aud-%'`,
    );
  };

  beforeAll(async () => {
    ctx = await createE2eApp();
    const rows = await ctx.maintenance.query<{ id: string }[]>(
      `SELECT id FROM users WHERE email = 'admin@hiflow.local'`,
    );
    actorId = rows[0].id;
    await purgeOwnData();
  });

  afterAll(async () => {
    await purgeOwnData();
    await ctx.app.close();
  });

  describe('capturing row changes', () => {
    it('records an insert, an update and a delete with who, which request and where from', async () => {
      const txId = randomUUID();
      const requestId = randomUUID();

      const id = await withContext(
        txId,
        async (manager) => {
          const created = await newDepartment(manager);
          await manager.query(
            `UPDATE departments SET name = 'E2E-AUD renamed' WHERE id = $1`,
            [created],
          );
          await manager.query(`DELETE FROM departments WHERE id = $1`, [
            created,
          ]);
          return created;
        },
        requestId,
      );

      const rows = await changesOf(txId);
      expect(rows.map((r) => r.op)).toEqual(['I', 'U', 'D']);
      expect(rows.every((r) => r.row_id === id)).toBe(true);
      expect(rows.every((r) => r.table_name === 'departments')).toBe(true);
      expect(rows.every((r) => r.actor_id === actorId)).toBe(true);
      expect(rows.every((r) => r.request_id === requestId)).toBe(true);
      expect(rows.every((r) => r.origin === 'e2e')).toBe(true);

      const [inserted, updated, deleted] = rows;
      expect(Object.keys(inserted.changes).sort()).toEqual([
        'code',
        'id',
        'name',
      ]);
      expect(updated.changes).toEqual({
        name: [expect.stringContaining(PREFIX) as unknown, 'E2E-AUD renamed'],
      });
      expect(deleted.changes).toMatchObject({ name: 'E2E-AUD renamed' });
    });

    it('writes nothing for an update that only touches updated_at', async () => {
      const txId = randomUUID();

      await withContext(txId, async (manager) => {
        const id = await newDepartment(manager);
        await manager.query(
          `UPDATE departments SET updated_at = now() WHERE id = $1`,
          [id],
        );
      });

      expect((await changesOf(txId)).map((r) => r.op)).toEqual(['I']);
    });

    it('never stores a password hash, only that it changed', async () => {
      const txId = randomUUID();
      const email = `e2e-aud-${randomUUID().slice(0, 8)}@example.com`;

      await withContext(txId, async (manager) => {
        const rows = await manager.query<{ id: string }[]>(
          `INSERT INTO users (email, password_hash, full_name, role)
           VALUES ($1, 'hash-one', 'E2E Aud', 'RECRUITER') RETURNING id`,
          [email],
        );
        await manager.query(
          `UPDATE users SET password_hash = 'hash-two' WHERE id = $1`,
          [rows[0].id],
        );
      });

      const rows = await changesOf(txId);
      expect(rows[0].changes.password_hash).toBe('[REDACTED]');
      expect(rows[1].changes).toEqual({
        password_hash: ['[REDACTED]', '[REDACTED]'],
      });
      expect(JSON.stringify(rows)).not.toMatch(/hash-(one|two)/);
      // Personal data is stored as it is (decision A); only Admin may read it.
      expect(rows[0].changes.email).toBe(email);
    });

    it('rolls the recorded changes back together with the write', async () => {
      const txId = randomUUID();
      let id = '';

      await expect(
        withContext(txId, async (manager) => {
          id = await newDepartment(manager);
          throw new Error('business rule failed');
        }),
      ).rejects.toThrow('business rule failed');

      expect(await changesOf(txId)).toEqual([]);
      const left = await ctx.maintenance.query<unknown[]>(
        `SELECT 1 FROM departments WHERE id = $1`,
        [id],
      );
      expect(left).toEqual([]);
    });

    it('lets only the owner switch capture off', async () => {
      const ownerTx = randomUUID();
      const appTx = randomUUID();

      // The maintenance connection is the owner and has capture off already.
      await ctx.maintenance.query(
        `INSERT INTO departments (name, code) VALUES ('${PREFIX}-quiet', '${PREFIX}-quiet')`,
      );
      await withContext(appTx, async (manager) => {
        await manager.query(`SELECT set_config('hiflow.capture', 'off', true)`);
        await newDepartment(manager);
      });

      const quiet = await ctx.maintenance.query<{ id: string }[]>(
        `SELECT id FROM departments WHERE code = '${PREFIX}-quiet'`,
      );
      const loud = await ctx.maintenance.query<unknown[]>(
        `SELECT 1 FROM audit_row_changes WHERE row_id = $1`,
        [quiet[0].id],
      );
      expect(loud).toEqual([]);
      expect(ownerTx).toBeDefined();
      expect((await changesOf(appTx)).map((r) => r.op)).toEqual(['I']);
    });
  });

  describe('refusing writes that skip the runner', () => {
    it('stops the API role from writing a business table outside a TxRunner transaction', async () => {
      const code = `${PREFIX}-HF001-${randomUUID().slice(0, 6)}`;

      await expect(
        ctx.dataSource.query(
          `INSERT INTO departments (name, code) VALUES ($1, $1)`,
          [code],
        ),
      ).rejects.toMatchObject({
        code: 'HF001',
        message: expect.stringContaining('outside a TxRunner') as unknown,
      });

      const left = await ctx.maintenance.query<unknown[]>(
        `SELECT 1 FROM departments WHERE code = $1`,
        [code],
      );
      expect(left).toEqual([]);
    });

    it('lets the owner write by hand, and records it as maintenance rather than as nobody', async () => {
      const owner = new DataSource(ownerDataSourceOptions);
      await owner.initialize();
      const code = `${PREFIX}-HAND-${randomUUID().slice(0, 6)}`;

      try {
        await owner.query(
          `INSERT INTO departments (name, code) VALUES ($1, $1)`,
          [code],
        );
        const rows = await ctx.maintenance.query<
          { origin: string; actor_id: string | null; op: string }[]
        >(
          `SELECT c.origin, c.actor_id, c.op FROM audit_row_changes c
           JOIN departments d ON d.id = c.row_id WHERE d.code = $1`,
          [code],
        );

        expect(rows).toEqual([
          { origin: 'maintenance', actor_id: null, op: 'I' },
        ]);
      } finally {
        await ctx.maintenance.transaction(async (manager) => {
          await manager.query(`SELECT set_config('hiflow.purge', 'on', true)`);
          await manager.query(
            `DELETE FROM audit_row_changes WHERE origin = 'maintenance'
               AND row_id IN (SELECT id FROM departments WHERE code = $1)`,
            [code],
          );
        });
        await owner.destroy();
      }
    });

    it('also stops a session that claims it is only tagging itself', async () => {
      // The tag decides the origin label, never whether the write is allowed.
      await expect(
        ctx.dataSource.transaction(async (manager) => {
          await manager.query(
            `SELECT set_config('hiflow.origin', 'app', true)`,
          );
          await manager.query(
            `INSERT INTO departments (name, code) VALUES ('${PREFIX}-TAG', '${PREFIX}-TAG')`,
          );
        }),
      ).rejects.toMatchObject({ code: 'HF001' });
    });
  });

  describe('keeping the trail intact', () => {
    const seedRow = async (txId: string): Promise<void> => {
      await withContext(txId, async (manager) => {
        await newDepartment(manager);
      });
    };

    it('stops the API role from changing or deleting what is recorded', async () => {
      const txId = randomUUID();
      await seedRow(txId);

      for (const sql of [
        `UPDATE audit_row_changes SET op = 'X' WHERE tx_id = '${txId}'`,
        `DELETE FROM audit_row_changes WHERE tx_id = '${txId}'`,
        `UPDATE audit_events SET event = 'X'`,
        `DELETE FROM audit_events`,
        `TRUNCATE audit_events`,
        `TRUNCATE audit_row_changes`,
      ]) {
        await expect(ctx.dataSource.query(sql)).rejects.toThrow(
          /permission denied/,
        );
      }
      expect((await changesOf(txId)).length).toBe(1);
    });

    it('stops even the owner unless it says it is purging', async () => {
      const txId = randomUUID();
      await seedRow(txId);
      const owner = ctx.maintenance;

      await expect(
        owner.query(`UPDATE audit_row_changes SET op = 'X' WHERE tx_id = $1`, [
          txId,
        ]),
      ).rejects.toThrow(/append-only/);
      await expect(
        owner.query(`DELETE FROM audit_row_changes WHERE tx_id = $1`, [txId]),
      ).rejects.toThrow(/only be deleted while purging/);
      await expect(owner.query(`TRUNCATE audit_events`)).rejects.toThrow(
        /only be deleted while purging/,
      );

      await owner.transaction(async (manager) => {
        await manager.query(`SELECT set_config('hiflow.purge', 'on', true)`);
        await manager.query(`DELETE FROM audit_row_changes WHERE tx_id = $1`, [
          txId,
        ]);
      });
      expect(await changesOf(txId)).toEqual([]);
    });

    it('lets a purge blank an old IP and user agent, and nothing else', async () => {
      const txId = randomUUID();
      await ctx.dataSource.query(
        `INSERT INTO audit_events (event, entity_type, tx_id, origin, ip, user_agent)
         VALUES ('E2E_PROBE', 'User', $1, 'e2e', '203.0.113.7', 'probe-agent')`,
        [txId],
      );

      await ctx.maintenance.transaction(async (manager) => {
        await manager.query(`SELECT set_config('hiflow.purge', 'on', true)`);
        await expect(
          manager.query(
            `UPDATE audit_events SET event = 'CHANGED' WHERE tx_id = $1`,
            [txId],
          ),
        ).rejects.toThrow(/append-only/);
      });
      await ctx.maintenance.transaction(async (manager) => {
        await manager.query(`SELECT set_config('hiflow.purge', 'on', true)`);
        await manager.query(
          `UPDATE audit_events SET ip = NULL, user_agent = NULL WHERE tx_id = $1`,
          [txId],
        );
      });

      const rows = await ctx.maintenance.query<
        { event: string; ip: string | null; user_agent: string | null }[]
      >(`SELECT event, ip, user_agent FROM audit_events WHERE tx_id = $1`, [
        txId,
      ]);
      expect(rows).toEqual([
        { event: 'E2E_PROBE', ip: null, user_agent: null },
      ]);
    });
  });
});
