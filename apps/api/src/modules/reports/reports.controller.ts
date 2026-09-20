import { PERMISSIONS } from '@hiflow/shared-types';
import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { ReportQueryDto, ReportType } from './reports.dto';
import { ReportsService } from './reports.service';

const reportTypePipe = new ParseEnumPipe(ReportType, {
  exceptionFactory: () => new BadRequestException('Loại báo cáo không hợp lệ'),
});

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get(':type')
  @RequirePermissions(PERMISSIONS.report.overviewView)
  get(
    @Param('type', reportTypePipe) type: ReportType,
    @Query() query: ReportQueryDto,
  ) {
    return this.reports.build(type, query);
  }

  @Get(':type/export')
  @RequirePermissions(PERMISSIONS.report.overviewExport)
  async export(
    @Param('type', reportTypePipe) type: ReportType,
    @Query() query: ReportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const { filename, content } = await this.reports.exportCsv(type, query);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return content;
  }
}
