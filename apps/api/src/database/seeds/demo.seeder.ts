import {
  ApplicationStatus,
  InterviewResult,
  JobStatus,
  OfferStatus,
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
  beginSeedContext,
  SeedActor,
  seedActors,
  SeedTrail,
} from './seed-trail';
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
const HOUR_MS = 3_600_000;
/** An event is never dated in the future, however the demo's timeline was laid out. */
const notAfterNow = (ms: number) => new Date(Math.min(ms, Date.now()));

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

/**
 * Removes exactly what a previous run created, and nothing else: its rows, and
 * the trail it left. The clean-up itself is not recorded (capture is off), so a
 * rebuilt demo does not carry a trace of having been torn down.
 */
async function removeDemoData(manager: EntityManager): Promise<void> {
  const demoRequisitions = `SELECT id FROM requisitions WHERE reason LIKE '${DEMO_REASON_PREFIX}%'`;

  await manager.query(`SELECT set_config('hiflow.purge', 'on', true)`);
  await manager.query(`DELETE FROM audit_row_changes WHERE origin = 'seed'`);
  await manager.query(`DELETE FROM audit_events WHERE origin = 'seed'`);
  await manager.query(`SELECT set_config('hiflow.capture', 'off', true)`);

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

  await manager.query(`SELECT set_config('hiflow.capture', 'on', true)`);
  await manager.query(`SELECT set_config('hiflow.purge', 'off', true)`);
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
  trail: SeedTrail,
  applicationId: string,
  finalStatus: ApplicationStatus,
  appliedAt: Date,
  actor: SeedActor,
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
      changedById: actor.id,
      changedAt: notAfterNow(appliedAt.getTime() + step * DAY_MS),
    });

    if (step > 0) {
      await trail.record(
        'APPLICATION_STATUS_CHANGED',
        applicationId,
        actor,
        notAfterNow(appliedAt.getTime() + step * DAY_MS),
        { from: path[step - 1], to, note },
      );
    }
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

    const txId = await beginSeedContext(manager);
    const trail = new SeedTrail(manager, txId);
    const actors = await seedActors(manager);
    const users = await idsBy(manager, 'users', 'email');
    const departments = await idsBy(manager, 'departments', 'code');
    const positions = await idsBy(manager, 'job_positions', 'code');
    const person = (name: string) => users.get(`${name}@hiflow.local`)!;
    const actor = (name: string): SeedActor =>
      actors.get(`${name}@hiflow.local`)!;
    const summary = { ...EMPTY };

    // Requisitions that became jobs (approved), then the two that did not.
    const jobIds = new Map<string, string>();
    for (const job of DEMO_JOBS) {
      const code = await nextRequisitionCode(manager);
      const createdAt = daysAgo(job.publishedDaysAgo + 3);
      const approvedAt = daysAgo(job.publishedDaysAgo + 1);
      const requisition = await manager.insert(Requisition, {
        code,
        title: `Tuyển ${job.quantity} ${job.title.toLowerCase()}`,
        departmentId: departments.get(job.department)!,
        positionId: positions.get(job.position)!,
        quantity: job.quantity,
        reason: `${DEMO_REASON_PREFIX} Nhu cầu mở rộng đội ngũ`,
        status: RequisitionStatus.APPROVED,
        createdById: person(job.createdBy),
        approvedById: person('hr'),
        approvedAt,
        createdAt,
      });
      const requisitionId = requisition.identifiers[0].id as string;
      summary.requisitions++;
      await trail.record(
        'REQUISITION_CREATED',
        requisitionId,
        actor(job.createdBy),
        createdAt,
        { code },
      );
      await trail.record(
        'REQUISITION_SUBMITTED',
        requisitionId,
        actor(job.createdBy),
        new Date(createdAt.getTime() + HOUR_MS),
        { code },
      );
      await trail.record(
        'REQUISITION_APPROVED',
        requisitionId,
        actor('hr'),
        approvedAt,
        { code },
      );

      const jobCreatedAt = daysAgo(job.publishedDaysAgo + 1);
      const publishedAt = daysAgo(job.publishedDaysAgo);
      const inserted = await manager.insert(Job, {
        requisitionId,
        title: job.title,
        positionId: positions.get(job.position)!,
        departmentId: departments.get(job.department)!,
        quantity: job.quantity,
        salaryMin: job.salary[0],
        salaryMax: job.salary[1],
        location: job.location,
        description: `<p>Tuyển dụng vị trí <strong>${job.title}</strong> tại ${job.location}.</p>`,
        status: JobStatus.OPEN,
        publishedAt,
        createdById: person('recruiter'),
        createdAt: jobCreatedAt,
      });
      const jobId = inserted.identifiers[0].id as string;
      jobIds.set(job.key, jobId);
      summary.jobs++;
      await trail.record(
        'JOB_CREATED',
        jobId,
        actor('recruiter'),
        new Date(jobCreatedAt.getTime() + HOUR_MS),
      );
      await trail.record(
        'JOB_PUBLISHED',
        jobId,
        actor('recruiter'),
        publishedAt,
      );
    }

    for (const other of DEMO_OTHER_REQUISITIONS) {
      const code = await nextRequisitionCode(manager);
      const createdAt = daysAgo(other.createdDaysAgo);
      const inserted = await manager.insert(Requisition, {
        code,
        title: other.title,
        departmentId: departments.get(other.department)!,
        positionId: positions.get(other.position)!,
        quantity: other.quantity,
        reason: `${DEMO_REASON_PREFIX} Bổ sung nhân sự`,
        status: other.status,
        rejectReason: other.rejectReason,
        approvedById: null,
        createdById: person('manager'),
        createdAt,
      });
      const requisitionId = inserted.identifiers[0].id as string;
      summary.requisitions++;
      await trail.record(
        'REQUISITION_CREATED',
        requisitionId,
        actor('manager'),
        createdAt,
        { code },
      );

      if (other.status !== RequisitionStatus.DRAFT) {
        await trail.record(
          'REQUISITION_SUBMITTED',
          requisitionId,
          actor('manager'),
          new Date(createdAt.getTime() + HOUR_MS),
          { code },
        );
      }
      if (other.status === RequisitionStatus.REJECTED) {
        await trail.record(
          'REQUISITION_REJECTED',
          requisitionId,
          actor('hr'),
          notAfterNow(createdAt.getTime() + DAY_MS),
          { code, reason: other.rejectReason ?? '' },
        );
      }
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
      const candidateId = candidate.identifiers[0].id as string;
      summary.candidates++;
      await trail.record(
        'CANDIDATE_CREATED',
        candidateId,
        actor('recruiter'),
        new Date(appliedAt.getTime() - HOUR_MS),
      );

      const application = await manager.insert(Application, {
        candidateId: candidate.identifiers[0].id as string,
        jobId: jobIds.get(c.job)!,
        status: c.status,
        appliedAt,
        assigneeId: c.assigned ? person('recruiter') : null,
      });
      const applicationId = application.identifiers[0].id as string;
      summary.applications++;
      await trail.record(
        'APPLICATION_CREATED',
        applicationId,
        actor('recruiter'),
        appliedAt,
      );

      await writeHistory(
        manager,
        trail,
        applicationId,
        c.status,
        appliedAt,
        actor('recruiter'),
      );

      if (c.interview) {
        const pending = c.interview.result === InterviewResult.PENDING;
        const interview = await manager.insert(Interview, {
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
        const interviewId = interview.identifiers[0].id as string;
        summary.interviews++;
        const interviewStage = appliedAt.getTime() + 2 * DAY_MS;
        await trail.record(
          'INTERVIEW_SCHEDULED',
          interviewId,
          actor('recruiter'),
          notAfterNow(interviewStage + HOUR_MS),
        );
        if (!pending) {
          await trail.record(
            'INTERVIEW_RESULT_RECORDED',
            interviewId,
            actor('interviewer'),
            notAfterNow(interviewStage + DAY_MS - HOUR_MS),
            { result: c.interview.result },
          );
        }
      }

      if (c.offer) {
        const offer = await manager.insert(Offer, {
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
        const offerId = offer.identifiers[0].id as string;
        summary.offers++;
        const offerStage = appliedAt.getTime() + 3 * DAY_MS;
        await trail.record(
          'OFFER_CREATED',
          offerId,
          actor('recruiter'),
          notAfterNow(offerStage + HOUR_MS),
        );
        if (c.offer.status !== OfferStatus.PENDING) {
          await trail.record(
            'OFFER_RESPONSE_RECORDED',
            offerId,
            actor('recruiter'),
            notAfterNow(offerStage + DAY_MS - 1000),
            { response: c.offer.status },
          );
        }
      }
    }

    return { skipped: false, ...summary };
  });
}
