import { z } from 'zod';

import { countSchema, optionalAmountSchema } from '@/lib/validations';

/** The job form (docs/web-plan-detail.md B7.5). The description is HTML from the editor. */
export const jobSchema = z
  .object({
    requisitionId: z
      .string()
      .min(1, { error: 'Vui lòng chọn yêu cầu tuyển dụng.' }),
    title: z
      .string()
      .trim()
      .min(1, { error: 'Vui lòng nhập tiêu đề.' })
      .max(200, { error: 'Tiêu đề tối đa 200 ký tự.' }),
    quantity: countSchema(1, 1000, 'số lượng'),
    salaryMin: optionalAmountSchema,
    salaryMax: optionalAmountSchema,
    location: z
      .string()
      .trim()
      .max(200, { error: 'Địa điểm tối đa 200 ký tự.' }),
    description: z.string().max(20000, { error: 'Mô tả tối đa 20000 ký tự.' }),
  })
  .refine(
    (value) =>
      value.salaryMin === undefined ||
      value.salaryMax === undefined ||
      value.salaryMax >= value.salaryMin,
    {
      error: 'Lương tối đa không được nhỏ hơn lương tối thiểu.',
      path: ['salaryMax'],
    },
  );

export type JobInput = z.input<typeof jobSchema>;
export type JobOutput = z.output<typeof jobSchema>;

/** Create leaves blank optional fields out; an edit sends null so a cleared value is cleared. */
export function toJobBody(values: JobOutput, mode: 'create' | 'edit') {
  const blank = mode === 'create' ? undefined : null;
  return {
    title: values.title,
    quantity: values.quantity,
    salaryMin: values.salaryMin ?? blank,
    salaryMax: values.salaryMax ?? blank,
    location: values.location === '' ? blank : values.location,
    description: values.description === '' ? blank : values.description,
  };
}

/** The 409 about the approved headcount belongs on the quantity box. */
export function isHeadcountError(message: string): boolean {
  return /số lượng đã duyệt/i.test(message);
}
