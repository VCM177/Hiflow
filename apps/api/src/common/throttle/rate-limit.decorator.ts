import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { ApiTooManyRequestsResponse } from '@nestjs/swagger';
import { PolicyThrottlerGuard } from './policy-throttler.guard';
import { THROTTLE_POLICIES_KEY, ThrottlePolicy } from './throttle.constants';

/**
 * Rate limits a route under the given policies (see `throttle.policies.ts`),
 * and documents the 429 the web app has to be ready to show.
 */
export const RateLimit = (...policies: ThrottlePolicy[]) =>
  applyDecorators(
    SetMetadata(THROTTLE_POLICIES_KEY, policies),
    UseGuards(PolicyThrottlerGuard),
    ApiTooManyRequestsResponse({
      description:
        'Quá nhiều yêu cầu. Đợi số giây trong header Retry-After rồi thử lại.',
      headers: {
        'Retry-After': {
          description: 'Số giây phải đợi trước khi gửi lại',
          schema: { type: 'integer', minimum: 1 },
        },
      },
    }),
  );
