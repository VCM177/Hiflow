import { PERMISSIONS } from '@hiflow/shared-types';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiFoundResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { CV_MAX_BYTES } from '../storage/cv-file.validator';
import { sendDownload } from '../storage/send-download';
import {
  CreateCandidateDto,
  ListCandidatesQueryDto,
  SetNoteDto,
  UpdateCandidateDto,
} from './candidates.dto';
import { CandidatesService } from './candidates.service';

@ApiTags('candidates')
@ApiBearerAuth()
@Controller('candidates')
export class CandidatesController {
  constructor(private readonly candidates: CandidatesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.candidate.listView)
  list(@Query() query: ListCandidatesQueryDto, @CurrentUser() actor: AuthUser) {
    return this.candidates.list(query, actor);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.candidate.listView)
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthUser) {
    return this.candidates.get(id, actor);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.candidate.create)
  create(@Body() dto: CreateCandidateDto, @CurrentUser() actor: AuthUser) {
    return this.candidates.create(dto, actor);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.candidate.update)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCandidateDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.candidates.update(id, dto, actor);
  }

  @Put(':id/note')
  @RequirePermissions(PERMISSIONS.candidate.noteCreate)
  setNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetNoteDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.candidates.setNote(id, dto.note, actor);
  }

  /** Redirects to a short-lived signed address, or streams the file, after the scope check. */
  @Get(':id/cv')
  @RequirePermissions(PERMISSIONS.candidate.listView)
  @ApiOkResponse({
    description: 'Tệp CV (khi lưu trên đĩa cục bộ)',
    content: {
      'application/octet-stream': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiFoundResponse({
    description:
      'Chuyển tới liên kết tải có chữ ký, hết hạn sau 60 giây (khi lưu trên Supabase)',
  })
  @ApiNotFoundResponse({
    description: 'Ứng viên không tồn tại, ngoài phạm vi, hoặc chưa có CV',
  })
  async downloadCv(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
    @Res() response: Response,
  ): Promise<void> {
    sendDownload(response, await this.candidates.downloadCv(id, actor));
  }

  @Post(':id/cv')
  @HttpCode(200)
  @ApiConsumes('multipart/form-data')
  @RequirePermissions(PERMISSIONS.candidate.cvManage)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: CV_MAX_BYTES, files: 1 } }),
  )
  uploadCv(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() actor: AuthUser,
  ) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn tệp CV');
    }

    return this.candidates.attachCv(id, file, actor);
  }

  @Delete(':id/cv')
  @RequirePermissions(PERMISSIONS.candidate.cvManage)
  removeCv(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.candidates.removeCv(id, actor);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.candidate.delete)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.candidates.remove(id, actor);
  }
}
