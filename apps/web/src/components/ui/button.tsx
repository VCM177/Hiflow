import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

// Variant semantics: primary = the one main action per screen or dialog,
// secondary = neutral default, ghost = tertiary, destructive = irreversible.
// Icon-only buttons (icon-sm) must carry an aria-label.
const buttonVariants = cva(
  'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-hf-control text-sm font-medium whitespace-nowrap transition-colors duration-(--hf-duration-fast) outline-none select-none focus-visible:ring-2 focus-visible:ring-hf-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4',
  {
    variants: {
      variant: {
        primary:
          'bg-hf-primary text-hf-primary-foreground hover:bg-hf-primary-hover',
        secondary:
          'border border-hf-border-control bg-hf-bg-card text-hf-text-body hover:bg-hf-bg-surface',
        ghost: 'text-hf-text-body hover:bg-hf-bg-surface',
        destructive:
          'bg-hf-destructive text-hf-primary-foreground hover:opacity-90',
      },
      size: {
        md: 'h-9 px-4',
        sm: 'h-8 px-3',
        'icon-sm': 'size-8',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      type={asChild ? undefined : type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="animate-spin" aria-hidden="true" />
          {children}
        </>
      ) : (
        children
      )}
    </Comp>
  );
}

export { Button, buttonVariants };
