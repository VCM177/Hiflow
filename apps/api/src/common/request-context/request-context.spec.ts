import type { NextFunction, Request, Response } from 'express';
import {
  cleanIp,
  cleanUserAgent,
  requestContext,
  requestContextMiddleware,
} from './request-context';

describe('requestContext', () => {
  it('is empty outside a request', () => {
    expect(requestContext.get()).toBeUndefined();
  });

  it('gives each request its own id, address and agent for everything it awaits', async () => {
    const seen: (ReturnType<typeof requestContext.get> | undefined)[] = [];
    const handle = (ip: string, agent: string) =>
      new Promise<void>((resolve) => {
        const next: NextFunction = () => {
          void Promise.resolve()
            .then(() => new Promise((r) => setTimeout(r, 5)))
            .then(() => {
              seen.push(requestContext.get());
              resolve();
            });
        };
        requestContextMiddleware(
          { ip, headers: { 'user-agent': agent } } as unknown as Request,
          {} as Response,
          next,
        );
      });

    await Promise.all([handle('203.0.113.1', 'a'), handle('203.0.113.2', 'b')]);

    expect(seen.map((s) => [s?.ip, s?.userAgent])).toEqual([
      ['203.0.113.1', 'a'],
      ['203.0.113.2', 'b'],
    ]);
    expect(new Set(seen.map((s) => s?.requestId)).size).toBe(2);
    expect(seen[0]?.recorded.size).toBe(0);
  });
});

describe('cleanIp', () => {
  it.each([
    ['203.0.113.9', '203.0.113.9'],
    ['::1', '::1'],
    ['::ffff:10.0.0.1', '::ffff:10.0.0.1'],
    ['fe80::1%eth0', 'fe80::1'],
  ])('keeps %s as %s', (input, expected) => {
    expect(cleanIp(input)).toBe(expected);
  });

  it.each([undefined, '', 'not an address', "1.2.3.4'; DROP TABLE x"])(
    'drops %p instead of storing it',
    (input) => {
      expect(cleanIp(input)).toBeNull();
    },
  );
});

describe('cleanUserAgent', () => {
  it('cuts a very long agent to what the column holds', () => {
    expect(cleanUserAgent('x'.repeat(600))?.length).toBe(256);
    expect(cleanUserAgent(undefined)).toBeNull();
  });
});
