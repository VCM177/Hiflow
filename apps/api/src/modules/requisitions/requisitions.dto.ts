import { RequisitionStatus } from '@hiflow/shared-types';
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

export class ListRequisitionsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(RequisitionStatus, { message: 'Trạng thái không hợp lệ' })
  status?: RequisitionStatus;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @IsOptional()
  @IsIn(['code', 'title', 'quantity', 'status', 'createdAt'])
  sortBy: 'code' | 'title' | 'quantity' | 'status' | 'createdAt' = 'createdAt';
}

export class CreateRequisitionDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  /** Ignored for a department manager, whose own department is always used. */
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsUUID()
  positionId!: string;

  @IsInt()
  @Min(1)
  @Max(1000)
  quantity!: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  reason?: string;

  @IsOptional()
  @IsDateString()
  expectedStartDate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  budgetMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  budgetMax?: number;
}

// The department is fixed at creation: moving a requisition between
// departments would let a manager slip out of their own scope.
export class UpdateRequisitionDto extends PartialType(
  OmitType(CreateRequisitionDto, ['departmentId'] as const),
) {}

export class RejectRequisitionDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập lý do từ chối' })
  @MaxLength(1000)
  reason!: string;
}
