import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { MulterError } from 'multer';

/**
 * Nest turns a few multer errors into 400/413 by matching their message text.
 * multer 2 reworded some of them ("Unexpected file field"), so those slip past
 * and would answer 500, and log an error, for what is plain bad input (a file
 * sent under the wrong field name). Anything multer rejects is the caller's
 * fault, so it is a 400, or a 413 for a file that is too big.
 */
@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter<MulterError> {
  catch(error: MulterError, host: ArgumentsHost): void {
    const status =
      error.code === 'LIMIT_FILE_SIZE'
        ? HttpStatus.PAYLOAD_TOO_LARGE
        : HttpStatus.BAD_REQUEST;

    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({
        statusCode: status,
        message:
          status === HttpStatus.PAYLOAD_TOO_LARGE
            ? 'Tệp tải lên quá lớn'
            : 'Dữ liệu tải lên không hợp lệ',
        error:
          status === HttpStatus.PAYLOAD_TOO_LARGE
            ? 'Payload Too Large'
            : 'Bad Request',
      });
  }
}
