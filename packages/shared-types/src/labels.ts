import { UserRole } from './roles';
import {
  ApplicationStatus,
  CandidateSource,
  InterviewResult,
  JobStatus,
  OfferStatus,
  RequisitionStatus,
} from './statuses';

/**
 * The Vietnamese name of every status, source and role. The API uses them in
 * its error messages and reports, the web app in its badges and filters: one
 * map each, so the two can never disagree.
 */

export const REQUISITION_STATUS_LABEL: Readonly<
  Record<RequisitionStatus, string>
> = {
  [RequisitionStatus.DRAFT]: 'Nháp',
  [RequisitionStatus.PENDING_APPROVAL]: 'Chờ duyệt',
  [RequisitionStatus.APPROVED]: 'Đã duyệt',
  [RequisitionStatus.REJECTED]: 'Bị từ chối',
  [RequisitionStatus.CLOSED]: 'Đã đóng',
};

export const JOB_STATUS_LABEL: Readonly<Record<JobStatus, string>> = {
  [JobStatus.DRAFT]: 'Nháp',
  [JobStatus.OPEN]: 'Đang tuyển',
  [JobStatus.CLOSED]: 'Đã đóng',
};

export const APPLICATION_STATUS_LABEL: Readonly<
  Record<ApplicationStatus, string>
> = {
  [ApplicationStatus.NEW]: 'Mới',
  [ApplicationStatus.SCREENING]: 'Sàng lọc',
  [ApplicationStatus.INTERVIEW]: 'Phỏng vấn',
  [ApplicationStatus.OFFER]: 'Đề nghị',
  [ApplicationStatus.HIRED]: 'Nhận việc',
  [ApplicationStatus.REJECTED]: 'Từ chối',
  [ApplicationStatus.WITHDRAWN]: 'Ứng viên rút',
};

export const INTERVIEW_RESULT_LABEL: Readonly<Record<InterviewResult, string>> =
  {
    [InterviewResult.PENDING]: 'Chờ kết quả',
    [InterviewResult.PASSED]: 'Đạt',
    [InterviewResult.FAILED]: 'Không đạt',
    [InterviewResult.CANCELLED]: 'Đã hủy',
  };

export const OFFER_STATUS_LABEL: Readonly<Record<OfferStatus, string>> = {
  [OfferStatus.PENDING]: 'Chờ phản hồi',
  [OfferStatus.ACCEPTED]: 'Đã chấp nhận',
  [OfferStatus.DECLINED]: 'Đã từ chối',
};

export const SOURCE_LABEL: Readonly<Record<CandidateSource, string>> = {
  [CandidateSource.WEBSITE]: 'Website',
  [CandidateSource.REFERRAL]: 'Giới thiệu',
  [CandidateSource.SOCIAL]: 'Mạng xã hội',
  [CandidateSource.AGENCY]: 'Đơn vị tuyển dụng',
  [CandidateSource.OTHER]: 'Khác',
};

/** Role names as the business documents and the menu use them. */
export const USER_ROLE_LABEL: Readonly<Record<UserRole, string>> = {
  [UserRole.ADMIN]: 'Admin',
  [UserRole.HR_MANAGER]: 'HR',
  [UserRole.DEPT_MANAGER]: 'Trưởng bộ phận',
  [UserRole.RECRUITER]: 'Tuyển dụng',
  [UserRole.INTERVIEWER]: 'Phỏng vấn viên',
};
