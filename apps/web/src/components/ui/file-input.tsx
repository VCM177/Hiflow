'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

export interface FileInputProps extends Omit<
  React.ComponentProps<'input'>,
  'type' | 'value'
> {
  /** Shown when no file is chosen yet. */
  emptyLabel?: string;
}

// A native file input (keyboard, screen reader and the OS picker all come for free).
// The file name shows in the hint, which the input references through aria-describedby.
function FileInput({
  className,
  emptyLabel = 'Chưa chọn tệp',
  onChange,
  id,
  ...props
}: FileInputProps) {
  const [fileName, setFileName] = React.useState<string>('');
  const hintId = React.useId();

  return (
    <div className="flex flex-col gap-1.5">
      <input
        id={id}
        type="file"
        aria-describedby={hintId}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          setFileName(file ? file.name : '');
          onChange?.(event);
        }}
        className={cn(
          'block w-full cursor-pointer rounded-hf-control border border-hf-border-control bg-hf-bg-card text-sm text-hf-text-body file:mr-3 file:h-9 file:cursor-pointer file:rounded-hf-control file:border-0 file:bg-hf-bg-surface file:px-3 file:text-sm file:font-medium file:text-hf-text-body focus-visible:ring-2 focus-visible:ring-hf-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-hf-destructive',
          className,
        )}
        {...props}
      />
      <p id={hintId} className="text-xs text-hf-text-muted">
        {fileName || emptyLabel}
      </p>
    </div>
  );
}

export { FileInput };
