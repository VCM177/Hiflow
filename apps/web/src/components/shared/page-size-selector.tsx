'use client';

import * as React from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MAX_LIMIT } from '@/lib/list-params';

const PAGE_SIZES = [10, 20, 50, MAX_LIMIT] as const;

/**
 * Picks how many rows a page shows (`limit`). A limit that came in through the URL and is
 * not one of the standard sizes (`?limit=15`) is still listed, so the control never shows
 * a value it cannot select.
 */
export function PageSizeSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (limit: number) => void;
}) {
  const labelId = React.useId();
  const sizes = PAGE_SIZES.includes(value as (typeof PAGE_SIZES)[number])
    ? PAGE_SIZES
    : [...PAGE_SIZES, value].sort((a, b) => a - b);

  return (
    <div className="flex items-center gap-2 text-sm text-hf-text-muted">
      <span id={labelId}>Số dòng mỗi trang</span>
      <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger aria-labelledby={labelId} className="w-20 tabular-nums">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sizes.map((size) => (
            <SelectItem key={size} value={String(size)}>
              {size}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
