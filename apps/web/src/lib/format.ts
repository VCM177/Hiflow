/** Hiflow shows every date and time in Vietnam time, whatever the browser's zone. */
export const DISPLAY_TIME_ZONE = 'Asia/Ho_Chi_Minh';

const CURRENCY = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

const DATE = new Intl.DateTimeFormat('vi-VN', {
  timeZone: DISPLAY_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const TIME = new Intl.DateTimeFormat('vi-VN', {
  timeZone: DISPLAY_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const PLACEHOLDER = '—';

/** Money in VND, no decimals: 1000000 → "1.000.000 ₫". Missing amounts show a dash. */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return PLACEHOLDER;
  }
  return CURRENCY.format(amount);
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** A date as dd/MM/yyyy in Vietnam time. */
export function formatDate(value: string | Date | null | undefined): string {
  const date = toDate(value);
  return date ? DATE.format(date) : PLACEHOLDER;
}

/** A date and time as dd/MM/yyyy HH:mm in Vietnam time. */
export function formatDateTime(
  value: string | Date | null | undefined,
): string {
  const date = toDate(value);
  return date ? `${DATE.format(date)} ${TIME.format(date)}` : PLACEHOLDER;
}
