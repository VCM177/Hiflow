import type { DataSource, EntityManager } from 'typeorm';
import { requestContext } from '../../common/request-context/request-context';
import type { AuditActor } from './audit.types';
import { AuditService } from './audit.service';
import { TxRunner } from './tx-runner.service';

const ACTOR: AuditActor = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Chị Hạnh',
  role: 'HR_MANAGER',
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function build() {
  const query = jest.fn().mockResolvedValue([]);
  const manager = { query } as unknown as EntityManager;
  const transaction = jest.fn((work: (m: EntityManager) => Promise<unknown>) =>
    work(manager),
  );
  const runner = new TxRunner({ transaction } as unknown as DataSource);

  return { runner, query, transaction };
}

describe('TxRunner', () => {
  afterEach(() => {
    delete process.env.AUDIT_ORIGIN;
  });

  it('opens one transaction and gives the database who, which request and where from', async () => {
    const { runner, query, transaction } = build();

    await requestContext.run(
      {
        requestId: 'rrrrrrrr-1111-4111-8111-111111111111',
        ip: '203.0.113.5',
        userAgent: 'agent',
        recorded: new Set(),
      },
      () => runner.run(ACTOR, () => Promise.resolve()),
    );

    expect(transaction).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0] as [string, string[]];
    expect(sql).toContain("set_config('hiflow.tx_id', $1, true)");
    expect(sql).toContain("set_config('hiflow.actor_id', $2, true)");
    expect(params[0]).toMatch(UUID);
    expect(params.slice(1)).toEqual([
      ACTOR.id,
      'rrrrrrrr-1111-4111-8111-111111111111',
      'app',
    ]);
  });

  it('copes with no actor and no request (a seed, a job)', async () => {
    const { runner, query } = build();
    process.env.AUDIT_ORIGIN = 'e2e';

    await runner.run(null, () => Promise.resolve());

    const params = (query.mock.calls[0] as [string, string[]])[1];
    expect(params.slice(1)).toEqual(['', '', 'e2e']);
  });

  it('returns what the work returns and lets its failure through', async () => {
    const { runner } = build();

    await expect(runner.run(ACTOR, () => Promise.resolve(42))).resolves.toBe(
      42,
    );
    await expect(
      runner.run(ACTOR, () => Promise.reject(new Error('rule broken'))),
    ).rejects.toThrow('rule broken');
  });

  it('records an event with the actor as they were, the request and its data', async () => {
    const { runner, query } = build();
    const recorded = new Set<string>();

    await requestContext.run(
      {
        requestId: 'rrrrrrrr-1111-4111-8111-111111111111',
        ip: '203.0.113.5',
        userAgent: 'agent',
        recorded: recorded as never,
      },
      () =>
        runner.run(ACTOR, (_manager, audit) =>
          audit.record('REQUISITION_REJECTED', 'e1', {
            code: 'YC-001',
            reason: 'Thiếu ngân sách',
          }),
        ),
    );

    const [sql, params] = query.mock.calls[1] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO audit_events');
    expect(params[0]).toBe('REQUISITION_REJECTED');
    expect(params[1]).toBe('Requisition');
    expect(params[2]).toBe('e1');
    expect(params.slice(3, 6)).toEqual([ACTOR.id, 'Chị Hạnh', 'HR_MANAGER']);
    expect(params[6]).toMatch(UUID);
    expect(params.slice(7)).toEqual([
      'rrrrrrrr-1111-4111-8111-111111111111',
      'app',
      '203.0.113.5',
      'agent',
      JSON.stringify({ code: 'YC-001', reason: 'Thiếu ngân sách' }),
    ]);
    // The same transaction id ties the event to the row changes the triggers wrote.
    expect(params[6]).toBe((query.mock.calls[0] as [string, string[]])[1][0]);
    expect([...recorded]).toEqual(['REQUISITION_REJECTED']);
  });

  it('stores an event with no data as an empty object', async () => {
    const { runner, query } = build();

    await runner.run(ACTOR, (_m, audit) => audit.record('JOB_PUBLISHED', 'j1'));

    expect((query.mock.calls[1] as [string, unknown[]])[1].at(-1)).toBe('{}');
  });
});

describe('AuditService.recordStandalone', () => {
  it('writes an event that has no other write, in its own transaction', async () => {
    const { runner, query, transaction } = build();

    await new AuditService(runner).recordStandalone(
      null,
      'AUTH_LOGIN_FAILED',
      null,
      { reason: 'INVALID_CREDENTIALS' },
    );

    expect(transaction).toHaveBeenCalledTimes(1);
    const params = (query.mock.calls[1] as [string, unknown[]])[1];
    expect(params[0]).toBe('AUTH_LOGIN_FAILED');
    expect(params[2]).toBeNull();
    expect(params[3]).toBeNull();
    expect(params.at(-1)).toBe(
      JSON.stringify({ reason: 'INVALID_CREDENTIALS' }),
    );
  });
});
