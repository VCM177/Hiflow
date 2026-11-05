import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

// Status badge tints. The text uses the darker status token so it passes AA on the tint.
// Always render a label: colour alone is never the only signal.
const badgeVariants = cva(
  'inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-hf-badge px-2 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      variant: {
        primary: 'bg-hf-primary/10 text-hf-primary',
        success: 'bg-hf-success/12 text-hf-success-text',
        warning: 'bg-hf-warning/8 text-hf-warning-text',
        destructive: 'bg-hf-destructive/10 text-hf-destructive-text',
        neutral: 'bg-hf-neutral/15 text-hf-neutral-text',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
