import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { auditEvents, rowChanges } from './helpers/audit';
import { createE2eApp, E2eContext } from './helpers/e2e-app';
import { createFlow, FlowTokens, loginAll } from './helpers/flow';
import { submitForm, VALID_FIELDS } from './helpers/public-apply';

const TAG = 'E2E-AUDPUB';

describe('Audit trail: the public application form (e2e)', () => {
  let ctx: E2eContext;
  let t: FlowTokens;
  let flow: ReturnType<typeof createFlow>;
  let jobId: string;
  let uploadRoot: string;
  let systemId: string;
  let seq = 0;

  const email = () => `${flow.mailPrefix}pub-${++seq}@example.com`;
  const apply = (address: string, target = jobId) =>
    submitForm(
      ctx.server,
      target,
      { ...VALID_FIELDS, email: address },
      undefined,
      { 'User-Agent': 'e2e-visitor/1' },
    );
  const applicationIdOf = async (address: string): Promise<string> =>
    (
      await ctx.maintenance.query<{ id: string }[]>(
        `SELECT a.id FROM applications a
           JOIN candidates c ON c.id = a.candidate_id WHERE c.email = $1`,
        [address],
      )
    )[0].id;

  beforeAll(async () => {
    uploadRoot = await mkdtemp(join(tmpdir(), 'hiflow-audpub-'));
    process.env.UPLOAD_DIR = uploadRoot;

    ctx = await createE2eApp();
    t = await loginAll(ctx);
    flow = createFlow(ctx, t, TAG);
    systemId = (
      await ctx.maintenance.query<{ id: string }[]>(
        `SELECT id FROM users WHERE is_system = true`,
      )
    )[0].id;
    await flow.cleanup();
    jobId = await flow.openJob();
  });

  afterAll(async () => {
    await flow.cleanup();
    await ctx.app.close();
    delete process.env.UPLOAD_DIR;
    await rm(uploadRoot, { recursive: true, force: true });
  });

  it('records a new submission as the system account, with the job, where it came from, and the rows it wrote', async () => {
    const address = email();

    await apply(address).expect(202);

    const appId = await applicationIdOf(address);
    const [event] = await auditEvents(ctx, { entityId: appId });
    expect(event).toMatchObject({
      event: 'APPLICATION_SUBMITTED_ONLINE',
      entity_type: 'Application',
      actor_id: systemId,
      actor_name: 'Ứng viên (Website)',
      data: { jobId },
      user_agent: 'e2e-visitor/1',
    });
    expect(event.ip).not.toBeNull();

    const tables = (await rowChanges(ctx, event)).map((c) => c.table_name);
    expect(tables.sort()).toEqual([
      'application_status_histories',
      'applications',
      'candidates',
    ]);
  });

  it('records nothing for a repeat, and nothing for an email that is already on file', async () => {
    const address = email();
    await apply(address).expect(202);
    const appId = await applicationIdOf(address);
    const before = (await auditEvents(ctx, { entityId: appId })).length;

    await apply(address).expect(202);

    expect((await auditEvents(ctx, { entityId: appId })).length).toBe(before);

    // The same person applying to another job is a new application with its own event.
    const otherJob = await flow.openJob();
    await apply(address, otherJob).expect(202);
    const events = await auditEvents(ctx, {
      event: 'APPLICATION_SUBMITTED_ONLINE',
    });
    expect(events.filter((e) => e.data.jobId === otherJob)).toHaveLength(1);
  });

  it('records nothing for a job that is not open', async () => {
    const since = (
      await ctx.maintenance.query<{ now: Date }[]>(
        `SELECT clock_timestamp() AS now`,
      )
    )[0].now;

    await apply(email(), '00000000-0000-4000-8000-000000000000').expect(404);

    expect(
      await auditEvents(ctx, { event: 'APPLICATION_SUBMITTED_ONLINE', since }),
    ).toEqual([]);
  });
});
