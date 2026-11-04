import type { InterviewResult } from '../statuses';

export interface InterviewView {
  id: string;
  application: {
    id: string;
    candidate: { id: string; fullName: string } | null;
    job: { id: string; title: string } | null;
  } | null;
  round: number;
  scheduledAt: Date;
  interviewer: { id: string; name: string } | null;
  result: InterviewResult;
  feedback: string | null;
  createdAt: Date;
  updatedAt: Date;
}
