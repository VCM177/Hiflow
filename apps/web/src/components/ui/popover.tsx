'use client';

import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';

import { POPUP_MOTION_CLASSNAME } from '@/components/ui/motion';
import { cn } from '@/lib/utils';

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;

// A floating panel anchored to its trigger (a date picker, a small form). Use a
// Dialog when the user must finish something before continuing.
function PopoverContent({
  className,
  align = 'center',
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 flex w-72 origin-(--radix-popover-content-transform-origin) flex-col gap-2.5 rounded-hf-overlay border border-hf-border bg-hf-bg-card p-3 text-sm text-hf-text-body shadow-hf-overlay outline-none',
          POPUP_MOTION_CLASSNAME,
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverContent, PopoverTrigger };
