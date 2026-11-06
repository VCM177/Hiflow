import { useQuery } from '@tanstack/react-query';
import { PERMISSIONS, type Permission } from '@hiflow/shared-types';

import type { SelectOption } from '@/components/shared/form/rhf-select-field';
import { queryKeys } from '@/lib/query/keys';
import { useSession } from '@/providers/session-provider';

import { fetchCatalogList } from './catalog-api';
import { CATALOGS, type CatalogKind } from './constants';

// The API's page size limit: more than this many departments or positions is not a case
// the select boxes are built for.
const OPTIONS_LIMIT = 100;
const FIVE_MINUTES = 5 * 60 * 1000;

const LIST_PERMISSION: Record<CatalogKind, Permission> = {
  department: PERMISSIONS.department.listView,
  position: PERMISSIONS.position.listView,
};

/**
 * The names a select box offers, shared by every form that picks a department or a
 * position. Roles that may not read the catalogue (the interviewer) never call the API:
 * the query stays off and `options` is empty.
 */
function useCatalogOptions(kind: CatalogKind) {
  const { can } = useSession();
  const catalog = CATALOGS[kind];
  const query = useQuery({
    queryKey: queryKeys.options(kind, { limit: OPTIONS_LIMIT }),
    queryFn: ({ signal }) =>
      fetchCatalogList(
        catalog,
        {
          page: 1,
          limit: OPTIONS_LIMIT,
          search: '',
          sortBy: 'name',
          sortDir: 'asc',
        },
        signal,
      ),
    enabled: can(LIST_PERMISSION[kind]),
    staleTime: FIVE_MINUTES,
  });
  const options: SelectOption[] = (query.data?.items ?? []).map((item) => ({
    value: item.id,
    label: item.name,
  }));
  return {
    options,
    isLoading: query.isPending && query.fetchStatus !== 'idle',
  };
}

export const useDepartmentOptions = () => useCatalogOptions('department');
export const usePositionOptions = () => useCatalogOptions('position');
