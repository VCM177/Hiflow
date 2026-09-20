import {
  APPLICATION_TRANSITIONS,
  ApplicationStatus,
  canTransition,
} from '@hiflow/shared-types';
import request from 'supertest';
import { seedDemo } from './../src/database/seeds/demo.seeder';
import { bearer, createE2eApp, E2eContext, loginAs } from './helpers/e2e-app';

const KEEP_EMAIL = 'e2e-seeddemo-keep@example.com';

interface HistoryRow {
  application_id: string;
  from_status: string | null;
  to_status: string;
  changed_at: Date;
}

describe('Demo seed (e2e)', () => {
  let ctx: E2eContext;

  const q = <T>(sql: string, params: unknown[] = []): Promise<T> =>
    ctx.dataSource.query(sql, params);
  const count = async (sql: string, params: unknown[] = []) =>
    Number((await q<{ n: string }[]>(sql, params))[0].n);

  const DEMO = `c.email LIKE 'demo.%@example.com'`;
  const demoApps = `SELECT a.id FROM applications a JOIN candidates c ON c.id = a.candidate_id WHERE ${DEMO}`;

  beforeAll(async () => {
    ctx = await createE2eApp();
    await q(`DELETE FROM candidates WHERE email = $1`, [KEEP_EMAIL]);
  });

  afterAll(async () => {
    await q(`DELETE FROM candidates WHERE email = $1`, [KEEP_EMAIL]);
    await ctx.app.close();
  });

  it('builds the pipeline described in the plan', async () => {
    const summary = await seedDemo(ctx.dataSource, { reset: true });

    expect(summary).toEqual({
      skipped: false,
      requisitions: 5,
      jobs: 3,
      candidates: 15,
      applications: 15,
      interviews: 6,
      offers: 3,
    });
  });

  it('spreads the applications over the funnel', async () => {
    const rows = await q<{ status: string; n: number }[]>(
      `SELECT a.status, COUNT(*)::int AS n FROM applications a
       JOIN candidates c ON c.id = a.candidate_id WHERE ${DEMO} GROUP BY a.status`,
    );
    const byStatus = Object.fromEntries(rows.map((r) => [r.status, r.n]));

    expect(byStatus).toEqual({
      NEW: 4,
      SCREENING: 4,
      INTERVIEW: 3,
      OFFER: 2,
      HIRED: 1,
      REJECTED: 1,
    });
  });

  it('gives every application a valid, ordered status history that ends where it is now', async () => {
    const history = await q<HistoryRow[]>(
      `SELECT h.application_id, h.from_status, h.to_status, h.changed_at
       FROM application_status_histories h
       WHERE h.application_id IN (${demoApps})
       ORDER BY h.application_id, h.changed_at, h.to_status`,
    );
    const apps = await q<{ id: string; status: string }[]>(
      `SELECT a.id, a.status FROM applications a JOIN candidates c ON c.id = a.candidate_id WHERE ${DEMO}`,
    );

    for (const app of apps) {
      const steps = history.filter((h) => h.application_id === app.id);

      expect(steps[0]).toMatchObject({ from_status: null, to_status: 'NEW' });
      expect(steps.at(-1)?.to_status).toBe(app.status);

      steps.slice(1).forEach((step, i) => {
        expect(step.from_status).toBe(steps[i].to_status);
        expect(
          canTransition(
            APPLICATION_TRANSITIONS,
            step.from_status as ApplicationStatus,
            step.to_status as ApplicationStatus,
          ),
        ).toBe(true);
        expect(step.changed_at.getTime()).toBeGreaterThanOrEqual(
          steps[i].changed_at.getTime(),
        );
      });
      expect(
        steps.every((s) => s.changed_at.getTime() <= Date.now() + 1000),
      ).toBe(true);
    }
  });

  it('respects the workflow rules: offers need a passed interview, hires need an accepted offer', async () => {
    const stage = (status: string) =>
      `SELECT a.id FROM applications a JOIN candidates c ON c.id = a.candidate_id WHERE ${DEMO} AND a.status = '${status}'`;

    for (const status of ['OFFER', 'HIRED']) {
      expect(
        await count(`SELECT COUNT(*) AS n FROM (${stage(status)}) s WHERE NOT EXISTS (
        SELECT 1 FROM interviews i WHERE i.application_id = s.id AND i.result = 'PASSED')`),
      ).toBe(0);
      expect(
        await count(
          `SELECT COUNT(*) AS n FROM interviews i WHERE i.result = 'PENDING' AND i.application_id IN (${stage(status)})`,
        ),
      ).toBe(0);
    }

    expect(
      await count(
        `SELECT COUNT(*) AS n FROM offers o WHERE o.status = 'ACCEPTED' AND o.application_id IN (${stage('HIRED')})`,
      ),
    ).toBe(1);
    expect(
      await count(
        `SELECT COUNT(*) AS n FROM offers o WHERE o.status = 'PENDING' AND o.application_id IN (${stage('OFFER')})`,
      ),
    ).toBe(2);
    // A rejected application holds no live interview or offer.
    expect(
      await count(
        `SELECT COUNT(*) AS n FROM interviews i WHERE i.result = 'PENDING' AND i.application_id IN (${stage('REJECTED')})`,
      ),
    ).toBe(0);
  });

  it('only leaves upcoming interviews on applications awaiting one, with no double-booking', async () => {
    const pending = await q<
      { status: string; scheduled_at: Date; interviewer_id: string }[]
    >(
      `SELECT a.status, i.scheduled_at, i.interviewer_id FROM interviews i
       JOIN applications a ON a.id = i.application_id
       WHERE i.result = 'PENDING' AND i.application_id IN (${demoApps})`,
    );

    expect(pending).toHaveLength(2);
    expect(pending.every((p) => p.status === 'INTERVIEW')).toBe(true);
    expect(pending.every((p) => p.scheduled_at.getTime() > Date.now())).toBe(
      true,
    );

    const [a, b] = pending;
    expect(
      Math.abs(a.scheduled_at.getTime() - b.scheduled_at.getTime()),
    ).toBeGreaterThanOrEqual(3_600_000);
  });

  it('turns approved requisitions into open jobs within their headcount, and keeps one to approve', async () => {
    expect(
      await count(`SELECT COUNT(*) AS n FROM jobs j JOIN requisitions r ON r.id = j.requisition_id
        WHERE r.reason LIKE '[demo]%' AND r.status = 'APPROVED' AND j.status = 'OPEN' AND j.quantity <= r.quantity`),
    ).toBe(3);
    expect(
      await count(
        `SELECT COUNT(*) AS n FROM requisitions WHERE reason LIKE '[demo]%' AND status = 'PENDING_APPROVAL'`,
      ),
    ).toBe(1);
    expect(
      await count(
        `SELECT COUNT(*) AS n FROM requisitions WHERE reason LIKE '[demo]%' AND status = 'REJECTED' AND reject_reason IS NOT NULL`,
      ),
    ).toBe(1);
  });

  it('uses only fictional example.com addresses', async () => {
    expect(
      await count(
        `SELECT COUNT(*) AS n FROM candidates c WHERE ${DEMO} AND c.email NOT LIKE '%@example.com'`,
      ),
    ).toBe(0);
  });

  it('is idempotent: a second run changes nothing', async () => {
    const before = await count(
      `SELECT COUNT(*) AS n FROM candidates c WHERE ${DEMO}`,
    );

    const again = await seedDemo(ctx.dataSource);

    expect(again.skipped).toBe(true);
    expect(
      await count(`SELECT COUNT(*) AS n FROM candidates c WHERE ${DEMO}`),
    ).toBe(before);
  });

  it('rebuilds on reset without duplicating, and never touches data it did not create', async () => {
    await q(
      `INSERT INTO candidates (full_name, email) VALUES ('Giữ lại', $1)`,
      [KEEP_EMAIL],
    );

    const rebuilt = await seedDemo(ctx.dataSource, { reset: true });

    expect(rebuilt).toMatchObject({
      skipped: false,
      candidates: 15,
      applications: 15,
    });
    expect(
      await count(`SELECT COUNT(*) AS n FROM candidates c WHERE ${DEMO}`),
    ).toBe(15);
    expect(
      await count(
        `SELECT COUNT(*) AS n FROM requisitions WHERE reason LIKE '[demo]%'`,
      ),
    ).toBe(5);
    expect(
      await count(`SELECT COUNT(*) AS n FROM candidates WHERE email = $1`, [
        KEEP_EMAIL,
      ]),
    ).toBe(1);
  });

  it('gives the dashboard something to show on first launch', async () => {
    const hr = await loginAs(ctx.server, 'hr@hiflow.local');
    const overview = (
      await request(ctx.server)
        .get('/dashboard/overview')
        .set(bearer(hr))
        .expect(200)
    ).body as {
      cards: Record<string, number>;
      funnel: { stage: string; count: number }[];
    };
    const reached = (stage: string) =>
      overview.funnel.find((f) => f.stage === stage)!.count;

    expect(overview.cards.pendingRequisitions).toBeGreaterThanOrEqual(1);
    expect(overview.cards.openJobs).toBeGreaterThanOrEqual(3);
    expect(overview.cards.newApplications).toBeGreaterThanOrEqual(15);
    expect(overview.cards.upcomingInterviews).toBeGreaterThanOrEqual(2);
    expect(overview.cards.hiredInPeriod).toBeGreaterThanOrEqual(1);
    // Cumulative funnel: everyone was new; 11 got past screening; 7 reached an interview.
    expect(reached('NEW')).toBeGreaterThanOrEqual(15);
    expect(reached('SCREENING')).toBeGreaterThanOrEqual(11);
    expect(reached('INTERVIEW')).toBeGreaterThanOrEqual(7);
    expect(reached('OFFER')).toBeGreaterThanOrEqual(3);
    expect(reached('HIRED')).toBeGreaterThanOrEqual(1);
  });
});
