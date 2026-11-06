import type { Jsonified, Report, ReportType } from '@hiflow/shared-types';

import { apiRequest } from '@/lib/api/client';
import { downloadFile } from '@/lib/api/download';

export type ReportData = Jsonified<Report>;

export interface ReportQuery {
  from: string | undefined;
  to: string | undefined;
  departmentId: string | undefined;
  positionId: string | undefined;
}

export const fetchReport = (
  type: ReportType,
  query: ReportQuery,
  signal?: AbortSignal,
): Promise<ReportData> =>
  apiRequest('GET', `/reports/${type}`, { query: { ...query }, signal });

/** Downloads the CSV of a report; the API records who took a copy. */
export const exportReport = (
  type: ReportType,
  query: ReportQuery,
): Promise<string> =>
  downloadFile(`/reports/${type}/export`, { ...query }, `${type}.csv`);
