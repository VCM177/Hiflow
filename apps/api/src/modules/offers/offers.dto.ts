import { PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateOfferDto {
  /** Monthly salary in VND. */
  @IsInt()
  @Min(1)
  @Max(10_000_000_000)
  salary!: number;

  @IsDateString()
  startDate!: string;

  /** Last day the candidate may answer. */
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class UpdateOfferDto extends PartialType(CreateOfferDto) {}

export class RespondOfferDto {
  @IsBoolean()
  accepted!: boolean;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  note?: string;
}
