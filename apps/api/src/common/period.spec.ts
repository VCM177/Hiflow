import { BadRequestException } from '@nestjs/common';
import { MAX_PERIOD_DAYS, resolvePeriod } from './period';

const NOW = new Date('2026-09-20T15:30:00Z');

describe('resolvePeriod', () => {
  it('defaults to the last 30 days ending today, inclusive', () => {
    const p = resolvePeriod(undefined, undefined, NOW);

    expect(p.toDay).toBe('2026-09-20');
    expect(p.fromDay).toBe('2026-08-22');
    expect(p.from.toISOString()).toBe('2026-08-22T00:00:00.000Z');
    expect(p.to.toISOString()).toBe('2026-09-21T00:00:00.000Z');
  });

  it('makes the end exclusive at the start of the following day', () => {
    const p = resolvePeriod('2026-09-01', '2026-09-30', NOW);

    expect(p.from.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(p.to.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('accepts a single day', () => {
    const p = resolvePeriod('2026-09-10', '2026-09-10', NOW);

    expect(p.to.getTime() - p.from.getTime()).toBe(86_400_000);
  });

  it('defaults the start to 30 days before a given end', () => {
    expect(resolvePeriod(undefined, '2026-09-30', NOW).fromDay).toBe(
      '2026-09-01',
    );
  });

  it('ignores the time part of ISO timestamps', () => {
    expect(
      resolvePeriod('2026-09-10T22:00:00Z', '2026-09-12T03:00:00Z', NOW)
        .fromDay,
    ).toBe('2026-09-10');
  });

  it('rejects a start after the end', () => {
    expect(() => resolvePeriod('2026-09-20', '2026-09-10', NOW)).toThrow(
      BadRequestException,
    );
  });

  it('accepts exactly the maximum span and rejects one day more', () => {
    const okEnd = '2026-12-31';
    // 2026-01-01 → 2026-12-31 is 365 days; extend by one to reach 366.
    expect(() => resolvePeriod('2025-12-31', okEnd, NOW)).not.toThrow();
    expect(() => resolvePeriod('2025-12-30', okEnd, NOW)).toThrow(
      `${MAX_PERIOD_DAYS}`,
    );
  });
});
