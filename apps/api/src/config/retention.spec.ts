import { DEFAULT_RETENTION_MONTHS, retentionMonths } from './retention';

describe('retentionMonths', () => {
  it('defaults to 12 months when unset or empty', () => {
    expect(DEFAULT_RETENTION_MONTHS).toBe(12);
    expect(retentionMonths(undefined)).toBe(12);
    expect(retentionMonths('')).toBe(12);
  });

  it('accepts whole months from 1 to 120', () => {
    expect(retentionMonths('1')).toBe(1);
    expect(retentionMonths('24')).toBe(24);
    expect(retentionMonths('120')).toBe(120);
  });

  it.each(['0', '-3', '121', '1.5', 'abc', ' ', 'NaN'])(
    'rejects %p instead of guessing',
    (value) => {
      expect(() => retentionMonths(value)).toThrow(
        /CANDIDATE_RETENTION_MONTHS/,
      );
    },
  );
});
