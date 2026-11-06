import * as React from 'react';
import { Inbox, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Shown where a list or a section has nothing to show. It always says why it is empty
 * and, when there is one, what to do next (a create button, "Xóa bộ lọc").
 */
export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
  className,
}: {
  title: string;
  /** The reason: "Chưa có phòng ban nào", or "Không có kết quả khớp bộ lọc". */
  description?: string;
  /** The next step, usually a Button. */
  action?: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 px-6 py-12 text-center',
        className,
      )}
    >
      <Icon className="size-8 text-hf-text-muted" aria-hidden="true" />
      <p className="text-sm font-semibold text-hf-text-heading">{title}</p>
      {description && (
        <p className="max-w-md text-sm text-hf-text-muted">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
