import { ApplicationStatus } from '@hiflow/shared-types';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const STATUS_MESSAGE = { message: 'Trạng thái không hợp lệ' };

export class ListApplicationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ApplicationStatus, STATUS_MESSAGE)
  status?: ApplicationStatus;

  @IsOptional()
  @IsUUID()
  jobId?: string;

  @IsOptional()
  @IsUUID()
  candidateId?: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsDateString()
  appliedFrom?: string;

  @IsOptional()
  @IsDateString()
  appliedTo?: string;

  @IsOptional()
  @IsIn(['appliedAt', 'status', 'candidateName', 'jobTitle'])
  sortBy: 'appliedAt' | 'status' | 'candidateName' | 'jobTitle' = 'appliedAt';
}

export class CreateApplicationDto {
  @IsUUID()
  candidateId!: string;

  @IsUUID()
  jobId!: string;

  /** Defaults to the caller when they are a recruiter. */
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class AssignApplicationDto {
  /** `null` removes the assignee; the field itself is required. */
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  assigneeId!: string | null;
}

export class ChangeStatusDto {
  @IsEnum(ApplicationStatus, STATUS_MESSAGE)
  toStatus!: ApplicationStatus;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class SetApplicationNoteDto {
  /** An empty string clears the note. */
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  note!: string;
}
