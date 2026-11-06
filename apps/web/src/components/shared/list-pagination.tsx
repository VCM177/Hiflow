import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PageMeta } from '@hiflow/shared-types';

import { Button } from '@/components/ui/button';

type PageItem = number | 'gap';

/**
 * The page numbers to show: the first, the last and the current page with its neighbours.
 * A hole of one page is filled with that page (a gap of one number would be longer than
 * the number); bigger holes become one gap.
 */
export function pageItems(page: number, totalPages: number): PageItem[] {
  const wanted = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  const pages = [...wanted]
    .filter((n) => n >= 1 && n <= totalPages)
    .sort((a, b) => a - b);

  const items: PageItem[] = [];
  pages.forEach((n, index) => {
    const previous = pages[index - 1];
    if (previous !== undefined) {
      if (n - previous === 2) items.push(previous + 1);
      else if (n - previous > 2) items.push('gap');
    }
    items.push(n);
  });
  return items;
}

const NUMBER = new Intl.NumberFormat('vi-VN');

/**
 * Page buttons and the "showing X–Y of Z" line, driven by the API's `meta`. The caller
 * writes the new page to the URL (`useListParams`), so a page can be shared and reloaded.
 * Renders nothing for an empty list: the empty state speaks there.
 */
export function ListPagination({
  meta,
  onPageChange,
}: {
  meta: PageMeta;
  onPageChange: (page: number) => void;
}) {
  const { page, limit, total, totalPages } = meta;
  if (total === 0) return null;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <nav
      aria-label="Phân trang"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-sm text-hf-text-muted tabular-nums">
        Hiển thị {NUMBER.format(from)}–{NUMBER.format(to)} trong{' '}
        {NUMBER.format(total)} kết quả
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Trang trước"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        {pageItems(page, totalPages).map((item, index) =>
          item === 'gap' ? (
            <span
              key={`gap-${index}`}
              aria-hidden="true"
              className="px-1 text-hf-text-muted"
            >
              …
            </span>
          ) : (
            <Button
              key={item}
              variant={item === page ? 'primary' : 'ghost'}
              size="icon-sm"
              aria-label={`Trang ${item}`}
              aria-current={item === page ? 'page' : undefined}
              className="tabular-nums"
              onClick={() => item !== page && onPageChange(item)}
            >
              {item}
            </Button>
          ),
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Trang sau"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
