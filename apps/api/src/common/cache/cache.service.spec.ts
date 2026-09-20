import { ConfigService } from '@nestjs/config';
import { CacheService, CacheStore, MemoryCacheStore } from './cache.service';

const config = (ttl?: string) =>
  ({
    get: (key: string) => (key === 'CACHE_TTL_SECONDS' ? ttl : undefined),
  }) as unknown as ConfigService;

describe('MemoryCacheStore', () => {
  it('returns a stored value until it expires, then forgets it', async () => {
    let now = 1_000;
    const store = new MemoryCacheStore(() => now);

    await store.set('k', 'v', 10);
    expect(await store.get('k')).toBe('v');

    now += 9_999;
    expect(await store.get('k')).toBe('v');
    now += 1;
    expect(await store.get('k')).toBeNull();
  });

  it('returns null for an unknown key', async () => {
    expect(await new MemoryCacheStore().get('missing')).toBeNull();
  });
});

describe('CacheService', () => {
  it('computes once and serves the cached value afterwards', async () => {
    const cache = new CacheService(config('60'));
    const compute = jest.fn().mockResolvedValue({ n: 1 });

    const first = await cache.wrap('a', compute);
    const second = await cache.wrap('a', compute);

    expect(first).toEqual({ n: 1 });
    expect(second).toEqual({ n: 1 });
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('keeps different keys apart', async () => {
    const cache = new CacheService(config('60'));

    expect(await cache.wrap('a', () => Promise.resolve(1))).toBe(1);
    expect(await cache.wrap('b', () => Promise.resolve(2))).toBe(2);
  });

  it('defaults to a 60 second TTL when none is configured', () => {
    expect(new CacheService(config(undefined)).enabled).toBe(true);
  });

  it('is disabled by a TTL of 0 and always recomputes', async () => {
    const cache = new CacheService(config('0'));
    const compute = jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);

    expect(cache.enabled).toBe(false);
    expect(await cache.wrap('a', compute)).toBe(1);
    expect(await cache.wrap('a', compute)).toBe(2);
  });

  it('falls back to the default for a non-numeric TTL', () => {
    expect(new CacheService(config('soon')).enabled).toBe(true);
  });

  it('never fails the request when the store is broken', async () => {
    const broken: CacheStore = {
      get: () => Promise.reject(new Error('redis down')),
      set: () => Promise.reject(new Error('redis down')),
    };
    const cache = new CacheService(config('60'), broken);

    expect(await cache.wrap('a', () => Promise.resolve('fresh'))).toBe('fresh');
  });

  it('does not cache a failed computation', async () => {
    const cache = new CacheService(config('60'));
    const compute = jest
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('ok');

    await expect(cache.wrap('a', compute)).rejects.toThrow('boom');
    expect(await cache.wrap('a', compute)).toBe('ok');
  });
});
