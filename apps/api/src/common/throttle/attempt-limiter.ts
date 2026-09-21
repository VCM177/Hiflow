import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerStorage } from '@nestjs/throttler';
import { createHash } from 'node:crypto';
import { TooManyAttemptsException } from './too-many-attempts.exception';
import type { ThrottlePolicy } from './throttle.constants';
import { buildThrottlers } from './throttle.policies';

/**
 * Rate limiting for a value that only exists after the request body is parsed
 * (an email typed into a form), which a route guard cannot see. It counts in the
 * same storage as the guards, so it is shared across containers and fails open
 * the same way.
 */
@Injectable()
export class AttemptLimiter {
  private readonly policies: ReturnType<typeof buildThrottlers>;

  constructor(
    @Inject(ThrottlerStorage) private readonly storage: ThrottlerStorage,
    config: ConfigService,
  ) {
    this.policies = buildThrottlers(
      Number(config.get<string>('THROTTLE_LIMIT_SCALE') ?? 1),
    );
  }

  /** Counts one attempt for `subject`; throws 429 once the policy's limit is passed. */
  async hit(policy: ThrottlePolicy, subject: string): Promise<void> {
    const config = this.policies.find((throttler) => throttler.name === policy);
    if (
      !config ||
      typeof config.ttl !== 'number' ||
      typeof config.limit !== 'number'
    ) {
      throw new Error(`Rate limit policy "${policy}" is not defined`);
    }

    // Hashed: the store (possibly a shared Redis) never holds a raw email address.
    const key = `${policy}:${createHash('sha256').update(subject).digest('hex')}`;
    const record = await this.storage.increment(
      key,
      config.ttl,
      config.limit,
      config.ttl,
      policy,
    );

    if (record.isBlocked) {
      throw new TooManyAttemptsException(record.timeToBlockExpire);
    }
  }
}
