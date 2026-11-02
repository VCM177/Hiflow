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
  /** Direct writes go through the owner connection, like the seed itself. */
  const w = (sql: string, params: unknown[] = []): Promise<unknown> =>
    ctx.maintenance.query(sql, params);
  const count = async (sql: string, params: unknown[] = []) =>
    Number((await q<{ n: string }[]>(sql, params))[0].n);

  const DEMO = `c.email LIKE 'demo.%@example.com'`;
  const demoApps = `SELECT a.id FROM applications a JOIN candidates c ON c.id = a.candidate_id WHERE ${DEMO}`;

  beforeAll(async () => {
    ctx = await createE2eApp();
    await w(`DELETE FROM candidates WHERE email = $1`, [KEEP_EMAIL]);
  });

  afterAll(async () => {
    await w(`DELETE FROM candidates WHERE email = $1`, [KEEP_EMAIL]);
    await ctx.app.close();
  });

  it('builds the pipeline described in the plan', async () => {
    const summary = await seedDemo(ctx.maintenance, { reset: true });

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
        // Strictly later: two steps at the same instant would draw a timeline
        // whose order the reader cannot trust.
        expect(step.changed_at.getTime()).toBeGreaterThan(
          steps[i].changed_at.getTime(),
        );
      });
      expect(
        steps.every((s) => s.changed_at.getTime() <= Date.now() + 1000),
      ).toBe(true);
    }
  });

  it('spreads the application dates over the last 30 days, not clustered on a few days', async () => {
    const rows = await q<{ applied_on: string; n: number }[]>(
      `SELECT to_char(a.applied_at, 'YYYY-MM-DD') AS applied_on, COUNT(*)::int AS n
         FROM applications a JOIN candidates c ON c.id = a.candidate_id
        WHERE ${DEMO} GROUP BY 1 ORDER BY 1`,
    );
    const bounds = await q<{ first: Date; last: Date }[]>(
      `SELECT MIN(a.applied_at) AS first, MAX(a.applied_at) AS last
         FROM applications a JOIN candidates c ON c.id = a.candidate_id
        WHERE ${DEMO}`,
    );
    const day = 24 * 3_600_000;
    const { first, last } = bounds[0];

    expect(Date.now() - first.getTime()).toBeLessThanOrEqual(30 * day);
    expect(last.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    // The window is really covered: the earliest is weeks old, the latest is recent.
    expect(Date.now() - first.getTime()).toBeGreaterThanOrEqual(20 * day);
    expect(Date.now() - last.getTime()).toBeLessThanOrEqual(2 * day);
    // No cluster: many different days, and never more than two applications on one.
    expect(rows.length).toBeGreaterThanOrEqual(12);
    expect(Math.max(...rows.map((row) => row.n))).toBeLessThanOrEqual(2);
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

    const again = await seedDemo(ctx.maintenance);

    expect(again.skipped).toBe(true);
    expect(
      await count(`SELECT COUNT(*) AS n FROM candidates c WHERE ${DEMO}`),
    ).toBe(before);
  });

  it('rebuilds on reset without duplicating, and never touches data it did not create', async () => {
    await w(
      `INSERT INTO candidates (full_name, email) VALUES ('Giữ lại', $1)`,
      [KEEP_EMAIL],
    );

    const rebuilt = await seedDemo(ctx.maintenance, { reset: true });

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

  describe('its audit trail', () => {
    const seedEvents = () =>
      q<{ event: string; entity_id: string; occurred_at: Date }[]>(
        `SELECT event, entity_id, occurred_at FROM audit_events
         WHERE origin = 'seed' ORDER BY occurred_at, id`,
      );

    it('leaves the events a real run would have, tagged seed and never dated in the future', async () => {
      const events = await seedEvents();
      const names = new Set(events.map((e) => e.event));

      for (const expected of [
        'REQUISITION_CREATED',
        'REQUISITION_SUBMITTED',
        'REQUISITION_APPROVED',
        'REQUISITION_REJECTED',
        'JOB_CREATED',
        'JOB_PUBLISHED',
        'CANDIDATE_CREATED',
        'APPLICATION_CREATED',
        'APPLICATION_STATUS_CHANGED',
        'INTERVIEW_SCHEDULED',
        'INTERVIEW_RESULT_RECORDED',
        'OFFER_CREATED',
        'OFFER_RESPONSE_RECORDED',
      ]) {
        expect(names).toContain(expected);
      }
      expect(events.every((e) => e.occurred_at.getTime() <= Date.now())).toBe(
        true,
      );
    });

    it('tells each requisition’s story in order, with the reason it was turned down', async () => {
      const events = await seedEvents();
      const storyOf = (id: string) =>
        events.filter((e) => e.entity_id === id).map((e) => e.event);
      const rows = await q<{ id: string; status: string }[]>(
        `SELECT id, status FROM requisitions WHERE reason LIKE '[demo]%'`,
      );

      for (const row of rows) {
        const story = storyOf(row.id);
        expect(story[0]).toBe('REQUISITION_CREATED');
        if (row.status === 'APPROVED') {
          expect(story).toEqual([
            'REQUISITION_CREATED',
            'REQUISITION_SUBMITTED',
            'REQUISITION_APPROVED',
          ]);
        }
        if (row.status === 'REJECTED') {
          expect(story.at(-1)).toBe('REQUISITION_REJECTED');
        }
      }

      const admin = await loginAs(ctx.server, 'admin@hiflow.local');
      const rejected = rows.find((r) => r.status === 'REJECTED')!;
      const timeline = (
        await request(ctx.server)
          .get(`/requisitions/${rejected.id}/history`)
          .set(bearer(admin))
          .expect(200)
      ).body as { event: string; note: string | null }[];
      expect(timeline.map((e) => e.event)).toEqual([
        'CREATED',
        'SUBMITTED',
        'REJECTED',
      ]);
      expect(timeline[2].note).toBe('Ngân sách quý này chưa được duyệt');
    });

    it('has one status change for every step an application took after its first', async () => {
      const steps = await count(
        `SELECT COUNT(*) AS n FROM application_status_histories
         WHERE from_status IS NOT NULL AND application_id IN (${demoApps})`,
      );
      const recorded = await count(
        `SELECT COUNT(*) AS n FROM audit_events
         WHERE event = 'APPLICATION_STATUS_CHANGED' AND entity_id IN (${demoApps})`,
      );

      expect(recorded).toBe(steps);
    });

    it('is replaced, not doubled, by a reset, and leaves other origins and its own teardown alone', async () => {
      const before = (await seedEvents()).length;
      await w(
        `INSERT INTO audit_events (event, entity_type, tx_id, origin)
         VALUES ('E2E_SURVIVOR', 'User', uuid_generate_v4(), 'e2e')`,
      );

      await seedDemo(ctx.maintenance, { reset: true });

      expect((await seedEvents()).length).toBe(before);
      expect(
        await count(
          `SELECT COUNT(*) AS n FROM audit_events WHERE event = 'E2E_SURVIVOR'`,
        ),
      ).toBe(1);
      // Tearing the old demo down is not itself something that happened.
      expect(
        await count(
          `SELECT COUNT(*) AS n FROM audit_row_changes WHERE op = 'D' AND origin = 'seed'`,
        ),
      ).toBe(0);
    });
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
