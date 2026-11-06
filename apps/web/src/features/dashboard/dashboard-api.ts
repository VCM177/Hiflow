import type { DashboardOverview, Jsonified } from '@hiflow/shared-types';

import { apiRequest } from '@/lib/api/client';

export type Overview = Jsonified<DashboardOverview>;

export interface OverviewQuery {
  from: string | undefined;
  to: string | undefined;
  departmentId: string | undefined;
}

export const fetchOverview = (
  query: OverviewQuery,
  signal?: AbortSignal,
): Promise<Overview> =>
  apiRequest('GET', '/dashboard/overview', { query: { ...query }, signal });
