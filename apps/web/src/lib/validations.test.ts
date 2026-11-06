import { describe, expect, it } from 'vitest';

import {
  categoryCodeSchema,
  consentSchema,
  countSchema,
  cvFileError,
  emailSchema,
  internalFullNameSchema,
  isInTheFuture,
  isOldEnough,
  offerDatesError,
  offerSalarySchema,
  optionalAmountSchema,
  passwordSchema,
  phoneSchema,
  publicFullNameSchema,
  requiredReasonSchema,
  salaryRangeSchema,
} from './validations';

function firstError(
  schema: {
    safeParse: (v: unknown) => {
      success: boolean;
      error?: { issues: { message: string }[] };
    };
  },
  value: unknown,
) {
  const result = schema.safeParse(value);
  return result.success ? null : (result.error?.issues[0]?.message ?? null);
}

describe('passwordSchema', () => {
  it('accepts a password with a letter and a digit at the length limits', () => {
    expect(firstError(passwordSchema, 'abcdefg1')).toBeNull();
    expect(firstError(passwordSchema, `a1${'x'.repeat(70)}`)).toBeNull();
  });

  it('rejects 7 and 73 characters', () => {
    expect(firstError(passwordSchema, 'abcdef1')).toBe(
      'Mật khẩu cần ít nhất 8 ký tự.',
    );
    expect(firstError(passwordSchema, `a1${'x'.repeat(71)}`)).toBe(
      'Mật khẩu tối đa 72 ký tự.',
    );
  });

  it('requires a letter and a digit', () => {
    expect(firstError(passwordSchema, '12345678')).toBe(
      'Mật khẩu cần ít nhất một chữ cái.',
    );
    expect(firstError(passwordSchema, 'abcdefgh')).toBe(
      'Mật khẩu cần ít nhất một chữ số.',
    );
  });
});

describe('emailSchema', () => {
  it('trims and lower-cases before validating', () => {
    expect(emailSchema.parse('  Nguyen.Van.A@Example.COM ')).toBe(
      'nguyen.van.a@example.com',
    );
  });

  it('rejects an invalid address', () => {
    expect(firstError(emailSchema, 'khong-phai-email')).toBe(
      'Email không hợp lệ.',
    );
  });
});

describe('phoneSchema', () => {
  it('removes spaces, dots, dashes and brackets, then accepts +84 and 0 forms', () => {
    expect(phoneSchema.parse('090 123.4567')).toBe('0901234567');
    expect(phoneSchema.parse('(+84) 90-123-4567')).toBe('+84901234567');
  });

  it('rejects numbers that are too short or have the wrong prefix', () => {
    expect(firstError(phoneSchema, '0901234')).toBe(
      'Số điện thoại không hợp lệ.',
    );
    expect(firstError(phoneSchema, '1901234567')).toBe(
      'Số điện thoại không hợp lệ.',
    );
  });
});

describe('publicFullNameSchema', () => {
  it('accepts a two-character name with Vietnamese letters', () => {
    expect(publicFullNameSchema.parse('  Ôn  ')).toBe('Ôn');
  });

  it('rejects a single character and a name with a hidden format character', () => {
    expect(firstError(publicFullNameSchema, 'A')).toBe(
      'Họ tên cần ít nhất 2 ký tự.',
    );
    expect(firstError(publicFullNameSchema, 'Nguyễn​Văn')).toBe(
      'Họ tên chứa ký tự không hợp lệ.',
    );
  });
});

describe('internalFullNameSchema', () => {
  it('requires a name of at most 100 characters', () => {
    expect(firstError(internalFullNameSchema, '   ')).toBe(
      'Vui lòng nhập họ tên.',
    );
    expect(firstError(internalFullNameSchema, 'x'.repeat(101))).toBe(
      'Họ tên tối đa 100 ký tự.',
    );
  });
});

describe('consentSchema', () => {
  it('accepts only a ticked box', () => {
    expect(consentSchema.safeParse(true).success).toBe(true);
    expect(firstError(consentSchema, false)).toBe(
      'Bạn cần đồng ý để gửi hồ sơ.',
    );
  });
});

describe('categoryCodeSchema', () => {
  it('accepts 2 to 30 letters, digits or underscores', () => {
    expect(firstError(categoryCodeSchema, 'AB')).toBeNull();
    expect(firstError(categoryCodeSchema, 'A'.repeat(30))).toBeNull();
  });

  it('rejects a dash, a space, or a length outside 2 to 30', () => {
    expect(firstError(categoryCodeSchema, 'A')).not.toBeNull();
    expect(firstError(categoryCodeSchema, 'A-B')).not.toBeNull();
    expect(firstError(categoryCodeSchema, 'A'.repeat(31))).not.toBeNull();
  });
});

