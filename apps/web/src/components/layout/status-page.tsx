import * as React from 'react';

/**
 * A centred message for a page that cannot show its content: no permission, not
 * found, failed to load. Says what happened and offers the next step.
 */
export function StatusPage({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-hf-text-heading">{title}</h1>
      <p className="text-sm text-hf-text-body">{description}</p>
      {actions && <div className="flex gap-2">{actions}</div>}
    </section>
  );
}
