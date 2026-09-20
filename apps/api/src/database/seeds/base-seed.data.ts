import { UserRole } from '@hiflow/shared-types';

export const DEPARTMENTS = [
  { code: 'SALES', name: 'Kinh doanh' },
  { code: 'ENG', name: 'Kỹ thuật' },
  { code: 'HR', name: 'Nhân sự' },
];

export const POSITIONS = [
  { code: 'SALES_EXEC', name: 'Nhân viên kinh doanh' },
  { code: 'MKT_SPEC', name: 'Chuyên viên marketing' },
  { code: 'DEV', name: 'Lập trình viên' },
  { code: 'QA', name: 'Kiểm thử phần mềm' },
  { code: 'HR_SPEC', name: 'Chuyên viên nhân sự' },
  { code: 'ACCOUNTANT', name: 'Kế toán' },
  { code: 'DESIGNER', name: 'Thiết kế đồ họa' },
  { code: 'CS_AGENT', name: 'Chăm sóc khách hàng' },
];

/** One demo account per role. Names are fictional. */
export const USERS: {
  email: string;
  fullName: string;
  role: UserRole;
  departmentCode: string | null;
}[] = [
  {
    email: 'admin@hiflow.local',
    fullName: 'Trần Quốc Bảo',
    role: UserRole.ADMIN,
    departmentCode: null,
  },
  {
    email: 'hr@hiflow.local',
    fullName: 'Lê Thu Hà',
    role: UserRole.HR_MANAGER,
    departmentCode: 'HR',
  },
  {
    email: 'manager@hiflow.local',
    fullName: 'Phạm Minh Tuấn',
    role: UserRole.DEPT_MANAGER,
    departmentCode: 'SALES',
  },
  {
    email: 'recruiter@hiflow.local',
    fullName: 'Nguyễn Ngọc Lan',
    role: UserRole.RECRUITER,
    departmentCode: 'HR',
  },
  {
    email: 'interviewer@hiflow.local',
    fullName: 'Hoàng Đức Anh',
    role: UserRole.INTERVIEWER,
    departmentCode: 'ENG',
  },
];
