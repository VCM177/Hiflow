import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class DashboardQueryDto {
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
}
