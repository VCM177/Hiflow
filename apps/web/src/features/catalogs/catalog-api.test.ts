import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiRequest } from '@/lib/api/client';

import {
  createCatalogItem,
  deleteCatalogItem,
  fetchCatalogList,
  updateCatalogItem,
} from './catalog-api';
import { CATALOGS } from './constants';

vi.mock('@/lib/api/client', () => ({ apiRequest: vi.fn() }));

const request = vi.mocked(apiRequest);

beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue(undefined);
});

describe('catalog API calls', () => {
  it('lists with the page, search and sort as the query', async () => {
    const signal = new AbortController().signal;
    const query = {
      page: 2,
      limit: 20,
      search: 'kỹ',
      sortBy: 'code' as const,
      sortDir: 'desc' as const,
    };

    await fetchCatalogList(CATALOGS.department, query, signal);

    expect(request).toHaveBeenCalledWith('GET', '/departments', {
      query,
      signal,
    });
  });

  it('creates on the list route with the form values', async () => {
    await createCatalogItem(CATALOGS.position, {
      name: 'Lập trình viên',
      code: 'DEV',
    });

    expect(request).toHaveBeenCalledWith('POST', '/positions', {
      body: { name: 'Lập trình viên', code: 'DEV' },
    });
  });

  it('updates the item by id', async () => {
    await updateCatalogItem(CATALOGS.department, 'd-1', {
      name: 'Nhân sự',
      code: 'HR',
    });

    expect(request).toHaveBeenCalledWith('PATCH', '/departments/d-1', {
      body: { name: 'Nhân sự', code: 'HR' },
    });
  });

  it('deletes the item by id', async () => {
    await deleteCatalogItem(CATALOGS.position, 'p-9');

    expect(request).toHaveBeenCalledWith('DELETE', '/positions/p-9');
  });
});
