import { endOfDayExclusive, startOfDay, toDateOnly } from './dates';

describe('dates', () => {
  it('startOfDay returns midnight UTC of that day', () => {
    expect(startOfDay('2026-09-20').toISOString()).toBe(
      '2026-09-20T00:00:00.000Z',
    );
    expect(startOfDay('2026-09-20T17:45:00Z').toISOString()).toBe(
      '2026-09-20T00:00:00.000Z',
    );
  });

  it('endOfDayExclusive returns midnight of the next day, so "to" covers the whole day', () => {
    expect(endOfDayExclusive('2026-09-20').toISOString()).toBe(
      '2026-09-21T00:00:00.000Z',
    );
  });

  it('rolls over month and year boundaries', () => {
    expect(endOfDayExclusive('2026-12-31').toISOString()).toBe(
      '2027-01-01T00:00:00.000Z',
    );
    expect(endOfDayExclusive('2026-02-28').toISOString()).toBe(
      '2026-03-01T00:00:00.000Z',
    );
  });

  it('toDateOnly drops any time part', () => {
    expect(toDateOnly('2026-10-01T08:00:00.000Z')).toBe('2026-10-01');
    expect(toDateOnly('2026-10-01')).toBe('2026-10-01');
  });
});
