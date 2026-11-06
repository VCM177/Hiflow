import { z } from 'zod';

import { countSchema, optionalAmountSchema } from '@/lib/validations';

const dateText = z
  .string()
  .trim()
  .refine((value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value), {
    error: 'Ngày không hợp lệ.',
  });

/**
 * The requisition form (docs/web-plan-detail.md B7.4). Inputs are what the boxes hold
 * (text); the parsed values are what the API takes. The department only matters to roles
 * that choose it; a department manager's own department is used by the server.
 */
export const requisitionSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, { error: 'Vui lòng nhập tiêu đề.' })
      .max(200, { error: 'Tiêu đề tối đa 200 ký tự.' }),
    departmentId: z.string(),
    positionId: z.string().min(1, { error: 'Vui lòng chọn vị trí.' }),
    quantity: countSchema(1, 1000, 'số lượng'),
    reason: z.string().trim().max(2000, { error: 'Lý do tối đa 2000 ký tự.' }),
    expectedStartDate: dateText,
    budgetMin: optionalAmountSchema,
    budgetMax: optionalAmountSchema,
  })
  .refine(
    (value) =>
      value.budgetMin === undefined ||
      value.budgetMax === undefined ||
      value.budgetMax >= value.budgetMin,
    {
      error: 'Ngân sách tối đa không được nhỏ hơn ngân sách tối thiểu.',
      path: ['budgetMax'],
    },
  );

export type RequisitionInput = z.input<typeof requisitionSchema>;
export type RequisitionOutput = z.output<typeof requisitionSchema>;

/**
 * The body for a create (blank optional fields are left out) or an edit (blank ones are
 * sent as null so a value that was cleared is cleared on the server).
 */
export function toRequisitionBody(
  values: RequisitionOutput,
  mode: 'create' | 'edit',
) {
  const blank = mode === 'create' ? undefined : null;
  return {
    title: values.title,
    positionId: values.positionId,
    quantity: values.quantity,
    reason: values.reason === '' ? blank : values.reason,
    expectedStartDate:
      values.expectedStartDate === '' ? blank : values.expectedStartDate,
    budgetMin: values.budgetMin ?? blank,
    budgetMax: values.budgetMax ?? blank,
  };
}
