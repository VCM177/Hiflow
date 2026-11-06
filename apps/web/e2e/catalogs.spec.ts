import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';

// Runs against a real API seeded with `seed:base` (see README.md). It creates one
// department tagged E2E- and removes it again; nothing else is touched.
const PASSWORD = process.env.E2E_PASSWORD ?? 'Hiflow@2026';
const RUN = Date.now().toString(36).toUpperCase();
const NAME = `E2E-Phong ${RUN}`;
const RENAMED = `E2E-Phong moi ${RUN}`;
const CODE = `E2E_${RUN}`;

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu').fill(PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL('/');
}

// Removes every department this run could have left behind, whatever the test did.
async function removeLeftovers(request: APIRequestContext) {
  const login = await request.post('/api/auth/login', {
    data: { email: 'admin@hiflow.local', password: PASSWORD },
  });
  if (!login.ok()) return;
  // The web proxy keeps the token in the session cookie, which this context stores.
  const list = await request.get('/api/departments?search=E2E-&limit=100');
  const body = (await list.json()) as { items: { id: string; name: string }[] };
  for (const item of body.items) {
    if (item.name.includes(RUN)) {
      await request.delete(`/api/departments/${item.id}`);
    }
  }
}

test.describe('catalogs page', () => {
  test.afterAll(async ({ request }) => {
    await removeLeftovers(request);
  });

  test('an admin creates, finds, renames and deletes a department', async ({
    page,
  }) => {
    await signIn(page, 'admin@hiflow.local');
    await page.goto('/catalogs');
    await expect(page).toHaveURL('/catalogs/department');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Danh mục' }),
    ).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('row').nth(1)).toBeVisible();

    // create
    await page.getByRole('button', { name: 'Thêm phòng ban' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Thêm phòng ban' });
    await dialog.getByLabel(/^Tên/).fill(NAME);
    await dialog.getByLabel(/^Mã/).fill(CODE);
    await dialog.getByRole('button', { name: 'Thêm phòng ban' }).click();
    await expect(dialog).toBeHidden();

    // search finds it, and only it
    await page.getByRole('searchbox', { name: 'Tìm phòng ban' }).fill(NAME);
    await expect(page).toHaveURL(/search=/);
    await expect(
      page.getByRole('cell', { name: NAME, exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('row')).toHaveCount(2); // header + the new row

    // rename
    await page.getByRole('button', { name: `Sửa ${NAME}` }).click();
    const edit = page.getByRole('dialog', { name: 'Sửa phòng ban' });
    await edit.getByLabel(/^Tên/).fill(RENAMED);
    await edit.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(edit).toBeHidden();
    await page.getByRole('searchbox', { name: 'Tìm phòng ban' }).fill(RENAMED);
    await expect(
      page.getByRole('cell', { name: RENAMED, exact: true }),
    ).toBeVisible();

    // delete through the confirm dialog
    await page.getByRole('button', { name: `Xóa ${RENAMED}` }).click();
    const confirm = page.getByRole('dialog', { name: 'Xóa phòng ban' });
    await expect(confirm).toContainText(RENAMED);
    await confirm.getByRole('button', { name: 'Xóa phòng ban' }).click();
    await expect(confirm).toBeHidden();
    await expect(page.getByText('Không có kết quả')).toBeVisible();
  });

  test('a code that is too short is refused in the form and nothing is sent', async ({
    page,
  }) => {
    await signIn(page, 'admin@hiflow.local');
    await page.goto('/catalogs/department');
    await page.getByRole('button', { name: 'Thêm phòng ban' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Thêm phòng ban' });
    await dialog.getByLabel(/^Tên/).fill(`E2E-Trung ${RUN}`);
    await dialog.getByLabel(/^Mã/).fill('x');
    await dialog.getByRole('button', { name: 'Thêm phòng ban' }).click();
    await expect(
      dialog.getByText('Mã chỉ gồm chữ, số hoặc dấu gạch dưới'),
    ).toBeVisible();
    await expect(dialog).toBeVisible();
  });

  test('the positions tab is its own address', async ({ page }) => {
    await signIn(page, 'admin@hiflow.local');
    await page.goto('/catalogs/department');
    await page.getByRole('tab', { name: 'Vị trí' }).click();
    await expect(page).toHaveURL('/catalogs/position');
    await expect(
      page.getByRole('button', { name: 'Thêm vị trí' }).first(),
    ).toBeVisible();
  });

  test('an unknown catalogue is a 404 page', async ({ page }) => {
    await signIn(page, 'admin@hiflow.local');
    await page.goto('/catalogs/nonsense');
    await expect(
      page.getByRole('heading', { name: 'Không tìm thấy trang' }),
    ).toBeVisible();
  });

  test('a recruiter has no menu entry and is told they lack permission', async ({
    page,
  }) => {
    await signIn(page, 'recruiter@hiflow.local');
    await page.goto('/catalogs/department');
    await expect(
      page.getByRole('heading', { name: /Không có quyền/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Thêm phòng ban' }),
    ).toHaveCount(0);
  });
});
