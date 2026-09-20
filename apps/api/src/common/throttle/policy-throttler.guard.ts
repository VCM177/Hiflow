import { ExecutionContext, Injectable } from '@nestjs/common';
import {
  ThrottlerGuard,
  type ThrottlerLimitDetail,
  type ThrottlerRequest,
} from '@nestjs/throttler';
import type { Response } from 'express';
import { THROTTLE_POLICIES_KEY } from './throttle.constants';

/**
 * ThrottlerGuard runs every named throttler on every route it guards. This one
 * only runs the throttlers a route asked for with `@RateLimit(...)`.
 */
@Injectable()
export class PolicyThrottlerGuard extends ThrottlerGuard {
  protected override async handleRequest(
    props: ThrottlerRequest,
  ): Promise<boolean> {
    const policies =
      this.reflector.getAllAndOverride<readonly string[] | undefined>(
        THROTTLE_POLICIES_KEY,
        [props.context.getHandler(), props.context.getClass()],
      ) ?? [];

    if (!props.throttler.name || !policies.includes(props.throttler.name)) {
      return true;
    }

    return super.handleRequest(props);
  }

  /**
   * Named throttlers write `Retry-After-<name>`. Clients (and the web app's
   * 429 message) look for the standard header, so set it as well.
   */
  protected override async throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    context
      .switchToHttp()
      .getResponse<Response>()
      .setHeader('Retry-After', String(Math.max(1, detail.timeToBlockExpire)));

    return super.throwThrottlingException(context, detail);
  }
}
