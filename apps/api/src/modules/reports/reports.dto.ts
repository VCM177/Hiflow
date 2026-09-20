import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export enum ReportType {
  REQUISITION_PROGRESS = 'requisition-progress',
  JOB_RESULTS = 'job-results',
  CANDIDATE_SOURCES = 'candidate-sources',
}

export class ReportQueryDto {
  /** First day of the period; defaults to 30 days before `to`. */
  @IsOptional()
  @IsDateString()
  from?: string;

  /** Last day of the period, inclusive; defaults to today. */
  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  positionId?: string;
}
