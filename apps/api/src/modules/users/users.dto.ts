import { UserRole } from '@hiflow/shared-types';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
import { StrongPassword } from '../../common/validators/strong-password.decorator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const normaliseEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

const toBoolean = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

const ROLE_MESSAGE = { message: 'Vai trò không hợp lệ' };

export class ListUsersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(UserRole, ROLE_MESSAGE)
  role?: UserRole;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsIn(['fullName', 'email', 'role', 'createdAt'])
  sortBy: 'fullName' | 'email' | 'role' | 'createdAt' = 'createdAt';
}

export class CreateUserDto {
  @Transform(normaliseEmail)
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(150)
  email!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName!: string;

  @IsEnum(UserRole, ROLE_MESSAGE)
  role!: UserRole;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @StrongPassword()
  password!: string;
}

export class UpdateUserDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName?: string;

  /** `null` removes the user from their department. */
  @IsOptional()
  @IsUUID()
  departmentId?: string | null;
}

export class AssignRoleDto {
  @IsEnum(UserRole, ROLE_MESSAGE)
  role!: UserRole;
}

export class SetStatusDto {
  @IsBoolean()
  isActive!: boolean;
}

export class ResetPasswordDto {
  @StrongPassword()
  newPassword!: string;
}

export class UpdateProfileDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName!: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @StrongPassword()
  newPassword!: string;
}
