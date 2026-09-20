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

const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'] as const;

/** Filters shared by the on-screen list and the CSV export. */
export class ActivityLogFilterDto {
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @IsOptional()
  @IsIn(WRITE_METHODS, { message: 'Loại thao tác không hợp lệ' })
  action?: (typeof WRITE_METHODS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(50)
  entityType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class ListActivityLogsQueryDto extends IntersectionType(
  PaginationQueryDto,
  ActivityLogFilterDto,
) {
  @IsOptional()
  @IsIn(['createdAt', 'entityType', 'action'])
  sortBy: 'createdAt' | 'entityType' | 'action' = 'createdAt';
}
