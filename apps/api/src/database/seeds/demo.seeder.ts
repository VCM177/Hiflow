import {
  ApplicationStatus,
  InterviewResult,
  JobStatus,
  RequisitionStatus,
} from '@hiflow/shared-types';
import { DataSource, EntityManager } from 'typeorm';
import { ApplicationStatusHistory } from '../../modules/applications/entities/application-status-history.entity';
import { Application } from '../../modules/applications/entities/application.entity';
import { Candidate } from '../../modules/candidates/entities/candidate.entity';
import { Interview } from '../../modules/interviews/entities/interview.entity';
import { Job } from '../../modules/jobs/entities/job.entity';
import { Offer } from '../../modules/offers/entities/offer.entity';
import { Requisition } from '../../modules/requisitions/entities/requisition.entity';
import { REQUISITION_CODE_SEQUENCE } from '../../modules/requisitions/requisitions.constants';
import { seedBase, seedPassword } from './base.seeder';
import {
  DEMO_CANDIDATES,
  DEMO_EMAIL_PATTERN,
  DEMO_JOBS,
  DEMO_OTHER_REQUISITIONS,
  DEMO_PATHS,
  DEMO_REASON_PREFIX,
} from './demo-seed.data';

const DAY_MS = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS);
const daysAhead = (n: number) => new Date(Date.now() + n * DAY_MS);
const isoDay = (date: Date) => date.toISOString().slice(0, 10);

export interface DemoSummary {
  skipped: boolean;
  requisitions: number;
  jobs: number;
  candidates: number;
  applications: number;
  interviews: number;
  offers: number;
}

const EMPTY: Omit<DemoSummary, 'skipped'> = {
  requisitions: 0,
  jobs: 0,
  candidates: 0,
  applications: 0,
  interviews: 0,
  offers: 0,
};

async function hasDemoData(manager: EntityManager): Promise<boolean> {
  const rows: unknown[] = await manager.query(
    `SELECT 1 FROM candidates WHERE email LIKE $1 LIMIT 1`,
    [DEMO_EMAIL_PATTERN],
  );
  return rows.length > 0;
}

/** Removes exactly what a previous run created, and nothing else. */
async function removeDemoData(manager: EntityManager): Promise<void> {
  const demoRequisitions = `SELECT id FROM requisitions WHERE reason LIKE '${DEMO_REASON_PREFIX}%'`;

  // Deleting an application cascades to its history, interviews and offer.
  await manager.query(
    `DELETE FROM applications WHERE candidate_id IN
       (SELECT id FROM candidates WHERE email LIKE $1)`,
    [DEMO_EMAIL_PATTERN],
  );
  await manager.query(`DELETE FROM candidates WHERE email LIKE $1`, [
    DEMO_EMAIL_PATTERN,
  ]);
  await manager.query(
    `DELETE FROM jobs WHERE requisition_id IN (${demoRequisitions})`,
  );
  await manager.query(
    `DELETE FROM requisitions WHERE reason LIKE '${DEMO_REASON_PREFIX}%'`,
  );
}

async function idsBy(
  manager: EntityManager,
  table: 'users' | 'departments' | 'job_positions',
  column: 'email' | 'code',
): Promise<Map<string, string>> {
  const rows: { key: string; id: string }[] = await manager.query(
    `SELECT ${column} AS key, id FROM ${table}`,
  );
  return new Map(rows.map((row) => [row.key, row.id]));
}

async function nextRequisitionCode(manager: EntityManager): Promise<string> {
  const rows: { value: string }[] = await manager.query(
    `SELECT nextval('${REQUISITION_CODE_SEQUENCE}') AS value`,
  );
  return `REQ-${new Date().getFullYear()}-${String(rows[0].value).padStart(4, '0')}`;
}

/**
 * Records the path an application took to reach its status. Steps are a day
 * apart (so timelines do not show five identical timestamps), but never in the
 * future.
 */
async function writeHistory(
  manager: EntityManager,
  applicationId: string,
  finalStatus: ApplicationStatus,
  appliedAt: Date,
  actorId: string,
): Promise<void> {
  const path = DEMO_PATHS[finalStatus];

  for (let step = 0; step < path.length; step++) {
    const to = path[step];
    const note =
      step === 0
        ? 'Tạo hồ sơ'
        : to === ApplicationStatus.REJECTED
          ? 'Không đạt phỏng vấn'
          : to === ApplicationStatus.HIRED
            ? 'Ứng viên chấp nhận đề nghị'
            : null;

    await manager.insert(ApplicationStatusHistory, {
      applicationId,
      fromStatus: step === 0 ? null : path[step - 1],
      toStatus: to,
      note,
      changedById: actorId,
      changedAt: new Date(
        Math.min(appliedAt.getTime() + step * DAY_MS, Date.now()),
      ),
    });
  }
}

/**
 * Fills the app with a small, believable recruitment pipeline so the dashboard
 * and reports have something to show on first launch. Idempotent: it does
 * nothing if demo data already exists, unless `reset` asks for a rebuild.
 */
