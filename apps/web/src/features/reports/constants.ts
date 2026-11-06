import { ReportType } from '@hiflow/shared-types';

export const REPORT_TYPES = [
  ReportType.REQUISITION_PROGRESS,
  ReportType.JOB_RESULTS,
  ReportType.CANDIDATE_SOURCES,
] as const;

export const REPORT_TAB_LABEL: Record<ReportType, string> = {
  [ReportType.REQUISITION_PROGRESS]: 'Tiến độ yêu cầu',
  [ReportType.JOB_RESULTS]: 'Kết quả theo tin',
  [ReportType.CANDIDATE_SOURCES]: 'Nguồn ứng viên',
};

export function isReportType(value: string): value is ReportType {
  return (REPORT_TYPES as readonly string[]).includes(value);
}
