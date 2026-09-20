import {
  CandidateSource,
  JobStatus,
  RequisitionStatus,
} from '@hiflow/shared-types';
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CacheService } from '../../common/cache/cache.service';
import { CsvColumn, toCsv } from '../../common/csv';
import { Period, resolvePeriod } from '../../common/period';
import { JOB_STATUS_LABEL } from '../jobs/jobs.constants';
import { REQUISITION_STATUS_LABEL } from '../requisitions/requisitions.constants';
import {
  CandidateSourceRow,
  JobResultRow,
  percent,
  REPORT_COLUMNS,
  REPORT_TITLES,
  RequisitionProgressRow,
  SOURCE_LABEL,
} from './reports.definitions';
import { ReportQueryDto, ReportType } from './reports.dto';

export interface Report {
  type: ReportType;
  title: string;
  period: { from: string; to: string };
  columns: { key: string; label: string }[];
  rows: Record<string, string | number>[];
}

interface Filters {
  period: Period;
  departmentId: string | null;
  positionId: string | null;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly cache: CacheService,
  ) {}

  build(type: ReportType, query: ReportQueryDto): Promise<Report> {
    const filters: Filters = {
      period: resolvePeriod(query.from, query.to),
      departmentId: query.departmentId ?? null,
      positionId: query.positionId ?? null,
    };
    const key = `report:${type}:${filters.period.fromDay}:${filters.period.toDay}:${filters.departmentId ?? 'all'}:${filters.positionId ?? 'all'}`;

    return this.cache.wrap(key, async () => ({
      type,
      title: REPORT_TITLES[type],
      period: { from: filters.period.fromDay, to: filters.period.toDay },
      columns: REPORT_COLUMNS[type],
      rows: await this.rows(type, filters),
    }));
  }

  async exportCsv(
    type: ReportType,
    query: ReportQueryDto,
  ): Promise<{ filename: string; content: string }> {
    const report = await this.build(type, query);

    return {
      filename: `${type}_${report.period.from}_${report.period.to}.csv`,
      content: toCsv(
        report.columns as CsvColumn<Record<string, string | number>>[],
        report.rows,
      ),
    };
  }

  private rows(type: ReportType, filters: Filters): Promise<Report['rows']> {
    switch (type) {
      case ReportType.REQUISITION_PROGRESS:
        return this.requisitionProgress(filters);
      case ReportType.JOB_RESULTS:
        return this.jobResults(filters);
      case ReportType.CANDIDATE_SOURCES:
        return this.candidateSources(filters);
    }
  }

  private async requisitionProgress(
    f: Filters,
  ): Promise<RequisitionProgressRow[]> {
    const rows = await this.dataSource.query<
      {
        code: string;
        title: string;
        department: string;
        position: string;
        quantity: number;
        hired: number;
        open_jobs: number;
        status: RequisitionStatus;
        created_at: Date;
      }[]
    >(
      `SELECT r.code, r.title, d.name AS department, p.name AS position, r.quantity,
              COALESCE(h.hired, 0)::int AS hired, COALESCE(j.open_jobs, 0)::int AS open_jobs,
              r.status, r.created_at
       FROM requisitions r
       JOIN departments d ON d.id = r.department_id
       JOIN job_positions p ON p.id = r.position_id
       LEFT JOIN (
         SELECT jb.requisition_id, COUNT(*) AS open_jobs
         FROM jobs jb WHERE jb.status = 'OPEN' GROUP BY jb.requisition_id
       ) j ON j.requisition_id = r.id
       LEFT JOIN (
         SELECT jb.requisition_id, COUNT(*) AS hired
         FROM applications a JOIN jobs jb ON jb.id = a.job_id
         WHERE a.status = 'HIRED' GROUP BY jb.requisition_id
       ) h ON h.requisition_id = r.id
       WHERE r.created_at >= $1 AND r.created_at < $2
         AND ($3::uuid IS NULL OR r.department_id = $3)
         AND ($4::uuid IS NULL OR r.position_id = $4)
       ORDER BY r.created_at DESC, r.code`,
      [f.period.from, f.period.to, f.departmentId, f.positionId],
    );

    return rows.map((r) => ({
      code: r.code,
      title: r.title,
      department: r.department,
      position: r.position,
      quantity: r.quantity,
      hired: r.hired,
      fillRate: percent(r.hired, r.quantity),
      openJobs: r.open_jobs,
      status: r.status,
      statusLabel: REQUISITION_STATUS_LABEL[r.status],
      createdAt: r.created_at.toISOString(),
    }));
  }

  private async jobResults(f: Filters): Promise<JobResultRow[]> {
    const rows = await this.dataSource.query<
      {
        title: string;
        department: string;
        position: string;
        status: JobStatus;
        quantity: number;
        applications: number;
        screened: number;
        interviewed: number;
        offered: number;
        hired: number;
        rejected: number;
      }[]
    >(
      // "Reached a stage" comes from the status history, so an application that
      // moved on (or was rejected later) still counts for the stages it passed.
      `SELECT jb.title, d.name AS department, p.name AS position, jb.status, jb.quantity,
              COUNT(DISTINCT a.id)::int AS applications,
              COUNT(DISTINCT a.id) FILTER (WHERE h.to_status = 'SCREENING')::int AS screened,
              COUNT(DISTINCT a.id) FILTER (WHERE h.to_status = 'INTERVIEW')::int AS interviewed,
              COUNT(DISTINCT a.id) FILTER (WHERE h.to_status = 'OFFER')::int AS offered,
              COUNT(DISTINCT a.id) FILTER (WHERE h.to_status = 'HIRED')::int AS hired,
              COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'REJECTED')::int AS rejected
       FROM jobs jb
       JOIN departments d ON d.id = jb.department_id
       JOIN job_positions p ON p.id = jb.position_id
       LEFT JOIN applications a
         ON a.job_id = jb.id AND a.applied_at >= $1 AND a.applied_at < $2
       LEFT JOIN application_status_histories h ON h.application_id = a.id
       WHERE jb.created_at < $2
         AND ($3::uuid IS NULL OR jb.department_id = $3)
         AND ($4::uuid IS NULL OR jb.position_id = $4)
       GROUP BY jb.id, d.name, p.name
       ORDER BY jb.created_at DESC, jb.title`,
      [f.period.from, f.period.to, f.departmentId, f.positionId],
    );

    return rows.map((r) => ({
      title: r.title,
      department: r.department,
      position: r.position,
      status: r.status,
      statusLabel: JOB_STATUS_LABEL[r.status],
      quantity: r.quantity,
      applications: r.applications,
      screened: r.screened,
      interviewed: r.interviewed,
      offered: r.offered,
      hired: r.hired,
      rejected: r.rejected,
      hireRate: percent(r.hired, r.applications),
    }));
  }

  private async candidateSources(f: Filters): Promise<CandidateSourceRow[]> {
    const rows = await this.dataSource.query<
      {
        source: CandidateSource;
        candidates: number;
        applications: number;
        hired: number;
      }[]
    >(
      `SELECT c.source, COUNT(DISTINCT c.id)::int AS candidates,
              COUNT(a.id)::int AS applications,
              COUNT(a.id) FILTER (WHERE a.status = 'HIRED')::int AS hired
       FROM applications a
       JOIN candidates c ON c.id = a.candidate_id
       JOIN jobs j ON j.id = a.job_id
       WHERE a.applied_at >= $1 AND a.applied_at < $2
         AND ($3::uuid IS NULL OR j.department_id = $3)
         AND ($4::uuid IS NULL OR j.position_id = $4)
       GROUP BY c.source
       ORDER BY applications DESC, c.source`,
      [f.period.from, f.period.to, f.departmentId, f.positionId],
    );

    return rows.map((r) => ({
      source: r.source,
      sourceLabel: SOURCE_LABEL[r.source],
      candidates: r.candidates,
      applications: r.applications,
      hired: r.hired,
      hireRate: percent(r.hired, r.applications),
    }));
  }
}
