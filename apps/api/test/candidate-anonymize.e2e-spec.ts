import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { APPLICATION_HOLD_STATUSES } from '@hiflow/shared-types';
import request from 'supertest';
import {
  ANONYMIZED_NAME,
  CandidateAnonymizerService,
} from './../src/modules/candidates/candidate-anonymizer.service';
import { purgeAuditCopies } from './../src/database/audit-purge';
import { StorageService } from './../src/modules/storage/storage.service';
import { bearer, createE2eApp, E2eContext } from './helpers/e2e-app';
import { createFlow, FlowTokens, loginAll } from './helpers/flow';

const TAG = 'E2E-ANON';
const PDF = Buffer.from('%PDF-1.4\n% cv that must be erased\n');

interface Detail {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  dob: string | null;
  note: string | null;
  hasCv: boolean;
  anonymizedAt: string | null;
  applications: { id: string; status: string }[];
}

describe('Anonymising a candidate (e2e)', () => {
  let ctx: E2eContext;
  let t: FlowTokens;
  let flow: ReturnType<typeof createFlow>;
  let jobId: string;
  let uploadRoot: string;
  // An anonymised candidate has lost the email that `flow.cleanup()` looks for.
  const tracked: string[] = [];

  const anonymize = (token: string, id: string) =>
    flow.post(token, `/candidates/${id}/anonymize`);
  const detailOf = async (id: string) =>
    (
      await request(ctx.server)
        .get(`/candidates/${id}`)
        .set(bearer(t.hr))
        .expect(200)
    ).body as Detail;
  const sql = <T>(text: string, params: unknown[] = []): Promise<T> =>
    ctx.maintenance.query<T>(text, params);

  /** A candidate with every kind of personal data, rejected everywhere. */
  const richCandidate = async (): Promise<{
    id: string;
    email: string;
    appId: string;
    appCvKey: string;
  }> => {
    const created = await flow.candidate('rich', 'Nguyễn Văn Riêng Tư');
    tracked.push(created.id);

    await request(ctx.server)
      .patch(`/candidates/${created.id}`)
      .set(bearer(t.recruiter))
      .send({ phone: '0912345678', dob: '1998-05-17' })
      .expect(200);
    await request(ctx.server)
      .put(`/candidates/${created.id}/note`)
      .set(bearer(t.recruiter))
      .send({ note: 'Ghi chú riêng tư' })
      .expect(200);
    await request(ctx.server)
      .post(`/candidates/${created.id}/cv`)
      .set(bearer(t.recruiter))
      .attach('file', PDF, { filename: 'cv.pdf' })
      .expect(200);

    const appId = await flow.application(jobId, created.id);
    const { key } = await ctx.app.get(StorageService).upload({
      originalname: 'cv.pdf',
      mimetype: 'application/pdf',
      size: PDF.length,
      buffer: PDF,
    });
    await sql(
      `UPDATE applications SET cv_file_key = $1, note = 'Ghi chú hồ sơ' WHERE id = $2`,
      [key, appId],
    );
    await flow.move(appId, 'REJECTED', 'Không phù hợp').expect(200);

    return { id: created.id, email: created.email, appId, appCvKey: key };
  };

  const purge = async (): Promise<void> => {
    const mine = `job_id IN (SELECT id FROM jobs WHERE title LIKE '${TAG}%')`;
    const ids = [
      ...tracked,
      ...(
        await sql<{ candidate_id: string }[]>(
          `SELECT DISTINCT candidate_id FROM applications WHERE ${mine}`,
        )
      ).map((row) => row.candidate_id),
    ];

    await sql(`DELETE FROM applications WHERE ${mine}`);
    await sql(`DELETE FROM candidates WHERE id = ANY($1)`, [ids]);
    await flow.cleanup();
  };

  beforeAll(async () => {
    uploadRoot = await mkdtemp(join(tmpdir(), 'hiflow-anon-'));
    process.env.UPLOAD_DIR = uploadRoot;

    ctx = await createE2eApp();
    t = await loginAll(ctx);
    flow = createFlow(ctx, t, TAG);
    await purge();
    jobId = await flow.openJob();
  });

  afterAll(async () => {
    await purge();
    await ctx.app.close();
    delete process.env.UPLOAD_DIR;
    await rm(uploadRoot, { recursive: true, force: true });
  });

  it('erases the personal data and the CVs but keeps the row and its applications', async () => {
    const { id, email, appId, appCvKey } = await richCandidate();
    const before = await detailOf(id);
    expect(before.hasCv).toBe(true);
    const total = async () =>
      (
        await sql<{ n: number }[]>(`SELECT COUNT(*)::int AS n FROM candidates`)
      )[0].n;
    const countBefore = await total();

    const anonymised = (await anonymize(t.hr, id).expect(200)).body as Detail;

    expect(anonymised.fullName).toBe(ANONYMIZED_NAME);
    expect(anonymised.email).toBe(`anonymized-${id}@anonymized.invalid`);
    expect(anonymised).toMatchObject({
      phone: null,
      dob: null,
      note: null,
      hasCv: false,
    });
    expect(anonymised.anonymizedAt).not.toBeNull();
    expect(anonymised.applications.map((a) => a.id)).toEqual([appId]);
    expect(await total()).toBe(countBefore);

    // Nothing of the person is left in the application or in the audit log.
    const app = (
      await request(ctx.server)
        .get(`/applications/${appId}`)
        .set(bearer(t.hr))
        .expect(200)
    ).body as object;
    expect(JSON.stringify(app)).not.toContain(email);
    expect(JSON.stringify(app)).not.toContain('Nguyễn Văn Riêng Tư');
    const note = await sql<{ note: string | null; cv: string | null }[]>(
      `SELECT note, cv_file_key AS cv FROM applications WHERE id = $1`,
      [appId],
    );
    expect(note[0]).toEqual({ note: null, cv: null });

    // The files are gone, not merely unlinked.
    await expect(
      ctx.app.get(StorageService).download(appCvKey, 'x.pdf'),
    ).rejects.toThrow();
    await request(ctx.server)
      .get(`/candidates/${id}/cv`)
      .set(bearer(t.hr))
      .expect(404);
  });

  it('lets only HR and admin do it', async () => {
    const own = await richCandidate();
    const other = await richCandidate();

    for (const token of [t.recruiter, t.manager, t.interviewer]) {
      await anonymize(token, own.id).expect(403);
    }
    expect((await detailOf(own.id)).anonymizedAt).toBeNull();

    await anonymize(t.admin, other.id).expect(200);
    await anonymize(t.hr, own.id).expect(200);
    await request(ctx.server)
      .post(`/candidates/${own.id}/anonymize`)
      .expect(401);
  });

  it('refuses while the candidate still has an application in progress', async () => {
    const live = await flow.candidate('live');
    tracked.push(live.id);
    await flow.application(jobId, live.id);
    const offerApp = await flow.toOfferStage(jobId);
    const [{ candidate_id: offerId }] = await sql<{ candidate_id: string }[]>(
      `SELECT candidate_id FROM applications WHERE id = $1`,
      [offerApp],
    );

    await anonymize(t.hr, live.id).expect(409);
    await anonymize(t.hr, offerId).expect(409);

    const untouched = await detailOf(live.id);
    expect(untouched.anonymizedAt).toBeNull();
    expect(untouched.fullName).toContain('Ứng viên live');
    // A hired candidate is held as well: their data is no longer Hiflow's alone.
    expect(APPLICATION_HOLD_STATUSES).toEqual(
      expect.arrayContaining([
        'NEW',
        'SCREENING',
        'INTERVIEW',
        'OFFER',
        'HIRED',
      ]),
    );
    expect(APPLICATION_HOLD_STATUSES).not.toContain('REJECTED');
    expect(APPLICATION_HOLD_STATUSES).not.toContain('WITHDRAWN');
  });

  it('can be done once, and answers 404 for an unknown candidate', async () => {
    const { id } = await richCandidate();

    await anonymize(t.hr, id).expect(200);
    await anonymize(t.hr, id).expect(409);
    await anonymize(t.hr, '00000000-0000-4000-8000-000000000000').expect(404);
    await anonymize(t.hr, 'not-a-uuid').expect(400);
  });

  it('lets a withdrawn candidate or one with no application be erased', async () => {
    const withdrawn = await flow.candidate('withdrawn');
    tracked.push(withdrawn.id);
    const appId = await flow.application(jobId, withdrawn.id);
    await flow.move(appId, 'WITHDRAWN', 'Ứng viên rút').expect(200);
    const bare = await flow.candidate('bare');
    tracked.push(bare.id);

    await anonymize(t.hr, withdrawn.id).expect(200);
    await anonymize(t.hr, bare.id).expect(200);
  });

  it('does not let an erased candidate be edited, noted, given a CV or applied for', async () => {
    const { id } = await richCandidate();
    await anonymize(t.hr, id).expect(200);

    await request(ctx.server)
      .patch(`/candidates/${id}`)
      .set(bearer(t.recruiter))
      .send({ phone: '0987654321' })
      .expect(409);
    await request(ctx.server)
      .put(`/candidates/${id}/note`)
      .set(bearer(t.recruiter))
      .send({ note: 'x' })
      .expect(409);
    await request(ctx.server)
      .post(`/candidates/${id}/cv`)
      .set(bearer(t.recruiter))
      .attach('file', PDF, { filename: 'cv.pdf' })
      .expect(409);
    await flow
      .post(t.recruiter, '/applications', { candidateId: id, jobId })
      .expect(409);

    expect(await detailOf(id)).toMatchObject({ phone: null, note: null });
  });

  describe('retention', () => {
    const backdate = async (candidateId: string): Promise<void> => {
      await sql(
        `UPDATE candidates SET updated_at = now() - interval '2 years' WHERE id = $1`,
        [candidateId],
      );
      await sql(
        `UPDATE applications SET applied_at = now() - interval '2 years' WHERE candidate_id = $1`,
        [candidateId],
      );
      await sql(
        `UPDATE application_status_histories SET changed_at = now() - interval '2 years'
         WHERE application_id IN (SELECT id FROM applications WHERE candidate_id = $1)`,
        [candidateId],
      );
    };

    it('finds only the idle candidates who hold no application in progress', async () => {
      const anonymizer = ctx.app.get(CandidateAnonymizerService);
      const idle = await flow.candidate('idle');
      const busy = await flow.candidate('busy');
      const recent = await flow.candidate('recent');
      tracked.push(idle.id, busy.id, recent.id);
      const idleApp = await flow.application(jobId, idle.id);
      await flow.move(idleApp, 'REJECTED', 'Không phù hợp').expect(200);
      await flow.application(jobId, busy.id);
      const recentApp = await flow.application(jobId, recent.id);
      await flow.move(recentApp, 'REJECTED', 'Không phù hợp').expect(200);
      await backdate(idle.id);
      await backdate(busy.id);

      const expired = await anonymizer.findExpired(12, 100_000);

      expect(expired).toContain(idle.id);
      expect(expired).not.toContain(busy.id);
      expect(expired).not.toContain(recent.id);
      // The period is measured from the last activity, so 3 years is not reached.
      expect(await anonymizer.findExpired(36, 100_000)).not.toContain(idle.id);
    });
  });

  describe('what the audit trail keeps of an erased candidate', () => {
    const copiesOf = async (id: string): Promise<number> =>
      (
        await sql<{ n: number }[]>(
          `SELECT COUNT(*)::int AS n FROM audit_row_changes
           WHERE table_name = 'candidates' AND row_id = $1`,
          [id],
        )
      )[0].n;

    it('removes the copies of what was erased, keeps the event that says so, and leaves everyone else', async () => {
      const erased = await richCandidate();
      const kept = await richCandidate();
      await anonymize(t.hr, erased.id).expect(200);
      expect(await copiesOf(erased.id)).toBeGreaterThan(0);

      // Counting first changes nothing.
      const dry = await purgeAuditCopies(ctx.maintenance, 12, true, {
        candidateIds: [erased.id, kept.id],
      });
      expect(dry.candidateCopies).toBeGreaterThan(0);
      expect(await copiesOf(erased.id)).toBeGreaterThan(0);

      const done = await purgeAuditCopies(ctx.maintenance, 12, false, {
        candidateIds: [erased.id, kept.id],
      });

      expect(done.candidateCopies).toBe(dry.candidateCopies);
      expect(await copiesOf(erased.id)).toBe(0);
      expect(await copiesOf(kept.id)).toBeGreaterThan(0);
      const events = await sql<{ event: string }[]>(
        `SELECT event FROM audit_events WHERE entity_id = $1`,
        [erased.id],
      );
      expect(events.map((e) => e.event)).toContain('CANDIDATE_ANONYMIZED');
    });

    it('blanks an address only once it is older than the period, and keeps the rest of the event', async () => {
      const txId = '00000000-0000-4000-8000-0000000000aa';
      await ctx.maintenance.query(
        `INSERT INTO audit_events (occurred_at, event, entity_type, tx_id, origin, ip, user_agent)
         VALUES (now() - interval '13 months', 'E2E_OLD', 'User', $1, 'e2e', '203.0.113.9', 'old-agent'),
                (now() - interval '1 month', 'E2E_NEW', 'User', $1, 'e2e', '203.0.113.9', 'new-agent')`,
        [txId],
      );

      const result = await purgeAuditCopies(ctx.maintenance, 12, false, {
        candidateIds: [],
        origin: 'e2e',
      });

      expect(result.expiredAddresses).toBeGreaterThanOrEqual(1);
      const rows = await sql<
        { event: string; ip: string | null; user_agent: string | null }[]
      >(
        `SELECT event, host(ip) AS ip, user_agent FROM audit_events
         WHERE tx_id = $1 ORDER BY event`,
        [txId],
      );
      expect(rows).toEqual([
        { event: 'E2E_NEW', ip: '203.0.113.9', user_agent: 'new-agent' },
        { event: 'E2E_OLD', ip: null, user_agent: null },
      ]);
    });
  });
});
