import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/errors';

import { applyApiError } from './apply-api-error';

type Values = { name: string };

describe('applyApiError', () => {
  it('puts a 400 on the named field and focuses it', () => {
    const setError = vi.fn();

    const shown = applyApiError<Values>(
      new ApiError(400, ['Tên không hợp lệ']),
      setError,
      'name',
    );

    expect(setError).toHaveBeenCalledWith(
      'name',
      { type: 'server', message: 'Tên không hợp lệ' },
      { shouldFocus: true },
    );
    expect(shown).toEqual({
      kind: 'field',
      field: 'name',
      message: 'Tên không hợp lệ',
    });
  });

  it('puts a file that is too large on the named field', () => {
    const setError = vi.fn();

    applyApiError<Values>(new ApiError(413, []), setError, 'name');

    expect(setError).toHaveBeenCalledWith(
      'name',
      { type: 'server', message: 'Tệp quá lớn.' },
      { shouldFocus: true },
    );
  });

  it('leaves a 400 with no named field to the caller', () => {
    const setError = vi.fn();

    const shown = applyApiError<Values>(
      new ApiError(400, ['Dữ liệu sai']),
      setError,
    );

    expect(setError).not.toHaveBeenCalled();
    expect(shown).toEqual({
      kind: 'inline',
      message: 'Dữ liệu sai',
      reload: false,
    });
  });

  it.each([
    [409, 'inline'],
    [403, 'toast'],
    [500, 'toast'],
    [429, 'retry'],
    [401, 'login'],
  ])('leaves a %i to the caller as "%s"', (status, kind) => {
    const setError = vi.fn();

    const shown = applyApiError<Values>(
      new ApiError(status, ['x']),
      setError,
      'name',
    );

    expect(setError).not.toHaveBeenCalled();
    expect(shown.kind).toBe(kind);
  });
});
