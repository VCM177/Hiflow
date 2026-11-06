import { describe, expect, it } from 'vitest';

import { formatSalaryRange } from './format-salary';

const norm = (s: string) => s.replace(/ /g, ' ');

describe('formatSalaryRange', () => {
  it('shows a negotiable salary when nothing is set', () => {
    expect(formatSalaryRange(null, null)).toBe('Thỏa thuận');
  });
  it('shows one open end', () => {
    expect(norm(formatSalaryRange(10_000_000, null))).toBe('Từ 10.000.000 ₫');
    expect(norm(formatSalaryRange(null, 20_000_000))).toBe('Đến 20.000.000 ₫');
  });
  it('shows a range', () => {
    expect(norm(formatSalaryRange(10_000_000, 20_000_000))).toBe(
      '10.000.000 ₫ – 20.000.000 ₫',
    );
  });
  it('shows one amount when both ends match', () => {
    expect(norm(formatSalaryRange(10_000_000, 10_000_000))).toBe(
      '10.000.000 ₫',
    );
  });
});
