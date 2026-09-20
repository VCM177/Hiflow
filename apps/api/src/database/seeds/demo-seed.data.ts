import {
  ApplicationStatus,
  CandidateSource,
  InterviewResult,
  OfferStatus,
  RequisitionStatus,
} from '@hiflow/shared-types';

/** Marker on every demo requisition, so a reset removes exactly what it made. */
export const DEMO_REASON_PREFIX = '[demo]';
/** Demo candidates all use this address pattern (fictional, `example.com`). */
export const DEMO_EMAIL_PATTERN = 'demo.%@example.com';

export interface DemoJob {
  key: string;
  title: string;
  department: string;
  position: string;
  quantity: number;
  /** Who raised the requisition; must be allowed to create for the department. */
  createdBy: 'manager' | 'admin';
  location: string;
  salary: [number, number];
  publishedDaysAgo: number;
}

export const DEMO_JOBS: DemoJob[] = [
  {
    key: 'sales',
    title: 'Nhân viên kinh doanh khu vực Hà Nội',
    department: 'SALES',
    position: 'SALES_EXEC',
    quantity: 3,
    createdBy: 'manager',
    location: 'Hà Nội',
    salary: [10_000_000, 18_000_000],
    publishedDaysAgo: 25,
  },
  {
    key: 'eng',
    title: 'Lập trình viên Backend',
    department: 'ENG',
    position: 'DEV',
    quantity: 2,
    createdBy: 'admin',
    location: 'Hồ Chí Minh',
    salary: [20_000_000, 35_000_000],
    publishedDaysAgo: 24,
  },
  {
    key: 'hr',
    title: 'Chuyên viên nhân sự',
    department: 'HR',
    position: 'HR_SPEC',
    quantity: 1,
    createdBy: 'admin',
    location: 'Đà Nẵng',
    salary: [12_000_000, 20_000_000],
    publishedDaysAgo: 20,
  },
];

/** Two requisitions that are not yet jobs: one waiting, one turned down. */
export const DEMO_OTHER_REQUISITIONS = [
  {
    title: 'Chuyên viên marketing nội dung',
    department: 'SALES',
    position: 'MKT_SPEC',
    quantity: 1,
    status: RequisitionStatus.PENDING_APPROVAL,
    rejectReason: null,
    createdDaysAgo: 2,
  },
  {
    title: 'Nhân viên chăm sóc khách hàng',
    department: 'SALES',
    position: 'CS_AGENT',
    quantity: 2,
    status: RequisitionStatus.REJECTED,
    rejectReason: 'Ngân sách quý này chưa được duyệt',
    createdDaysAgo: 6,
  },
];

export interface DemoCandidate {
  slug: string;
  fullName: string;
  source: CandidateSource;
  job: DemoJob['key'];
  status: ApplicationStatus;
  appliedDaysAgo: number;
  assigned: boolean;
  /** A completed interview round, or one still to come (days from now). */
  interview?: { result: InterviewResult; inDays?: number };
  offer?: {
    status: OfferStatus;
    salary: number;
    startInDays: number;
    expiresInDays?: number;
  };
}

const { NEW, SCREENING, INTERVIEW, OFFER, HIRED, REJECTED } = ApplicationStatus;
const { WEBSITE, REFERRAL, SOCIAL, AGENCY, OTHER } = CandidateSource;

/**
 * 15 applications spread over the funnel: 4 new, 4 screening, 3 interview,
 * 2 offer, 1 hired, 1 rejected. Everything at OFFER or beyond has a passed
 * interview, exactly as the workflow rules require.
 */
