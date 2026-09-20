import type { ThrottlerStorage } from '@nestjs/throttler';
import {
  FailOpenThrottlerStorage,
  type ThrottlerStorageRecord,
} from './fail-open-throttler-storage';

const record = (totalHits: number): ThrottlerStorageRecord => ({
  totalHits,
  timeToExpire: 1000,
  isBlocked: false,
  timeToBlockExpire: 0,
});

const storageOf = (
  increment: jest.Mock<Promise<ThrottlerStorageRecord>>,
): ThrottlerStorage & { increment: jest.Mock } => ({ increment });

describe('FailOpenThrottlerStorage', () => {
  let primary: jest.Mock<Promise<ThrottlerStorageRecord>>;
  let fallback: jest.Mock<Promise<ThrottlerStorageRecord>>;
  let clock: number;
  let storage: FailOpenThrottlerStorage;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    primary = jest.fn<Promise<ThrottlerStorageRecord>, unknown[]>();
    fallback = jest.fn<Promise<ThrottlerStorageRecord>, unknown[]>();
    fallback.mockResolvedValue(record(1));
    clock = 1_000_000;
    storage = new FailOpenThrottlerStorage(
      storageOf(primary),
      storageOf(fallback),
      () => clock,
    );
    warn = jest
      .spyOn(
        (storage as unknown as { logger: { warn: () => void } }).logger,
        'warn',
      )
      .mockImplementation(() => undefined);
  });

  it('uses the primary store and leaves the fallback alone while it works', async () => {
    primary.mockResolvedValue(record(7));

    await expect(storage.increment('k', 60, 10, 60, 'login')).resolves.toEqual(
      record(7),
    );
    expect(primary).toHaveBeenCalledWith('k', 60, 10, 60, 'login');
    expect(fallback).not.toHaveBeenCalled();
  });

  it('counts in the fallback instead of failing the request when the primary throws', async () => {
    primary.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(storage.increment('k', 60, 10, 60, 'login')).resolves.toEqual(
      record(1),
    );
    expect(fallback).toHaveBeenCalledWith('k', 60, 10, 60, 'login');
  });

  it('warns once per minute during an outage, not on every request', async () => {
    primary.mockRejectedValue(new Error('down'));

    await storage.increment('a', 60, 10, 60, 'login');
    await storage.increment('b', 60, 10, 60, 'login');
    expect(warn).toHaveBeenCalledTimes(1);

    clock += 61_000;
    await storage.increment('c', 60, 10, 60, 'login');
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('goes back to the primary as soon as it recovers', async () => {
    primary.mockRejectedValueOnce(new Error('down'));
    primary.mockResolvedValue(record(3));

    await storage.increment('k', 60, 10, 60, 'login');
    await expect(storage.increment('k', 60, 10, 60, 'login')).resolves.toEqual(
      record(3),
    );
    expect(fallback).toHaveBeenCalledTimes(1);
  });
});
