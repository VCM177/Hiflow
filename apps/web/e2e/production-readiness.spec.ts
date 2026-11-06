import { expect, test, type Page } from '@playwright/test';

import { apiAs, openAs, openJob } from './helpers';

// What a deployment relies on: pages that fit a phone, response headers, and what search
// engines are told. Runs against the dev server, so the production-only header (HSTS) is
// covered by a unit test instead.
const RUN = Date.now().toString(36);
const PHONE = { width: 375, height: 667 };

/** True when the page itself scrolls sideways (a wide table inside its own region does not count). */
async function scrollsSideways(page: Page): Promise<boolean> {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
}

test.describe.serial('production readiness', () => {
  let jobId = '';

  test.beforeAll(async ({ browser }) => {
    const admin = await apiAs(browser, 'admin@hiflow.local');
    ({ jobId } = await openJob(admin, `E2E-Tin san sang ${RUN}`, 2));
  });

  test('the careers pages fit a 375 px phone and the form can be used', async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/careers');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await scrollsSideways(page)).toBe(false);

    await page.goto(`/careers/${jobId}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await scrollsSideways(page)).toBe(false);

    // every field and the button are reachable and big enough to touch (WCAG 2.5.8: 24 px)
    for (const field of [
      page.getByLabel(/^Họ và tên/),
      page.getByLabel(/^Email/),
      page.getByLabel(/^Số điện thoại/),
      page.getByRole('checkbox'),
      page.getByRole('button', { name: 'Gửi hồ sơ' }),
    ]) {
      await field.scrollIntoViewIfNeeded();
      const box = await field.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(16);
      expect(box!.width).toBeGreaterThanOrEqual(16);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(PHONE.width);
    }
    const submit = await page
      .getByRole('button', { name: 'Gửi hồ sơ' })
      .boundingBox();
    expect(submit!.height).toBeGreaterThanOrEqual(24);

    await page.goto(`/careers/${jobId}/thanks`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await scrollsSideways(page)).toBe(false);
    await page.goto('/careers/00000000-0000-4000-8000-000000000000');
    await expect(page.getByText('Tin này không còn nhận hồ sơ')).toBeVisible();
    expect(await scrollsSideways(page)).toBe(false);
  });

  test('the sign-in page and the staff lists do not make the page scroll sideways on a phone', async ({
    browser,
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Đăng nhập' })).toBeVisible();
    expect(await scrollsSideways(page)).toBe(false);

    const staff = await openAs(browser, 'admin@hiflow.local');
    await staff.setViewportSize(PHONE);
    for (const path of [
      '/',
      '/applications',
      '/requisitions',
      '/jobs',
      '/candidates',
      '/users',
    ]) {
      await staff.goto(path);
      await expect(
        staff.getByRole('heading', { level: 1 }).first(),
      ).toBeVisible();
      await staff.waitForLoadState('networkidle');
      expect(await scrollsSideways(staff), `${path} scrolls sideways`).toBe(
        false,
      );
    }
    await staff.context().close();
  });

  test('responses carry the security headers and do not name the framework', async ({
    request,
  }) => {
    for (const path of ['/login', '/careers', '/robots.txt']) {
      const response = await request.get(path);
      const headers = response.headers();
      expect(headers['x-frame-options'], path).toBe('DENY');
      expect(headers['x-content-type-options'], path).toBe('nosniff');
      expect(headers['referrer-policy'], path).toBe(
        'strict-origin-when-cross-origin',
      );
      expect(headers['content-security-policy'], path).toContain(
        "frame-ancestors 'none'",
      );
      expect(headers['permissions-policy'], path).toContain('camera=()');
      expect(headers['x-powered-by'], path).toBeUndefined();
    }
  });

  test('search engines may read the job board and nothing else', async ({
    request,
  }) => {
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('Allow: /careers');
    expect(robots).toMatch(/Disallow: \/\s/);
    expect(robots).toContain('Sitemap: ');

    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).toContain('/careers</loc>');
    expect(sitemap).toContain(jobId);
  });

  test('a job page names itself for search engines with an absolute address', async ({
    page,
  }) => {
    await page.goto(`/careers/${jobId}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const canonical = new URL(page.url()).pathname;
    expect(canonical).toMatch(new RegExp(`${jobId}$`));

    const ld = JSON.parse(
      await page
        .locator('script[type="application/ld+json"]')
        .first()
        .innerText(),
    ) as { '@type': string; url: string; title: string };
    expect(ld['@type']).toBe('JobPosting');
    expect(ld.url).toMatch(/^https?:\/\//);
    expect(ld.url).toContain(canonical);
    expect(
      await page.locator('link[rel="canonical"]').getAttribute('href'),
    ).toMatch(new RegExp(`${canonical}$`));
  });
});
