import { expect, test, type Browser, type Page } from '@playwright/test';

// Runs against a real API seeded with `seed:base`. The whole path of a hire's first half:
// a department manager asks, HR rejects then approves, a recruiter writes the job, it goes
// public and is stopped. Records made here are titled E2E-. A published job and an approved
// requisition cannot be deleted through the API (only drafts can), so they are stopped and
// closed and stay in the database with their E2E- title; a separate draft is deleted in the
// browser to cover the delete path.
const PASSWORD = process.env.E2E_PASSWORD ?? 'Hiflow@2026';
const RUN = Date.now().toString(36);
const TITLE = `E2E-Yeu cau ${RUN}`;
const DRAFT_TITLE = `E2E-Nhap ${RUN}`;
const JOB_TITLE = `E2E-Tin ${RUN}`;

async function openAs(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
  });
  const page = await context.newPage();
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu').fill(PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).not.toHaveURL(/login/);
  return page;
}

async function fillRequisition(page: Page, title: string) {
  await page.getByLabel(/^Tiêu đề/).fill(title);
  await page.getByRole('combobox', { name: /Vị trí/ }).click();
  await page.getByRole('option').first().click();
  await page.getByLabel(/^Số lượng/).fill('2');
  await page.getByLabel(/^Lý do tuyển dụng/).fill('Mở rộng đội ngũ');
}