describe('requiredReasonSchema', () => {
  it('rejects a blank reason', () => {
    expect(firstError(requiredReasonSchema, '   ')).toBe(
      'Vui lòng nhập lý do.',
    );
  });
});

describe('salaryRangeSchema', () => {
  it('accepts min equal to max', () => {
    expect(
      salaryRangeSchema.safeParse({ salaryMin: 10, salaryMax: 10 }).success,
    ).toBe(true);
  });

  it('rejects min above max, on the max field', () => {
    const result = salaryRangeSchema.safeParse({
      salaryMin: 11,
      salaryMax: 10,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['salaryMax']);
  });
});

describe('offerSalarySchema', () => {
  it('accepts the bounds 1 and 10,000,000,000', () => {
    expect(offerSalarySchema.safeParse(1).success).toBe(true);
    expect(offerSalarySchema.safeParse(10_000_000_000).success).toBe(true);
  });

  it('rejects 0, above the maximum, and fractions', () => {
    expect(offerSalarySchema.safeParse(0).success).toBe(false);
    expect(offerSalarySchema.safeParse(10_000_000_001).success).toBe(false);
    expect(offerSalarySchema.safeParse(1.5).success).toBe(false);
  });
});

describe('cvFileError', () => {
  it('accepts a PDF or DOCX at or under 5 MB', () => {
    expect(cvFileError({ name: 'cv.pdf', size: 5 * 1024 * 1024 })).toBeNull();
    expect(cvFileError({ name: 'CV.DOCX', size: 1000 })).toBeNull();
  });

  it('refuses the legacy .doc format', () => {
    expect(cvFileError({ name: 'cv.doc', size: 1000 })).toBe(
      'Chỉ chấp nhận tệp PDF hoặc DOCX.',
    );
  });

  it('refuses a file over 5 MB', () => {
    expect(cvFileError({ name: 'cv.pdf', size: 5 * 1024 * 1024 + 1 })).toBe(
      'Tệp CV tối đa 5 MB.',
    );
  });
});

describe('age and date rules', () => {
  const now = new Date('2026-11-05T10:00:00+07:00');

  it('requires at least 16 years on the given day', () => {
    expect(isOldEnough(new Date('2010-11-05T00:00:00+07:00'), now)).toBe(true);
    expect(isOldEnough(new Date('2010-11-06T00:00:00+07:00'), now)).toBe(false);
  });

  it('requires an interview time in the future', () => {
    expect(isInTheFuture(new Date('2026-11-06T09:00:00+07:00'), now)).toBe(
      true,
    );
    expect(isInTheFuture(new Date('2026-11-04T09:00:00+07:00'), now)).toBe(
      false,
    );
  });

  it('checks offer dates: no past start, no past deadline, deadline not after start', () => {
    const start = new Date('2026-11-20T00:00:00+07:00');
    expect(
      offerDatesError(start, new Date('2026-11-10T00:00:00+07:00'), now),
    ).toBeNull();
    expect(
      offerDatesError(
        new Date('2026-11-01T00:00:00+07:00'),
        new Date('2026-11-10T00:00:00+07:00'),
        now,
      ),
    ).toBe('Ngày nhận việc không được ở quá khứ.');
    expect(
      offerDatesError(start, new Date('2026-11-01T00:00:00+07:00'), now),
    ).toBe('Hạn phản hồi không được ở quá khứ.');
    expect(
      offerDatesError(start, new Date('2026-11-25T00:00:00+07:00'), now),
    ).toBe('Hạn phản hồi không được sau ngày nhận việc.');
  });
});

describe('countSchema', () => {
  const schema = countSchema(1, 1000, 'số lượng');
  it('reads a whole number from text', () => {
    expect(schema.parse(' 5 ')).toBe(5);
  });
  it.each(['', 'abc', '0', '1001', '2.5'])('refuses %j', (value) => {
    expect(schema.safeParse(value).success).toBe(false);
  });
});

describe('optionalAmountSchema', () => {
  it('turns blank into undefined and text into a number', () => {
    expect(optionalAmountSchema.parse('')).toBeUndefined();
    expect(optionalAmountSchema.parse('15.000.000')).toBe(15_000_000);
  });
  it('refuses negatives and words', () => {
    expect(optionalAmountSchema.safeParse('-1').success).toBe(false);
    expect(optionalAmountSchema.safeParse('abc').success).toBe(false);
  });
});
