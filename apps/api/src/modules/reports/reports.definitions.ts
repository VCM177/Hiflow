import { CandidateSource } from '@hiflow/shared-types';
import { CsvColumn } from '../../common/csv';
import { ReportType } from './reports.dto';

export type RequisitionProgressRow = {
  code: string;
  title: string;
  department: string;
  position: string;
  quantity: number;
  hired: number;
  fillRate: number;
  openJobs: number;
  status: string;
  statusLabel: string;
  createdAt: string;
};

export type JobResultRow = {
  title: string;
  department: string;
  position: string;
  status: string;
  statusLabel: string;
  quantity: number;
  applications: number;
  screened: number;
  interviewed: number;
  offered: number;
  hired: number;
  rejected: number;
  hireRate: number;
};

export type CandidateSourceRow = {
  source: string;
  sourceLabel: string;
  candidates: number;
  applications: number;
  hired: number;
  hireRate: number;
};

export const REPORT_TITLES: Readonly<Record<ReportType, string>> = {
  [ReportType.REQUISITION_PROGRESS]: 'Báo cáo tiến độ yêu cầu tuyển dụng',
  [ReportType.JOB_RESULTS]: 'Báo cáo kết quả tuyển dụng theo tin',
  [ReportType.CANDIDATE_SOURCES]: 'Báo cáo hiệu quả nguồn ứng viên',
};

export const REPORT_COLUMNS = {
  [ReportType.REQUISITION_PROGRESS]: [
    { key: 'code', label: 'Mã yêu cầu' },
    { key: 'title', label: 'Tiêu đề' },
    { key: 'department', label: 'Phòng ban' },
    { key: 'position', label: 'Vị trí' },
    { key: 'quantity', label: 'Số lượng cần tuyển' },
    { key: 'hired', label: 'Đã nhận việc' },
    { key: 'fillRate', label: 'Tỷ lệ lấp đầy (%)' },
    { key: 'openJobs', label: 'Tin đang mở' },
    { key: 'statusLabel', label: 'Trạng thái' },
    { key: 'createdAt', label: 'Ngày tạo' },
  ] satisfies CsvColumn<RequisitionProgressRow>[],
  [ReportType.JOB_RESULTS]: [
    { key: 'title', label: 'Tin tuyển dụng' },
    { key: 'department', label: 'Phòng ban' },
    { key: 'position', label: 'Vị trí' },
    { key: 'statusLabel', label: 'Trạng thái' },
    { key: 'quantity', label: 'Số lượng cần tuyển' },
    { key: 'applications', label: 'Hồ sơ nộp' },
    { key: 'screened', label: 'Qua sàng lọc' },
    { key: 'interviewed', label: 'Vào phỏng vấn' },
    { key: 'offered', label: 'Nhận đề nghị' },
    { key: 'hired', label: 'Nhận việc' },
    { key: 'rejected', label: 'Bị từ chối' },
    { key: 'hireRate', label: 'Tỷ lệ nhận việc (%)' },
  ] satisfies CsvColumn<JobResultRow>[],
  [ReportType.CANDIDATE_SOURCES]: [
    { key: 'sourceLabel', label: 'Nguồn ứng viên' },
    { key: 'candidates', label: 'Số ứng viên' },
    { key: 'applications', label: 'Số hồ sơ' },
    { key: 'hired', label: 'Nhận việc' },
    { key: 'hireRate', label: 'Tỷ lệ nhận việc (%)' },
  ] satisfies CsvColumn<CandidateSourceRow>[],
};

export const SOURCE_LABEL: Readonly<Record<CandidateSource, string>> = {
  [CandidateSource.WEBSITE]: 'Website',
  [CandidateSource.REFERRAL]: 'Giới thiệu',
  [CandidateSource.SOCIAL]: 'Mạng xã hội',
  [CandidateSource.AGENCY]: 'Đơn vị tuyển dụng',
  [CandidateSource.OTHER]: 'Khác',
};

/** A percentage rounded to one decimal, 0 when there is nothing to divide by. */
export const percent = (part: number, whole: number): number =>
  whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10;
