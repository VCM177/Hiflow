import {
  ApplicationStatus,
  hasPermission,
  PERMISSIONS,
} from '@hiflow/shared-types';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CacheService } from '../../common/cache/cache.service';
import { Period, resolvePeriod } from '../../common/period';
import { departmentScope } from '../../common/scope';
import type { AuthUser } from '../../common/types/auth-user';
import { APPLICATION_STATUS_LABEL } from '../applications/applications.constants';
import { DashboardQueryDto } from './dashboard.dto';

const FUNNEL_STAGES: readonly ApplicationStatus[] = [
  ApplicationStatus.NEW,
  ApplicationStatus.SCREENING,
  ApplicationStatus.INTERVIEW,
  ApplicationStatus.OFFER,
  ApplicationStatus.HIRED,
];

const DAY_MS = 86_400_000;

export interface DashboardOverview {
  period: { from: string; to: string };
  cards: {
    pendingRequisitions: number;
    openJobs: number;
    newApplications: number;
    upcomingInterviews: number;
    hiredInPeriod: number;
  };
  funnel: { stage: ApplicationStatus; label: string; count: number }[];
  outcomes: { rejected: number; withdrawn: number };
  todo: { type: string; label: string; count: number; href: string }[];
}

type Params = unknown[];

@Injectable()
export class DashboardService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly cache: CacheService,
  ) {}

  overview(
    query: DashboardQueryDto,
    actor: AuthUser,
  ): Promise<DashboardOverview> {
    const period = resolvePeriod(query.from, query.to);
    const scope = this.scopeFor(actor, query.departmentId);

    // The to-do list depends on the caller's permissions, i.e. on their role.
    const key = `dashboard:${actor.role}:${scope ?? 'all'}:${period.fromDay}:${period.toDay}`;

    return this.cache.wrap(key, () => this.compute(period, scope, actor));
  }

  /** A department manager is confined to their own department. */
  private scopeFor(actor: AuthUser, requested?: string): string | null {
    const confined = departmentScope(actor);

    if (confined && requested && requested !== confined) {
      throw new ForbiddenException('Không có quyền xem số liệu phòng ban này');
    }

    return confined ?? requested ?? null;
  }

  private async compute(
    period: Period,
    scope: string | null,
    actor: AuthUser,
  ): Promise<DashboardOverview> {
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + DAY_MS);
    const inAWeek = new Date(now.getTime() + 7 * DAY_MS);

    const [
      pendingRequisitions,
      openJobs,
      newApplications,
      upcomingInterviews,
      hiredInPeriod,
      funnelRows,
      outcomeRows,
      unassigned,
      interviewsToday,
      offersExpiring,
    ] = await Promise.all([
      this.count(
        `SELECT COUNT(*)::int AS n FROM requisitions r
         WHERE r.status = 'PENDING_APPROVAL' AND ($1::uuid IS NULL OR r.department_id = $1)`,
        [scope],
      ),
      this.count(
        `SELECT COUNT(*)::int AS n FROM jobs j
         WHERE j.status = 'OPEN' AND ($1::uuid IS NULL OR j.department_id = $1)`,
        [scope],
      ),
      this.count(
        `SELECT COUNT(*)::int AS n FROM applications a JOIN jobs j ON j.id = a.job_id
         WHERE a.applied_at >= $2 AND a.applied_at < $3
           AND ($1::uuid IS NULL OR j.department_id = $1)`,
        [scope, period.from, period.to],
      ),
      this.count(
        `SELECT COUNT(*)::int AS n FROM interviews i
         JOIN applications a ON a.id = i.application_id JOIN jobs j ON j.id = a.job_id
         WHERE i.result = 'PENDING' AND i.scheduled_at >= $2 AND i.scheduled_at < $3
           AND ($1::uuid IS NULL OR j.department_id = $1)`,
        [scope, now, inAWeek],
      ),
      this.count(
        `SELECT COUNT(DISTINCT h.application_id)::int AS n
         FROM application_status_histories h
         JOIN applications a ON a.id = h.application_id JOIN jobs j ON j.id = a.job_id
         WHERE h.to_status = 'HIRED' AND h.changed_at >= $2 AND h.changed_at < $3
           AND ($1::uuid IS NULL OR j.department_id = $1)`,
        [scope, period.from, period.to],
      ),
      this.dataSource.query<{ stage: ApplicationStatus; n: number }[]>(
        // How many applications from this period ever reached each stage.
        `SELECT h.to_status AS stage, COUNT(DISTINCT h.application_id)::int AS n
         FROM application_status_histories h
         JOIN applications a ON a.id = h.application_id JOIN jobs j ON j.id = a.job_id
         WHERE a.applied_at >= $2 AND a.applied_at < $3
           AND h.to_status IN ('NEW','SCREENING','INTERVIEW','OFFER','HIRED')
           AND ($1::uuid IS NULL OR j.department_id = $1)
         GROUP BY h.to_status`,
        [scope, period.from, period.to],
      ),
      this.dataSource.query<{ status: ApplicationStatus; n: number }[]>(
        `SELECT a.status, COUNT(*)::int AS n FROM applications a JOIN jobs j ON j.id = a.job_id
         WHERE a.applied_at >= $2 AND a.applied_at < $3
           AND a.status IN ('REJECTED','WITHDRAWN')
           AND ($1::uuid IS NULL OR j.department_id = $1)
         GROUP BY a.status`,
        [scope, period.from, period.to],
      ),
      this.count(
        `SELECT COUNT(*)::int AS n FROM applications a JOIN jobs j ON j.id = a.job_id
         WHERE a.status = 'NEW' AND a.assignee_id IS NULL
           AND ($1::uuid IS NULL OR j.department_id = $1)`,
        [scope],
      ),
      this.count(
        `SELECT COUNT(*)::int AS n FROM interviews i
         JOIN applications a ON a.id = i.application_id JOIN jobs j ON j.id = a.job_id
         WHERE i.result = 'PENDING' AND i.scheduled_at >= $2 AND i.scheduled_at < $3
           AND ($1::uuid IS NULL OR j.department_id = $1)`,
        [scope, dayStart, dayEnd],
      ),
      this.count(
        `SELECT COUNT(*)::int AS n FROM offers o
         JOIN applications a ON a.id = o.application_id JOIN jobs j ON j.id = a.job_id
         WHERE o.status = 'PENDING' AND o.expires_at IS NOT NULL
           AND o.expires_at >= current_date AND o.expires_at <= current_date + 3
           AND ($1::uuid IS NULL OR j.department_id = $1)`,
        [scope],
      ),
    ]);

    const reached = new Map(funnelRows.map((row) => [row.stage, row.n]));
    const outcomes = new Map(outcomeRows.map((row) => [row.status, row.n]));

    return {
      period: { from: period.fromDay, to: period.toDay },
      cards: {
        pendingRequisitions,
        openJobs,
        newApplications,
        upcomingInterviews,
        hiredInPeriod,
      },
      funnel: FUNNEL_STAGES.map((stage) => ({
        stage,
        label: APPLICATION_STATUS_LABEL[stage],
        count: reached.get(stage) ?? 0,
      })),
      outcomes: {
        rejected: outcomes.get(ApplicationStatus.REJECTED) ?? 0,
        withdrawn: outcomes.get(ApplicationStatus.WITHDRAWN) ?? 0,
      },
      todo: this.todoFor(actor, {
        pendingRequisitions,
        unassigned,
        interviewsToday,
        offersExpiring,
      }),
    };
  }

  /** Only tasks the caller is actually allowed to act on. */
  private todoFor(
    actor: AuthUser,
    counts: {
      pendingRequisitions: number;
      unassigned: number;
      interviewsToday: number;
      offersExpiring: number;
    },
  ): DashboardOverview['todo'] {
    const can = (permission: Parameters<typeof hasPermission>[1]) =>
      hasPermission(actor.permissions, permission);
    const items: DashboardOverview['todo'] = [];

    if (can(PERMISSIONS.requisition.approve)) {
      items.push({
        type: 'REQUISITIONS_TO_APPROVE',
        label: 'Yêu cầu tuyển dụng chờ duyệt',
        count: counts.pendingRequisitions,
        href: '/requisitions?status=PENDING_APPROVAL',
      });
    }
    if (can(PERMISSIONS.application.assigneeUpdate)) {
      items.push({
        type: 'UNASSIGNED_APPLICATIONS',
        label: 'Hồ sơ mới chưa có người phụ trách',
        count: counts.unassigned,
        href: '/applications?status=NEW',
      });
    }
    if (can(PERMISSIONS.interview.listView)) {
      items.push({
        type: 'INTERVIEWS_TODAY',
        label: 'Phỏng vấn hôm nay',
        count: counts.interviewsToday,
        href: '/interviews',
      });
    }
    if (can(PERMISSIONS.offer.view)) {
      items.push({
        type: 'OFFERS_EXPIRING',
        label: 'Đề nghị sắp hết hạn phản hồi (3 ngày)',
        count: counts.offersExpiring,
        href: '/applications?status=OFFER',
      });
    }

    return items;
  }

  private async count(sql: string, params: Params): Promise<number> {
    const rows = await this.dataSource.query<{ n: number }[]>(sql, params);
    return rows[0]?.n ?? 0;
  }
}
