import { describe, expect, it } from 'vitest';

import { createUserSchema, resetPasswordSchema } from './user-schema';

const valid = {
  email: ' New@Example.com ',
  fullName: ' Trần Thị B ',
  role: 'RECRUITER',
  departmentId: 'none',
  password: 'Abcdef12',
};

describe('createUserSchema', () => {
  it('normalises the email and trims the name', () => {
    expect(createUserSchema.parse(valid)).toMatchObject({
      email: 'new@example.com',
      fullName: 'Trần Thị B',
    });
  });
  it('refuses an unknown role', () => {
    expect(createUserSchema.safeParse({ ...valid, role: 'ROOT' }).success).toBe(
      false,
    );
  });
  it('refuses a weak password', () => {
    expect(
      createUserSchema.safeParse({ ...valid, password: 'abcdefgh' }).success,
    ).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  it('needs 8 characters with a letter and a digit', () => {
    expect(
      resetPasswordSchema.safeParse({ newPassword: 'short1' }).success,
    ).toBe(false);
    expect(
      resetPasswordSchema.safeParse({ newPassword: 'longenough1' }).success,
    ).toBe(true);
  });
});
