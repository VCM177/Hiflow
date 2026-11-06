import { z } from 'zod';

const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** "2026-10-01T09:00" typed in a datetime box is Vietnam time: the API wants the offset spelled out. */
export function toVietnamIso(local: string): string {
  return `${local}:00+07:00`;
}

/**
 * The interview scheduling form (docs/web-plan-detail.md B7.8): who, when (not in the
 * past) and which round (blank = the next round, chosen by the server).
 */
export const scheduleSchema = z.object({
  interviewerId: z.string().min(1, { error: 'Vui lòng chọn người phỏng vấn.' }),
  scheduledAt: z
    .string()
    .min(1, { error: 'Vui lòng chọn ngày giờ phỏng vấn.' })
    .refine((value) => LOCAL_DATE_TIME.test(value), {
      error: 'Ngày giờ không hợp lệ.',
    })
    .refine(
      (value) =>
        !LOCAL_DATE_TIME.test(value) ||
        new Date(toVietnamIso(value)).getTime() > Date.now(),
      { error: 'Thời gian phỏng vấn phải ở tương lai.' },
    ),
  round: z
    .string()
    .trim()
    .refine(
      (value) =>
        value === '' ||
        (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 10),
      { error: 'Vòng phỏng vấn từ 1 đến 10.' },
    ),
});

export type ScheduleValues = z.infer<typeof scheduleSchema>;

export function toScheduleBody(values: ScheduleValues) {
  return {
    interviewerId: values.interviewerId,
    scheduledAt: toVietnamIso(values.scheduledAt),
    ...(values.round === '' ? {} : { round: Number(values.round) }),
  };
}
