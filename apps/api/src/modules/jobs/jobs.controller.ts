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
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { CreateJobDto, ListJobsQueryDto, UpdateJobDto } from './jobs.dto';
import { JobsService } from './jobs.service';

@ApiTags('jobs')
@ApiBearerAuth()
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.job.listView)
  list(@Query() query: ListJobsQueryDto, @CurrentUser() actor: AuthUser) {
    return this.jobs.list(query, actor);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.job.listView)
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthUser) {
    return this.jobs.get(id, actor);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.job.create)
  create(@Body() dto: CreateJobDto, @CurrentUser() actor: AuthUser) {
    return this.jobs.create(dto, actor);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.job.update)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateJobDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.jobs.update(id, dto, actor);
  }

  @Post(':id/publish')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.job.publish)
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.jobs.publish(id, actor);
  }

  @Post(':id/stop')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.job.stop)
  stop(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthUser) {
    return this.jobs.stop(id, actor);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.job.delete)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.jobs.remove(id, actor);
  }
}
