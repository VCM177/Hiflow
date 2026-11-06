import { useQuery } from '@tanstack/react-query';
import {
  PERMISSIONS,
  type Jsonified,
  type Paginated,
  type UserOption,
} from '@hiflow/shared-types';

import type { SelectOption } from '@/components/shared/form/rhf-select-field';
import { apiRequest } from '@/lib/api/client';
import { queryKeys } from '@/lib/query/keys';
import { useSession } from '@/providers/session-provider';

export type UserOptionPurpose = 'ASSIGNEE' | 'INTERVIEWER';

const OPTIONS_LIMIT = 100;
const FIVE_MINUTES = 5 * 60 * 1000;

/**
 * The people a select box offers for a purpose (who can own an application, who can
 * interview). Roles that may not read the list never call the API.
 */
export function useUserOptions(purpose: UserOptionPurpose) {
  const { can } = useSession();
  const query = useQuery({
    queryKey: queryKeys.options('user', { purpose }),
    queryFn: ({ signal }) =>
      apiRequest<Paginated<Jsonified<UserOption>>>('GET', '/users/options', {
        query: { purpose, limit: OPTIONS_LIMIT },
        signal,
      }),
    enabled: can(PERMISSIONS.user.optionsView),
    staleTime: FIVE_MINUTES,
  });
  const options: SelectOption[] = (query.data?.items ?? []).map((user) => ({
    value: user.id,
    label: user.fullName,
  }));
  return {
    options,
    isLoading: query.isPending && query.fetchStatus !== 'idle',
  };
}
