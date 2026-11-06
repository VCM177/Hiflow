import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';

// Runs against a real API seeded with `seed:base`. Accounts cannot be deleted through the
// API, so the spec owns ONE account (e2e-users@example.com): it is created when missing,
// put back to a known state before the run and locked again afterwards. Nothing else is
// changed except what the spec restores itself.
const PASSWORD = process.env.E2E_PASSWORD ?? 'Hiflow@2026';
const E2E_EMAIL = 'e2e-users@example.com';
const E2E_NAME = 'E2E Nguoi dung';
const E2E_PASSWORD = 'E2eStart2026';

async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).not.toHaveURL(/login/);
}

async function adminLogin(request: APIRequestContext) {
  const response = await request.post('/api/auth/login', {
    data: { email: 'admin@hiflow.local', password: PASSWORD },
  });
  expect(response.ok()).toBe(true);
}

async function findE2eUser(request: APIRequestContext) {
  const list = await request.get(`/api/users?search=${E2E_EMAIL}&limit=10`);
  const body = (await list.json()) as {
    items: { id: string; email: string }[];
  };
  return body.items.find((user) => user.email === E2E_EMAIL);
}

async function resetE2eUser(request: APIRequestContext) {
  await adminLogin(request);
  let user = await findE2eUser(request);
  if (!user) {
    const created = await request.post('/api/users', {
      data: {
        email: E2E_EMAIL,
        fullName: E2E_NAME,
        role: 'RECRUITER',
        password: E2E_PASSWORD,
      },
    });
    expect(created.ok()).toBe(true);
    user = (await created.json()) as { id: string; email: string };
  }
  await request.patch(`/api/users/${user.id}`, {
    data: { fullName: E2E_NAME, departmentId: null },
  });
  await request.patch(`/api/users/${user.id}/role`, {
    data: { role: 'RECRUITER' },
  });
  await request.patch(`/api/users/${user.id}/status`, {
    data: { isActive: true },
  });
  await request.post(`/api/users/${user.id}/reset-password`, {
    data: { newPassword: E2E_PASSWORD },
  });
  return user.id;
}

