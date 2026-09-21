import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiConsumes,
  ApiNotFoundResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { RateLimit } from '../../common/throttle/rate-limit.decorator';
import { THROTTLE_POLICY } from '../../common/throttle/throttle.constants';
import { CV_MAX_BYTES } from '../storage/cv-file.validator';
import {
  APPLICATION_RECEIPT,
  PublicApplicationsService,
} from './public-applications.service';
import { SubmitApplicationDto } from './submit-application.dto';

/**
 * The application form. Every protection sits on this route on purpose: per
 * address and per email limits, the captcha, a file limit that stops the upload
 * being read past 5MB, and one identical answer whatever the outcome.
 */
@ApiTags('public')
@Controller('public/jobs')
export class PublicApplicationsController {
  constructor(private readonly applications: PublicApplicationsService) {}

  @Public()
  @RateLimit(THROTTLE_POLICY.PUBLIC_APPLY_IP)
  @Post(':id/applications')
  @HttpCode(202)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('cv', {
      // Anything beyond the form's own fields or one file is refused while it is
      // being read, not after it is in memory.
      limits: {
        fileSize: CV_MAX_BYTES,
        files: 1,
        fields: 8,
        fieldSize: 4 * 1024,
        parts: 10,
      },
    }),
  )
  @ApiAcceptedResponse({
    description:
      'Đã nhận. Nội dung trả về luôn giống nhau, kể cả khi ứng viên đã nộp trước đó; chi tiết được gửi qua email.',
    schema: { example: APPLICATION_RECEIPT },
  })
  @ApiBadRequestResponse({
    description:
      'Dữ liệu không hợp lệ, thiếu CV, CV sai định dạng, chưa đồng ý xử lý dữ liệu hoặc captcha không đạt',
  })
  @ApiNotFoundResponse({
    description: 'Tin không tồn tại hoặc không còn tuyển',
  })
  @ApiServiceUnavailableResponse({
    description:
      'Không kiểm tra được captcha hoặc không lưu được CV, thử lại sau',
  })
  @ApiTooManyRequestsResponse({
    description:
      'Quá nhiều lần nộp từ địa chỉ này hoặc cho email này. Đợi số giây trong header Retry-After.',
  })
  apply(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitApplicationDto,
    @UploadedFile() cv: Express.Multer.File | undefined,
    @Req() request: Request,
  ) {
    return this.applications.submit(id, dto, cv, request.ip ?? 'unknown');
  }
}
