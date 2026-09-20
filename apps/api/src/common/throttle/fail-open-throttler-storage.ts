import { Logger } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';

export type ThrottlerStorageRecord = Awaited<
  ReturnType<ThrottlerStorage['increment']>
>;

const WARN_INTERVAL_MS = 60_000;

interface Lifecycle {
  onModuleDestroy?(): void;
  onApplicationShutdown?(): void;
}

/**
 * Counts in Redis so every container shares one counter, and falls back to a
 * per-process counter when Redis is unreachable. Failing open keeps login and
 * the public form available; the limit only gets weaker until Redis returns.
 */
export class FailOpenThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger('Throttle');
  private lastWarningAt = 0;

  constructor(
    private readonly primary: ThrottlerStorage & Lifecycle,
    private readonly fallback: ThrottlerStorage & Lifecycle,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    try {
      return await this.primary.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName,
      );
    } catch (error) {
      this.warn(error);
      return this.fallback.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName,
      );
    }
  }

  /** Logs at most once a minute so an outage does not flood the log. */
  warn(error: unknown): void {
    const at = this.now();
    if (at - this.lastWarningAt < WARN_INTERVAL_MS) return;

    this.lastWarningAt = at;
    this.logger.warn(
      `Redis unavailable, rate limiting per instance only: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  onModuleDestroy(): void {
    this.primary.onModuleDestroy?.();
  }

  onApplicationShutdown(): void {
    this.fallback.onApplicationShutdown?.();
  }
}
