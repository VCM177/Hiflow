import { PERMISSIONS } from '@hiflow/shared-types';
import {
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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiFoundResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { sendDownload } from '../storage/send-download';
import {
  AssignApplicationDto,
  ChangeStatusDto,
  CreateApplicationDto,
  ListApplicationsQueryDto,
  SetApplicationNoteDto,
} from './applications.dto';
import { ApplicationsService } from './applications.service';

@ApiTags('applications')
@ApiBearerAuth()
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.application.listView)
  list(
    @Query() query: ListApplicationsQueryDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.applications.list(query, actor);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.application.listView)
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthUser) {
    return this.applications.get(id, actor);
  }

  /** Redirects to a short-lived signed address, or streams the file, after the scope check. */
  @Get(':id/cv')
  @RequirePermissions(PERMISSIONS.application.listView)
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
    description:
      'Hồ sơ không tồn tại, ngoài phạm vi, hoặc không có CV đính kèm',
  })
  async downloadCv(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
    @Res() response: Response,
  ): Promise<void> {
    sendDownload(response, await this.applications.downloadCv(id, actor));
  }

  @Post()
  @RequirePermissions(PERMISSIONS.application.create)
  create(@Body() dto: CreateApplicationDto, @CurrentUser() actor: AuthUser) {
    return this.applications.create(dto, actor);
  }

  @Patch(':id/assignee')
  @RequirePermissions(PERMISSIONS.application.assigneeUpdate)
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignApplicationDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.applications.assign(id, dto.assigneeId, actor);
  }

  @Post(':id/status')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.application.statusUpdate)
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeStatusDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.applications.changeStatus(id, dto, actor);
  }

  @Put(':id/note')
  @RequirePermissions(PERMISSIONS.application.noteCreate)
  setNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetApplicationNoteDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.applications.setNote(id, dto.note, actor);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.application.delete)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.applications.remove(id, actor);
  }
}
