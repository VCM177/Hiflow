import type { ApplicationStatus, CandidateSource } from '../statuses';

export interface CandidateView {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  dob: string | null;
  source: CandidateSource;
  /** The file itself is only reachable through `GET /candidates/:id/cv`. */
  hasCv: boolean;
  note: string | null;
  /** Set once the personal data was erased (see `POST /candidates/:id/anonymize`). */
  anonymizedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CandidateApplicationSummary {
  id: string;
  jobId: string;
  jobTitle: string;
  status: ApplicationStatus;
  appliedAt: Date;
}

export interface CandidateDetailView extends CandidateView {
  applications: CandidateApplicationSummary[];
}
