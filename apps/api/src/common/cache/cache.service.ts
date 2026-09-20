import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Where cached values live. Swap the implementation to move to Redis. */
export interface CacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}

export class MemoryCacheStore implements CacheStore {
  private readonly entries = new Map<
    string,
    { value: string; expiresAt: number }
  >();

  constructor(private readonly now: () => number = Date.now) {}

  get(key: string): Promise<string | null> {
    const entry = this.entries.get(key);

    if (!entry) return Promise.resolve(null);
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return Promise.resolve(null);
    }

    return Promise.resolve(entry.value);
  }

  set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.entries.set(key, {
      value,
      expiresAt: this.now() + ttlSeconds * 1000,
    });
    return Promise.resolve();
  }
}

export const CACHE_STORE = Symbol('CACHE_STORE');
export const DEFAULT_TTL_SECONDS = 60;

/**
 * Caches the result of an expensive computation for a short time. A cache
 * problem must never fail a request, so any store error falls back to
 * computing the value directly.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly ttlSeconds: number;

  constructor(
    config: ConfigService,
    private readonly store: CacheStore = new MemoryCacheStore(),
  ) {
    const configured = Number(config.get('CACHE_TTL_SECONDS'));
    this.ttlSeconds =
      config.get('CACHE_TTL_SECONDS') === undefined || Number.isNaN(configured)
        ? DEFAULT_TTL_SECONDS
        : configured;
  }

  /** A TTL of 0 disables caching entirely (used by the tests). */
  get enabled(): boolean {
    return this.ttlSeconds > 0;
  }

  async wrap<T>(key: string, compute: () => Promise<T>): Promise<T> {
    if (!this.enabled) return compute();

    try {
      const hit = await this.store.get(key);
      if (hit !== null) return JSON.parse(hit) as T;
    } catch (error) {
      this.logger.warn(`Cache read failed for ${key}: ${String(error)}`);
    }

    const value = await compute();

    try {
      await this.store.set(key, JSON.stringify(value), this.ttlSeconds);
    } catch (error) {
      this.logger.warn(`Cache write failed for ${key}: ${String(error)}`);
    }

    return value;
  }
}
