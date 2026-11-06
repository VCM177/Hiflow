import { describe, expect, it } from 'vitest';

import { candidateSchema, toCandidateBody } from './candidate-schema';

const valid = {
  fullName: ' Nguyễn Văn A ',
  email: ' A@Example.com ',
  phone: '090 123-4567',
  dob: '1995-05-20',
  source: 'REFERRAL',
  note: '',
};

describe('candidateSchema', () => {
  it('normalises name and email', () => {
    expect(candidateSchema.parse(valid)).toMatchObject({
      fullName: 'Nguyễn Văn A',
      email: 'a@example.com',
    });
  });

  it('lets phone and birth date stay blank', () => {
    expect(
      candidateSchema.safeParse({ ...valid, phone: '', dob: '' }).success,
    ).toBe(true);
  });

  it.each([
    ['fullName', ''],
    ['email', 'khong-phai-email'],
    ['phone', '12345'],
    ['dob', 'not a date'],
    [
      'dob',
      new Date(Date.now() - 10 * 365 * 86400_000).toISOString().slice(0, 10),
    ],
    ['source', 'NOPE'],
    ['note', 'x'.repeat(2001)],
  ])('refuses %s = %j', (field, value) => {
    expect(
      candidateSchema.safeParse({ ...valid, [field]: value }).success,
    ).toBe(false);
  });

  it('says the candidate must be 16', () => {
    const young = new Date(Date.now() - 10 * 365 * 86400_000)
      .toISOString()
      .slice(0, 10);
    const result = candidateSchema.safeParse({ ...valid, dob: young });
    expect(result.error?.issues[0].message).toBe('Ứng viên phải từ 16 tuổi.');
  });
});

describe('toCandidateBody', () => {
  it('strips phone punctuation', () => {
    expect(toCandidateBody(candidateSchema.parse(valid), 'create').phone).toBe(
      '0901234567',
    );
  });
  it('omits blanks on create and nulls them on edit', () => {
    const parsed = candidateSchema.parse({ ...valid, phone: '', dob: '' });
    expect(toCandidateBody(parsed, 'create').phone).toBeUndefined();
    expect(toCandidateBody(parsed, 'edit').phone).toBeNull();
    expect(toCandidateBody(parsed, 'edit').dob).toBeNull();
  });
});
