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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { AuditEvent } from './audit.decorators';
import { AuditService } from './audit.service';
import { actorOf } from './audit.types';
import {
  AuditEventFilterDto,
  ListAuditEventsQueryDto,
} from './audit-events.dto';
import { AuditEventsService } from './audit-events.service';

@ApiTags('audit-events')
@ApiBearerAuth()
@Controller('audit-events')
export class AuditEventsController {
  constructor(
    private readonly events: AuditEventsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.audit.eventView)
  list(@Query() query: ListAuditEventsQueryDto) {
    return this.events.list(query);
  }

  // Declared before `:id` so "export" is never parsed as an id.
  @Get('export')
  @AuditEvent('AUDIT_LOG_EXPORTED')
  @RequirePermissions(PERMISSIONS.audit.eventExport)
  async export(
    @Query() filter: AuditEventFilterDto,
    @CurrentUser() actor: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const { csv, rows } = await this.events.exportCsv(filter);
    const stamp = new Date().toISOString().slice(0, 10);

    // Who took a copy of the trail is itself something the trail must say.
    await this.audit.recordStandalone(
      actorOf(actor),
      'AUDIT_LOG_EXPORTED',
      null,
      {
        filters: Object.fromEntries(
          Object.entries(filter).map(([key, value]) => [key, String(value)]),
        ),
        rows,
      },
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="audit-events_${stamp}.csv"`,
    );
    return csv;
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.audit.eventView)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.events.get(id);
  }
}
