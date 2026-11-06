import { expect, test } from '@playwright/test';

import { PDF, apiAs, json, openAs, randomFutureHour } from './helpers';

// The whole path of one hire, through the browser, one role after another (Gate B):
// a manager asks, HR approves, a recruiter writes and publishes the job, a candidate applies
// on the public form, the recruiter screens, books an interview, the interviewer passes it,
// the recruiter makes an offer and records its acceptance, and the admin finds every step in
// the audit trail. A hired application cannot be removed through the API, so the requisition,
// job, application and candidate stay with E2E- names.
const RUN = Date.now().toString(36);
const REQUISITION = `E2E-Vong doi ${RUN}`;
const NAME = `E2E-Ung vien vong doi ${RUN}`;
const EMAIL = `e2e-life-${RUN}@example.com`;

const pad = (n: number) => String(n).padStart(2, '0');
const dayAhead = (days: number) => {
  const date = new Date(Date.now() + days * 86_400_000);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

test.describe.serial('the lifecycle of a hire', () => {
  test.setTimeout(120_000);
  let requisitionUrl = '';
  let jobPublicPath = '';
  let applicationUrl = '';
  let interviewUrl = '';

  test('a manager asks, HR approves', async ({ browser }) => {
    const manager = await openAs(browser, 'manager@hiflow.local');
    await manager.goto('/requisitions/new');
    await manager.getByLabel(/^Tiêu đề/).fill(REQUISITION);
    await manager.getByRole('combobox', { name: /Vị trí/ }).click();
    await manager.getByRole('option').first().click();
    await manager.getByLabel(/^Số lượng/).fill('1');
    await manager.getByRole('button', { name: 'Lưu và gửi duyệt' }).click();
    await expect(manager).toHaveURL(/\/requisitions\/[0-9a-f-]{36}$/);
    requisitionUrl = new URL(manager.url()).pathname;
    await expect(manager.getByText('Chờ duyệt').first()).toBeVisible();
    await manager.context().close();

    const hr = await openAs(browser, 'hr@hiflow.local');
    await hr.goto(requisitionUrl);
    await hr.getByRole('button', { name: 'Duyệt yêu cầu' }).click();
    await hr
      .getByRole('dialog', { name: 'Duyệt yêu cầu' })
      .getByRole('button', { name: 'Duyệt yêu cầu' })
      .click();
    await expect(hr.getByText('Đã duyệt').first()).toBeVisible();
    await hr.context().close();
  });

  test('a recruiter writes and publishes the job', async ({ browser }) => {
    const recruiter = await openAs(browser, 'recruiter@hiflow.local');
    await recruiter.goto(requisitionUrl);
    await recruiter.getByRole('link', { name: 'Tạo tin tuyển dụng' }).click();
    await expect(recruiter.getByLabel(/^Tiêu đề/)).toHaveValue(REQUISITION);
    await recruiter.getByLabel(/^Địa điểm/).fill('Hà Nội');
    await recruiter.getByLabel(/^Lương tối thiểu/).fill('15000000');
    await recruiter.getByLabel(/^Lương tối đa/).fill('25000000');
    await recruiter.getByRole('textbox', { name: 'Mô tả công việc' }).click();
    await recruiter.keyboard.type('Mô tả vòng đời E2E');
    await recruiter.getByRole('button', { name: 'Tạo tin' }).click();
    await expect(recruiter).toHaveURL(/\/jobs\/[0-9a-f-]{36}$/);
    await recruiter.getByRole('button', { name: 'Đăng tin' }).click();
    await recruiter
      .getByRole('dialog', { name: 'Đăng tin' })
      .getByRole('button', { name: 'Đăng tin' })
      .click();
    await expect(recruiter.getByText('Đang tuyển').first()).toBeVisible();
    await recruiter.context().close();
  });

  test('a candidate finds the job and applies on the public form', async ({
    page,
  }) => {
    await page.goto('/careers');
    await page.getByLabel('Tìm vị trí').fill(REQUISITION);
    await page.getByRole('button', { name: 'Tìm' }).click();
    await page.getByRole('link', { name: REQUISITION }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: REQUISITION }),
    ).toBeVisible();
    await expect(page.getByText('Mô tả vòng đời E2E')).toBeVisible();
    jobPublicPath = new URL(page.url()).pathname;

    await page.getByLabel(/^Họ và tên/).fill(NAME);
    await page.getByLabel(/^Email/).fill(EMAIL);
    await page.getByLabel(/^Số điện thoại/).fill('0901234567');
    await page.getByLabel(/^CV/).setInputFiles(PDF);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Gửi hồ sơ' }).click();
    await expect(page).toHaveURL(new RegExp(`${jobPublicPath}/thanks$`));
    await expect(
      page.getByRole('heading', { name: 'Chúng tôi đã nhận hồ sơ của bạn' }),
    ).toBeVisible();
  });

  test('the recruiter screens the application and books an interview', async ({
    browser,
  }) => {
    // the demo interviewer's name, as the person picker shows it
    const admin = await apiAs(browser, 'admin@hiflow.local');
    const found = await json<{ items: { fullName: string; email: string }[] }>(
      admin,
      'get',
      '/users?search=interviewer@hiflow.local&limit=5',
    );
    const interviewerName = found.items.find(
      (user) => user.email === 'interviewer@hiflow.local',
    )!.fullName;
    const recruiter = await openAs(browser, 'recruiter@hiflow.local');
    await recruiter.goto('/applications?status=NEW');
    await recruiter.getByLabel('Tìm hồ sơ').fill(NAME);
    // the list has narrowed to the one application before it is clicked
    await expect(recruiter.getByRole('row')).toHaveCount(2);
    await recruiter
      .getByRole('row', { name: new RegExp(NAME) })
      .getByRole('link')
      .first()
      .click();
    await expect(recruiter).toHaveURL(/\/applications\/[0-9a-f-]{36}$/);
    applicationUrl = new URL(recruiter.url()).pathname;
    await expect(
      recruiter.getByRole('heading', { level: 1, name: NAME }),
    ).toBeVisible();
    // the CV came with the application
    await expect(recruiter.getByRole('link', { name: /Tải CV/ })).toBeVisible();

    await recruiter
      .getByRole('button', { name: 'Chuyển sang Sàng lọc' })
      .click();
    await expect(recruiter.getByText('Sàng lọc').first()).toBeVisible();
    await recruiter
      .getByRole('button', { name: 'Chuyển sang Phỏng vấn' })
      .click();
    await expect(recruiter.getByText('Phỏng vấn').first()).toBeVisible();

    await recruiter.getByRole('tab', { name: 'Phỏng vấn' }).click();
    await recruiter.getByRole('button', { name: 'Đặt lịch' }).click();
    const book = recruiter.getByRole('dialog', { name: 'Đặt lịch phỏng vấn' });
    await book.getByRole('combobox', { name: /Người phỏng vấn/ }).click();
    await recruiter.getByRole('option', { name: interviewerName }).click();
    const slot = new Date(randomFutureHour().getTime() + 7 * 3_600_000)
      .toISOString()
      .slice(0, 16);
    await book.getByLabel(/^Ngày giờ/).fill(slot);
    await book.getByRole('button', { name: 'Đặt lịch' }).click();
    await expect(book).toBeHidden();
    const round = recruiter.getByRole('link', { name: /Vòng 1/ });
    await expect(round).toBeVisible();
    interviewUrl = (await round.getAttribute('href')) ?? '';
    expect(interviewUrl).toMatch(/^\/interviews\/[0-9a-f-]{36}$/);
    await recruiter.context().close();
  });

  test('the interviewer passes the round', async ({ browser }) => {
    const interviewer = await openAs(browser, 'interviewer@hiflow.local');
    await interviewer.goto(interviewUrl);
    await interviewer.getByRole('combobox', { name: /Kết quả/ }).click();
    await interviewer.getByRole('option', { name: 'Đạt', exact: true }).click();
    await interviewer.getByLabel(/^Nhận xét/).fill('Phù hợp vị trí');
    await interviewer.getByRole('button', { name: 'Ghi kết quả' }).click();
    await interviewer
      .getByRole('dialog', { name: 'Ghi kết quả phỏng vấn' })
      .getByRole('button', { name: 'Ghi kết quả' })
      .click();
    await expect(interviewer.getByText('Phù hợp vị trí')).toBeVisible();
    await interviewer.context().close();
  });

  test('the recruiter makes the offer and the candidate accepts', async ({
    browser,
  }) => {
    const recruiter = await openAs(browser, 'recruiter@hiflow.local');
    await recruiter.goto(applicationUrl);
    await recruiter
      .getByRole('button', { name: 'Chuyển sang Đề nghị' })
      .click();
    await recruiter.getByRole('tab', { name: 'Offer' }).click();
    await recruiter.getByRole('button', { name: 'Tạo đề nghị' }).click();
    const offer = recruiter.getByRole('dialog', { name: 'Tạo đề nghị' });
    await offer.getByLabel(/^Lương/).fill('20000000');
    await offer.getByLabel(/^Ngày nhận việc/).fill(dayAhead(30));
    await offer.getByLabel('Hạn phản hồi').fill(dayAhead(10));
    await offer.getByRole('button', { name: 'Tạo đề nghị' }).click();
    await expect(offer).toBeHidden();
    await recruiter.getByRole('button', { name: 'Ứng viên chấp nhận' }).click();
    await recruiter
      .getByRole('dialog', { name: 'Ứng viên chấp nhận đề nghị' })
      .getByRole('button', { name: 'Ghi nhận chấp nhận' })
      .click();
    await expect(recruiter.getByText('Đã chấp nhận')).toBeVisible();
    await expect(recruiter.getByText('Nhận việc').first()).toBeVisible();
    await recruiter.context().close();
  });

  test('the admin finds every step in the audit trail', async ({ browser }) => {
    const applicationId = applicationUrl.split('/').pop();
    const admin = await openAs(browser, 'admin@hiflow.local');

    // the four status changes of the application, newest first
    await admin.goto(
      `/audit-events?event=APPLICATION_STATUS_CHANGED&entityId=${applicationId}`,
    );
    await expect(
      admin.getByRole('row', { name: /Chuyển trạng thái hồ sơ/ }),
    ).toHaveCount(4);

    // the application arrived through the public form
    await admin.goto(
      `/audit-events?event=APPLICATION_SUBMITTED_ONLINE&entityId=${applicationId}`,
    );
    const submitted = admin.getByRole('row', {
      name: /Ứng viên nộp hồ sơ qua website/,
    });
    await expect(submitted).toHaveCount(1);

    // the offer, in words
    await admin.goto('/audit-events?event=OFFER_RESPONSE_RECORDED');
    await expect(
      admin.getByRole('row', { name: /Ghi nhận phản hồi đề nghị/ }).first(),
    ).toBeVisible();

    // and the status change to HIRED shows old → new in the row changes
    await admin.goto(
      `/audit-events?event=APPLICATION_STATUS_CHANGED&entityId=${applicationId}`,
    );
    await admin
      .getByRole('row', { name: /Chuyển trạng thái hồ sơ/ })
      .first()
      .getByRole('link')
      .first()
      .click();
    const changes = admin.getByRole('list', { name: 'Thay đổi dòng' });
    await expect(changes).toContainText('OFFER');
    await expect(changes).toContainText('HIRED');
    await expect(changes).toContainText('→');
    await admin.context().close();
  });
});
