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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../../common/types/auth-user';
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
