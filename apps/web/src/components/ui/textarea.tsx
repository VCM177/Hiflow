import * as React from 'react';

import { cn } from '@/lib/utils';

// Same field states as Input. Grows with its content (field-sizing) and starts at three lines.
function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'field-sizing-content min-h-20 w-full rounded-hf-control border border-hf-border-control bg-hf-bg-card px-3 py-2 text-sm text-hf-text-body transition-[border-color,box-shadow] duration-(--hf-duration-fast) outline-none placeholder:text-hf-text-muted focus-visible:ring-2 focus-visible:ring-hf-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-hf-destructive aria-invalid:ring-2 aria-invalid:ring-hf-destructive/20',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
