import type {
  InterviewResult,
  OfferStatus,
  ApplicationStatus,
} from './statuses';
import type { UserRole } from './roles';

/**
 * Every business action the audit trail records, with the kind of thing it
 * happened to and the label the web app shows. The data each event may carry is
 * declared in `AuditEventDataMap` below, so the service cannot store a field the
 * catalogue does not list.
 */
export const AUDIT_EVENTS = {
  // Session
  AUTH_LOGIN_SUCCEEDED: { entityType: 'User', label: 'Đăng nhập' },
  AUTH_LOGIN_FAILED: { entityType: 'User', label: 'Đăng nhập thất bại' },
  AUTH_LOGGED_OUT: { entityType: 'User', label: 'Đăng xuất' },

  // Own profile
  PROFILE_UPDATED: { entityType: 'User', label: 'Cập nhật hồ sơ cá nhân' },
  PASSWORD_CHANGED: { entityType: 'User', label: 'Đổi mật khẩu' },

  // Users
  USER_CREATED: { entityType: 'User', label: 'Tạo người dùng' },
  USER_UPDATED: { entityType: 'User', label: 'Cập nhật người dùng' },
  USER_ROLE_CHANGED: { entityType: 'User', label: 'Đổi vai trò người dùng' },
  USER_STATUS_CHANGED: {
    entityType: 'User',
    label: 'Khóa hoặc mở khóa người dùng',
  },
  USER_PASSWORD_RESET: {
    entityType: 'User',
    label: 'Đặt lại mật khẩu người dùng',
  },

  // Catalogues
  DEPARTMENT_CREATED: { entityType: 'Department', label: 'Tạo phòng ban' },
  DEPARTMENT_UPDATED: { entityType: 'Department', label: 'Sửa phòng ban' },
  DEPARTMENT_DELETED: { entityType: 'Department', label: 'Xóa phòng ban' },
  POSITION_CREATED: { entityType: 'JobPosition', label: 'Tạo vị trí' },
  POSITION_UPDATED: { entityType: 'JobPosition', label: 'Sửa vị trí' },
  POSITION_DELETED: { entityType: 'JobPosition', label: 'Xóa vị trí' },

  // Requisitions
  REQUISITION_CREATED: {
    entityType: 'Requisition',
    label: 'Tạo yêu cầu tuyển dụng',
  },
  REQUISITION_UPDATED: {
    entityType: 'Requisition',
    label: 'Sửa yêu cầu tuyển dụng',
  },
  REQUISITION_DELETED: {
    entityType: 'Requisition',
    label: 'Xóa yêu cầu tuyển dụng',
  },
  REQUISITION_SUBMITTED: {
    entityType: 'Requisition',
    label: 'Gửi duyệt yêu cầu tuyển dụng',
  },
  REQUISITION_APPROVED: {
    entityType: 'Requisition',
    label: 'Duyệt yêu cầu tuyển dụng',
  },
  REQUISITION_REJECTED: {
    entityType: 'Requisition',
    label: 'Từ chối yêu cầu tuyển dụng',
  },
  REQUISITION_CLOSED: {
    entityType: 'Requisition',
    label: 'Đóng yêu cầu tuyển dụng',
  },

  // Jobs
  JOB_CREATED: { entityType: 'Job', label: 'Tạo tin tuyển dụng' },
  JOB_UPDATED: { entityType: 'Job', label: 'Sửa tin tuyển dụng' },
  JOB_DELETED: { entityType: 'Job', label: 'Xóa tin tuyển dụng' },
  JOB_PUBLISHED: { entityType: 'Job', label: 'Đăng tin tuyển dụng' },
  JOB_STOPPED: { entityType: 'Job', label: 'Ngừng tin tuyển dụng' },

  // Candidates
  CANDIDATE_CREATED: { entityType: 'Candidate', label: 'Tạo ứng viên' },
  CANDIDATE_UPDATED: { entityType: 'Candidate', label: 'Sửa ứng viên' },
  CANDIDATE_DELETED: { entityType: 'Candidate', label: 'Xóa ứng viên' },
  CANDIDATE_NOTE_UPDATED: {
    entityType: 'Candidate',
    label: 'Cập nhật ghi chú ứng viên',
  },
  CANDIDATE_CV_UPLOADED: {
    entityType: 'Candidate',
    label: 'Tải lên CV ứng viên',
  },
  CANDIDATE_CV_REMOVED: { entityType: 'Candidate', label: 'Xóa CV ứng viên' },
  CANDIDATE_CV_DOWNLOADED: {
    entityType: 'Candidate',
    label: 'Tải xuống CV ứng viên',
  },
  CANDIDATE_ANONYMIZED: { entityType: 'Candidate', label: 'Ẩn danh ứng viên' },

  // Applications
  APPLICATION_CREATED: {
    entityType: 'Application',
    label: 'Tạo hồ sơ ứng tuyển',
  },
  APPLICATION_SUBMITTED_ONLINE: {
    entityType: 'Application',
    label: 'Ứng viên nộp hồ sơ qua website',
  },
  APPLICATION_NOTE_UPDATED: {
    entityType: 'Application',
    label: 'Cập nhật ghi chú hồ sơ',
  },
  APPLICATION_ASSIGNEE_CHANGED: {
    entityType: 'Application',
    label: 'Đổi người phụ trách hồ sơ',
  },
  APPLICATION_STATUS_CHANGED: {
    entityType: 'Application',
    label: 'Chuyển trạng thái hồ sơ',
  },
  APPLICATION_DELETED: {
    entityType: 'Application',
    label: 'Xóa hồ sơ ứng tuyển',
  },
  APPLICATION_CV_DOWNLOADED: {
    entityType: 'Application',
    label: 'Tải xuống CV của hồ sơ',
  },

  // Interviews
  INTERVIEW_SCHEDULED: { entityType: 'Interview', label: 'Xếp lịch phỏng vấn' },
  INTERVIEW_UPDATED: { entityType: 'Interview', label: 'Sửa lịch phỏng vấn' },
  INTERVIEW_CANCELLED: { entityType: 'Interview', label: 'Hủy lịch phỏng vấn' },
  INTERVIEW_RESULT_RECORDED: {
    entityType: 'Interview',
    label: 'Ghi kết quả phỏng vấn',
  },

  // Offers
  OFFER_CREATED: { entityType: 'Offer', label: 'Tạo đề nghị' },
  OFFER_UPDATED: { entityType: 'Offer', label: 'Sửa đề nghị' },
  OFFER_RESPONSE_RECORDED: {
    entityType: 'Offer',
    label: 'Ghi nhận phản hồi đề nghị',
  },

  // Exports
  AUDIT_LOG_EXPORTED: {
    entityType: 'AuditLog',
    label: 'Xuất nhật ký kiểm toán',
  },
  REPORT_EXPORTED: { entityType: 'Report', label: 'Xuất báo cáo' },
} as const;

