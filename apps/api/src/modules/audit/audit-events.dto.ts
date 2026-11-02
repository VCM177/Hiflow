import { AUDIT_EVENT_NAMES } from '@hiflow/shared-types';
import type { AuditEvent } from '@hiflow/shared-types';
import { IntersectionType } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';

export const AUDIT_ORIGINS = ['app', 'seed', 'maintenance', 'e2e'] as const;

/** Filters shared by the on-screen list and the CSV export. */
export class AuditEventFilterDto {
  @IsOptional()
  @IsIn(AUDIT_EVENT_NAMES, { message: 'Mã sự kiện không hợp lệ' })
  event?: AuditEvent;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  entityType?: string;

  @IsOptional()
  @IsUUID()
  entityId?: string;

  @IsOptional()
  @IsUUID()
  actorId?: string;

  @IsOptional()
  @IsIn(AUDIT_ORIGINS, { message: 'Nguồn không hợp lệ' })
  origin?: (typeof AUDIT_ORIGINS)[number];

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class ListAuditEventsQueryDto extends IntersectionType(
  PaginationQueryDto,
  AuditEventFilterDto,
) {
  @IsOptional()
  @IsIn(['occurredAt'])
  sortBy = 'occurredAt' as const;
}
