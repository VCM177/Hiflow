// Must stay before e2e-app: it sets the env the app reads when first imported.
import { restoreCaptchaEnv } from './helpers/captcha-pass-env';
import { createE2eApp, E2eContext } from './helpers/e2e-app';
import { createFlow, FlowTokens, loginAll } from './helpers/flow';
import { submitForm, VALID_FIELDS } from './helpers/public-apply';

/**
 * Talks to the real Cloudflare siteverify endpoint using Cloudflare's published
 * test secret, which accepts any token. If Cloudflare cannot be reached the form
 * fails closed with 503 and these tests fail visibly.
 */
describe('Public application form, captcha that passes (e2e)', () => {
  let ctx: E2eContext;
  let t: FlowTokens;
  let flow: ReturnType<typeof createFlow>;

  const candidateCount = async (address: string): Promise<number> => {
    const rows: { n: string }[] = await ctx.dataSource.query(
      `SELECT COUNT(*) AS n FROM candidates WHERE email = $1`,
      [address],
    );
    return Number(rows[0].n);
  };

  beforeAll(async () => {
    ctx = await createE2eApp();
    t = await loginAll(ctx);
    flow = createFlow(ctx, t, 'E2E-captchapass');
  });

  afterAll(async () => {
    await flow.cleanup();
    await ctx.app.close();
    restoreCaptchaEnv();
  });

  it('accepts a submission carrying a token Cloudflare confirms', async () => {
    const jobId = await flow.openJob();
    const email = `${flow.mailPrefix}ok@example.com`;

    await submitForm(ctx.server, jobId, {
      ...VALID_FIELDS,
      email,
      turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
    }).expect(202);

    expect(await candidateCount(email)).toBe(1);
  });

  it('refuses a submission with no token, without creating anything', async () => {
    const jobId = await flow.openJob();
    const email = `${flow.mailPrefix}notoken@example.com`;

    await submitForm(ctx.server, jobId, { ...VALID_FIELDS, email }).expect(400);

    expect(await candidateCount(email)).toBe(0);
  });

  it('refuses an empty token and one longer than Cloudflare allows', async () => {
    const jobId = await flow.openJob();

    for (const token of ['', 'x'.repeat(2049)]) {
      await submitForm(ctx.server, jobId, {
        ...VALID_FIELDS,
        email: `${flow.mailPrefix}badtoken@example.com`,
        turnstileToken: token,
      }).expect(400);
    }
    expect(await candidateCount(`${flow.mailPrefix}badtoken@example.com`)).toBe(
      0,
    );
  });

  it('does not touch the staff side: a recruiter needs no token', async () => {
    await flow.candidate('staffside');
  });
});
