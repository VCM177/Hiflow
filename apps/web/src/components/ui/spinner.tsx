import * as React from 'react';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

// Inline loading indicator for a control or a small area. A page-level load uses
// a Skeleton instead. The label is read by screen readers; it is never only a visual.
function Spinner({
  className,
  label = 'Đang tải',
  ...props
}: React.ComponentProps<'span'> & { label?: string }) {
  return (
    <span role="status" className="inline-flex" {...props}>
      <Loader2
        aria-hidden="true"
        className={cn('size-4 animate-spin text-hf-text-muted', className)}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export { Spinner };
