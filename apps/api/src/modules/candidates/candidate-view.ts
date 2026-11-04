import type { CandidateView } from '@hiflow/shared-types';
import { Candidate } from './entities/candidate.entity';

export const toCandidateView = (c: Candidate): CandidateView => ({
  id: c.id,
  fullName: c.fullName,
  email: c.email,
  phone: c.phone,
  dob: c.dob,
  source: c.source,
  hasCv: c.cvFileKey !== null,
  note: c.note,
  anonymizedAt: c.anonymizedAt,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});
