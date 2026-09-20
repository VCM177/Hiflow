import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { createThrottlerStorage } from './../src/common/throttle/throttle.module';
// Importing the module registers ConfigModule, which loads apps/api/.env.
import './../src/app.module';

const REDIS_URL = process.env.REDIS_URL;

// Real Redis only: skipped (and reported as skipped) when REDIS_URL is not set.
const describeWithRedis = REDIS_URL ? describe : describe.skip;

describeWithRedis('Throttle counters in real Redis (integration)', () => {
  const tag = `e2e-${randomUUID()}`;
  const stores: ThrottlerStorageRedisService[] = [];

  const connect = () => {
    const store = new ThrottlerStorageRedisService(REDIS_URL);
    stores.push(store);
    return store;
  };

  afterAll(async () => {
    // Keys carry a 5 s TTL and this run's unique tag; remove them anyway.
    const [first] = stores;
    const keys = await first.redis.keys(`*${tag}*`);
    if (keys.length > 0) await first.redis.del(...keys);
    stores.forEach((store) => store.onModuleDestroy());
  });

  it('shares one counter between two connections, as two containers would', async () => {
    const containerA = connect();
    const containerB = connect();
    const key = `${tag}-shared`;

    await containerA.increment(key, 5000, 2, 5000, 'e2e');
    await containerB.increment(key, 5000, 2, 5000, 'e2e');
    const third = await containerA.increment(key, 5000, 2, 5000, 'e2e');

    expect(third.totalHits).toBe(3);
    expect(third.isBlocked).toBe(true);
  });

  it('is what the application picks when REDIS_URL is set and memory is not forced', () => {
    const saved = process.env.THROTTLE_STORAGE;
    delete process.env.THROTTLE_STORAGE;

    try {
      const config = new ConfigService({ REDIS_URL });
      const storage = createThrottlerStorage(config) as unknown as {
        primary: unknown;
        onModuleDestroy(): void;
      };

      expect(storage.primary).toBeInstanceOf(ThrottlerStorageRedisService);
      storage.onModuleDestroy();
    } finally {
      if (saved !== undefined) process.env.THROTTLE_STORAGE = saved;
    }
  });
});
