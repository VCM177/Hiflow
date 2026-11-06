import { expect, test } from '@playwright/test';

import { PDF, apiAs, openJob } from './helpers';

// Cloudflare Turnstile in a real browser (gate B-4.1). Off by default: the other specs run
// without a site key, so the widget is not drawn and no token is needed. Run it on purpose:
//
//   E2E_TURNSTILE=pass  with NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA and the
//                       API started with TURNSTILE_SECRET=1x0000000000000000000000000000000AA
//                       (the test keys always pass); the form sends a real token and the
//                       API checks it with Cloudflare.
//   E2E_TURNSTILE=block with NEXT_PUBLIC_TURNSTILE_SITE_KEY=2x00000000000000000000AB (fails
//                       every challenge): the form refuses to send and makes no request.
//
// Needs network to challenges.cloudflare.com. The API keeps the same secret for the run.
const MODE = process.env.E2E_TURNSTILE;
let jobId = '';

test.describe('captcha in the browser', () => {
  test.skip(
    !MODE,
    'set E2E_TURNSTILE=pass or block (see the header of this file)',
  );

  test.beforeAll(async ({ browser }) => {
    const admin = await apiAs(browser, 'admin@hiflow.local');
    ({ jobId } = await openJob(
      admin,
      `E2E-Captcha ${Date.now().toString(36)}`,
      1,
    ));
  });

  test('a passed challenge lets the application through', async ({ page }) => {
    test.skip(MODE !== 'pass', 'pass mode only');
    await page.goto(`/careers/${jobId}`);
    await page.getByLabel(/^Họ và tên/).fill('E2E-Captcha Pass');
    await page
      .getByLabel(/^Email/)
      .fill(`e2e-captcha-${Date.now().toString(36)}@example.com`);
    await page.getByLabel(/^Số điện thoại/).fill('0901234567');
    await page.getByLabel(/^CV/).setInputFiles(PDF);
    await page.getByRole('checkbox').check();

    // The widget writes its token into a hidden field once the challenge is passed.
    const token = page.locator('input[name="cf-turnstile-response"]');
    await expect(token).not.toHaveValue('', { timeout: 30_000 });
    await page.getByRole('button', { name: 'Gửi hồ sơ' }).click();
    await expect(page).toHaveURL(/\/thanks$/);
  });

  test('without a passed challenge the form does not send', async ({
    page,
  }) => {
    test.skip(MODE !== 'block', 'block mode only');
    const applications: string[] = [];
    page.on('request', (request) => {
      if (
        request.url().includes('/applications') &&
        request.method() === 'POST'
      ) {
        applications.push(request.url());
      }
    });

    await page.goto(`/careers/${jobId}`);
    await page.getByLabel(/^Họ và tên/).fill('E2E-Captcha Block');
    await page
      .getByLabel(/^Email/)
      .fill(`e2e-captcha-block-${Date.now().toString(36)}@example.com`);
    await page.getByLabel(/^Số điện thoại/).fill('0901234567');
    await page.getByLabel(/^CV/).setInputFiles(PDF);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Gửi hồ sơ' }).click();

    await expect(
      page.getByText('Vui lòng hoàn tất bước xác minh chống spam.'),
    ).toBeVisible();
    expect(applications).toEqual([]);
  });
});
