import { formatDateTime } from '@/lib/format';

export interface TimelineItem {
  /** The entity's id (a history row), used as the key. */
  id: string;
  title: string;
  /** ISO string or Date, shown as dd/MM/yyyy HH:mm in Vietnam time. */
  at: string | Date;
  /** Who did it. Left out when unknown. */
  actor?: string | null;
  /** A free-text note, shown as written. */
  note?: string | null;
}

/**
 * A history, newest first as the caller orders it: a status history, an audit trail of one
 * record. Each entry says what happened, when and by whom; colour is never the only signal.
 */
export function VerticalTimeline({
  items,
  emptyLabel = 'Chưa có lịch sử.',
  label,
}: {
  items: readonly TimelineItem[];
  emptyLabel?: string;
  /** Names the list for screen readers, e.g. "Lịch sử trạng thái". */
  label?: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-hf-text-muted">{emptyLabel}</p>;
  }
  return (
    <ol aria-label={label} className="relative flex flex-col gap-5">
      {items.map((item, index) => (
        <li key={item.id} className="relative flex gap-3">
          <div className="flex flex-col items-center" aria-hidden="true">
            <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-hf-primary" />
            {index < items.length - 1 && (
              <span className="mt-1 w-px flex-1 bg-hf-border" />
            )}
          </div>
          <div className="min-w-0 pb-1">
            <p className="text-sm font-medium text-hf-text-heading">
              {item.title}
            </p>
            <p className="text-xs text-hf-text-muted">
              <time dateTime={new Date(item.at).toISOString()}>
                {formatDateTime(item.at)}
              </time>
              {item.actor ? ` · ${item.actor}` : ''}
            </p>
            {item.note && (
              <p className="mt-1 text-sm break-words whitespace-pre-line text-hf-text-body">
                {item.note}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
