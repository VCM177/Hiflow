import type { DataSource } from 'typeorm';
import { AuditGuardCheck } from './audit-guard-check';

const checkAs = (allowed: boolean[]) =>
  new AuditGuardCheck({
    query: jest
      .fn()
      .mockResolvedValue([
        { role: 'some_role', allowed: allowed.map((a) => String(a)) },
      ]),
  } as unknown as DataSource).onApplicationBootstrap();

describe('AuditGuardCheck', () => {
  it('lets the API start as a role that can only read and insert', async () => {
    await expect(checkAs(Array(6).fill(false) as boolean[])).resolves.toBe(
      undefined,
    );
  });

  it.each([0, 2, 3, 5])(
    'refuses to start when one audit privilege (%i) is granted',
    async (index) => {
      const allowed = Array<boolean>(6).fill(false);
      allowed[index] = true;

      await expect(checkAs(allowed)).rejects.toThrow(
        /"some_role" can change the audit tables/,
      );
    },
  );
});
