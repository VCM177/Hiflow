import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import {
  ThrottlerModule,
  ThrottlerStorageService,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { AttemptLimiter } from './attempt-limiter';
import { FailOpenThrottlerStorage } from './fail-open-throttler-storage';
import { buildThrottlers } from './throttle.policies';
import { TooManyAttemptsFilter } from './too-many-attempts.exception';

const logger = new Logger('Throttle');

/**
 * Redis when it is configured (one shared counter across containers), otherwise
 * a per-process counter. THROTTLE_STORAGE=memory forces the latter, which e2e
 * uses so a test run does not spend the Redis free-tier request budget.
 */
export function createThrottlerStorage(
  config: ConfigService,
): ThrottlerStorage {
  const redisUrl = config.get<string>('REDIS_URL');
  const mode =
    config.get<string>('THROTTLE_STORAGE') ?? (redisUrl ? 'redis' : 'memory');

  if (mode === 'memory') {
    return new ThrottlerStorageService();
  }

  if (mode !== 'redis' || !redisUrl) {
    throw new Error('THROTTLE_STORAGE=redis needs REDIS_URL');
  }

  const primary = new ThrottlerStorageRedisService(redisUrl, {
    // Fail fast instead of queueing commands while Redis is down.
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 3_000,
    commandTimeout: 800,
    retryStrategy: (attempt) => Math.min(attempt * 500, 5_000),
  });
  const storage = new FailOpenThrottlerStorage(
    primary,
    new ThrottlerStorageService(),
  );
  // ioredis prints unhandled error events; route them through the same throttled log.
  primary.redis.on('error', (error) => storage.warn(error));

  logger.log('Rate limiting through Redis');
  return storage;
}

@Global()
@Module({
  providers: [
    AttemptLimiter,
    { provide: APP_FILTER, useClass: TooManyAttemptsFilter },
  ],
  exports: [AttemptLimiter],
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: buildThrottlers(
          Number(config.get<string>('THROTTLE_LIMIT_SCALE') ?? 1),
        ),
        storage: createThrottlerStorage(config),
      }),
    }),
  ],
})
export class ThrottleModule {}
