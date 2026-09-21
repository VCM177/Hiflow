import request from 'supertest';
// Must stay before e2e-app: it sets the env the app reads when first imported.
import { restoreThrottleEnv } from './helpers/real-throttle-env';
import { createE2eApp, E2eContext } from './helpers/e2e-app';
import { createFlow, FlowTokens, loginAll } from './helpers/flow';
import { submitForm, VALID_FIELDS } from './helpers/public-apply';

const IP_LIMIT = 10;
const EMAIL_LIMIT = 3;

describe('Public application form, rate limits at their real values (e2e)', () => {
  let ctx: E2eContext;
  let t: FlowTokens;
  let flow: ReturnType<typeof createFlow>;
  let jobId: string;
  let ipCounter = 0;

  // A fresh address per call, so one test's attempts never count against another's.
  const nextIp = () => `198.51.100.${100 + ++ipCounter}`;

  beforeAll(async () => {
    ctx = await createE2eApp();
    t = await loginAll(ctx);
    flow = createFlow(ctx, t, 'E2E-applylimit');
    jobId = await flow.openJob();
  });

  afterAll(async () => {
    await flow.cleanup();
    await ctx.app.close();
    restoreThrottleEnv();
  });

  it('answers 429 with Retry-After once one address has submitted too often', async () => {
    const ip = nextIp();
    const post = () =>
      request(ctx.server)
        .post(`/public/jobs/${jobId}/applications`)
        .set('X-Forwarded-For', ip);

    // Empty forms are refused with 400, but every attempt still counts.
    for (let i = 0; i < IP_LIMIT; i++) {
      await post().expect(400);
    }

    const blocked = await post().expect(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    await request(ctx.server)
      .post(`/public/jobs/${jobId}/applications`)
      .set('X-Forwarded-For', nextIp())
      .expect(400);
  });

  it('answers 429 with Retry-After once one mailbox has been used too often, from any address', async () => {
    const email = `${flow.mailPrefix}hammered@example.com`;
    const send = (ip: string, address = email) =>
      submitForm(
        ctx.server,
        jobId,
        { ...VALID_FIELDS, email: address },
        undefined,
        { 'X-Forwarded-For': ip },
      );

    // Different addresses each time: the per-address limit is not what stops this.
    for (let i = 0; i < EMAIL_LIMIT; i++) {
      await send(nextIp()).expect(202);
    }

    const blocked = await send(nextIp()).expect(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    // The address is matched ignoring case, so another spelling is the same mailbox.
    await send(nextIp(), email.toUpperCase()).expect(429);
    // Someone else's mailbox is not affected.
    await send(nextIp(), `${flow.mailPrefix}bystander@example.com`).expect(202);
  });

  it('says the same 429 whether or not the mailbox has applied before', async () => {
    const known = `${flow.mailPrefix}known@example.com`;
    const unknown = `${flow.mailPrefix}unknown@example.com`;
    const send = (address: string) =>
      submitForm(
        ctx.server,
        jobId,
        { ...VALID_FIELDS, email: address },
        undefined,
        {
          'X-Forwarded-For': nextIp(),
        },
      );

    for (const address of [known, unknown]) {
      for (let i = 0; i < EMAIL_LIMIT; i++) await send(address).expect(202);
    }

    const a = await send(known).expect(429);
    const b = await send(unknown).expect(429);
    expect(a.body).toEqual(b.body);
  });
});
