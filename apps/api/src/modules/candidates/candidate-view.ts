import { ApplicationStatus, CandidateSource } from '@hiflow/shared-types';
import { Candidate } from './entities/candidate.entity';

export interface CandidateView {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  dob: string | null;
  source: CandidateSource;
  cvFileUrl: string | null;
  note: string | null;
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

export const toCandidateView = (c: Candidate): CandidateView => ({
  id: c.id,
  fullName: c.fullName,
  email: c.email,
  phone: c.phone,
  dob: c.dob,
  source: c.source,
  cvFileUrl: c.cvFileUrl,
  note: c.note,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});