export async function seedDemo(
  dataSource: DataSource,
  options: { reset?: boolean } = {},
): Promise<DemoSummary> {
  // The demo cast (manager, HR, recruiter, interviewer…) comes from the base seed.
  await seedBase(dataSource, seedPassword());

  return dataSource.transaction(async (manager) => {
    const existing = await hasDemoData(manager);
    if (existing && !options.reset) {
      return { skipped: true, ...EMPTY };
    }
    if (existing) await removeDemoData(manager);

    const users = await idsBy(manager, 'users', 'email');
    const departments = await idsBy(manager, 'departments', 'code');
    const positions = await idsBy(manager, 'job_positions', 'code');
    const person = (name: string) => users.get(`${name}@hiflow.local`)!;
    const summary = { ...EMPTY };

    // Requisitions that became jobs (approved), then the two that did not.
    const jobIds = new Map<string, string>();
    for (const job of DEMO_JOBS) {
      const requisition = await manager.insert(Requisition, {
        code: await nextRequisitionCode(manager),
        title: `Tuyển ${job.quantity} ${job.title.toLowerCase()}`,
        departmentId: departments.get(job.department)!,
        positionId: positions.get(job.position)!,
        quantity: job.quantity,
        reason: `${DEMO_REASON_PREFIX} Nhu cầu mở rộng đội ngũ`,
        status: RequisitionStatus.APPROVED,
        createdById: person(job.createdBy),
        approvedById: person('hr'),
        approvedAt: daysAgo(job.publishedDaysAgo + 1),
        createdAt: daysAgo(job.publishedDaysAgo + 3),
      });
      summary.requisitions++;

      const inserted = await manager.insert(Job, {
        requisitionId: requisition.identifiers[0].id as string,
        title: job.title,
        positionId: positions.get(job.position)!,
        departmentId: departments.get(job.department)!,
        quantity: job.quantity,
        salaryMin: job.salary[0],
        salaryMax: job.salary[1],
        location: job.location,
        description: `<p>Tuyển dụng vị trí <strong>${job.title}</strong> tại ${job.location}.</p>`,
        status: JobStatus.OPEN,
        publishedAt: daysAgo(job.publishedDaysAgo),
        createdById: person('recruiter'),
        createdAt: daysAgo(job.publishedDaysAgo + 1),
      });
      jobIds.set(job.key, inserted.identifiers[0].id as string);
      summary.jobs++;
    }

    for (const other of DEMO_OTHER_REQUISITIONS) {
      await manager.insert(Requisition, {
        code: await nextRequisitionCode(manager),
        title: other.title,
        departmentId: departments.get(other.department)!,
        positionId: positions.get(other.position)!,
        quantity: other.quantity,
        reason: `${DEMO_REASON_PREFIX} Bổ sung nhân sự`,
        status: other.status,
        rejectReason: other.rejectReason,
        approvedById: null,
        createdById: person('manager'),
        createdAt: daysAgo(other.createdDaysAgo),
      });
      summary.requisitions++;
    }

    for (const c of DEMO_CANDIDATES) {
      const appliedAt = daysAgo(c.appliedDaysAgo);
      const candidate = await manager.insert(Candidate, {
        fullName: c.fullName,
        email: `demo.${c.slug}@example.com`,
        phone: `09${String(10_000_000 + summary.candidates * 137).slice(0, 8)}`,
        source: c.source,
        createdAt: new Date(appliedAt.getTime() - 3_600_000),
      });
      summary.candidates++;

      const application = await manager.insert(Application, {
        candidateId: candidate.identifiers[0].id as string,
        jobId: jobIds.get(c.job)!,
        status: c.status,
        appliedAt,
        assigneeId: c.assigned ? person('recruiter') : null,
      });
      const applicationId = application.identifiers[0].id as string;
      summary.applications++;

      await writeHistory(
        manager,
        applicationId,
        c.status,
        appliedAt,
        person('recruiter'),
      );

      if (c.interview) {
        const pending = c.interview.result === InterviewResult.PENDING;
        await manager.insert(Interview, {
          applicationId,
          round: 1,
          scheduledAt: pending
            ? daysAhead(c.interview.inDays ?? 1)
            : new Date(appliedAt.getTime() + 5 * DAY_MS),
          interviewerId: person('interviewer'),
          result: c.interview.result,
          feedback:
            c.interview.result === InterviewResult.PASSED
              ? 'Đạt yêu cầu, giao tiếp tốt'
              : c.interview.result === InterviewResult.FAILED
                ? 'Chưa đáp ứng yêu cầu chuyên môn'
                : null,
        });
        summary.interviews++;
      }

      if (c.offer) {
        await manager.insert(Offer, {
          applicationId,
          salary: c.offer.salary,
          startDate: isoDay(daysAhead(c.offer.startInDays)),
          expiresAt:
            c.offer.expiresInDays === undefined
              ? null
              : isoDay(daysAhead(c.offer.expiresInDays)),
          status: c.offer.status,
          note: 'Thử việc 2 tháng, lương thỏa thuận',
          createdById: person('recruiter'),
        });
        summary.offers++;
      }
    }

    return { skipped: false, ...summary };
  });
}
