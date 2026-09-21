// Must stay before e2e-app: it sets the env the app reads when first imported.
import { restoreCaptchaEnv } from './helpers/captcha-fail-env';
import { createE2eApp, E2eContext } from './helpers/e2e-app';
import { createFlow, FlowTokens, loginAll } from './helpers/flow';
import { submitForm, VALID_FIELDS } from './helpers/public-apply';

/**
 * Real Cloudflare siteverify with its published always-fail test secret: every
 * token is refused, so nothing may be stored and nobody may be emailed.
 */
describe('Public application form, captcha that fails (e2e)', () => {
  let ctx: E2eContext;
  let t: FlowTokens;
  let flow: ReturnType<typeof createFlow>;

  beforeAll(async () => {
    ctx = await createE2eApp();
    t = await loginAll(ctx);
    flow = createFlow(ctx, t, 'E2E-captchafail');
  });

  afterAll(async () => {
    await flow.cleanup();
    await ctx.app.close();
    restoreCaptchaEnv();
  });

  it('refuses the submission and stores nothing', async () => {
    const jobId = await flow.openJob();
    const email = `${flow.mailPrefix}refused@example.com`;

    const response = await submitForm(ctx.server, jobId, {
      ...VALID_FIELDS,
      email,
      turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
    }).expect(400);

    expect(JSON.stringify(response.body)).toContain('chống spam');
    const rows: { n: string }[] = await ctx.dataSource.query(
      `SELECT COUNT(*) AS n FROM candidates WHERE email = $1`,
      [email],
    );
    expect(rows[0].n).toBe('0');
  });

  it('answers the same for a tampered form as for a bot: the captcha comes before everything else', async () => {
    const jobId = await flow.openJob();

    // Would be a 404 for an unknown job or a 400 for a bad CV, but the captcha
    // is checked first, so a bot learns nothing about either.
    const bad = await submitForm(
      ctx.server,
      jobId,
      {
        ...VALID_FIELDS,
        email: `${flow.mailPrefix}tamper@example.com`,
        turnstileToken: 'x',
      },
      { content: Buffer.from('MZ....'), filename: 'cv.pdf' },
    ).expect(400);

    expect(JSON.stringify(bad.body)).toContain('chống spam');
  });
});
