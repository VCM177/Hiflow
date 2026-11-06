import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * One label and value of a detail page, for a `<dl>`. The wrapper is the only element between
 * the list and its `dt`/`dd` (a list may hold groups, not groups inside groups), so a field
 * that spans columns takes `className="sm:col-span-2"` here instead of a wrapper of its own.
 */
export function DetailField({
  label,
  children,
  className,
}: {
  label: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-xs text-hf-text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm break-words text-hf-text-body">
        {children ?? '—'}
      </dd>
    </div>
  );
}
