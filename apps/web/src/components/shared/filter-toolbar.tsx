'use client';

import * as React from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { MAX_SEARCH } from '@/lib/list-params';

const SEARCH_DELAY_MS = 300;

/**
 * The text box. It keeps what the person typed in its own state and reports it once they
 * pause, so the URL (and the request) does not change on every key. It is mounted again
 * when the filters are reset, which starts it from an empty box.
 */
function SearchBox({
  initial,
  label,
  placeholder,
  onSearchChange,
}: {
  initial: string;
  label: string;
  placeholder?: string;
  onSearchChange: (value: string) => void;
}) {
  const [draft, setDraft] = React.useState(initial);
  const debounced = useDebouncedValue(draft, SEARCH_DELAY_MS);

  // Reports a settled change. This is an event going out, not state copied from props:
  // `reported` remembers the last value sent so the first render and a URL that already
  // holds the term send nothing.
  const reported = React.useRef(initial);
  React.useEffect(() => {
    // A new callback identity alone re-runs this effect but sends nothing: the value
    // matches what was last reported.
    if (debounced === reported.current) return;
    reported.current = debounced;
    onSearchChange(debounced);
  }, [debounced, onSearchChange]);

  return (
    <div className="relative w-full sm:w-72">
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-hf-text-muted"
        aria-hidden="true"
      />
      <Input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        maxLength={MAX_SEARCH}
        value={draft}
        className="pl-9"
        onChange={(event) => setDraft(event.target.value)}
      />
    </div>
  );
}

export interface FilterToolbarProps {
  /** The term now in the URL. Only read when the toolbar first shows. */
  search: string;
  onSearchChange: (value: string) => void;
  /** Names the box for screen readers, and fills it as a hint. */
  searchLabel?: string;
  searchPlaceholder?: string;
  /** Light filters (a status select, a department select) that sit on the same line. */
  children?: React.ReactNode;
  /** Complex filters (date ranges, many fields) open in a dialog instead of the line. */
  advanced?: { title: string; description?: string; children: React.ReactNode };
  /** True when the search or any filter is set; the clear button shows only then. */
  hasActiveFilters: boolean;
  onReset: () => void;
}

/**
 * The line above a list: search, light filters, an optional advanced-filter dialog and
 * "Xóa bộ lọc" while anything is filtered.
 */
export function FilterToolbar({
  search,
  onSearchChange,
  searchLabel = 'Tìm kiếm',
  searchPlaceholder = 'Tìm kiếm...',
  children,
  advanced,
  hasActiveFilters,
  onReset,
}: FilterToolbarProps) {
  // Bumped by every reset: it remounts the search box so its text is cleared too.
  const [resets, setResets] = React.useState(0);

  return (
    <div role="search" className="flex flex-wrap items-center gap-3">
      <SearchBox
        key={resets}
        initial={resets === 0 ? search : ''}
        label={searchLabel}
        placeholder={searchPlaceholder}
        onSearchChange={onSearchChange}
      />
      {children}
      {advanced && (
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <SlidersHorizontal aria-hidden="true" />
              {advanced.title}
            </Button>
          </DialogTrigger>
          <DialogContent size="md">
            <DialogHeader>
              <DialogTitle>{advanced.title}</DialogTitle>
              <DialogDescription
                className={advanced.description ? undefined : 'sr-only'}
              >
                {advanced.description ?? advanced.title}
              </DialogDescription>
            </DialogHeader>
            {advanced.children}
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="primary">Xong</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          onClick={() => {
            setResets((count) => count + 1);
            onReset();
          }}
        >
          Xóa bộ lọc
        </Button>
      )}
    </div>
  );
}
