import { ApplicationStatus, UserRole } from '@hiflow/shared-types';

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

/** Roles that can own an application (be its recruiter in charge). */
export const ASSIGNABLE_ROLES: readonly UserRole[] = [
  UserRole.RECRUITER,
  UserRole.HR_MANAGER,
  UserRole.ADMIN,
];

export const RACE_MESSAGE =
  'Hồ sơ vừa được xử lý bởi người khác, vui lòng tải lại';
