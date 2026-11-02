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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { AuditEvent } from '../audit/audit.decorators';
import { AuditService } from '../audit/audit.service';
import { actorOf } from '../audit/audit.types';
import { ReportQueryDto, ReportType } from './reports.dto';
import { ReportsService } from './reports.service';

const reportTypePipe = new ParseEnumPipe(ReportType, {
  exceptionFactory: () => new BadRequestException('Loại báo cáo không hợp lệ'),
});

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly audit: AuditService,
  ) {}

  @Get(':type')
  @RequirePermissions(PERMISSIONS.report.overviewView)
  get(
    @Param('type', reportTypePipe) type: ReportType,
    @Query() query: ReportQueryDto,
  ) {
    return this.reports.build(type, query);
  }

  @Get(':type/export')
  @AuditEvent('REPORT_EXPORTED')
  @RequirePermissions(PERMISSIONS.report.overviewExport)
  async export(
    @Param('type', reportTypePipe) type: ReportType,
    @Query() query: ReportQueryDto,
    @CurrentUser() actor: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const { filename, content, rows } = await this.reports.exportCsv(
      type,
      query,
    );

    // A report holds figures about people, so who took a copy is recorded.
    await this.audit.recordStandalone(actorOf(actor), 'REPORT_EXPORTED', null, {
      report: type,
      filters: Object.fromEntries(
        Object.entries(query).map(([key, value]) => [key, String(value)]),
      ),
      rows,
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return content;
  }
}
