import { BadRequestException } from '@nestjs/common';
import { endOfDayExclusive, startOfDay } from './dates';

export interface Period {
  /** Inclusive start (midnight UTC of the first day). */
  from: Date;
  /** Exclusive end (midnight UTC after the last day). */
  to: Date;
  /** The first day, as `YYYY-MM-DD`. */
  fromDay: string;
  /** The last day, as `YYYY-MM-DD`. */
  toDay: string;
}

export const DEFAULT_PERIOD_DAYS = 30;
export const MAX_PERIOD_DAYS = 366;

const DAY_MS = 86_400_000;
const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Turns optional `from`/`to` days into a period. With neither given it is the
 * last 30 days ending today; with only one, the other defaults sensibly.
 */
export function resolvePeriod(
  from?: string,
  to?: string,
  now: Date = new Date(),
): Period {
  const lastDay = to ? startOfDay(to) : startOfDay(now.toISOString());
  const firstDay = from
    ? startOfDay(from)
    : new Date(lastDay.getTime() - (DEFAULT_PERIOD_DAYS - 1) * DAY_MS);

  if (firstDay.getTime() > lastDay.getTime()) {
    throw new BadRequestException('Ngày bắt đầu không được sau ngày kết thúc');
  }

  const days =
    Math.round((lastDay.getTime() - firstDay.getTime()) / DAY_MS) + 1;
  if (days > MAX_PERIOD_DAYS) {
    throw new BadRequestException(
      `Khoảng thời gian tối đa là ${MAX_PERIOD_DAYS} ngày`,
    );
  }

  return {
    from: firstDay,
    to: endOfDayExclusive(lastDay.toISOString()),
    fromDay: isoDay(firstDay),
    toDay: isoDay(lastDay),
  };
}
