'use client';

import * as React from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

// One Toaster for the whole app, mounted once in the root layout. Toasts confirm a
// success or report an error that is not tied to one field. Errors that map to a
// field belong on that field, not in a toast.
// Colours come from the hf tokens, so there is no hard-coded colour here.
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="top-right"
      richColors
      toastOptions={{ className: 'text-sm font-medium' }}
      style={
        {
          '--normal-bg': 'var(--hf-bg-card)',
          '--normal-border': 'var(--hf-border)',
          '--normal-text': 'var(--hf-text-body)',

          '--success-bg': 'var(--hf-bg-card)',
          '--success-border': 'var(--hf-success)',
          '--success-text': 'var(--hf-success-text)',

          '--error-bg': 'var(--hf-bg-card)',
          '--error-border': 'var(--hf-destructive)',
          '--error-text': 'var(--hf-destructive-text)',

          '--warning-bg': 'var(--hf-bg-card)',
          '--warning-border': 'var(--hf-warning)',
          '--warning-text': 'var(--hf-warning-text)',

          '--info-bg': 'var(--hf-bg-card)',
          '--info-border': 'var(--hf-primary)',
          '--info-text': 'var(--hf-primary)',

          '--border-radius': 'var(--hf-radius-container)',
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
