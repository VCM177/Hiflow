import { expect, test, type APIRequestContext } from '@playwright/test';

import { apiAs, json, openAs, openJob } from './helpers';

// Runs against a real API seeded with `seed:base`. It follows two applications of one job:
// A goes screening → interview → offer → hired through the browser; B reaches the offer step
// through the API and the candidate declines in the browser. Nothing here can be deleted
// through the API once it has moved (only a new application can), so the job, the
// requisition and the applications stay with E2E- names; candidate B is anonymised.
const RUN = Date.now().toString(36);
const JOB = `E2E-Tin ho so ${RUN}`;
const NAME_A = `E2E-Ung vien A ${RUN}`;
const NAME_B = `E2E-Ung vien B ${RUN}`;

const pad = (n: number) => String(n).padStart(2, '0');
/** A local date-time text a few days ahead, at a different hour each run, for the datetime box. */
function futureSlot(): string {
  const date = new Date(Date.now() + (3 + (Date.now() % 20)) * 86_400_000);
  const hour = 8 + (Date.now() % 9);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(hour)}:00`;
}
const dayAhead = (days: number) => {
  const date = new Date(Date.now() + days * 86_400_000);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

async function newCandidate(
  recruiter: APIRequestContext,
  name: string,
  label: string,
) {
  return json<{ id: string }>(recruiter, 'post', '/candidates', {
    fullName: name,
    email: `e2e-app-${RUN}-${label}@example.com`,
    phone: '0901234567',
  });
}

test.describe.serial('applications', () => {
  let jobId = '';
  let candidateA = '';
  let candidateB = '';
  let applicationA = '';
  let applicationB = '';

  test.beforeAll(async ({ browser }) => {
    const admin = await apiAs(browser, 'admin@hiflow.local');
    const manager = await apiAs(browser, 'manager@hiflow.local');
    const me = await json<{ user: { departmentId: string } }>(
      manager,
      'get',
      '/auth/me',
    ).catch(async () => ({
      user: await json<{ departmentId: string }>(manager, 'get', '/auth/me'),
    }));
    const departmentId =
      'user' in me && me.user
        ? me.user.departmentId
        : (me as unknown as { departmentId: string }).departmentId;
    ({ jobId } = await openJob(admin, JOB, 3, departmentId));
    const recruiter = await apiAs(browser, 'recruiter@hiflow.local');
    candidateA = (await newCandidate(recruiter, NAME_A, 'a')).id;
    candidateB = (await newCandidate(recruiter, NAME_B, 'b')).id;
  });

  test('a recruiter adds A, a duplicate is refused, then moves A to the interview step', async ({
    browser,
  }) => {
    const page = await openAs(browser, 'recruiter@hiflow.local');
    await page.goto('/applications');
    for (const attempt of [1, 2]) {
      await page.getByRole('button', { name: 'Thêm hồ sơ' }).first().click();
      const dialog = page.getByRole('dialog', { name: 'Thêm hồ sơ ứng tuyển' });
      await dialog.getByLabel('Tìm ứng viên').fill(NAME_A);
      await dialog.getByRole('combobox', { name: /Ứng viên/ }).click();
      await page.getByRole('option', { name: new RegExp(NAME_A) }).click();
      await dialog.getByRole('combobox', { name: /Tin tuyển dụng/ }).click();
      await page.getByRole('option', { name: JOB }).click();
      await dialog.getByRole('button', { name: 'Thêm hồ sơ' }).click();
      if (attempt === 1) {
        await expect(page).toHaveURL(/\/applications\/[0-9a-f-]{36}$/);
        applicationA = new URL(page.url()).pathname.split('/').pop() ?? '';
        await page.goto('/applications');
      } else {
        await expect(
          dialog.getByText('Ứng viên đã nộp hồ sơ vào tin này'),
        ).toBeVisible();
        await dialog.getByRole('button', { name: 'Hủy' }).click();
      }
    }

    await page.goto(`/applications/${applicationA}`);
    await expect(
      page.getByRole('heading', { level: 1, name: NAME_A }),
    ).toBeVisible();
    await expect(page.getByText('Mới').first()).toBeVisible();
    // Nhận việc is never a button
    await expect(page.getByRole('button', { name: /Nhận việc/ })).toHaveCount(
      0,
    );

    await page.getByRole('button', { name: 'Chuyển sang Sàng lọc' }).click();
    await expect(page.getByText('Sàng lọc').first()).toBeVisible();
    await page.getByRole('button', { name: 'Chuyển sang Phỏng vấn' }).click();
    await expect(page.getByText('Phỏng vấn').first()).toBeVisible();
    // no round yet: the offer step says why it is locked
    await expect(
      page.getByRole('button', { name: 'Chuyển sang Đề nghị' }),
    ).toBeDisabled();

    // book a round
    await page.getByRole('tab', { name: 'Phỏng vấn' }).click();
    await page.getByRole('button', { name: 'Đặt lịch' }).click();
    const book = page.getByRole('dialog', { name: 'Đặt lịch phỏng vấn' });
    await book.getByLabel(/^Ngày giờ/).fill('2020-01-01T09:00');
    await book.getByRole('combobox', { name: /Người phỏng vấn/ }).click();
    await page.getByRole('option').first().click();
    await book.getByRole('button', { name: 'Đặt lịch' }).click();
    await expect(
      book.getByText('Thời gian phỏng vấn phải ở tương lai.'),
    ).toBeVisible();
    await book.getByLabel(/^Ngày giờ/).fill(futureSlot());
    await book.getByRole('button', { name: 'Đặt lịch' }).click();
    await expect(book).toBeHidden();
    await expect(page.getByText(/Vòng 1/)).toBeVisible();
    await expect(page.getByText('Chờ kết quả', { exact: true })).toBeVisible();
    // while a round waits there is no second booking, and the offer step stays locked
    await expect(page.getByRole('button', { name: 'Đặt lịch' })).toHaveCount(0);
    await page.getByRole('tab', { name: 'Tiến trình' }).click();
    await expect(
      page.getByRole('button', { name: 'Chuyển sang Đề nghị' }),
    ).toBeDisabled();
    await page.context().close();
  });

  test('after the interviewer passes the round, the offer is made and accepted', async ({
    browser,
  }) => {
    const recruiterApi = await apiAs(browser, 'recruiter@hiflow.local');
    const rounds = await json<{ items: { id: string }[] }>(
      recruiterApi,
      'get',
      `/interviews?applicationId=${applicationA}`,
    );
    const interviewerApi = await apiAs(browser, 'interviewer@hiflow.local');
    await json(
      interviewerApi,
      'post',
      `/interviews/${rounds.items[0].id}/result`,
      {
        result: 'PASSED',
      },
    );

    const page = await openAs(browser, 'recruiter@hiflow.local');
    await page.goto(`/applications/${applicationA}`);
    await page.getByRole('button', { name: 'Chuyển sang Đề nghị' }).click();
    await page.getByRole('tab', { name: 'Offer' }).click();
    await page.getByRole('button', { name: 'Tạo đề nghị' }).click();
    const dialog = page.getByRole('dialog', { name: 'Tạo đề nghị' });
    await dialog.getByLabel(/^Lương/).fill('0');
    await dialog.getByLabel(/^Ngày nhận việc/).fill(dayAhead(30));
    await dialog.getByRole('button', { name: 'Tạo đề nghị' }).click();
    await expect(dialog.getByText('Mức lương tối thiểu 1.')).toBeVisible();
    await dialog.getByLabel(/^Lương/).fill('20000000');
    await dialog.getByLabel('Hạn phản hồi').fill(dayAhead(40));
    await dialog.getByRole('button', { name: 'Tạo đề nghị' }).click();
    await expect(
      dialog.getByText('Hạn phản hồi không được sau ngày nhận việc.'),
    ).toBeVisible();
    await dialog.getByLabel('Hạn phản hồi').fill(dayAhead(10));
    await dialog.getByRole('button', { name: 'Tạo đề nghị' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('Chờ phản hồi')).toBeVisible();
    await expect(page.getByText(/20\.000\.000/)).toBeVisible();

    await page.getByRole('button', { name: 'Ứng viên chấp nhận' }).click();
    await page
      .getByRole('dialog', { name: 'Ứng viên chấp nhận đề nghị' })
      .getByRole('button', { name: 'Ghi nhận chấp nhận' })
      .click();
    await expect(page.getByText('Đã chấp nhận')).toBeVisible();
    await expect(page.getByText('Nhận việc').first()).toBeVisible();
    // finished: no more status buttons, and the offer is read only
    await page.getByRole('tab', { name: 'Tiến trình' }).click();
    await expect(
      page.getByRole('button', { name: /Chuyển sang|Ứng viên rút/ }),
    ).toHaveCount(0);
    await page.context().close();
  });

  test('B reaches the offer step; HR sees no Offer tab, a manager no candidate link; the candidate declines', async ({
    browser,
  }) => {
    const recruiterApi = await apiAs(browser, 'recruiter@hiflow.local');
    const created = await json<{ id: string }>(
      recruiterApi,
      'post',
      '/applications',
      {
        candidateId: candidateB,
        jobId,
      },
    );
    applicationB = created.id;
    for (const toStatus of ['SCREENING', 'INTERVIEW']) {
      await json(recruiterApi, 'post', `/applications/${applicationB}/status`, {
        toStatus,
      });
    }
    const interviewers = await json<{ items: { id: string }[] }>(
      recruiterApi,
      'get',
      '/users/options?purpose=INTERVIEWER&limit=1',
    );
    const slot = new Date(Date.now() + (25 + (Date.now() % 20)) * 86_400_000);
    slot.setUTCHours(1 + (Date.now() % 8), 0, 0, 0);
    const interview = await json<{ id: string }>(
      recruiterApi,
      'post',
      '/interviews',
      {
        applicationId: applicationB,
        interviewerId: interviewers.items[0].id,
        scheduledAt: slot.toISOString(),
      },
    );
    const interviewerApi = await apiAs(browser, 'interviewer@hiflow.local');
    await json(interviewerApi, 'post', `/interviews/${interview.id}/result`, {
      result: 'PASSED',
    });
    await json(recruiterApi, 'post', `/applications/${applicationB}/status`, {
      toStatus: 'OFFER',
    });
    await json(recruiterApi, 'post', `/applications/${applicationB}/offer`, {
      salary: 18000000,
      startDate: dayAhead(30),
    });

    const hr = await openAs(browser, 'hr@hiflow.local');
    await hr.goto(`/applications/${applicationB}`);
    await expect(
      hr.getByRole('heading', { level: 1, name: NAME_B }),
    ).toBeVisible();
    await expect(hr.getByRole('tab', { name: 'Offer' })).toHaveCount(0);
    await expect(
      hr.getByRole('button', {
        name: /Chuyển sang|Từ chối hồ sơ|Ứng viên rút/,
      }),
    ).toHaveCount(0);
    await hr.context().close();

    const manager = await openAs(browser, 'manager@hiflow.local');
    await manager.goto(`/applications/${applicationB}`);
    await expect(
      manager.getByRole('heading', { level: 1, name: NAME_B }),
    ).toBeVisible();
    await expect(manager.getByText('0901234567')).toBeVisible();
    await expect(manager.getByRole('link', { name: NAME_B })).toHaveCount(0);
    await manager.context().close();

    const page = await openAs(browser, 'recruiter@hiflow.local');
    await page.goto(`/applications/${applicationB}`);
    await page.getByRole('tab', { name: 'Offer' }).click();
    await page.getByRole('button', { name: 'Ứng viên từ chối' }).click();
    const dialog = page.getByRole('dialog', {
      name: 'Ứng viên từ chối đề nghị',
    });
    await expect(dialog).toContainText('Ứng viên rút');
    await dialog.getByRole('button', { name: 'Ghi nhận từ chối' }).click();
    await expect(page.getByText('Đã từ chối').first()).toBeVisible();
    await expect(page.getByText('Ứng viên rút').first()).toBeVisible();
    await page.context().close();
  });

  test('the list is filterable, HR anonymises B, and the dashboard-style link works', async ({
    browser,
  }) => {
    const page = await openAs(browser, 'recruiter@hiflow.local');
    await page.goto(`/applications?status=OFFER`);
    await expect(
      page.getByRole('combobox', { name: 'Lọc theo trạng thái' }),
    ).toContainText('Đề nghị');
    await page.goto('/applications');
    await page.getByLabel('Tìm hồ sơ').fill(RUN);
    await expect(page.getByRole('row')).toHaveCount(3);
    await page.getByRole('combobox', { name: 'Lọc theo trạng thái' }).click();
    await page.getByRole('option', { name: 'Nhận việc' }).click();
    await expect(page.getByRole('row')).toHaveCount(2);
    await expect(
      page.getByRole('row', { name: new RegExp(NAME_A) }),
    ).toBeVisible();
    await page.context().close();

    // A is hired: its candidate cannot be anonymised; B withdrew: it can
    const hr = await openAs(browser, 'hr@hiflow.local');
    await hr.goto(`/candidates/${candidateA}`);
    await hr.getByRole('button', { name: 'Ẩn danh', exact: true }).click();
    const blocked = hr.getByRole('dialog', { name: 'Ẩn danh ứng viên' });
    await blocked.getByRole('button', { name: 'Ẩn danh ứng viên' }).click();
    await expect(blocked.getByRole('alert')).toBeVisible();
    await blocked.getByRole('button', { name: 'Hủy' }).click();

    await hr.goto(`/candidates/${candidateB}`);
    await hr.getByRole('button', { name: 'Ẩn danh', exact: true }).click();
    await hr
      .getByRole('dialog', { name: 'Ẩn danh ứng viên' })
      .getByRole('button', { name: 'Ẩn danh ứng viên' })
      .click();
    await expect(
      hr.getByRole('status').filter({ hasText: 'đã được ẩn danh' }),
    ).toBeVisible();
    await hr.context().close();
  });
});
