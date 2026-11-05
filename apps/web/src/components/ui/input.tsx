import * as React from 'react';

import { cn } from '@/lib/utils';

// The label always sits above the input (never a placeholder). Error state is
// shown with a destructive border and aria-invalid; the icon and message come
// from the form field that wraps this input.
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      className={cn(
        'h-9 w-full min-w-0 rounded-hf-control border border-hf-border-control bg-hf-bg-card px-3 py-1 text-sm text-hf-text-body transition-[border-color,box-shadow] duration-(--hf-duration-fast) outline-none placeholder:text-hf-text-muted focus-visible:ring-2 focus-visible:ring-hf-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-hf-destructive aria-invalid:ring-2 aria-invalid:ring-hf-destructive/20',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
