import { JobStatus } from '@hiflow/shared-types';
import { OmitType, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class ListJobsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(JobStatus, { message: 'Trạng thái không hợp lệ' })
  status?: JobStatus;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  positionId?: string;

  @IsOptional()
  @IsUUID()
  requisitionId?: string;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @IsOptional()
  @IsIn(['title', 'status', 'quantity', 'createdAt', 'publishedAt'])
  sortBy: 'title' | 'status' | 'quantity' | 'createdAt' | 'publishedAt' =
    'createdAt';
}

export class CreateJobDto {
  @IsUUID()
  requisitionId!: string;

  /** Defaults to the requisition's title. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  /** Defaults to the requisition's headcount. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  quantity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMax?: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  description?: string;
}

// Department and position come from the requisition and cannot be changed here,
// and a job cannot be re-pointed at a different requisition.
export class UpdateJobDto extends PartialType(
  OmitType(CreateJobDto, ['requisitionId'] as const),
) {}
