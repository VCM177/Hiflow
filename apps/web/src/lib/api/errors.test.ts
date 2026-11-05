import { describe, expect, it } from 'vitest';

import { ApiError, messagesFromBody, parseRetryAfter } from './errors';

describe('ApiError', () => {
  it('carries status, messages and the first message as its text', () => {
    const error = new ApiError(409, ['Hồ sơ đã được xử lý.']);
    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(409);
    expect(error.messages).toEqual(['Hồ sơ đã được xử lý.']);
    expect(error.message).toBe('Hồ sơ đã được xử lý.');
  });

  it('falls back to a generic Vietnamese message when the server sent none', () => {
    expect(new ApiError(0, []).message).toBe(
      'Có lỗi xảy ra, vui lòng thử lại.',
    );
  });
});

describe('messagesFromBody', () => {
  it('reads a string message', () => {
    expect(
      messagesFromBody({ statusCode: 400, message: 'Sai dữ liệu' }),
    ).toEqual(['Sai dữ liệu']);
  });

  it('reads an array of messages and drops non-strings', () => {
    expect(
      messagesFromBody({ statusCode: 400, message: ['Tên bắt buộc', 42] }),
    ).toEqual(['Tên bắt buộc']);
  });

  it('returns nothing for a body without a message', () => {
    expect(messagesFromBody(null)).toEqual([]);
    expect(messagesFromBody('<html>')).toEqual([]);
    expect(messagesFromBody({ statusCode: 500 })).toEqual([]);
  });
});

describe('parseRetryAfter', () => {
  it('reads whole seconds', () => {
    expect(parseRetryAfter('30')).toBe(30);
  });

  it('rounds a fractional value up', () => {
    expect(parseRetryAfter('2.2')).toBe(3);
  });

  it('ignores a missing, negative or non-numeric header', () => {
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter('-1')).toBeUndefined();
    expect(parseRetryAfter('Wed, 21 Oct 2026 07:28:00 GMT')).toBeUndefined();
  });
});
