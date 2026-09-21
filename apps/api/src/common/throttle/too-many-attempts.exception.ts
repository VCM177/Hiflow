import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';

/** A 429 raised from code (not from the throttler guard) that knows when to retry. */
export class TooManyAttemptsException extends HttpException {
  constructor(readonly retryAfterSeconds: number) {
    super(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
        error: 'Too Many Requests',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

/** Adds the standard Retry-After header the guard-based 429s carry as well. */
@Catch(TooManyAttemptsException)
export class TooManyAttemptsFilter implements ExceptionFilter<TooManyAttemptsException> {
  catch(exception: TooManyAttemptsException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    response
      .status(exception.getStatus())
      .setHeader(
        'Retry-After',
        String(Math.max(1, exception.retryAfterSeconds)),
      )
      .json(exception.getResponse());
  }
}
