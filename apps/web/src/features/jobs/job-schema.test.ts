import { describe, expect, it } from 'vitest';

import { isHeadcountError, jobSchema, toJobBody } from './job-schema';

const valid = {
  requisitionId: 'r1',
  title: ' Kế toán ',
  quantity: '2',
  salaryMin: '',
  salaryMax: '',
  location: '',
  description: '',
};

describe('jobSchema', () => {
  it('parses text boxes into numbers', () => {
    expect(
      jobSchema.parse({
        ...valid,
        salaryMin: '10000000',
        salaryMax: '20000000',
      }),
    ).toMatchObject({
      title: 'Kế toán',
      quantity: 2,
      salaryMin: 10_000_000,
      salaryMax: 20_000_000,
    });
  });

  it.each([
    ['requisitionId', ''],
    ['title', ''],
    ['quantity', '0'],
    ['quantity', '1001'],
    ['location', 'x'.repeat(201)],
    ['description', 'x'.repeat(20001)],
  ])('refuses %s = %j', (field, value) => {
    expect(jobSchema.safeParse({ ...valid, [field]: value }).success).toBe(
      false,
    );
  });

  it('puts a maximum salary below the minimum on the maximum box', () => {
    const result = jobSchema.safeParse({
      ...valid,
      salaryMin: '20',
      salaryMax: '10',
    });
    expect(result.error?.issues[0].path).toEqual(['salaryMax']);
  });
});

describe('toJobBody', () => {
  const parsed = jobSchema.parse(valid);
  it('omits blanks on create and nulls them on edit', () => {
    expect(toJobBody(parsed, 'create').location).toBeUndefined();
    expect(toJobBody(parsed, 'edit').location).toBeNull();
    expect(toJobBody(parsed, 'edit').salaryMin).toBeNull();
  });
});

describe('isHeadcountError', () => {
  it('recognises the API message', () => {
    expect(
      isHeadcountError('Vượt quá số lượng đã duyệt của yêu cầu (còn lại 1)'),
    ).toBe(true);
    expect(isHeadcountError('Chỉ tạo tin từ yêu cầu đã được duyệt')).toBe(
      false,
    );
  });
});
