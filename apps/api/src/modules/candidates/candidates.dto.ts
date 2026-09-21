import { CandidateSource } from '@hiflow/shared-types';
import { OmitType, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
import {
  normaliseEmail,
  normalisePhone,
  trim,
  VN_PHONE,
} from '../../common/transforms';

const SOURCE_MESSAGE = { message: 'Nguồn ứng viên không hợp lệ' };

export class ListCandidatesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(CandidateSource, SOURCE_MESSAGE)
  source?: CandidateSource;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @IsOptional()
  @IsIn(['fullName', 'email', 'source', 'createdAt'])
  sortBy: 'fullName' | 'email' | 'source' | 'createdAt' = 'createdAt';
}

export class CreateCandidateDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName!: string;

  @Transform(normaliseEmail)
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(150)
  email!: string;

  @IsOptional()
  @Transform(normalisePhone)
  @Matches(VN_PHONE, { message: 'Số điện thoại không hợp lệ' })
  phone?: string;

  @IsOptional()
  @IsDateString()
  dob?: string;

  @IsOptional()
  @IsEnum(CandidateSource, SOURCE_MESSAGE)
  source?: CandidateSource;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  note?: string;
}

// The note has its own endpoint and permission (candidate.note.create).
export class UpdateCandidateDto extends PartialType(
  OmitType(CreateCandidateDto, ['note'] as const),
) {}

export class SetNoteDto {
  /** An empty string clears the note. */
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  note!: string;
}
