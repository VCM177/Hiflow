import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { rethrowDbError } from './db-errors';

const dbError = (code: string) =>
  new QueryFailedError(
    'INSERT ...',
    [],
    Object.assign(new Error('db'), { code }),
  );

describe('rethrowDbError', () => {
  it('maps a unique violation to a 409 with the supplied message', () => {
    expect(() =>
      rethrowDbError(dbError('23505'), { unique: 'Mã đã tồn tại' }),
    ).toThrow(new ConflictException('Mã đã tồn tại'));
  });

  it.each([
    ['23503', 'NO ACTION foreign key violation'],
    ['23001', 'ON DELETE RESTRICT violation'],
  ])('maps %s (%s) to a 409', (code) => {
    expect(() =>
      rethrowDbError(dbError(code), { foreignKey: 'Đang được sử dụng' }),
    ).toThrow(new ConflictException('Đang được sử dụng'));
  });

  it('falls back to a generic message when none is given', () => {
    expect(() => rethrowDbError(dbError('23505'))).toThrow(ConflictException);
  });

  it('rethrows an unrelated database error untouched', () => {
    const other = dbError('42P01');

    expect(() => rethrowDbError(other)).toThrow(other);
  });

  it('rethrows a non-database error untouched', () => {
    const boom = new Error('boom');

    expect(() => rethrowDbError(boom)).toThrow(boom);
  });
});
