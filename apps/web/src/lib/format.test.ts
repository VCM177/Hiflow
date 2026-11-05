import { describe, expect, it } from 'vitest';

import { formatCurrency, formatDate, formatDateTime } from './format';

describe('formatCurrency', () => {
  it('formats VND with dot separators and no decimals', () => {
    const text = formatCurrency(1000000);
    expect(text).toContain('1.000.000');
    expect(text).toContain('₫');
    expect(text).not.toContain(',');
  });

  it('rounds away any fraction instead of printing decimals', () => {
    expect(formatCurrency(1234.6)).toContain('1.235');
  });

  it('shows a dash for a missing or non-numeric amount', () => {
    expect(formatCurrency(null)).toBe('—');
    expect(formatCurrency(undefined)).toBe('—');
    expect(formatCurrency(Number.NaN)).toBe('—');
  });
});

describe('formatDate', () => {
  it('formats as dd/MM/yyyy', () => {
    expect(formatDate('2026-10-01T00:00:00+07:00')).toBe('01/10/2026');
  });

  it('uses Vietnam time, so a UTC instant late in the day lands on the next date', () => {
    // 18:00 UTC on 30 Sep is 01:00 on 1 Oct in Vietnam.
    expect(formatDate('2026-09-30T18:00:00Z')).toBe('01/10/2026');
  });

  it('shows a dash for an empty or invalid value', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('không phải ngày')).toBe('—');
  });
});

describe('formatDateTime', () => {
  it('formats as dd/MM/yyyy HH:mm in Vietnam time', () => {
    expect(formatDateTime('2026-10-01T09:00:00+07:00')).toBe(
      '01/10/2026 09:00',
    );
  });

  it('uses a 24-hour clock', () => {
    expect(formatDateTime('2026-10-01T21:30:00+07:00')).toBe(
      '01/10/2026 21:30',
    );
  });

  it('converts from UTC into Vietnam time', () => {
    expect(formatDateTime('2026-10-01T02:15:00Z')).toBe('01/10/2026 09:15');
  });
});
