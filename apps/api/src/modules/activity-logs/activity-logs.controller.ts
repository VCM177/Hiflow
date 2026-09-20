import { PERMISSIONS } from '@hiflow/shared-types';
import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import {
  ActivityLogFilterDto,
  ListActivityLogsQueryDto,
} from './activity-logs.dto';
import { ActivityLogsService } from './activity-logs.service';

@ApiTags('activity-logs')
@ApiBearerAuth()
@Controller('activity-logs')
export class ActivityLogsController {
  constructor(private readonly logs: ActivityLogsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.activityLog.listView)
  list(@Query() query: ListActivityLogsQueryDto) {
    return this.logs.list(query);
  }

  // Declared before `:id` so "export" is never parsed as an id.
  @Get('export')
  @RequirePermissions(PERMISSIONS.activityLog.listExport)
  async export(
    @Query() filter: ActivityLogFilterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const csv = await this.logs.exportCsv(filter);
    const stamp = new Date().toISOString().slice(0, 10);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="activity-logs_${stamp}.csv"`,
    );
    return csv;
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.activityLog.listView)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.logs.get(id);
  }
}
