import * as React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PERMISSIONS } from '@hiflow/shared-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchCatalogList } from './catalog-api';
import { useDepartmentOptions, usePositionOptions } from './options';

let granted: string[] = [];
vi.mock('@/providers/session-provider', () => ({
  useSession: () => ({ can: (p: string) => granted.includes(p) }),
}));
vi.mock('./catalog-api', () => ({ fetchCatalogList: vi.fn() }));

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('catalog options', () => {
  beforeEach(() => {
    vi.mocked(fetchCatalogList).mockReset();
  });

  it('turns the catalogue into select options', async () => {
    granted = [PERMISSIONS.department.listView];
    vi.mocked(fetchCatalogList).mockResolvedValue({
      items: [
        {
          id: 'd1',
          name: 'Kinh doanh',
          code: 'KD',
          createdAt: '',
          updatedAt: '',
        },
      ],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
    } as never);
    const { result } = renderHook(() => useDepartmentOptions(), { wrapper });
    await waitFor(() =>
      expect(result.current.options).toEqual([
        { value: 'd1', label: 'Kinh doanh' },
      ]),
    );
    expect(fetchCatalogList).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'department' }),
      expect.objectContaining({ limit: 100 }),
      expect.anything(),
    );
  });

  it('does not call the API for a role that may not read the catalogue', () => {
    granted = [];
    const { result } = renderHook(() => usePositionOptions(), { wrapper });
    expect(result.current.options).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(fetchCatalogList).not.toHaveBeenCalled();
  });
});
