import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';
import { Repository } from 'typeorm';
import type { AuthUser } from '../../common/types/auth-user';
import {
  ENTITY_TYPE_BY_RESOURCE,
  LOGGED_METHODS,
  SKIP_LOG_ROUTES,
} from './activity-log.constants';
import { ActivityLog } from './entities/activity-log.entity';
import { sanitizePayload } from './sanitize-payload';

const routePattern = (request: Request): string =>
  (request.route as { path?: string } | undefined)?.path ?? request.path;

const entityTypeOf = (route: string): string => {
  const resource = route.split('/').filter(Boolean)[0] ?? 'unknown';
  return (
    ENTITY_TYPE_BY_RESOURCE[resource] ??
    resource.charAt(0).toUpperCase() + resource.slice(1)
  );
};

const entityIdOf = (request: Request, response: unknown): string | null => {
  const fromParams = request.params?.id;
  if (typeof fromParams === 'string') {
    return fromParams;
  }

  const fromResponse = (response as { id?: unknown } | null)?.id;
  return typeof fromResponse === 'string' ? fromResponse : null;
};

@Injectable()
export class ActivityLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ActivityLogInterceptor.name);

  constructor(
    @InjectRepository(ActivityLog)
    private readonly logs: Repository<ActivityLog>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const route = routePattern(request);

    if (
      !LOGGED_METHODS.has(request.method) ||
      SKIP_LOG_ROUTES.includes(route)
    ) {
      return next.handle();
    }

    return next.handle().pipe(
      tap((response) => {
        void this.record(request, route, response);
      }),
    );
  }

  /** Fire-and-forget: a failed audit write must never fail the request. */
  private async record(
    request: Request,
    route: string,
    response: unknown,
  ): Promise<void> {
    try {
      const actor = request.user as AuthUser | undefined;

      await this.logs.save(
        this.logs.create({
          actorId: actor?.id ?? null,
          action: request.method,
          entityType: entityTypeOf(route),
          entityId: entityIdOf(request, response),
          payload: {
            route,
            body: sanitizePayload(request.body),
          } as Record<string, unknown>,
        }),
      );
    } catch (error) {
      this.logger.warn(
        `Could not record activity: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
