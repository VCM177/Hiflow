import { ConfigService } from '@nestjs/config';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { AttemptLimiter } from './attempt-limiter';
import { THROTTLE_POLICY, type ThrottlePolicy } from './throttle.constants';
import {
  TooManyAttemptsException,
  TooManyAttemptsFilter,
} from './too-many-attempts.exception';

const storageAnswering = (isBlocked: boolean, timeToBlockExpire = 0) => {
  const increment = jest.fn().mockResolvedValue({
    totalHits: 1,
    timeToExpire: 1,
    isBlocked,
    timeToBlockExpire,
  });
  return { storage: { increment } as ThrottlerStorage, increment };
};

const limiterOver = (storage: ThrottlerStorage, scale?: string) =>
  new AttemptLimiter(
    storage,
    new ConfigService(scale ? { THROTTLE_LIMIT_SCALE: scale } : {}),
  );

describe('AttemptLimiter', () => {
  it('counts an attempt under the policy limit and lets it through', async () => {
    const { storage, increment } = storageAnswering(false);

    await expect(
      limiterOver(storage).hit(THROTTLE_POLICY.PUBLIC_APPLY_EMAIL, 'a@b.c'),
    ).resolves.toBeUndefined();

    const [, ttl, limit, blockDuration, name] = increment.mock
      .calls[0] as unknown[];
    expect(ttl).toBe(60 * 60 * 1000);
    expect(limit).toBe(3);
    expect(blockDuration).toBe(ttl);
    expect(name).toBe('public-apply-email');
  });

  it('scales the limit like the guards do', async () => {
    const { storage, increment } = storageAnswering(false);

    await limiterOver(storage, '1000').hit(
      THROTTLE_POLICY.PUBLIC_APPLY_EMAIL,
      'a@b.c',
    );

    expect((increment.mock.calls[0] as unknown[])[2]).toBe(3000);
  });

  it('throws 429 carrying the wait time once the counter says blocked', async () => {
    const { storage } = storageAnswering(true, 1800);

    const failure = limiterOver(storage).hit(
      THROTTLE_POLICY.PUBLIC_APPLY_EMAIL,
      'a@b.c',
    );

    await expect(failure).rejects.toBeInstanceOf(TooManyAttemptsException);
    await expect(failure).rejects.toMatchObject({ retryAfterSeconds: 1800 });
    await expect(failure).rejects.toHaveProperty('status', 429);
  });

  it('never puts the raw address in the store, and treats each address separately', async () => {
    const { storage, increment } = storageAnswering(false);
    const limiter = limiterOver(storage);

    await limiter.hit(
      THROTTLE_POLICY.PUBLIC_APPLY_EMAIL,
      'nguoi.dung@example.com',
    );
    await limiter.hit(
      THROTTLE_POLICY.PUBLIC_APPLY_EMAIL,
      'nguoi.dung@example.com',
    );
    await limiter.hit(THROTTLE_POLICY.PUBLIC_APPLY_EMAIL, 'khac@example.com');

    const keys = increment.mock.calls.map((call: unknown[]) => String(call[0]));
    expect(keys[0]).toBe(keys[1]);
    expect(keys[0]).not.toBe(keys[2]);
    expect(keys[0]).toMatch(/^public-apply-email:[0-9a-f]{64}$/);
    expect(keys.join()).not.toContain('example.com');
  });

  it('refuses a policy that does not exist rather than silently not limiting', async () => {
    const { storage, increment } = storageAnswering(false);

    await expect(
      limiterOver(storage).hit('no-such-policy' as ThrottlePolicy, 'x'),
    ).rejects.toThrow('not defined');
    expect(increment).not.toHaveBeenCalled();
  });
});

describe('TooManyAttemptsFilter', () => {
  const run = (exception: TooManyAttemptsException) => {
    const json = jest.fn();
    const setHeader = jest.fn().mockReturnValue({ json });
    const status = jest.fn().mockReturnValue({ setHeader });
    const host = {
      switchToHttp: () => ({ getResponse: () => ({ status }) }),
    };
    new TooManyAttemptsFilter().catch(exception, host as never);
    return { status, setHeader, json };
  };

  it('answers 429 with a Retry-After header and the exception body', () => {
    const { status, setHeader, json } = run(new TooManyAttemptsException(120));

    expect(status).toHaveBeenCalledWith(429);
    expect(setHeader).toHaveBeenCalledWith('Retry-After', '120');
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 429 }),
    );
  });

  it('never advertises a wait shorter than one second', () => {
    expect(run(new TooManyAttemptsException(0)).setHeader).toHaveBeenCalledWith(
      'Retry-After',
      '1',
    );
  });
});
