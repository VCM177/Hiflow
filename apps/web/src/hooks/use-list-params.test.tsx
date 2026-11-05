import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { listBaseShape } from '@/lib/list-params';

import { useListParams } from './use-list-params';

const replace = vi.fn();
let currentQuery = '';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/candidates',
  useSearchParams: () => new URLSearchParams(currentQuery),
}));

const SHAPE = {
  ...listBaseShape,
  status: z.enum(['new', 'interview']).optional().catch(undefined),
};

describe('useListParams', () => {
  beforeEach(() => {
    replace.mockReset();
    currentQuery = '';
  });

  it('reads the URL and drops an invalid filter', () => {
    currentQuery = 'status=hacked&page=3';
    const { result } = renderHook(() => useListParams(SHAPE));
    expect(result.current.params.page).toBe(3);
    expect(result.current.params.status).toBeUndefined();
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('reports an active filter when one is set', () => {
    currentQuery = 'status=interview';
    const { result } = renderHook(() => useListParams(SHAPE));
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('writes a change to the URL and goes back to page 1', () => {
    currentQuery = 'page=4';
    const { result } = renderHook(() => useListParams(SHAPE));
    act(() => {
      result.current.setParams({ status: 'new' });
    });
    expect(replace).toHaveBeenCalledWith('/candidates?status=new', {
      scroll: false,
    });
  });

  it('keeps the page when asked to, for a plain page change', () => {
    currentQuery = 'status=new';
    const { result } = renderHook(() => useListParams(SHAPE));
    act(() => {
      result.current.setParams({ page: 5 }, { keepPage: true });
    });
    expect(replace).toHaveBeenCalledWith('/candidates?page=5&status=new', {
      scroll: false,
    });
  });

  it('clears filters and the search but keeps the sort', () => {
    currentQuery = 'status=new&search=an&sortBy=name&sortDir=desc&page=2';
    const { result } = renderHook(() => useListParams(SHAPE));
    act(() => {
      result.current.resetFilters();
    });
    expect(replace).toHaveBeenCalledWith(
      '/candidates?sortBy=name&sortDir=desc',
      {
        scroll: false,
      },
    );
  });

  it('leaves the URL clean when nothing is left', () => {
    currentQuery = 'status=new';
    const { result } = renderHook(() => useListParams(SHAPE));
    act(() => {
      result.current.resetFilters();
    });
    expect(replace).toHaveBeenCalledWith('/candidates', { scroll: false });
  });
});
