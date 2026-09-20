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

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const normaliseEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

// "090 123-4567" and "090.123.4567" are common ways to type the same number.
const normalisePhone = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/[\s.\-()]/g, '') : value;

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
  @Matches(/^(?:\+84|0)\d{9,10}$/, { message: 'Số điện thoại không hợp lệ' })
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
