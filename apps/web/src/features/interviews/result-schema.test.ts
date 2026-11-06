import { describe, expect, it } from 'vitest';

import { resultSchema, toResultBody } from './result-schema';

describe('resultSchema', () => {
  it('needs a result', () => {
    expect(resultSchema.safeParse({ result: '', feedback: '' }).success).toBe(
      false,
    );
  });

  it('lets a pass go without a comment', () => {
    expect(
      resultSchema.safeParse({ result: 'PASSED', feedback: '' }).success,
    ).toBe(true);
  });

  it('needs a comment for a fail, on the comment box', () => {
    const result = resultSchema.safeParse({
      result: 'FAILED',
      feedback: '   ',
    });
    expect(result.error?.issues[0].path).toEqual(['feedback']);
    expect(result.error?.issues[0].message).toBe(
      'Vui lòng nhập nhận xét khi không đạt.',
    );
  });

  it('caps the comment at 2000 characters', () => {
    expect(
      resultSchema.safeParse({ result: 'PASSED', feedback: 'x'.repeat(2001) })
        .success,
    ).toBe(false);
  });
});

describe('toResultBody', () => {
  it('leaves a blank comment out', () => {
    expect(toResultBody({ result: 'PASSED', feedback: '' })).toEqual({
      result: 'PASSED',
    });
    expect(
      toResultBody({ result: 'FAILED', feedback: 'Thiếu kỹ năng' }),
    ).toEqual({
      result: 'FAILED',
      feedback: 'Thiếu kỹ năng',
    });
  });
});
