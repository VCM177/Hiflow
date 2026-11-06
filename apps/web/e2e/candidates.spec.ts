import { expect, test } from '@playwright/test';

import { PDF, openAs } from './helpers';

// Runs against a real API seeded with `seed:base`. One candidate is made through the
// browser, edited, given a CV and a note, then anonymised by HR; the anonymised row cannot
// be removed through the API, so it stays (its personal data is gone).
const RUN = Date.now().toString(36);
const NAME = `E2E-Ung vien ${RUN}`;
const EMAIL = `e2e-cand-${RUN}@example.com`;

test.describe.serial('candidates', () => {
  let detailUrl = '';

  test('a recruiter adds a candidate, a duplicate email is refused, then edits and manages the CV', async ({
    browser,
  }) => {
    const page = await openAs(browser, 'recruiter@hiflow.local');
    await page.goto('/candidates');
    await page.getByRole('button', { name: 'Thêm ứng viên' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Thêm ứng viên' });
    await dialog.getByLabel(/^Họ và tên/).fill(NAME);
    await dialog.getByLabel(/^Email/).fill(EMAIL);
    await dialog.getByLabel('Số điện thoại').fill('090 123 4567');
    await dialog.getByLabel('Ngày sinh').fill('1995-05-20');
    await dialog.getByRole('combobox', { name: /Nguồn/ }).click();
    await page.getByRole('option', { name: 'Giới thiệu' }).click();
    await dialog.getByRole('button', { name: 'Thêm ứng viên' }).click();
    await expect(page).toHaveURL(/\/candidates\/[0-9a-f-]{36}$/);
    detailUrl = new URL(page.url()).pathname;
    await expect(
      page.getByRole('heading', { level: 1, name: NAME }),
    ).toBeVisible();
    await expect(page.getByText('0901234567')).toBeVisible();

    // the same email again, from the list
    await page.goto('/candidates');
    await page.getByRole('button', { name: 'Thêm ứng viên' }).first().click();
    const again = page.getByRole('dialog', { name: 'Thêm ứng viên' });
    await again.getByLabel(/^Họ và tên/).fill('E2E-Trung email');
    await again.getByLabel(/^Email/).fill(EMAIL);
    await again.getByRole('button', { name: 'Thêm ứng viên' }).click();
    await expect(again.getByText('Email ứng viên đã tồn tại')).toBeVisible();
    await again.getByRole('button', { name: 'Hủy' }).click();

    // edit on the detail page
    await page.goto(detailUrl);
    await page.getByRole('button', { name: 'Sửa', exact: true }).click();
    const edit = page.getByRole('dialog', { name: 'Sửa ứng viên' });
    await edit.getByLabel(/^Họ và tên/).fill(`${NAME} sua`);
    await edit.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: `${NAME} sua` }),
    ).toBeVisible();

    // a wrong file is stopped in the browser, a PDF goes up
    await expect(page.getByText('Chưa có CV.')).toBeVisible();
    await page.getByLabel(/Tải CV lên/).setInputFiles({
      name: 'cv.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('hello'),
    });
    await page.getByRole('button', { name: 'Tải lên' }).click();
    await expect(
      page.getByText('Chỉ chấp nhận tệp PDF hoặc DOCX.'),
    ).toBeVisible();
    await page.getByLabel(/Tải CV lên/).setInputFiles(PDF);
    await page.getByRole('button', { name: 'Tải lên' }).click();
    const download = page.getByRole('link', { name: /Tải CV/ });
    await expect(download).toBeVisible();
    await expect(download).toHaveAttribute(
      'href',
      /\/api\/candidates\/[0-9a-f-]{36}\/cv$/,
    );

    // the CV really downloads for a signed-in user
    const response = await page.request.get(
      (await download.getAttribute('href')) ?? '',
    );
    expect(response.ok()).toBe(true);

    // note
    await page
      .getByRole('button', { name: /Thêm ghi chú|Sửa ghi chú/ })
      .click();
    await page
      .getByRole('textbox', { name: /Ghi chú/ })
      .fill('Ứng viên tiềm năng');
    await page.getByRole('button', { name: 'Lưu' }).click();
    await expect(page.getByText('Ứng viên tiềm năng')).toBeVisible();

    // remove the CV after confirming
    await page.getByRole('button', { name: 'Xóa CV' }).click();
    await page
      .getByRole('dialog', { name: 'Xóa CV' })
      .getByRole('button', { name: 'Xóa CV' })
      .click();
    await expect(page.getByText('Chưa có CV.')).toBeVisible();
    await page.context().close();
  });

  test('the list finds and filters candidates', async ({ browser }) => {
    const page = await openAs(browser, 'recruiter@hiflow.local');
    await page.goto('/candidates');
    await page.getByLabel('Tìm ứng viên').fill(RUN);
    await expect(page.getByRole('row')).toHaveCount(2);
    await page.getByRole('combobox', { name: 'Lọc theo nguồn' }).click();
    await page.getByRole('option', { name: 'Website' }).click();
    await expect(page.getByText('Không có kết quả')).toBeVisible();
    await page
      .getByRole('search')
      .getByRole('button', { name: 'Xóa bộ lọc' })
      .click();
    await expect(page.getByRole('row')).toHaveCount(2);
    await page.context().close();
  });

  test('HR cannot edit but anonymises, after which nothing can be edited', async ({
    browser,
  }) => {
    const page = await openAs(browser, 'hr@hiflow.local');
    await page.goto(detailUrl);
    await expect(
      page.getByRole('button', { name: 'Sửa', exact: true }),
    ).toHaveCount(0);
    await page.getByRole('button', { name: 'Ẩn danh', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Ẩn danh ứng viên' });
    await expect(dialog).toContainText('không thể hoàn tác');
    await dialog.getByRole('button', { name: 'Ẩn danh ứng viên' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'đã được ẩn danh' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Ẩn danh', exact: true }),
    ).toHaveCount(0);
    await page.context().close();

    const admin = await openAs(browser, 'admin@hiflow.local');
    await admin.goto(detailUrl);
    await expect(
      admin.getByRole('status').filter({ hasText: 'đã được ẩn danh' }),
    ).toBeVisible();
    await expect(
      admin.getByRole('button', { name: 'Sửa', exact: true }),
    ).toHaveCount(0);
    await expect(admin.getByRole('button', { name: 'Tải lên' })).toHaveCount(0);
    await admin.context().close();
  });

  test('a department manager has no candidates page, an interviewer sees the list', async ({
    browser,
  }) => {
    const manager = await openAs(browser, 'manager@hiflow.local');
    await manager.goto('/candidates');
    await expect(manager.getByText('Không có quyền truy cập')).toBeVisible();
    await manager.context().close();

    const interviewer = await openAs(browser, 'interviewer@hiflow.local');
    await interviewer.goto('/candidates');
    await expect(
      interviewer.getByRole('heading', { level: 1, name: 'Ứng viên' }),
    ).toBeVisible();
    await expect(
      interviewer.getByRole('button', { name: 'Thêm ứng viên' }),
    ).toHaveCount(0);
    await interviewer.context().close();
  });
});
