import request from 'supertest';
import { bearer, E2eContext, loginAs } from './e2e-app';
import { approvedRequisition, idByCode } from './factories';

export interface FlowTokens {
  manager: string;
  hr: string;
  admin: string;
  recruiter: string;
  interviewer: string;
}

export async function loginAll(ctx: E2eContext): Promise<FlowTokens> {
  const [manager, hr, admin, recruiter, interviewer] = await Promise.all(
    [
      'manager@hiflow.local',
      'hr@hiflow.local',
      'admin@hiflow.local',
      'recruiter@hiflow.local',
      'interviewer@hiflow.local',
    ].map((email) => loginAs(ctx.server, email)),
  );

  return { manager, hr, admin, recruiter, interviewer };
}

export async function userIdByEmail(
  ctx: E2eContext,
  email: string,
): Promise<string> {
  const rows: { id: string }[] = await ctx.dataSource.query(
    `SELECT id FROM users WHERE email = $1`,
    [email],
  );
  return rows[0].id;
}

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

// Shared by every flow in a file: two flows with the same tag must not hand
// out the same candidate email or the same interview slot.
let seq = 0;
let slot = 0;

/**
 * Builds real recruitment data through the public API, so a test starts from a
 * state a user could genuinely have reached. Everything it creates carries
 * `tag`, which is how `cleanup()` finds it again.
 */
export function createFlow(ctx: E2eContext, t: FlowTokens, tag: string) {
  const mailPrefix = `e2e-${tag.toLowerCase().replace(/[^a-z0-9]/g, '')}-`;

  const post = (token: string, path: string, body: object = {}) =>
    request(ctx.server).post(path).set(bearer(token)).send(body);

  const flow = {
    mailPrefix,

    post,

    /** Evenly spaced future instants, never closer than two hours apart. */
    futureSlot(): string {
      const start = Date.now() + 30 * DAY_MS;
      const rounded = start - (start % HOUR_MS);
      return new Date(rounded + ++slot * 2 * HOUR_MS).toISOString();
    },

    async openJob(
      opts: { creator?: string; extra?: object } = {},
    ): Promise<string> {
      const devId = await idByCode(ctx.dataSource, 'job_positions', 'DEV');
      const req = await approvedRequisition(
        ctx.server,
        { creator: opts.creator ?? t.manager, approver: t.hr },
        {
          title: `${tag} req ${++seq}`,
          positionId: devId,
          quantity: 5,
          ...opts.extra,
        },
      );
      const job = (
        await post(t.recruiter, '/jobs', { requisitionId: req.id }).expect(201)
      ).body as { id: string };
      await post(t.recruiter, `/jobs/${job.id}/publish`).expect(200);
      return job.id;
    },

    async candidate(
      label = 'c',
      fullName?: string,
    ): Promise<{ id: string; email: string }> {
      const n = ++seq;
      return (
        await post(t.recruiter, '/candidates', {
          fullName: fullName ?? `Ứng viên ${label} ${n}`,
          email: `${mailPrefix}${label}-${n}@example.com`,
        }).expect(201)
      ).body as { id: string; email: string };
    },

    async application(jobId: string, candidateId?: string): Promise<string> {
      const cid = candidateId ?? (await flow.candidate()).id;
      return (
        (
          await post(t.recruiter, '/applications', {
            candidateId: cid,
            jobId,
          }).expect(201)
        ).body as { id: string }
      ).id;
    },

    move(appId: string, toStatus: string, note?: string, token = t.recruiter) {
      return post(
        token,
        `/applications/${appId}/status`,
        note === undefined ? { toStatus } : { toStatus, note },
      );
    },

    /** NEW → SCREENING → INTERVIEW. */
    async toInterviewStage(jobId: string): Promise<string> {
      const appId = await flow.application(jobId);
      await flow.move(appId, 'SCREENING').expect(200);
      await flow.move(appId, 'INTERVIEW').expect(200);
      return appId;
    },

    async scheduleInterview(
      appId: string,
      opts: { interviewerId?: string; at?: string; round?: number } = {},
    ): Promise<{ id: string; scheduledAt: string; round: number }> {
      const interviewerId =
        opts.interviewerId ??
        (await userIdByEmail(ctx, 'interviewer@hiflow.local'));

      return (
        await post(t.recruiter, '/interviews', {
          applicationId: appId,
          interviewerId,
          scheduledAt: opts.at ?? flow.futureSlot(),
          ...(opts.round ? { round: opts.round } : {}),
        }).expect(201)
      ).body as { id: string; scheduledAt: string; round: number };
    },

    /** Schedules an interview and records it as passed, all through the API. */
    async passInterview(appId: string): Promise<void> {
      const interview = await flow.scheduleInterview(appId);
      await post(t.interviewer, `/interviews/${interview.id}/result`, {
        result: 'PASSED',
        feedback: 'Đạt yêu cầu',
      }).expect(200);
    },

    /** Takes a fresh application all the way to the OFFER stage. */
    async toOfferStage(jobId: string): Promise<string> {
      const appId = await flow.toInterviewStage(jobId);
      await flow.passInterview(appId);
      await flow.move(appId, 'OFFER').expect(200);
      return appId;
    },

    offerBody(overrides: object = {}) {
      const start = new Date(Date.now() + 30 * DAY_MS)
        .toISOString()
        .slice(0, 10);
      const expires = new Date(Date.now() + 14 * DAY_MS)
        .toISOString()
        .slice(0, 10);

      return {
        salary: 20000000,
        startDate: start,
        expiresAt: expires,
        note: 'Đề nghị thử việc 2 tháng',
        ...overrides,
      };
    },

    /** Removes everything this flow (and the tests using it) created. */
    async cleanup(): Promise<void> {
      const q = (sql: string) => ctx.dataSource.query(sql);
      const mine = `candidate_id IN (SELECT id FROM candidates WHERE email LIKE '${mailPrefix}%')`;

      await q(`DELETE FROM activity_logs WHERE
        (entity_type = 'Application' AND entity_id IN (SELECT id::text FROM applications WHERE ${mine}))
        OR (entity_type = 'Interview' AND entity_id IN (SELECT i.id::text FROM interviews i JOIN applications a ON a.id = i.application_id WHERE a.${mine}))
        OR (entity_type = 'Candidate' AND entity_id IN (SELECT id::text FROM candidates WHERE email LIKE '${mailPrefix}%'))
        OR (entity_type = 'Job' AND entity_id IN (SELECT id::text FROM jobs WHERE title LIKE '${tag}%'))
        OR (entity_type = 'Requisition' AND entity_id IN (SELECT id::text FROM requisitions WHERE title LIKE '${tag}%'))`);
      // Deleting applications cascades to their history, interviews and offers.
      await q(`DELETE FROM applications WHERE ${mine}`);
      await q(`DELETE FROM candidates WHERE email LIKE '${mailPrefix}%'`);
      await q(`DELETE FROM jobs WHERE title LIKE '${tag}%'`);
      await q(`DELETE FROM requisitions WHERE title LIKE '${tag}%'`);
    },
  };

  return flow;
}
