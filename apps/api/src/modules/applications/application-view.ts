import {
  ApplicationStatus,
  InterviewResult,
  OfferStatus,
} from '@hiflow/shared-types';
import { Interview } from '../interviews/entities/interview.entity';
import { Offer } from '../offers/entities/offer.entity';
import { Application } from './entities/application.entity';
import { ApplicationStatusHistory } from './entities/application-status-history.entity';

interface Ref {
  id: string;
  name: string;
}

export interface ApplicationListItem {
  id: string;
  candidate: { id: string; fullName: string; email: string } | null;
  job: { id: string; title: string; status: string } | null;
  status: ApplicationStatus;
  appliedAt: Date;
  assignee: Ref | null;
}

export interface ApplicationHistoryItem {
  id: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  note: string | null;
  changedBy: Ref | null;
  changedAt: Date;
}

export interface ApplicationInterviewItem {
  id: string;
  round: number;
  scheduledAt: Date;
  interviewer: Ref | null;
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
  candidateDetail: {
    phone: string | null;
    hasCv: boolean;
  } | null;
  history: ApplicationHistoryItem[];
  interviews: ApplicationInterviewItem[];
  /** Present only for callers allowed to see offers. */
  offer: ApplicationOfferItem | null;
}

const refOf = (
  entity: { id: string; fullName?: string } | null | undefined,
): Ref | null =>
  entity ? { id: entity.id, name: entity.fullName ?? '' } : null;

export const toListItem = (a: Application): ApplicationListItem => ({
  id: a.id,
  candidate: a.candidate
    ? {
        id: a.candidate.id,
        fullName: a.candidate.fullName,
        email: a.candidate.email,
      }
    : null,
  job: a.job
    ? { id: a.job.id, title: a.job.title, status: a.job.status }
    : null,
  status: a.status,
  appliedAt: a.appliedAt,
  assignee: refOf(a.assignee),
});

export const toHistoryItem = (
  h: ApplicationStatusHistory,
): ApplicationHistoryItem => ({
  id: h.id,
  fromStatus: h.fromStatus,
  toStatus: h.toStatus,
  note: h.note,
  changedBy: refOf(h.changedBy),
  changedAt: h.changedAt,
});

export const toInterviewItem = (i: Interview): ApplicationInterviewItem => ({
  id: i.id,
  round: i.round,
  scheduledAt: i.scheduledAt,
  interviewer: refOf(i.interviewer),
  result: i.result,
  feedback: i.feedback,
});

export const toOfferItem = (o: Offer): ApplicationOfferItem => ({
  id: o.id,
  salary: o.salary,
  startDate: o.startDate,
  expiresAt: o.expiresAt,
  status: o.status,
  note: o.note,
});
