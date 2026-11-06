import { describe, expect, it } from 'vitest';

import {
  scheduleSchema,
  toScheduleBody,
  toVietnamIso,
  toVietnamLocal,
} from './schedule-schema';

const future = new Date(Date.now() + 3 * 86_400_000);
const localFuture = new Date(future.getTime() + 7 * 3_600_000)
  .toISOString()
  .slice(0, 16);

describe('toVietnamIso', () => {
  it('spells out the +07:00 offset', () => {
    expect(toVietnamIso('2026-10-01T09:00')).toBe('2026-10-01T09:00:00+07:00');
  });
});

describe('scheduleSchema', () => {
  const valid = { interviewerId: 'u1', scheduledAt: localFuture, round: '' };

  it('accepts a future time and a blank round', () => {
    expect(scheduleSchema.safeParse(valid).success).toBe(true);
  });

  it('refuses a time in the past with the API wording', () => {
    const result = scheduleSchema.safeParse({
      ...valid,
      scheduledAt: '2020-01-01T09:00',
    });
    expect(result.error?.issues[0].message).toBe(
      'Thời gian phỏng vấn phải ở tương lai.',
    );
  });

  it.each([
    ['interviewerId', ''],
    ['scheduledAt', ''],
    ['scheduledAt', 'mai'],
    ['round', '0'],
    ['round', '11'],
    ['round', 'a'],
  ])('refuses %s = %j', (field, value) => {
    expect(scheduleSchema.safeParse({ ...valid, [field]: value }).success).toBe(
      false,
    );
  });
});

describe('toScheduleBody', () => {
  it('leaves the round out when blank and sends it as a number otherwise', () => {
    expect(
      toScheduleBody({
        interviewerId: 'u',
        scheduledAt: '2030-01-01T09:00',
        round: '',
      }),
    ).toEqual({
      interviewerId: 'u',
      scheduledAt: '2030-01-01T09:00:00+07:00',
    });
    expect(
      toScheduleBody({
        interviewerId: 'u',
        scheduledAt: '2030-01-01T09:00',
        round: '2',
      }).round,
    ).toBe(2);
  });
});

describe('toVietnamLocal', () => {
  it('shows an instant in Vietnam time whatever the browser zone', () => {
    expect(toVietnamLocal('2026-10-01T02:00:00.000Z')).toBe('2026-10-01T09:00');
    expect(toVietnamLocal('2026-10-01T20:30:00.000Z')).toBe('2026-10-02T03:30');
  });
  it('round-trips with toVietnamIso', () => {
    const local = '2026-10-01T09:00';
    expect(toVietnamLocal(new Date(toVietnamIso(local)).toISOString())).toBe(
      local,
    );
  });
});