test.describe('users and profile', () => {
  let userId = '';

  test.beforeAll(async ({ request }) => {
    userId = await resetE2eUser(request);
  });

  test.afterAll(async ({ request }) => {
    await adminLogin(request);
    await request.post(`/api/users/${userId}/reset-password`, {
      data: { newPassword: E2E_PASSWORD },
    });
    await request.patch(`/api/users/${userId}`, {
      data: { fullName: E2E_NAME },
    });
    await request.patch(`/api/users/${userId}/status`, {
      data: { isActive: false },
    });
  });

  test('an admin edits, changes the role of, locks and unlocks an account', async ({
    page,
  }) => {
    await signIn(page, 'admin@hiflow.local');
    await page.goto('/users');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Người dùng' }),
    ).toBeVisible();
    await page.getByLabel('Tìm người dùng').fill(E2E_EMAIL);
    const line = page.getByRole('row', { name: new RegExp(E2E_EMAIL) });
    await expect(line).toBeVisible();
    await expect(page.getByRole('row')).toHaveCount(2);

    // edit the name
    await page.getByRole('button', { name: `Sửa ${E2E_NAME}` }).click();
    const edit = page.getByRole('dialog', { name: 'Sửa người dùng' });
    await edit.getByLabel(/^Họ và tên/).fill('E2E Nguoi dung doi ten');
    await edit.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(edit).toBeHidden();
    await expect(line).toContainText('E2E Nguoi dung doi ten');

    // change the role
    await page.getByRole('button', { name: /^Đổi vai trò của E2E/ }).click();
    const role = page.getByRole('dialog', { name: 'Đổi vai trò' });
    await role.getByRole('combobox', { name: /Vai trò/ }).click();
    await page.getByRole('option', { name: 'Phỏng vấn viên' }).click();
    await role.getByRole('button', { name: 'Đổi vai trò' }).click();
    await expect(role).toBeHidden();
    await expect(line).toContainText('Phỏng vấn viên');

    // lock, then unlock
    await page.getByRole('button', { name: /^Khóa E2E/ }).click();
    await page
      .getByRole('dialog', { name: 'Khóa tài khoản' })
      .getByRole('button', { name: 'Khóa tài khoản' })
      .click();
    await expect(line).toContainText('Đã khóa');
    await page.getByRole('button', { name: /^Mở khóa E2E/ }).click();
    await page
      .getByRole('dialog', { name: 'Mở khóa tài khoản' })
      .getByRole('button', { name: 'Mở khóa' })
      .click();
    await expect(line).toContainText('Hoạt động');
  });

  test('nobody can change their own role or lock themselves', async ({
    page,
  }) => {
    await signIn(page, 'admin@hiflow.local');
    await page.goto('/users?search=admin%40hiflow.local');
    await expect(
      page.getByRole('button', { name: /^Đổi vai trò của / }),
    ).toBeDisabled();
    await expect(page.getByRole('button', { name: /^Khóa / })).toBeDisabled();
  });

  test('HR sees no actions on an Admin account and cannot grant Admin', async ({
    page,
  }) => {
    await signIn(page, 'hr@hiflow.local');
    await page.goto('/users?role=ADMIN');
    await expect(page.getByRole('row').nth(1)).toBeVisible();
    await expect(page.getByRole('button', { name: /^Sửa / })).toHaveCount(0);

    await page.getByRole('button', { name: 'Thêm người dùng' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Thêm người dùng' });
    await dialog.getByRole('combobox', { name: /Vai trò/ }).click();
    await expect(
      page.getByRole('option', { name: 'Tuyển dụng' }),
    ).toBeVisible();
    await expect(page.getByRole('option', { name: 'Admin' })).toHaveCount(0);
  });

  test('a recruiter has no Người dùng page', async ({ page }) => {
    await signIn(page, 'recruiter@hiflow.local');
    await page.goto('/users');
    await expect(page.getByText('Không có quyền truy cập')).toBeVisible();
  });

  test('a person edits their name and changes their password', async ({
    page,
    browser,
  }) => {
    await signIn(page, E2E_EMAIL, E2E_PASSWORD);
    await page.getByRole('button', { name: /^Tài khoản của / }).click();
    await page.getByRole('menuitem', { name: 'Hồ sơ cá nhân' }).click();
    await expect(page).toHaveURL('/profile');

    await page.getByLabel(/^Họ và tên/).fill('E2E Doi ten that');
    await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(page.getByText('Đã lưu họ tên')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Tài khoản của E2E Doi ten that' }),
    ).toBeVisible();

    // wrong current password lands on that field
    await page.getByLabel(/^Mật khẩu hiện tại/).fill('SaiMatKhau99');
    await page.getByLabel(/^Mật khẩu mới/).fill('E2eNew2026x');
    await page.getByRole('button', { name: 'Đổi mật khẩu' }).click();
    await expect(page.getByText('Mật khẩu hiện tại không đúng')).toBeVisible();
    await expect(page).toHaveURL('/profile');

    await page.getByLabel(/^Mật khẩu hiện tại/).fill(E2E_PASSWORD);
    await page.getByRole('button', { name: 'Đổi mật khẩu' }).click();
    await expect(page.getByText('Đã đổi mật khẩu')).toBeVisible();
    // still signed in
    await page.reload();
    await expect(page).toHaveURL('/profile');

    // the new password works in a fresh browser
    const fresh = await browser.newContext();
    const other = await fresh.newPage();
    await other.goto('/login');
    await other.getByLabel('Email').fill(E2E_EMAIL);
    await other.getByLabel('Mật khẩu').fill('E2eNew2026x');
    await other.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(other).not.toHaveURL(/login/);
    await fresh.close();
  });
});
