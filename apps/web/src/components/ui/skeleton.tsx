import * as React from 'react';

import { cn } from '@/lib/utils';

// Placeholder for content that is loading. It is decorative: the view that shows it
// must announce the loading state with text (for example "Đang tải danh sách").
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse rounded-hf-control bg-hf-bg-surface',
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
