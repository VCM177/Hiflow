import { z } from 'zod';

/** The result form: Đạt or Không đạt, and a comment that Không đạt must have. */
export const resultSchema = z
  .object({
    result: z
      .string()
      .refine((value): boolean => value === 'PASSED' || value === 'FAILED', {
        error: 'Vui lòng chọn kết quả.',
      }),
    feedback: z
      .string()
      .trim()
      .max(2000, { error: 'Nhận xét tối đa 2000 ký tự.' }),
  })
  .refine((value) => value.result !== 'FAILED' || value.feedback !== '', {
    error: 'Vui lòng nhập nhận xét khi không đạt.',
    path: ['feedback'],
  });

export type ResultValues = z.infer<typeof resultSchema>;

export function toResultBody(values: ResultValues) {
  return {
    result: values.result as 'PASSED' | 'FAILED',
    ...(values.feedback === '' ? {} : { feedback: values.feedback }),
  };
}
