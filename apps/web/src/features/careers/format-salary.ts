import { formatCurrency } from '@/lib/format';

/** "15.000.000 ₫ – 25.000.000 ₫", "Từ …", "Đến …", or "Thỏa thuận" when neither end is set. */
export function formatSalaryRange(
  min: number | null,
  max: number | null,
): string {
  if (min === null && max === null) return 'Thỏa thuận';
  if (max === null) return `Từ ${formatCurrency(min)}`;
  if (min === null) return `Đến ${formatCurrency(max)}`;
  return min === max
    ? formatCurrency(min)
    : `${formatCurrency(min)} – ${formatCurrency(max)}`;
}
