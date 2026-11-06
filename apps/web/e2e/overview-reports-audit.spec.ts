import { expect, test } from '@playwright/test';

import { apiAs, json, openAs, openJob } from './helpers';

// Runs against a real API seeded with `seed:base`. It makes one job, one candidate whose name
// is hostile text, and one unassigned application, then looks at them from the overview, the
// reports and the audit trail. The unassigned application and the candidate are removed at the
// end; the job (published) and its requisition stay with E2E- names.
const RUN = Date.now().toString(36);
const JOB = `E2E-Tin tong quan ${RUN}`;
const HOSTILE = `E2E-<b>in dam</b><img src=x onerror="window.__xss=1"> ${RUN}`;

test.describe.serial('overview, reports and audit', () => {
  let candidateId = '';
  let applicationId = '';

  test.beforeAll(async ({ browser }) => {
    const admin = await apiAs(browser, 'admin@hiflow.local');
    const { jobId } = await openJob(admin, JOB, 3);
    const candidate = await json<{ id: string }>(admin, 'post', '/candidates', {
      fullName: HOSTILE,
      email: `e2e-overview-${RUN}@example.com`,
    });
    candidateId = candidate.id;
    // no assignee: it lands in the "not assigned" to-do of HR
    const application = await json<{ id: string }>(
      admin,
      'post',
      '/applications',
      {
        candidateId,
        jobId,
      },
    );
    applicationId = application.id;
  });

  test.afterAll(async ({ browser }) => {
    const admin = await apiAs(browser, 'admin@hiflow.local');
    await admin.delete(`/api/applications/${applicationId}`);
    await admin.delete(`/api/candidates/${candidateId}`);
  });

  test('HR sees the numbers, the funnel and a to-do that opens the filtered list', async ({
    browser,
  }) => {
    const page = await openAs(browser, 'hr@hiflow.local');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Tổng quan' }),
    ).toBeVisible();
    for (const label of [
      'Yêu cầu chờ duyệt',
      'Tin đang tuyển',
      'Hồ sơ mới',
      'Phỏng vấn sắp tới',
      'Đã nhận việc trong kỳ',
    ]) {
      await expect(
        page.getByText(label, { exact: true }).first(),
      ).toBeVisible();
    }
    const funnel = page.getByRole('list', { name: 'Phễu tuyển dụng' });
    await expect(funnel.getByRole('listitem')).toHaveCount(5);

    // the same figures as a table
    await page.getByRole('button', { name: 'Xem dạng bảng' }).click();
    await expect(
      page.getByRole('table', { name: 'Phễu tuyển dụng' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Xem dạng biểu đồ' }).click();

    // HR's work is approving: the to-do opens the requisitions waiting for them
    await page
      .getByRole('link', { name: 'Yêu cầu tuyển dụng chờ duyệt' })
      .click();
    await expect(page).toHaveURL(/\/requisitions\?status=PENDING_APPROVAL$/);
    await expect(
      page.getByRole('combobox', { name: 'Lọc theo trạng thái' }),
    ).toContainText('Chờ duyệt');
    await page.context().close();
  });

  test('the recruiter’s to-do opens the unassigned applications', async ({
    browser,
  }) => {
    const page = await openAs(browser, 'recruiter@hiflow.local');
    await page
      .getByRole('link', { name: 'Hồ sơ mới chưa có người phụ trách' })
      .click();
    await expect(page).toHaveURL(/\/applications\?status=NEW$/);
    await expect(
      page.getByRole('combobox', { name: 'Lọc theo trạng thái' }),
    ).toContainText('Mới');
    await page.getByLabel('Tìm hồ sơ').fill(JOB);
    // the application made in beforeAll, with the hostile name drawn as text
    const line = page.getByRole('row', { name: new RegExp(JOB) });
    await expect(line).toHaveCount(1);
    await expect(line).toContainText('<b>in dam</b>');
    await page.context().close();
  });

  test('the period is chosen in the page, shared in the address, and a year-long limit is told in place', async ({
    browser,
  }) => {
    const page = await openAs(browser, 'hr@hiflow.local');
    await page.getByLabel('Từ ngày').fill('2026-10-01');
    await page.getByLabel('Đến ngày').fill('2026-10-31');
    await expect(page).toHaveURL(/from=2026-10-01/);
    await expect(
      page.getByText(/Kỳ 01\/10\/2026 – 31\/10\/2026/),
    ).toBeVisible();

    await page.getByLabel('Từ ngày').fill('2020-01-01');
    await expect(
      page.getByText(/Khoảng thời gian tối đa là 366 ngày/),
    ).toBeVisible();
    // the filters are still there to fix it
    await expect(page.getByLabel('Từ ngày')).toBeVisible();
    await page.getByRole('button', { name: 'Về 30 ngày gần nhất' }).click();
    await expect(
      page.getByRole('list', { name: 'Phễu tuyển dụng' }),
    ).toBeVisible();
    await page.context().close();
  });

  test('a department manager has no department filter; an interviewer has no overview', async ({
    browser,
  }) => {
    const manager = await openAs(browser, 'manager@hiflow.local');
    await expect(
      manager.getByRole('heading', { level: 1, name: 'Tổng quan' }),
    ).toBeVisible();
    await expect(
      manager.getByRole('list', { name: 'Phễu tuyển dụng' }),
    ).toBeVisible();
    await expect(
      manager.getByRole('combobox', { name: 'Lọc theo phòng ban' }),
    ).toHaveCount(0);
    await manager.context().close();

    const interviewer = await openAs(browser, 'interviewer@hiflow.local');
    await interviewer.goto('/');
    await expect(
      interviewer.getByText('Không có quyền truy cập'),
    ).toBeVisible();
    await interviewer.context().close();
  });

  test('HR reads the reports, moves between tabs, and downloads a CSV', async ({
    browser,
  }) => {
    const page = await openAs(browser, 'hr@hiflow.local');
    await page.goto('/reports');
    await expect(page).toHaveURL('/reports/requisition-progress');
    await expect(
      page.getByRole('tab', { name: 'Tiến độ yêu cầu' }),
    ).toHaveAttribute('aria-selected', 'true');
    await expect(
      page.getByRole('table').getByRole('columnheader').first(),
    ).toBeVisible();

    await page.getByLabel('Từ ngày').fill('2026-10-01');
    await page.getByRole('tab', { name: 'Nguồn ứng viên' }).click();
    await expect(page).toHaveURL(
      /\/reports\/candidate-sources\?from=2026-10-01/,
    );
    await expect(page.getByLabel('Từ ngày')).toHaveValue('2026-10-01');

    await page.getByRole('tab', { name: 'Kết quả theo tin' }).click();
    await expect(page).toHaveURL(/\/reports\/job-results/);
    await expect(page.getByText(/ghi vào nhật ký kiểm toán/)).toBeVisible();
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Xuất CSV' }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
    await expect(page.getByText(/^Đã tải .*\.csv$/)).toBeVisible();
    await page.context().close();
  });

  test('reports are for HR and Admin only', async ({ browser }) => {
    for (const email of [
      'recruiter@hiflow.local',
      'manager@hiflow.local',
      'interviewer@hiflow.local',
    ]) {
      const page = await openAs(browser, email);
      await page.goto('/reports/job-results');
      await expect(page.getByText('Không có quyền truy cập')).toBeVisible();
      await page.context().close();
    }
    const missing = await openAs(browser, 'hr@hiflow.local');
    await missing.goto('/reports/khong-co');
    await expect(missing.getByText('Không tìm thấy trang')).toBeVisible();
    await missing.context().close();
  });

  test('the admin finds an event, reads its row changes, and hostile text stays text', async ({
    browser,
  }) => {
    const page = await openAs(browser, 'admin@hiflow.local');
    await page.goto(
      `/audit-events?event=CANDIDATE_CREATED&entityId=${candidateId}`,
    );
    await expect(
      page.getByRole('combobox', { name: 'Lọc theo sự kiện' }),
    ).toContainText('Tạo ứng viên');
    const row = page.getByRole('row', { name: /Tạo ứng viên/ });
    await expect(row).toHaveCount(1);
    await row.getByRole('link').first().click();
    await expect(page).toHaveURL(/\/audit-events\/[0-9a-f-]{36}$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Tạo ứng viên' }),
    ).toBeVisible();
    await expect(page.getByText(/Quản trị|Admin/).first()).toBeVisible();

    const changes = page.getByRole('list', { name: 'Thay đổi dòng' });
    await expect(changes).toContainText('Thêm dòng');
    await expect(changes).toContainText('candidates');
    // the name is shown character by character, tags and all
    await expect(changes).toContainText('<b>in dam</b>');
    expect(await page.locator('main img, main b').count()).toBe(0);
    expect(await page.evaluate(() => 'window.__xss' in window)).toBe(false);
    await page.context().close();
  });

  test('a published job shows its status change as old → new', async ({
    browser,
  }) => {
    const page = await openAs(browser, 'admin@hiflow.local');
    await page.goto('/audit-events?event=JOB_PUBLISHED');
    await page
      .getByRole('row', { name: /Đăng tin tuyển dụng/ })
      .first()
      .getByRole('link')
      .first()
      .click();
    const changes = page.getByRole('list', { name: 'Thay đổi dòng' });
    await expect(changes).toContainText('Sửa dòng');
    await expect(changes).toContainText('DRAFT');
    await expect(changes).toContainText('→');
    await expect(changes).toContainText('OPEN');
    await page.context().close();
  });

  test('the admin filters, exports the trail, and nobody else can open it', async ({
    browser,
  }) => {
    const page = await openAs(browser, 'admin@hiflow.local');
    await page.goto('/audit-events');
    await expect(
      page.getByText(/chứa dữ liệu cá nhân, chỉ Admin được đọc/),
    ).toBeVisible();
    await expect(page.getByText(/tối đa 10\.000 dòng/)).toBeVisible();
    await page.getByRole('combobox', { name: 'Lọc theo nguồn' }).click();
    await page.getByRole('option', { name: 'Ứng dụng' }).click();
    await expect(page).toHaveURL(/origin=app/);
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Xuất CSV' }).click();
    expect((await downloading).suggestedFilename()).toMatch(/\.csv$/);
    await page.context().close();

    for (const email of ['hr@hiflow.local', 'recruiter@hiflow.local']) {
      const other = await openAs(browser, email);
      await other.goto('/audit-events');
      await expect(other.getByText('Không có quyền truy cập')).toBeVisible();
      await other.context().close();
    }
  });
});