export type AuditEvent = keyof typeof AUDIT_EVENTS;
export type AuditEntityType = (typeof AUDIT_EVENTS)[AuditEvent]['entityType'];

type None = undefined;
type Changed = { changedFields: string[] };
type ExportData = {
  filters: Record<string, string | number | boolean | null>;
  rows: number;
};

/** What each event may carry in `data`. `undefined` means it carries nothing. */
export interface AuditEventDataMap {
  AUTH_LOGIN_SUCCEEDED: None;
  AUTH_LOGIN_FAILED: { reason: 'INVALID_CREDENTIALS' | 'ACCOUNT_LOCKED' };
  AUTH_LOGGED_OUT: None;
  PROFILE_UPDATED: Changed;
  PASSWORD_CHANGED: None;
  USER_CREATED: None;
  USER_UPDATED: Changed;
  USER_ROLE_CHANGED: { from: UserRole; to: UserRole };
  USER_STATUS_CHANGED: { from: boolean; to: boolean };
  USER_PASSWORD_RESET: None;
  DEPARTMENT_CREATED: None;
  DEPARTMENT_UPDATED: Changed;
  DEPARTMENT_DELETED: None;
  POSITION_CREATED: None;
  POSITION_UPDATED: Changed;
  POSITION_DELETED: None;
  REQUISITION_CREATED: { code: string };
  REQUISITION_UPDATED: { code: string } & Changed;
  REQUISITION_DELETED: { code: string };
  REQUISITION_SUBMITTED: { code: string };
  REQUISITION_APPROVED: { code: string };
  REQUISITION_REJECTED: { code: string; reason: string };
  REQUISITION_CLOSED: { code: string };
  JOB_CREATED: None;
  JOB_UPDATED: Changed;
  JOB_DELETED: None;
  JOB_PUBLISHED: None;
  JOB_STOPPED: None;
  CANDIDATE_CREATED: None;
  CANDIDATE_UPDATED: Changed;
  CANDIDATE_DELETED: None;
  CANDIDATE_NOTE_UPDATED: None;
  CANDIDATE_CV_UPLOADED: None;
  CANDIDATE_CV_REMOVED: None;
  CANDIDATE_CV_DOWNLOADED: None;
  CANDIDATE_ANONYMIZED: { trigger: 'REQUEST' | 'RETENTION' };
  APPLICATION_CREATED: None;
  APPLICATION_SUBMITTED_ONLINE: { jobId: string };
  APPLICATION_NOTE_UPDATED: None;
  APPLICATION_ASSIGNEE_CHANGED: { from: string | null; to: string | null };
  APPLICATION_STATUS_CHANGED: {
    from: ApplicationStatus;
    to: ApplicationStatus;
    note: string | null;
  };
  APPLICATION_DELETED: None;
  APPLICATION_CV_DOWNLOADED: None;
  INTERVIEW_SCHEDULED: None;
  INTERVIEW_UPDATED: Changed;
  INTERVIEW_CANCELLED: { reason: string | null };
  INTERVIEW_RESULT_RECORDED: { result: InterviewResult };
  OFFER_CREATED: None;
  OFFER_UPDATED: Changed;
  OFFER_RESPONSE_RECORDED: { response: OfferStatus };
  AUDIT_LOG_EXPORTED: ExportData;
  REPORT_EXPORTED: ExportData & { report: string };
}

// Compile-time proof that the catalogue and the data map list the same events.
type Missing = Exclude<AuditEvent, keyof AuditEventDataMap>;
type Extra = Exclude<keyof AuditEventDataMap, AuditEvent>;
type AuditCatalogueIsComplete = [Missing, Extra] extends [never, never]
  ? true
  : never;
/** Does not compile when an event has no data type, or a data type no event. */
export const AUDIT_CATALOGUE_COMPLETE: AuditCatalogueIsComplete = true;

export type AuditEventData<E extends AuditEvent> = AuditEventDataMap[E];

/** `data` is required exactly when the event declares some. */
export type AuditDataArgs<E extends AuditEvent> =
  AuditEventDataMap[E] extends undefined ? [] : [data: AuditEventDataMap[E]];

export const AUDIT_EVENT_NAMES = Object.keys(AUDIT_EVENTS) as AuditEvent[];

export const auditEventLabel = (event: string): string =>
  event in AUDIT_EVENTS ? AUDIT_EVENTS[event as AuditEvent].label : event;
