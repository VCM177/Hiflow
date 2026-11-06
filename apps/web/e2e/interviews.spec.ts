import { expect, test, type APIRequestContext } from '@playwright/test';

import { apiAs, json, openAs, openJob, randomFutureHour } from './helpers';

// Runs against a real API seeded with `seed:base`. Two applications of one job get
// interviews; nothing here can be removed through the API once it has moved, so the job,
// the requisition, the applications and the candidates stay with E2E- names.
const RUN = Date.now().toString(36);
const JOB = `E2E-Tin phong van ${RUN}`;
const NAME_1 = `E2E-PV mot ${RUN}`;
const NAME_2 = `E2E-PV hai ${RUN}`;
const NAME_3 = `E2E-PV ba ${RUN}`;

// Far ahead and random, so earlier runs' interviews (which stay) never clash with these.
const BASE = randomFutureHour().getTime();
const slot = (n: number, minutes = 0) =>
  new Date(BASE + n * 3 * 3_600_000 + minutes * 60_000).toISOString();
/** The same instant as the text a datetime box takes, in Vietnam time. */
const local = (iso: string) =>
  new Date(new Date(iso).getTime() + 7 * 3_600_000).toISOString().slice(0, 16);

/** How the page writes an instant: dd/MM/yyyy HH:mm in Vietnam time. */
const shown = (iso: string) => {
  const [date, time] = local(iso).split('T');
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y} ${time}`;
};

async function userId(admin: APIRequestContext, email: string) {
  const list = await json<{ items: { id: string; email: string }[] }>(
    admin,
    'get',
    `/users?search=${encodeURIComponent(email)}&limit=5`,
  );
  return list.items.find((user) => user.email === email)!.id;
}

async function interviewing(
  recruiter: APIRequestContext,
  jobId: string,
  name: string,
  label: string,
) {
  const candidate = await json<{ id: string }>(
    recruiter,
    'post',
    '/candidates',
    {
      fullName: name,
      email: `e2e-int-${RUN}-${label}@example.com`,
      phone: '0901234567',
    },
  );
  const application = await json<{ id: string }>(
    recruiter,
    'post',
    '/applications',
    {
      candidateId: candidate.id,
      jobId,
    },
  );
  for (const toStatus of ['SCREENING', 'INTERVIEW']) {
    await json(recruiter, 'post', `/applications/${application.id}/status`, {
      toStatus,
    });
  }
  return application.id;
}

test.describe.serial('interviews', () => {
  let recruiter: APIRequestContext;
  let interviewerId = '';
  let hrId = '';
  let app1 = '';
  let app2 = '';
  let app3 = '';
  let interview1 = '';
  let interview2 = '';
  let interview3 = '';

  test.beforeAll(async ({ browser }) => {
    const admin = await apiAs(browser, 'admin@hiflow.local');
    interviewerId = await userId(admin, 'interviewer@hiflow.local');
    hrId = await userId(admin, 'hr@hiflow.local');
    const { jobId } = await openJob(admin, JOB, 5);
    recruiter = await apiAs(browser, 'recruiter@hiflow.local');
    app1 = await interviewing(recruiter, jobId, NAME_1, '1');
    app2 = await interviewing(recruiter, jobId, NAME_2, '2');
    app3 = await interviewing(recruiter, jobId, NAME_3, '3');
    const book = (applicationId: string, who: string, at: string) =>
      json<{ id: string }>(recruiter, 'post', '/interviews', {
        applicationId,
        interviewerId: who,
        scheduledAt: at,
      });
    interview1 = (await book(app1, interviewerId, slot(0))).id;
    interview2 = (await book(app2, interviewerId, slot(1))).id;
    // an interview that belongs to HR, not to the interviewer
    interview3 = (await book(app3, hrId, slot(2))).id;
  });

  test('the interviewer lands on their pending list, sees only their own, and records a failed round', async ({
    browser,
  }) => {
    const page = await openAs(browser, 'interviewer@hiflow.local');
    await page.goto('/interviews?result=PENDING');
    await expect(
      page.getByRole('combobox', { name: 'Lọc theo kết quả' }),
    ).toContainText('Chờ kết quả');
    await page.getByLabel('Tìm lịch phỏng vấn').fill(RUN);
    await expect(
      page.getByRole('row', { name: new RegExp(NAME_1) }),
    ).toBeVisible();
    await expect(
      page.getByRole('row', { name: new RegExp(NAME_2) }),
    ).toBeVisible();
    // HR's interview is not theirs
    await expect(
      page.getByRole('row', { name: new RegExp(NAME_3) }),
    ).toHaveCount(0);
    await page.goto(`/interviews/${interview3}`);
    await expect(page.getByText('Không tìm thấy trang')).toBeVisible();

    await page.goto(`/interviews/${interview1}`);
    await expect(
      page.getByRole('heading', { level: 1, name: new RegExp(NAME_1) }),
    ).toBeVisible();
    // an interviewer cannot move or cancel the schedule
    await expect(
      page.getByRole('button', { name: /Sửa lịch|Hủy lịch/ }),
    ).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Tải CV/ })).toHaveCount(0);
    await expect(page.getByText('0901234567')).toBeVisible();
    await expect(
      page.getByText(/chỉ hiện với vai trò được xem tin tuyển dụng/),
    ).toBeVisible();

    await page.getByRole('combobox', { name: /Kết quả/ }).click();
    await page.getByRole('option', { name: 'Không đạt' }).click();
    await page.getByRole('button', { name: 'Ghi kết quả' }).click();
    await expect(
      page.getByText('Vui lòng nhập nhận xét khi không đạt.'),
    ).toBeVisible();
    await page.getByLabel(/^Nhận xét/).fill('Thiếu kinh nghiệm thực tế');
    await page.getByRole('button', { name: 'Ghi kết quả' }).click();
    const confirm = page.getByRole('dialog', { name: 'Ghi kết quả phỏng vấn' });
    await expect(confirm).toContainText('không thể thay đổi');
    await confirm.getByRole('button', { name: 'Ghi kết quả' }).click();
    await expect(page.getByText('Thiếu kinh nghiệm thực tế')).toBeVisible();
    await expect(page.getByRole('combobox', { name: /Kết quả/ })).toHaveCount(
      0,
    );

    // the application still cannot go to Đề nghị: no round passed
    await page.context().close();
    const staff = await openAs(browser, 'recruiter@hiflow.local');
    await staff.goto(`/applications/${app1}`);
    await expect(
      staff.getByRole('button', { name: 'Chuyển sang Đề nghị' }),
    ).toBeDisabled();
    await staff.getByRole('tab', { name: 'Phỏng vấn' }).click();
    await staff.getByRole('link', { name: /Vòng 1/ }).click();
    await expect(staff).toHaveURL(`/interviews/${interview1}`);
    await expect(staff.getByText('Không đạt').first()).toBeVisible();
    await staff.context().close();
  });

  test('the recruiter is told about a clash inside the dialog, moves the schedule, then cancels', async ({
    browser,
  }) => {
    const page = await openAs(browser, 'recruiter@hiflow.local');
    await page.goto(`/interviews/${interview2}`);
    await page.getByRole('button', { name: 'Sửa lịch' }).click();
    const dialog = page.getByRole('dialog', { name: 'Sửa lịch phỏng vấn' });
    await expect(dialog.getByLabel(/^Ngày giờ/)).toHaveValue(local(slot(1)));

    // 20 minutes after interview 1 (the failed one still blocks its interviewer): refused
    await dialog.getByLabel(/^Ngày giờ/).fill(local(slot(0, 20)));
    await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(
      dialog.getByText('Người phỏng vấn đã có lịch trong khung giờ này'),
    ).toBeVisible();
    // a time in the past is refused before anything is sent
    await dialog.getByLabel(/^Ngày giờ/).fill('2020-01-01T09:00');
    await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(
      dialog.getByText('Thời gian phỏng vấn phải ở tương lai.'),
    ).toBeVisible();

    await dialog.getByLabel(/^Ngày giờ/).fill(local(slot(5)));
    await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(shown(slot(5)))).toBeVisible();

    await page.getByRole('button', { name: 'Hủy lịch' }).click();
    const confirm = page.getByRole('dialog', { name: 'Hủy lịch phỏng vấn' });
    await confirm.getByRole('button', { name: 'Hủy lịch' }).click();
    await expect(page.getByText('Đã hủy').first()).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Sửa lịch|Hủy lịch/ }),
    ).toHaveCount(0);

    // after the cancellation the application can be booked again
    await page.goto(`/applications/${app2}`);
    await page.getByRole('tab', { name: 'Phỏng vấn' }).click();
    await expect(page.getByRole('button', { name: 'Đặt lịch' })).toBeVisible();
    await page.context().close();
  });

  test('HR sees every interview but only decides their own', async ({
    browser,
  }) => {
    const page = await openAs(browser, 'hr@hiflow.local');
    await page.goto(`/interviews/${interview1}`);
    await expect(
      page.getByRole('heading', { level: 1, name: new RegExp(NAME_1) }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Sửa lịch|Hủy lịch/ }),
    ).toHaveCount(0);

    await page.goto(`/interviews/${interview3}`);
    await expect(
      page.getByRole('heading', { level: 1, name: new RegExp(NAME_3) }),
    ).toBeVisible();
    // their own: the form is there; HR may read job and candidate pages
    await expect(page.getByRole('combobox', { name: /Kết quả/ })).toBeVisible();
    await expect(page.getByText('Mô tả E2E')).toBeVisible();
    await page.context().close();
  });

  test('on a phone the page splits into Kết quả, CV and Tin', async ({
    browser,
  }) => {
    const page = await openAs(browser, 'hr@hiflow.local');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/interviews/${interview3}`);
    await expect(page.getByRole('tab')).toHaveText(['Kết quả', 'CV', 'Tin']);
    await expect(page.getByRole('combobox', { name: /Kết quả/ })).toBeVisible();
    await expect(page.getByText('Mô tả E2E')).toHaveCount(0);
    await page.getByRole('tab', { name: 'Tin' }).click();
    await expect(page.getByText('Mô tả E2E')).toBeVisible();
    await page.getByRole('tab', { name: 'CV' }).click();
    await expect(page.getByText('0901234567')).toBeVisible();
    await page.context().close();
  });

  test('a record that does not exist or is out of scope answers the same page', async ({
    browser,
  }) => {
    const manager = await openAs(browser, 'manager@hiflow.local');
    await manager.goto(`/interviews/${interview1}`);
    await expect(manager.getByText('Không tìm thấy trang')).toBeVisible();
    await manager.goto('/interviews/00000000-0000-4000-8000-000000000000');
    await expect(manager.getByText('Không tìm thấy trang')).toBeVisible();
    await manager.context().close();
  });
});
