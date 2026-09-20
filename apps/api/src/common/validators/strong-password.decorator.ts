import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * At least 8 characters with a letter and a digit. The 72-character cap is
 * bcrypt's limit: anything longer would be silently truncated.
 */
export const StrongPassword = () =>
  applyDecorators(
    IsString(),
    MinLength(8, { message: 'Mật khẩu tối thiểu 8 ký tự' }),
    MaxLength(72, { message: 'Mật khẩu tối đa 72 ký tự' }),
    Matches(/[A-Za-z]/, { message: 'Mật khẩu phải có ít nhất một chữ cái' }),
    Matches(/\d/, { message: 'Mật khẩu phải có ít nhất một chữ số' }),
  );
