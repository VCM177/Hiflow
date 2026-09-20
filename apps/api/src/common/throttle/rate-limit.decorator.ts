import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { PolicyThrottlerGuard } from './policy-throttler.guard';
import { THROTTLE_POLICIES_KEY, ThrottlePolicy } from './throttle.constants';

/** Rate limits a route under the given policies (see `throttle.policies.ts`). */
export const RateLimit = (...policies: ThrottlePolicy[]) =>
  applyDecorators(
    SetMetadata(THROTTLE_POLICIES_KEY, policies),
    UseGuards(PolicyThrottlerGuard),
  );
