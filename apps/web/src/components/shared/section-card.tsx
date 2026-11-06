import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * The frame of one block on a page: a white card with a title, an optional description and
 * actions, and the content. Detail pages stack these; a list page puts its table in one.
 * Pass `flush` when the content is a table that should reach the card's edges.
 */
export function SectionCard({
  title,
  description,
  actions,
  flush = false,
  className,
  children,
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  flush?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const headingId = React.useId();
  const hasHeader = Boolean(title || actions);
  return (
    <section
      aria-labelledby={title ? headingId : undefined}
      className={cn(
        'rounded-hf-container border border-hf-border bg-hf-bg-card shadow-hf-card',
        className,
      )}
    >
      {hasHeader && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-hf-border px-5 py-4">
          <div className="min-w-0">
            {title && (
              <h2
                id={headingId}
                className="text-base font-semibold text-hf-text-heading"
              >
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-0.5 text-sm text-hf-text-muted">{description}</p>
            )}
          </div>
          {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
        </header>
      )}
      <div className={flush ? undefined : 'p-5'}>{children}</div>
    </section>
  );
}