export const DEMO_CANDIDATES: DemoCandidate[] = [
  {
    slug: 'an',
    fullName: 'Nguyễn Văn An',
    source: WEBSITE,
    job: 'sales',
    status: NEW,
    appliedDaysAgo: 2,
    assigned: true,
  },
  {
    slug: 'binh',
    fullName: 'Trần Thị Bình',
    source: SOCIAL,
    job: 'sales',
    status: NEW,
    appliedDaysAgo: 1,
    assigned: false,
  },
  {
    slug: 'cuong',
    fullName: 'Lê Hoàng Cường',
    source: REFERRAL,
    job: 'sales',
    status: SCREENING,
    appliedDaysAgo: 9,
    assigned: true,
  },
  {
    slug: 'dung',
    fullName: 'Phạm Thu Dung',
    source: WEBSITE,
    job: 'sales',
    status: INTERVIEW,
    appliedDaysAgo: 12,
    assigned: true,
    interview: { result: InterviewResult.PENDING, inDays: 2 },
  },
  {
    slug: 'duc',
    fullName: 'Hoàng Minh Đức',
    source: AGENCY,
    job: 'sales',
    status: OFFER,
    appliedDaysAgo: 20,
    assigned: true,
    interview: { result: InterviewResult.PASSED },
    offer: {
      status: OfferStatus.PENDING,
      salary: 18_000_000,
      startInDays: 25,
      expiresInDays: 5,
    },
  },
  {
    slug: 'ha',
    fullName: 'Vũ Thị Hà',
    source: SOCIAL,
    job: 'sales',
    status: REJECTED,
    appliedDaysAgo: 18,
    assigned: true,
    interview: { result: InterviewResult.FAILED },
  },
  {
    slug: 'huy',
    fullName: 'Đặng Quốc Huy',
    source: WEBSITE,
    job: 'eng',
    status: NEW,
    appliedDaysAgo: 3,
    assigned: true,
  },
  {
    slug: 'huong',
    fullName: 'Bùi Thanh Hương',
    source: REFERRAL,
    job: 'eng',
    status: SCREENING,
    appliedDaysAgo: 8,
    assigned: true,
  },
  {
    slug: 'khoa',
    fullName: 'Đỗ Anh Khoa',
    source: WEBSITE,
    job: 'eng',
    status: SCREENING,
    appliedDaysAgo: 6,
    assigned: true,
  },
  {
    slug: 'lan',
    fullName: 'Ngô Thị Lan',
    source: REFERRAL,
    job: 'eng',
    status: INTERVIEW,
    appliedDaysAgo: 11,
    assigned: true,
    interview: { result: InterviewResult.PENDING, inDays: 4 },
  },
  {
    slug: 'long',
    fullName: 'Dương Văn Long',
    source: AGENCY,
    job: 'eng',
    status: OFFER,
    appliedDaysAgo: 22,
    assigned: true,
    interview: { result: InterviewResult.PASSED },
    offer: {
      status: OfferStatus.PENDING,
      salary: 25_000_000,
      startInDays: 20,
      expiresInDays: 2,
    },
  },
  {
    slug: 'mai',
    fullName: 'Lý Thị Mai',
    source: WEBSITE,
    job: 'eng',
    status: HIRED,
    appliedDaysAgo: 28,
    assigned: true,
    interview: { result: InterviewResult.PASSED },
    offer: {
      status: OfferStatus.ACCEPTED,
      salary: 22_000_000,
      startInDays: 10,
    },
  },
  {
    slug: 'nam',
    fullName: 'Phan Đình Nam',
    source: OTHER,
    job: 'hr',
    status: NEW,
    appliedDaysAgo: 0,
    assigned: false,
  },
  {
    slug: 'oanh',
    fullName: 'Trịnh Thu Oanh',
    source: SOCIAL,
    job: 'hr',
    status: SCREENING,
    appliedDaysAgo: 7,
    assigned: true,
  },
  {
    slug: 'phuc',
    fullName: 'Đinh Công Phúc',
    source: WEBSITE,
    job: 'hr',
    status: INTERVIEW,
    appliedDaysAgo: 10,
    assigned: true,
  },
];

/** The status path each final state passes through. */
export const DEMO_PATHS: Record<ApplicationStatus, ApplicationStatus[]> = {
  [NEW]: [NEW],
  [SCREENING]: [NEW, SCREENING],
  [INTERVIEW]: [NEW, SCREENING, INTERVIEW],
  [OFFER]: [NEW, SCREENING, INTERVIEW, OFFER],
  [HIRED]: [NEW, SCREENING, INTERVIEW, OFFER, HIRED],
  [REJECTED]: [NEW, SCREENING, INTERVIEW, REJECTED],
  [ApplicationStatus.WITHDRAWN]: [NEW, ApplicationStatus.WITHDRAWN],
};
