import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { apiAs, json, openAs, openJob, randomFutureHour } from './helpers';

// Automatic WCAG 2.1 A and AA checks (axe-core) on every kind of page, per role. They catch
// what a tool can: contrast, names and labels, roles, landmarks, duplicate ids. They do not
// replace the by-hand pass on keyboard order and focus (docs/gate-b-audit.md).
const RUN = Date.now().toString(36);
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function expectNoViolations(page: Page, label: string) {
  await page.waitForLoadState('networkidle');
  const { violations } = await new AxeBuilder({ page })
    .withTags(TAGS)
    .analyze();
  const summary = violations.map((violation) => ({
    rule: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes
      .slice(0, 3)
      .map((node) => `${node.target.join(' ')} :: ${node.html.slice(0, 120)}`),
  }));
  expect(summary, `${label}: accessibility violations`).toEqual([]);
}

test.describe.serial('accessibility', () => {
  // Each test walks many pages, and the dev server compiles a page the first time it is opened.
  test.setTimeout(180_000);

  let jobId = '';
  let requisitionId = '';
  let candidateId = '';
  let applicationId = '';
  let interviewId = '';

  test.beforeAll(async ({ browser }) => {
    const admin = await apiAs(browser, 'admin@hiflow.local');
    ({ jobId, requisitionId } = await openJob(
      admin,
      `E2E-Tin truy cap ${RUN}`,
      2,
    ));
    const recruiter = await apiAs(browser, 'recruiter@hiflow.local');
    candidateId = (
      await json<{ id: string }>(recruiter, 'post', '/candidates', {
        fullName: `E2E-Truy cap ${RUN}`,
        email: `e2e-a11y-${RUN}@example.com`,
        phone: '0901234567',
      })
    ).id;
    applicationId = (
      await json<{ id: string }>(recruiter, 'post', '/applications', {
        candidateId,
        jobId,
      })
    ).id;
    for (const toStatus of ['SCREENING', 'INTERVIEW']) {
      await json(recruiter, 'post', `/applications/${applicationId}/status`, {
        toStatus,
      });
    }
    const interviewers = await json<{ items: { id: string }[] }>(
      recruiter,
      'get',
      '/users/options?purpose=INTERVIEWER&limit=1',
    );
    interviewId = (
      await json<{ id: string }>(recruiter, 'post', '/interviews', {
        applicationId,
        interviewerId: interviewers.items[0].id,
        scheduledAt: randomFutureHour().toISOString(),
      })
    ).id;
  });

  // Leave no interview waiting: it would block its interviewer's calendar for other suites.
  test.afterAll(async ({ browser }) => {
    const admin = await apiAs(browser, 'admin@hiflow.local');
    await admin.post(`/api/interviews/${interviewId}/cancel`);
  });

  test('the public job board and the sign-in page', async ({
    page,
    browser,
  }) => {
    await page.goto('/careers');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoViolations(page, '/careers');

    await page.goto(`/careers/${jobId}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoViolations(page, 'job page with the application form');

    // the form with every error showing
    await page.getByRole('button', { name: 'Gửi hồ sơ' }).click();
    await expect(page.getByText('Vui lòng nhập email.')).toBeVisible();
    await expectNoViolations(page, 'application form with errors');

    await page.goto(`/careers/${jobId}/thanks`);
    await expectNoViolations(page, 'thank-you page');

    await page.goto('/careers/00000000-0000-4000-8000-000000000000');
    await expect(page.getByText('Tin này không còn nhận hồ sơ')).toBeVisible();
    await expectNoViolations(page, 'job not found');

    await page.goto('/login');
    await expectNoViolations(page, '/login');
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page.getByText('Vui lòng nhập email.')).toBeVisible();
    await expectNoViolations(page, '/login with errors');
    void browser;
  });

  test('the staff pages, as the admin', async ({ browser }) => {
    const page = await openAs(browser, 'admin@hiflow.local');
    const pages: [string, string][] = [
      ['/', 'Tổng quan'],
      ['/requisitions', 'Yêu cầu tuyển dụng'],
      ['/requisitions/new', 'Tạo yêu cầu tuyển dụng'],
      [`/requisitions/${requisitionId}`, 'E2E-Tin truy cap'],
      ['/jobs', 'Tin tuyển dụng'],
      ['/jobs/new', 'Tạo tin tuyển dụng'],
      [`/jobs/${jobId}`, 'E2E-Tin truy cap'],
      ['/candidates', 'Ứng viên'],
      [`/candidates/${candidateId}`, 'E2E-Truy cap'],
      ['/applications', 'Hồ sơ ứng tuyển'],
      [`/applications/${applicationId}`, 'E2E-Truy cap'],
      ['/interviews', 'Lịch phỏng vấn'],
      [`/interviews/${interviewId}`, 'Vòng 1'],
      ['/reports/requisition-progress', 'Báo cáo'],
      ['/reports/job-results', 'Báo cáo'],
      ['/reports/candidate-sources', 'Báo cáo'],
      ['/audit-events', 'Nhật ký kiểm toán'],
      ['/users', 'Người dùng'],
      ['/catalogs/department', 'Danh mục'],
      ['/catalogs/position', 'Danh mục'],
      ['/profile', 'Hồ sơ cá nhân'],
    ];
    for (const [path, heading] of pages) {
      await page.goto(path);
      await expect(
        page.getByRole('heading', { level: 1 }).first(),
      ).toContainText(heading);
      // wait until the data is in, not only the skeleton
      await expect(page.locator('main [aria-busy="true"]')).toHaveCount(0);
      await expectNoViolations(page, path);
    }
    await page.context().close();
  });

  test('dialogs, the editor, the funnel table and the account menu', async ({
    browser,
  }) => {
    const page = await openAs(browser, 'admin@hiflow.local');
    // axe measures contrast mid-fade otherwise; the app itself honours this setting.
    await page.emulateMedia({ reducedMotion: 'reduce' });

    await page.goto('/users');
    await page.getByRole('button', { name: 'Thêm người dùng' }).first().click();
    await expect(
      page.getByRole('dialog', { name: 'Thêm người dùng' }),
    ).toBeVisible();
    await expectNoViolations(page, 'create user dialog');
    await page.keyboard.press('Escape');

    await page.goto('/candidates');
    await page.getByRole('button', { name: 'Thêm ứng viên' }).first().click();
    await expect(
      page.getByRole('dialog', { name: 'Thêm ứng viên' }),
    ).toBeVisible();
    await expectNoViolations(page, 'create candidate dialog');
    await page.keyboard.press('Escape');

    await page.goto(`/jobs/${jobId}/edit`);
    await expect(
      page.getByRole('toolbar', { name: 'Định dạng văn bản' }),
    ).toBeVisible();
    await expectNoViolations(page, 'job form with the rich text editor');

    await page.goto('/');
    await page.getByRole('button', { name: 'Xem dạng bảng' }).click();
    await expectNoViolations(page, 'overview with the funnel as a table');

    await page.getByRole('button', { name: /^Tài khoản của / }).click();
    await expect(
      page.getByRole('menuitem', { name: 'Đăng xuất' }),
    ).toBeVisible();
    await expectNoViolations(page, 'account menu open');
    await page.context().close();
  });

  test('the pages other roles land on', async ({ browser }) => {
    const cases: [string, string[]][] = [
      ['interviewer@hiflow.local', ['/interviews?result=PENDING']],
      ['manager@hiflow.local', ['/', '/requisitions', '/requisitions/new']],
      ['recruiter@hiflow.local', ['/', '/jobs', '/applications']],
      ['hr@hiflow.local', ['/', '/users', '/reports/job-results']],
    ];
    for (const [email, paths] of cases) {
      const page = await openAs(browser, email);
      for (const path of paths) {
        await page.goto(path);
        await expect(
          page.getByRole('heading', { level: 1 }).first(),
        ).toBeVisible();
        await expectNoViolations(page, `${email} ${path}`);
      }
      await page.goto('/audit-events');
      await expect(page.getByText('Không có quyền truy cập')).toBeVisible();
      await expectNoViolations(page, `${email} no-access page`);
      await page.context().close();
    }
  });
});
