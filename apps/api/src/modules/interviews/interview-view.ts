import type { InterviewView } from '@hiflow/shared-types';
import { Interview } from './entities/interview.entity';

export const toInterviewView = (i: Interview): InterviewView => ({
  id: i.id,
  application: i.application
    ? {
        id: i.application.id,
        candidate: i.application.candidate
          ? {
              id: i.application.candidate.id,
              fullName: i.application.candidate.fullName,
            }
          : null,
        job: i.application.job
          ? { id: i.application.job.id, title: i.application.job.title }
          : null,
      }
    : null,
  round: i.round,
  scheduledAt: i.scheduledAt,
  interviewer: i.interviewer
    ? { id: i.interviewer.id, name: i.interviewer.fullName }
    : null,
  result: i.result,
  feedback: i.feedback,
  createdAt: i.createdAt,
  updatedAt: i.updatedAt,
});
