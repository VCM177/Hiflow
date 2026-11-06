'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ALL = 'all';

/**
 * A light filter that sits in the `FilterToolbar`: one choice or "all". `undefined` means
 * no filter, which keeps the URL clean.
 */
export function FilterSelect({
  label,
  value,
  allLabel,
  options,
  onChange,
}: {
  /** Names the box for screen readers. */
  label: string;
  value: string | undefined;
  /** The first entry, shown while nothing is filtered: "Mọi vai trò". */
  allLabel: string;
  options: readonly { value: string; label: string }[];
  onChange: (next: string | undefined) => void;
}) {
  return (
    <Select
      value={value ?? ALL}
      onValueChange={(next) => onChange(next === ALL ? undefined : next)}
    >
      <SelectTrigger aria-label={label} className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
