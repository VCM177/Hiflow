import {
  CallHandler,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { requestContext } from '../../common/request-context/request-context';
import { AUDIT_EVENT_KEY, AuditEventMeta } from './audit.decorators';

/**
 * Writes nothing. A route that promises an event (`@AuditEvent`) and succeeds
 * without having recorded it is a bug: the tests turn it into a 500 so it cannot
 * be missed, and production logs it.
 */
@Injectable()
export class AuditVerifierInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditVerifierInterceptor.name);

  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const declared = this.reflector.get<AuditEventMeta | undefined>(
      AUDIT_EVENT_KEY,
      context.getHandler(),
    );

    if (context.getType() !== 'http' || !declared || declared.conditional) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        if (requestContext.get()?.recorded.has(declared.event)) return;

        const message = `${declared.event} was declared but not recorded`;
        if (process.env.NODE_ENV === 'test') {
          throw new InternalServerErrorException(message);
        }
        this.logger.error(message);
      }),
    );
  }
}
