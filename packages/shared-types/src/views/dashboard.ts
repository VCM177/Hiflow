import type { ApplicationStatus } from '../statuses';

export interface DashboardOverview {
  period: { from: string; to: string };
  cards: {
    pendingRequisitions: number;
    openJobs: number;
    newApplications: number;
    upcomingInterviews: number;
    hiredInPeriod: number;
  };
  funnel: { stage: ApplicationStatus; label: string; count: number }[];
  outcomes: { rejected: number; withdrawn: number };
  todo: { type: string; label: string; count: number; href: string }[];
}
