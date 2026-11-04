import type {
  ApplicationStatus,
  InterviewResult,
  OfferStatus,
} from '../statuses';
import type { NamedRef } from './ref';

export interface ApplicationListItem {
  id: string;
  candidate: { id: string; fullName: string; email: string } | null;
  job: { id: string; title: string; status: string } | null;
  status: ApplicationStatus;
  appliedAt: Date;
  assignee: NamedRef | null;
}

export interface ApplicationHistoryItem {
  id: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  note: string | null;
  changedBy: NamedRef | null;
  changedAt: Date;
}

export interface ApplicationInterviewItem {
  id: string;
  round: number;
  scheduledAt: Date;
  interviewer: NamedRef | null;
  result: InterviewResult;
  feedback: string | null;
}

export interface ApplicationOfferItem {
  id: string;
  salary: number;
  startDate: string;
  expiresAt: string | null;
  status: OfferStatus;
  note: string | null;
}

export interface ApplicationDetail extends ApplicationListItem {
  note: string | null;
  /**
   * A CV can be downloaded at `GET /applications/:id/cv`: the one sent with
   * this application, or else the one on the candidate profile.
   */
  hasCv: boolean;
  candidateDetail: {
    phone: string | null;
    hasCv: boolean;
  } | null;
  history: ApplicationHistoryItem[];
  interviews: ApplicationInterviewItem[];
  /** Present only for callers allowed to see offers. */
  offer: ApplicationOfferItem | null;
}
