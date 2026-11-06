import { describe, expect, it } from 'vitest';

import { requisitionSchema, toRequisitionBody } from './requisition-schema';

const valid = {
  title: ' Tuyển lập trình viên ',
  departmentId: 'd1',
  positionId: 'p1',
  quantity: '3',
  reason: '',
  expectedStartDate: '',
  budgetMin: '',
  budgetMax: '',
};

describe('requisitionSchema', () => {
  it('parses text boxes into the values the API takes', () => {
    const out = requisitionSchema.parse({
      ...valid,
      budgetMin: '10.000.000',
      budgetMax: '20000000',
    });
    expect(out).toMatchObject({
      title: 'Tuyển lập trình viên',
      quantity: 3,
      budgetMin: 10_000_000,
      budgetMax: 20_000_000,
    });
  });

  it.each([
    ['title', ''],
    ['title', 'x'.repeat(201)],
    ['positionId', ''],
    ['quantity', '0'],
    ['quantity', '1001'],
    ['reason', 'x'.repeat(2001)],
    ['expectedStartDate', '01/01/2027'],
  ])('refuses %s = %j', (field, value) => {
    expect(
      requisitionSchema.safeParse({ ...valid, [field]: value }).success,
    ).toBe(false);
  });

  it('refuses a maximum budget below the minimum, on the maximum box', () => {
    const result = requisitionSchema.safeParse({
      ...valid,
      budgetMin: '20',
      budgetMax: '10',
    });
    expect(result.error?.issues[0].path).toEqual(['budgetMax']);
  });
});

describe('toRequisitionBody', () => {
  const parsed = requisitionSchema.parse(valid);
  it('leaves blank optional fields out on create', () => {
    const body = toRequisitionBody(parsed, 'create');
    expect(body.reason).toBeUndefined();
    expect(body.budgetMin).toBeUndefined();
  });
  it('sends null for blank optional fields on edit', () => {
    const body = toRequisitionBody(parsed, 'edit');
    expect(body.reason).toBeNull();
    expect(body.expectedStartDate).toBeNull();
    expect(body.budgetMax).toBeNull();
  });
});
