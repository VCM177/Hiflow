'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { z } from 'zod';

import { parseListParams, serializeListParams } from '@/lib/list-params';

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
  const setParams = useCallback(
    (patch: Record<string, unknown>, options: { keepPage?: boolean } = {}) => {
      const next: Record<string, unknown> = { ...params, ...patch };
      if (!options.keepPage && !('page' in patch)) next.page = 1;
      const search = serializeListParams(next, defaults);
      const query = search.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [params, defaults, pathname, router],
  );

  /** Clears every filter and the search term, keeping the sort. */
  const resetFilters = useCallback(() => {
    const cleared: Record<string, unknown> = { page: 1 };
    for (const key of Object.keys(shape)) {
      if (!NON_FILTER_KEYS.has(key)) cleared[key] = defaults[key];
    }
    const search = serializeListParams(
      { ...params, ...cleared },
      defaults,
    ).toString();
    router.replace(search ? `${pathname}?${search}` : pathname, {
      scroll: false,
    });
  }, [shape, defaults, params, pathname, router]);

  return { params, setParams, resetFilters, hasActiveFilters } as const;
}
