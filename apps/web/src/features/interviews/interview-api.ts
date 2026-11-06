import type { InterviewView, Jsonified } from '@hiflow/shared-types';

import { apiRequest } from '@/lib/api/client';

export type Interview = Jsonified<InterviewView>;

export const scheduleInterview = (body: {
  applicationId: string;
  interviewerId: string;
  scheduledAt: string;
  round?: number;
}): Promise<Interview> => apiRequest('POST', '/interviews', { body });