test.describe.serial('requisitions and jobs', () => {
  let requisitionUrl = '';
  let jobUrl = '';
  let jobSlug = '';

  test('a department manager creates a requisition and sends it, HR rejects with a reason', async ({
    browser,
  }) => {
    const manager = await openAs(browser, 'manager@hiflow.local');
    await manager.goto('/requisitions/new');
    // the department is the manager's own: no box for it
    await expect(
      manager.getByRole('combobox', { name: /Phòng ban/ }),
    ).toHaveCount(0);
    await fillRequisition(manager, TITLE);
    await manager.getByRole('button', { name: 'Lưu và gửi duyệt' }).click();
    await expect(manager).toHaveURL(/\/requisitions\/[0-9a-f-]{36}$/);
    requisitionUrl = new URL(manager.url()).pathname;
    await expect(manager.getByText('Chờ duyệt').first()).toBeVisible();
    // a manager cannot approve
    await expect(
      manager.getByRole('button', { name: 'Duyệt yêu cầu' }),
    ).toHaveCount(0);

    const hr = await openAs(browser, 'hr@hiflow.local');
    await hr.goto(requisitionUrl);
    await hr.getByRole('button', { name: 'Từ chối' }).click();
    const dialog = hr.getByRole('dialog', { name: 'Từ chối yêu cầu' });
    await dialog.getByRole('button', { name: 'Từ chối yêu cầu' }).click();
    await expect(dialog.getByText('Vui lòng nhập lý do.')).toBeVisible();
    await dialog.getByRole('textbox').fill('Chưa rõ ngân sách');
    await dialog.getByRole('button', { name: 'Từ chối yêu cầu' }).click();
    await expect(dialog).toBeHidden();

    // the manager sees the reason on top and sends it again
    await manager.goto(requisitionUrl);
    await expect(
      manager.getByRole('alert').filter({ hasText: 'Yêu cầu bị từ chối' }),
    ).toContainText('Chưa rõ ngân sách');
    await manager.getByRole('link', { name: 'Sửa' }).click();
    await manager.getByLabel('Tối thiểu').fill('15000000');
    await manager.getByRole('button', { name: 'Lưu và gửi duyệt' }).click();
    await expect(manager).toHaveURL(requisitionUrl);
    await expect(manager.getByText('Chờ duyệt').first()).toBeVisible();

    // HR approves
    await hr.reload();
    await hr.getByRole('button', { name: 'Duyệt yêu cầu' }).click();
    await hr
      .getByRole('dialog', { name: 'Duyệt yêu cầu' })
      .getByRole('button', { name: 'Duyệt yêu cầu' })
      .click();
    await expect(hr.getByText('Đã duyệt').first()).toBeVisible();
    // the history keeps both decisions
    const history = hr.getByRole('list', { name: 'Lịch sử yêu cầu' });
    await expect(history).toContainText('Từ chối yêu cầu');
    await expect(history).toContainText('Duyệt yêu cầu');
    await manager.context().close();
    await hr.context().close();
  });

  test('a recruiter writes the job, a too-large headcount is refused, then it goes public', async ({
    browser,
    page,
  }) => {
    const recruiter = await openAs(browser, 'recruiter@hiflow.local');
    await recruiter.goto(requisitionUrl);
    await recruiter.getByRole('link', { name: 'Tạo tin tuyển dụng' }).click();
    await expect(recruiter).toHaveURL(/\/jobs\/new\?requisitionId=/);
    // filled from the requisition
    await expect(recruiter.getByLabel(/^Tiêu đề/)).toHaveValue(TITLE);
    await expect(recruiter.getByLabel(/^Số lượng/)).toHaveValue('2');

    await recruiter.getByLabel(/^Tiêu đề/).fill(JOB_TITLE);
    await recruiter.getByLabel(/^Số lượng/).fill('5');
    await recruiter.getByLabel(/^Địa điểm/).fill('Hà Nội');
    await recruiter.getByLabel(/^Lương tối thiểu/).fill('15000000');
    await recruiter.getByLabel(/^Lương tối đa/).fill('25000000');
    const editor = recruiter.getByRole('textbox', { name: 'Mô tả công việc' });
    await editor.click();
    await recruiter.getByRole('button', { name: 'In đậm' }).click();
    await recruiter.keyboard.type('Yêu cầu E2E');
    await recruiter.getByRole('button', { name: 'Tạo tin' }).click();
    // 5 > 2 approved
    await expect(
      recruiter.getByText(/Vượt quá số lượng đã duyệt/),
    ).toBeVisible();
    await expect(recruiter.getByLabel(/^Số lượng/)).toBeFocused();

    await recruiter.getByLabel(/^Số lượng/).fill('2');
    await recruiter.getByRole('button', { name: 'Tạo tin' }).click();
    await expect(recruiter).toHaveURL(/\/jobs\/[0-9a-f-]{36}$/);
    jobUrl = new URL(recruiter.url()).pathname;
    await expect(recruiter.getByText('Nháp').first()).toBeVisible();
    await expect(recruiter.locator('.job-description strong')).toContainText(
      'Yêu cầu E2E',
    );

    // a draft is not public
    const draftPublic = await page.goto(`/careers/${jobUrl.split('/').pop()}`);
    expect(draftPublic?.status()).toBe(404);

    await recruiter.getByRole('button', { name: 'Đăng tin' }).click();
    await recruiter
      .getByRole('dialog', { name: 'Đăng tin' })
      .getByRole('button', { name: 'Đăng tin' })
      .click();
    await expect(recruiter.getByText('Đang tuyển').first()).toBeVisible();

    // public now, with the formatted description
    await page.goto('/careers');
    await page.getByLabel('Tìm vị trí').fill(JOB_TITLE);
    await page.getByRole('button', { name: 'Tìm' }).click();
    await page.getByRole('link', { name: JOB_TITLE }).click();
    await expect(page).toHaveURL(/\/careers\/.+-[0-9a-f-]{36}$/);
    jobSlug = new URL(page.url()).pathname;
    await expect(
      page.getByRole('heading', { level: 1, name: JOB_TITLE }),
    ).toBeVisible();
    await expect(page.locator('.job-description strong')).toContainText(
      'Yêu cầu E2E',
    );
    await recruiter.context().close();
  });

  test('the requisition page lists the job, and stopping the job closes the public page', async ({
    browser,
    page,
  }) => {
    const hr = await openAs(browser, 'hr@hiflow.local');
    await hr.goto(requisitionUrl);
    await expect(hr.getByRole('link', { name: JOB_TITLE })).toBeVisible();

    const recruiter = await openAs(browser, 'recruiter@hiflow.local');
    await recruiter.goto(jobUrl);
    await recruiter.getByRole('button', { name: 'Ngừng đăng' }).click();
    const dialog = recruiter.getByRole('dialog', { name: 'Ngừng đăng tin' });
    await expect(dialog).toContainText('không còn nhận hồ sơ');
    await dialog.getByRole('button', { name: 'Ngừng đăng' }).click();
    await expect(recruiter.getByText('Đã đóng').first()).toBeVisible();
    // a closed job offers no edit
    await expect(recruiter.getByRole('link', { name: 'Sửa' })).toHaveCount(0);

    const gone = await page.goto(jobSlug);
    expect(gone?.status()).toBe(404);

    // closing the requisition (the jobs are already closed)
    await hr.reload();
    await hr.getByRole('button', { name: 'Đóng yêu cầu' }).click();
    const close = hr.getByRole('dialog', { name: 'Đóng yêu cầu' });
    await expect(close).toContainText('tự động đóng');
    await close.getByRole('button', { name: 'Đóng yêu cầu' }).click();
    await expect(hr.getByText('Đã đóng').first()).toBeVisible();
    await expect(hr.getByRole('button', { name: 'Đóng yêu cầu' })).toHaveCount(
      0,
    );
    await hr.context().close();
    await recruiter.context().close();
  });

  test('a draft is deleted after confirmation, and lists find and filter requisitions', async ({
    browser,
  }) => {
    const manager = await openAs(browser, 'manager@hiflow.local');
    await manager.goto('/requisitions/new');
    await fillRequisition(manager, DRAFT_TITLE);
    await manager.getByRole('button', { name: 'Lưu nháp' }).click();
    await expect(manager).toHaveURL(/\/requisitions\/[0-9a-f-]{36}$/);
    await expect(manager.getByText('Nháp').first()).toBeVisible();

    await manager.goto('/requisitions');
    await manager.getByLabel('Tìm yêu cầu').fill(RUN);
    await expect(manager.getByRole('row')).toHaveCount(3);
    await manager
      .getByRole('combobox', { name: 'Lọc theo trạng thái' })
      .click();
    await manager.getByRole('option', { name: 'Nháp' }).click();
    await expect(
      manager.getByRole('row', { name: new RegExp(DRAFT_TITLE) }),
    ).toBeVisible();
    await expect(manager.getByRole('row')).toHaveCount(2);

    await manager
      .getByRole('row', { name: new RegExp(DRAFT_TITLE) })
      .getByRole('link')
      .first()
      .click();
    await expect(manager).toHaveURL(/\/requisitions\/[0-9a-f-]{36}$/);
    await manager.getByRole('button', { name: 'Xóa', exact: true }).click();
    await manager
      .getByRole('dialog', { name: 'Xóa yêu cầu' })
      .getByRole('button', { name: 'Xóa yêu cầu' })
      .click();
    await expect(manager).toHaveURL('/requisitions');
    await manager.getByLabel('Tìm yêu cầu').fill(DRAFT_TITLE);
    await expect(manager.getByText('Không có kết quả')).toBeVisible();
    await manager.context().close();
  });

  test('a recruiter cannot create a requisition, an interviewer has no jobs page', async ({
    browser,
  }) => {
    const recruiter = await openAs(browser, 'recruiter@hiflow.local');
    await recruiter.goto('/requisitions/new');
    await expect(recruiter.getByText('Không có quyền truy cập')).toBeVisible();
    await recruiter.context().close();
    const interviewer = await openAs(browser, 'interviewer@hiflow.local');
    await interviewer.goto('/jobs');
    await expect(
      interviewer.getByText('Không có quyền truy cập'),
    ).toBeVisible();
    await interviewer.context().close();
  });
});
