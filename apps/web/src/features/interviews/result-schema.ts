import { INTERVIEW_RESULT_LABEL, InterviewResult } from '@hiflow/shared-types';
import { z } from 'zod';

import type { RecordableResult } from './interview-api';

export const RECORDABLE: readonly string[] = [
  InterviewResult.PASSED,
  InterviewResult.FAILED,
];

export const RESULT_OPTIONS = [
  InterviewResult.PASSED,
  InterviewResult.FAILED,
].map((value) => ({
  value,
  label: INTERVIEW_RESULT_LABEL[value],
}));

/** The result form: Đạt or Không đạt, and a comment that Không đạt must have. */
export const resultSchema = z
  .object({
    result: z.string().refine((value): boolean => RECORDABLE.includes(value), {
      error: 'Vui lòng chọn kết quả.',
    }),
    feedback: z
      .string()
      .trim()
      .max(2000, { error: 'Nhận xét tối đa 2000 ký tự.' }),
  })
  .refine(
    (value) => value.result !== InterviewResult.FAILED || value.feedback !== '',
    {
      error: 'Vui lòng nhập nhận xét khi không đạt.',
      path: ['feedback'],
    },
  );

export type ResultValues = z.infer<typeof resultSchema>;

export function toResultBody(values: ResultValues) {
  return {
    result: values.result as RecordableResult,
    ...(values.feedback === '' ? {} : { feedback: values.feedback }),
  };
}
