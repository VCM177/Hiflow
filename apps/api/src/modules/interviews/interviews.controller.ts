import { PERMISSIONS } from '@hiflow/shared-types';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { AuditEvent } from '../audit/audit.decorators';
import {
  CreateInterviewDto,
  ListInterviewsQueryDto,
  RecordResultDto,
  UpdateInterviewDto,
} from './interviews.dto';
import { InterviewsService } from './interviews.service';

@ApiTags('interviews')
@ApiBearerAuth()
@Controller('interviews')
export class InterviewsController {
  constructor(private readonly interviews: InterviewsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.interview.listView)
  list(@Query() query: ListInterviewsQueryDto, @CurrentUser() actor: AuthUser) {
    return this.interviews.list(query, actor);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.interview.listView)
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthUser) {
    return this.interviews.get(id, actor);
  }

  @Post()
  @AuditEvent('INTERVIEW_SCHEDULED')
  @RequirePermissions(PERMISSIONS.interview.create)
  create(@Body() dto: CreateInterviewDto, @CurrentUser() actor: AuthUser) {
    return this.interviews.create(dto, actor);
  }

  @Patch(':id')
  @AuditEvent('INTERVIEW_UPDATED', { conditional: true })
  @RequirePermissions(PERMISSIONS.interview.update)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInterviewDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.interviews.update(id, dto, actor);
  }

  @Post(':id/cancel')
  @AuditEvent('INTERVIEW_CANCELLED')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.interview.cancel)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.interviews.cancel(id, actor);
  }

  @Post(':id/result')
  @AuditEvent('INTERVIEW_RESULT_RECORDED')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.interview.resultRecord)
  recordResult(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordResultDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.interviews.recordResult(id, dto, actor);
  }
}
