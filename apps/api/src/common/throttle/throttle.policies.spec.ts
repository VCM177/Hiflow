import { accountTracker, buildThrottlers } from './throttle.policies';

describe('accountTracker', () => {
  it('keys on the email, ignoring case and surrounding spaces', () => {
    expect(accountTracker({ body: { email: '  Admin@Hiflow.Local ' } })).toBe(
      'acct:admin@hiflow.local',
    );
  });

  it.each([{}, { email: 42 }, { email: { $ne: '' } }, { email: '   ' }])(
    'falls back to the address for a body without a usable email (%j)',
    (body) => {
      expect(accountTracker({ body, ip: '203.0.113.9' })).toBe(
        'ip:203.0.113.9',
      );
    },
  );

  it('does not throw when the request has no body at all', () => {
    expect(accountTracker({ ip: '203.0.113.9' })).toBe('ip:203.0.113.9');
  });

  it('caps an absurdly long email so a key cannot be inflated', () => {
    const tracker = accountTracker({ body: { email: 'a'.repeat(5000) } });

    expect(tracker.length).toBeLessThanOrEqual('acct:'.length + 254);
  });
});

describe('buildThrottlers', () => {
  it('scales every limit', () => {
    const limits = (scale: number): Record<string, unknown> => {
      const byName: Record<string, unknown> = {};
      for (const throttler of buildThrottlers(scale)) {
        byName[throttler.name ?? ''] = throttler.limit;
      }
      return byName;
    };

    expect(limits(1)).toEqual({
      'login-ip': 10,
      'login-account': 20,
      'public-read-ip': 60,
    });
    expect(limits(1000)).toEqual({
      'login-ip': 10_000,
      'login-account': 20_000,
      'public-read-ip': 60_000,
    });
  });
});
