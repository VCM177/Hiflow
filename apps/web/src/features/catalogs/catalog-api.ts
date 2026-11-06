import type {
  CatalogItemView,
  Jsonified,
  Paginated,
} from '@hiflow/shared-types';

import { apiRequest } from '@/lib/api/client';

import type { CatalogDefinition, CatalogSortKey } from './constants';
import type { CatalogFormValues } from './catalog-schema';

/** A catalogue row as the browser receives it (dates are ISO strings). */
export type CatalogItem = Jsonified<CatalogItemView>;

export interface CatalogListQuery {
  page: number;
  limit: number;
  search: string;
  sortBy: CatalogSortKey;
  sortDir: 'asc' | 'desc';
}

export function fetchCatalogList(
  catalog: CatalogDefinition,
  query: CatalogListQuery,
  signal?: AbortSignal,
): Promise<Paginated<CatalogItem>> {
  return apiRequest('GET', catalog.path, { query: { ...query }, signal });
}

export function createCatalogItem(
  catalog: CatalogDefinition,
  input: CatalogFormValues,
): Promise<CatalogItem> {
  return apiRequest('POST', catalog.path, { body: input });
}

export function updateCatalogItem(
  catalog: CatalogDefinition,
  id: string,
  input: CatalogFormValues,
): Promise<CatalogItem> {
  return apiRequest('PATCH', `${catalog.path}/${id}`, { body: input });
}

export function deleteCatalogItem(
  catalog: CatalogDefinition,
  id: string,
): Promise<void> {
  return apiRequest('DELETE', `${catalog.path}/${id}`);
}
