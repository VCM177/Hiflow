import { CallHandler, ExecutionContext, Logger } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { requestContext } from '../../common/request-context/request-context';
import type { AuditEventMeta } from './audit.decorators';
import { AuditVerifierInterceptor } from './audit-verifier.interceptor';

const run = (
  declared: AuditEventMeta | undefined,
  recorded: string[],
  type = 'http',
) => {
  const interceptor = new AuditVerifierInterceptor({
    get: jest.fn().mockReturnValue(declared),
  } as unknown as Reflector);
  const context = {
    getType: () => type,
    getHandler: () => () => undefined,
  } as unknown as ExecutionContext;
  const next: CallHandler = { handle: () => of('ok') };

  return requestContext.run(
    {
      requestId: 'r',
      ip: null,
      userAgent: null,
      recorded: new Set(recorded) as never,
    },
    () => lastValueFrom(interceptor.intercept(context, next)),
  );
};

describe('AuditVerifierInterceptor', () => {
  const declared: AuditEventMeta = {
    event: 'REQUISITION_APPROVED',
    conditional: false,
  };

  it('ignores a route that declares nothing', async () => {
    await expect(run(undefined, [])).resolves.toBe('ok');
  });

  it('lets a route through when the declared event was recorded', async () => {
    await expect(run(declared, ['REQUISITION_APPROVED'])).resolves.toBe('ok');
  });

  it('fails a route that succeeded without recording what it declared (test mode)', async () => {
    await expect(run(declared, ['JOB_PUBLISHED'])).rejects.toThrow(
      'REQUISITION_APPROVED was declared but not recorded',
    );
  });

  it('does not insist when the event is conditional', async () => {
    await expect(run({ ...declared, conditional: true }, [])).resolves.toBe(
      'ok',
    );
  });

  it('only logs in production, and the request still succeeds', async () => {
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      await expect(run(declared, [])).resolves.toBe('ok');
      expect(error).toHaveBeenCalledWith(
        'REQUISITION_APPROVED was declared but not recorded',
      );
    } finally {
      process.env.NODE_ENV = previous;
      error.mockRestore();
    }
  });

  it('leaves non-HTTP work alone', async () => {
    await expect(run(declared, [], 'rpc')).resolves.toBe('ok');
  });
});
