import { describe, expect, it } from 'vitest';

import { describeChanges, formatValue } from './row-changes';

describe('formatValue', () => {
  it('writes every kind of value as text', () => {
    expect(formatValue(null)).toBe('null');
    expect(formatValue(undefined)).toBe('null');
    expect(formatValue('a')).toBe('a');
    expect(formatValue(5)).toBe('5');
    expect(formatValue(false)).toBe('false');
    expect(formatValue({ a: 1 })).toBe('{"a":1}');
  });

  it('keeps markup as plain text', () => {
    expect(formatValue('<script>alert(1)</script>')).toBe(
      '<script>alert(1)</script>',
    );
  });
});

describe('describeChanges', () => {
  it('shows an update as old and new, sorted by column', () => {
    expect(
      describeChanges({
        op: 'U',
        changes: { status: ['DRAFT', 'APPROVED'], full_name: ['An', 'Bình'] },
      }),
    ).toEqual([
      { column: 'full_name', before: 'An', after: 'Bình' },
      { column: 'status', before: 'DRAFT', after: 'APPROVED' },
    ]);
  });

  it('shows a null before or after', () => {
    expect(
      describeChanges({ op: 'U', changes: { phone: [null, '0901234567'] } }),
    ).toEqual([{ column: 'phone', before: 'null', after: '0901234567' }]);
  });

  it('shows an insert and a delete as one value per column', () => {
    expect(
      describeChanges({ op: 'I', changes: { title: 'Kế toán', quantity: 2 } }),
    ).toEqual([
      { column: 'quantity', after: '2' },
      { column: 'title', after: 'Kế toán' },
    ]);
    expect(describeChanges({ op: 'D', changes: { title: 'Kế toán' } })).toEqual(
      [{ column: 'title', after: 'Kế toán' }],
    );
  });

  it('passes a redacted password through as it came', () => {
    expect(
      describeChanges({
        op: 'U',
        changes: { password_hash: ['[REDACTED]', '[REDACTED]'] },
      }),
    ).toEqual([
      { column: 'password_hash', before: '[REDACTED]', after: '[REDACTED]' },
    ]);
  });

  it('does not break on an update column that is not a pair', () => {
    expect(describeChanges({ op: 'U', changes: { odd: 'x' } })).toEqual([
      { column: 'odd', after: 'x' },
    ]);
  });

  it('is empty for no changes', () => {
    expect(describeChanges({ op: 'U', changes: {} })).toEqual([]);
  });
});
