'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        'fixed inset-0 z-50 bg-hf-scrim duration-(--hf-duration-fast) ease-hf-standard data-[state=closed]:animate-out data-[state=closed]:duration-100 data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
        className,
      )}
      {...props}
    />
  );
}

// sm: confirmations and short forms · md: standard forms · lg: two-column forms
// and pickers · xl: tables and previews.
const DIALOG_SIZE_CLASSNAME = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
} as const;

interface DialogContentProps extends React.ComponentProps<
  typeof DialogPrimitive.Content
> {
  showCloseButton?: boolean;
  /** Blocks closing with Esc or the X while the dialog holds unsaved input or a
   * submit is in flight. An explicit Hủy button in the body is separate and is
   * not affected. Outside clicks never close a dialog. */
  preventDismiss?: boolean;
  size?: keyof typeof DIALOG_SIZE_CLASSNAME;
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  preventDismiss = false,
  size = 'md',
  onEscapeKeyDown,
  ...props
}: DialogContentProps) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          'fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 grid-cols-1 gap-4 overflow-y-auto rounded-hf-overlay border border-hf-border bg-hf-bg-card p-6 text-hf-text-body shadow-hf-overlay duration-(--hf-duration-fast) ease-hf-standard data-[state=closed]:animate-out data-[state=closed]:duration-100 data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          DIALOG_SIZE_CLASSNAME[size],
          className,
        )}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => {
          if (preventDismiss) event.preventDefault();
          onEscapeKeyDown?.(event);
        }}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            onClick={(event) => {
              if (preventDismiss) event.preventDefault();
            }}
            className="absolute top-4 right-4 flex size-8 items-center justify-center rounded-hf-control text-hf-text-muted outline-none hover:bg-hf-bg-surface hover:text-hf-text-body focus-visible:ring-2 focus-visible:ring-hf-ring disabled:pointer-events-none"
          >
            <X className="size-4" aria-hidden="true" />
            <span className="sr-only">Đóng</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div className={cn('flex flex-col gap-1.5 pr-8', className)} {...props} />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn(
        'text-lg leading-none font-semibold text-hf-text-heading',
        className,
      )}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn('text-sm text-hf-text-muted', className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
