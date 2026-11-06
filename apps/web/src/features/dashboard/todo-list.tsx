import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

import type { Overview } from './dashboard-api';

/** Only an address inside the app is ever linked: the href comes from the API as text. */
export function isInAppPath(href: string): boolean {
  return href.startsWith('/') && !href.startsWith('//') && !href.includes('\\');
}

/** The work waiting for the person; each line opens the list already filtered to it. */
export function TodoList({ todo }: { todo: Overview['todo'] }) {
  if (todo.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-hf-text-muted">
        <CheckCircle2 aria-hidden="true" className="size-4" />
        Không có việc cần xử lý.
      </p>
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-hf-border">
      {todo.map((item) => (
        <li
          key={item.type}
          className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0"
        >
          {isInAppPath(item.href) ? (
            <Link
              href={item.href}
              className="font-medium text-hf-primary hover:underline"
            >
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-hf-text-heading">
              {item.label}
            </span>
          )}
          <span className="text-hf-text-heading tabular-nums">
            {item.count}
          </span>
        </li>
      ))}
    </ul>
  );
}
