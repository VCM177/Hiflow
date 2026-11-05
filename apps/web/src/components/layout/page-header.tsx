import * as React from 'react';

/**
 * The title block of every page. Page-level actions (create, export, approve) go in
 * `actions`, never scattered in the body.
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-hf-text-heading">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-hf-text-muted">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </header>
  );
}
