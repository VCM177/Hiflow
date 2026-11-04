export enum ReportType {
  REQUISITION_PROGRESS = 'requisition-progress',
  JOB_RESULTS = 'job-results',
  CANDIDATE_SOURCES = 'candidate-sources',
}

export interface Report {
  type: ReportType;
  title: string;
  period: { from: string; to: string };
  columns: { key: string; label: string }[];
  rows: Record<string, string | number>[];
}
