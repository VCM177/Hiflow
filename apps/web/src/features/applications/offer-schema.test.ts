import { describe, expect, it } from 'vitest';

import {
  isOfferExpired,
  offerSchema,
  todayText,
  toOfferBody,
} from './offer-schema';

const day = (offset: number) => {
  const date = new Date(Date.now() + offset * 86_400_000);
  return todayText(date);
};

const valid = {
  salary: '15000000',
  startDate: day(10),
  expiresAt: day(5),
  note: '',
};

describe('offerSchema', () => {
  it('keeps the salary as typed and reads it as a number for the API', () => {
    const parsed = offerSchema.parse(valid);
    expect(parsed.salary).toBe('15000000');
    expect(toOfferBody(parsed, 'create').salary).toBe(15_000_000);
  });

  it.each([
    ['salary', '0'],
    ['salary', '10000000001'],
    ['salary', 'abc'],
    ['startDate', ''],
    ['startDate', day(-1)],
    ['expiresAt', day(-1)],
    ['expiresAt', day(11)],
    ['note', 'x'.repeat(2001)],
  ])('refuses %s = %j', (field, value) => {
    expect(offerSchema.safeParse({ ...valid, [field]: value }).success).toBe(
      false,
    );
  });

  it('puts a late deadline on the deadline box', () => {
    const result = offerSchema.safeParse({ ...valid, expiresAt: day(11) });
    expect(result.error?.issues[0].path).toEqual(['expiresAt']);
    expect(result.error?.issues[0].message).toContain('sau ngày nhận việc');
  });

  it('lets the deadline be blank, and equal to the start date', () => {
    expect(offerSchema.safeParse({ ...valid, expiresAt: '' }).success).toBe(
      true,
    );
    expect(
      offerSchema.safeParse({ ...valid, expiresAt: valid.startDate }).success,
    ).toBe(true);
  });
});

describe('toOfferBody', () => {
  it('nulls blanks on edit and omits them on create', () => {
    const parsed = offerSchema.parse({ ...valid, expiresAt: '' });
    expect(toOfferBody(parsed, 'edit')).toMatchObject({
      expiresAt: null,
      note: null,
    });
    expect(toOfferBody(parsed, 'create').expiresAt).toBeUndefined();
  });
});

describe('isOfferExpired', () => {
  it('is expired the day after the deadline, not on it', () => {
    expect(isOfferExpired(day(-1))).toBe(true);
    expect(isOfferExpired(day(0))).toBe(false);
    expect(isOfferExpired(null)).toBe(false);
  });
});
