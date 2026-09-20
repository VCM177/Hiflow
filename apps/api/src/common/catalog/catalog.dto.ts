import { PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../pagination/pagination-query.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CatalogInputDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @Transform(trim)
  @IsString()
  @Matches(/^[A-Za-z0-9_]{2,30}$/, {
    message: 'Mã chỉ gồm chữ, số, dấu gạch dưới (2–30 ký tự)',
  })
  code!: string;
}

export class UpdateCatalogDto extends PartialType(CatalogInputDto) {}

export class CatalogListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['name', 'code', 'createdAt'])
  sortBy: 'name' | 'code' | 'createdAt' = 'name';

  override sortDir: 'asc' | 'desc' = 'asc';
}
