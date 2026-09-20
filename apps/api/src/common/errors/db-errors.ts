import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

const UNIQUE_VIOLATION = '23505';
// Postgres reports NO ACTION violations as 23503 but ON DELETE RESTRICT ones
// as 23001, so a foreign key that blocks a delete can arrive as either.
const FOREIGN_KEY_VIOLATIONS: ReadonlySet<string> = new Set(['23503', '23001']);

export interface DbErrorMessages {
  /** Shown when a unique constraint is violated. */
  unique?: string;
  /** Shown when a row is still referenced by (or references) another row. */
  foreignKey?: string;
}

/** Translates Postgres constraint errors into 409s; rethrows anything else. */
export function rethrowDbError(
  error: unknown,
  messages: DbErrorMessages = {},
): never {
  if (error instanceof QueryFailedError) {
    const code = (error.driverError as { code?: string } | undefined)?.code;

    if (code === UNIQUE_VIOLATION) {
      throw new ConflictException(messages.unique ?? 'Dữ liệu đã tồn tại');
    }

    if (code && FOREIGN_KEY_VIOLATIONS.has(code)) {
      throw new ConflictException(
        messages.foreignKey ?? 'Dữ liệu đang được sử dụng ở nơi khác',
      );
    }
  }

  throw error;
}
