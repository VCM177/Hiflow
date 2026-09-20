import { InterviewResult } from '@hiflow/shared-types';
import { PartialType, PickType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
import { MAX_ROUND } from './interviews.constants';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class ListInterviewsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(InterviewResult, { message: 'Kết quả không hợp lệ' })
  result?: InterviewResult;

  @IsOptional()
  @IsUUID()
  applicationId?: string;

  @IsOptional()
  @IsUUID()
  interviewerId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_ROUND)
  round?: number;

  @IsOptional()
  @IsDateString()
  scheduledFrom?: string;

  @IsOptional()
  @IsDateString()
  scheduledTo?: string;

  @IsOptional()
  @IsIn(['scheduledAt', 'round', 'result', 'createdAt'])
  sortBy: 'scheduledAt' | 'round' | 'result' | 'createdAt' = 'scheduledAt';

  // Upcoming interviews first is the natural order for a schedule.
  override sortDir: 'asc' | 'desc' = 'asc';
}

export class CreateInterviewDto {
  @IsUUID()
  applicationId!: string;

  @IsUUID()
  interviewerId!: string;

  /** ISO 8601 with a time and offset, e.g. 2026-10-01T09:00:00+07:00. */
  @IsISO8601({ strict: true })
  scheduledAt!: string;

  /** Defaults to the next round for the application. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_ROUND)
  round?: number;
}

export class UpdateInterviewDto extends PartialType(
  PickType(CreateInterviewDto, [
    'interviewerId',
    'scheduledAt',
    'round',
  ] as const),
) {}

export class RecordResultDto {
  @IsIn([InterviewResult.PASSED, InterviewResult.FAILED], {
    message: 'Kết quả phải là Đạt hoặc Không đạt',
  })
  result!: InterviewResult.PASSED | InterviewResult.FAILED;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  feedback?: string;
}
