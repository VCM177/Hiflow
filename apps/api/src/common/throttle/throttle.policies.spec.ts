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
    const limits = (scale: number) =>
      buildThrottlers(scale).map((throttler) => throttler.limit);

    expect(limits(1)).toEqual([10, 20]);
    expect(limits(1000)).toEqual([10_000, 20_000]);
  });
});
