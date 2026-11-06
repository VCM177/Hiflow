'use client';

import { useCallback, useMemo, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { z } from 'zod';

import {
  parseListParams,
  serializeListParams,
  type ParsedListParams,
} from '@/lib/list-params';

// Keys that are paging or sorting, not filters: they never count toward "active filters".
const NON_FILTER_KEYS = new Set(['page', 'limit', 'sortBy', 'sortDir']);

/**
 * Keeps a list's state (page, search, sort, filters) in the URL, so a list can be shared
 * and survives a reload. `shape` must be a module constant (a stable object), otherwise
 * the parsed values are recomputed on every render.
 */
export function useListParams<TShape extends Record<string, z.ZodType>>(
  shape: TShape,
) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const defaults = useMemo(
    () => parseListParams({}, shape) as Record<string, unknown>,
    [shape],
  );

  const params = useMemo(() => {
    const raw: Record<string, string | string[]> = {};
    for (const key of new Set(searchParams.keys())) {
      const values = searchParams.getAll(key);
      raw[key] = values.length > 1 ? values : (values[0] ?? '');
    }
    return parseListParams(raw, shape) as Record<string, unknown>;
  }, [searchParams, shape]);

  const hasActiveFilters = useMemo(
    () =>
      Object.keys(shape).some(
        (key) =>
          !NON_FILTER_KEYS.has(key) &&
          params[key] !== undefined &&
          params[key] !== '' &&
          params[key] !== defaults[key],
      ),
    [shape, params, defaults],
  );

  /**
   * Writes `patch` into the URL. A change to a filter or the search term resets to page 1
   * unless `keepPage` is set. Values equal to their default are left out of the URL.
   */
  // The URL catches up a moment after `router.replace`. Two changes made inside that moment
  // (two date boxes filled one after the other) must build on each other, not on the same
  // stale `params`, or the second would undo the first. `source` says which `params` the
  // pending value was built on; once the URL changes, `params` is a new object and the
  // pending value is no longer used.
  const pending = useRef<{
    source: Record<string, unknown>;
    value: Record<string, unknown>;
  } | null>(null);
  const current = (): Record<string, unknown> =>
    pending.current?.source === params ? pending.current.value : params;
  const write = useCallback(
    (next: Record<string, unknown>) => {
      pending.current = { source: params, value: next };
      const query = serializeListParams(next, defaults).toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [params, defaults, pathname, router],
  );

  const setParams = useCallback(
    (patch: Record<string, unknown>, options: { keepPage?: boolean } = {}) => {
      const next: Record<string, unknown> = { ...current(), ...patch };
      // Only a list that pages has a page to go back to; the overview and the reports do not.
      if (!options.keepPage && !('page' in patch) && 'page' in shape) {
        next.page = 1;
      }
      write(next);
    },
    // `current` reads refs and `params` only; it changes with `params`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params, shape, write],
  );

  /** Clears every filter and the search term, keeping the sort. */
  const resetFilters = useCallback(() => {
    const cleared: Record<string, unknown> = {};
    if ('page' in shape) cleared.page = 1;
    for (const key of Object.keys(shape)) {
      if (!NON_FILTER_KEYS.has(key)) cleared[key] = defaults[key];
    }
    write({ ...params, ...cleared });
  }, [shape, defaults, params, write]);

  /**
   * The query string of the list as it stands, including a change the URL has not caught up
   * with yet. For links that carry the filters to another page (the report tabs).
   */
  const queryString = useCallback(
    () => serializeListParams(current(), defaults).toString(),
    // `current` reads a ref and `params`; it changes with `params`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params, defaults],
  );

  return {
    // Typed by the schema, so a page reads `params.page` as a number and `params.sortBy` as its union.
    params: params as ParsedListParams<TShape>,
    setParams,
    resetFilters,
    queryString,
    hasActiveFilters,
  } as const;
}
