import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  normaliseEmail,
  normalisePhone,
  trim,
  VN_PHONE,
} from '../../common/transforms';

/** A multipart form sends everything as text, so "true" has to become a boolean. */
const toBoolean = ({ value }: { value: unknown }): unknown =>
  value === 'true' ? true : value === 'false' ? false : value;

/**
 * The fields of the public application form, and nothing else: an unknown field
 * is refused by the global ValidationPipe rather than quietly stored.
 */
export class SubmitApplicationDto {
  // One line only, and no control or invisible formatting characters: the name
  // is repeated back in an email, so it must not be able to fake extra text
  // (line breaks) or reorder what the reader sees (bidi overrides).
  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'Họ tên quá ngắn' })
  @MaxLength(100, { message: 'Họ tên tối đa 100 ký tự' })
  @Matches(/^[^\p{Cc}\p{Cf}]+$/u, { message: 'Họ tên có ký tự không hợp lệ' })
  fullName!: string;

  @Transform(normaliseEmail)
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(150)
  email!: string;

  @Transform(normalisePhone)
  @Matches(VN_PHONE, { message: 'Số điện thoại không hợp lệ' })
  phone!: string;

  @Transform(toBoolean)
  @IsBoolean()
  @Equals(true, {
    message: 'Vui lòng đồng ý cho Hiflow xử lý dữ liệu cá nhân để ứng tuyển',
  })
  consent!: boolean;

  /** Cloudflare Turnstile token; checked in the service (not needed when captcha is off). */
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  turnstileToken?: string;
}
