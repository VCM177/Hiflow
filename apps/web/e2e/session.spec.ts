import { expect, test, type Page } from '@playwright/test';

// Runs against a real API seeded with `seed:base` (see README.md). The demo
// accounts and their password come from the seed; E2E_PASSWORD overrides it.
const PASSWORD = process.env.E2E_PASSWORD ?? 'Hiflow@2026';

const ACCOUNTS = {
  admin: {
    email: 'admin@hiflow.local',
    landing: '/',
    menu: [
      'Tổng quan',
      'Yêu cầu tuyển dụng',
      'Tin tuyển dụng',
      'Ứng viên',
      'Hồ sơ ứng tuyển',
      'Lịch phỏng vấn',
      'Báo cáo',
      'Người dùng',
      'Danh mục',
      'Nhật ký kiểm toán',
    ],
  },
  hr: {
    email: 'hr@hiflow.local',
    landing: '/',
    menu: [
      'Tổng quan',
      'Yêu cầu tuyển dụng',
      'Tin tuyển dụng',
      'Ứng viên',
      'Hồ sơ ứng tuyển',
      'Lịch phỏng vấn',
      'Báo cáo',
      'Người dùng',
    ],
  },
  manager: {
    email: 'manager@hiflow.local',
    landing: '/',
    menu: [
      'Tổng quan',
      'Yêu cầu tuyển dụng',
      'Tin tuyển dụng',
      'Hồ sơ ứng tuyển',
      'Lịch phỏng vấn',
    ],
  },
  recruiter: {
    email: 'recruiter@hiflow.local',
    landing: '/',
    menu: [
      'Tổng quan',
      'Yêu cầu tuyển dụng',
      'Tin tuyển dụng',
      'Ứng viên',
      'Hồ sơ ứng tuyển',
      'Lịch phỏng vấn',
    ],
  },
  interviewer: {
    email: 'interviewer@hiflow.local',
    landing: '/interviews?result=PENDING',
    menu: ['Ứng viên', 'Hồ sơ ứng tuyển', 'Lịch phỏng vấn'],
  },
} as const;

async function signIn(page: Page, email: string, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : '/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu').fill(PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
}

function menuLabels(page: Page) {
  return page
    .getByRole('navigation', { name: 'Menu chính' })
    .getByRole('link')
    .allInnerTexts();
}

test.describe('signed out', () => {
  test('a protected page sends the visitor to login and remembers it', async ({
    page,
  }) => {
    await page.goto('/jobs?status=OPEN');
    await expect(page).toHaveURL('/login?next=%2Fjobs%3Fstatus%3DOPEN');
    await expect(
      page.getByRole('heading', { name: 'Đăng nhập Hiflow' }),
    ).toBeVisible();
  });

  test('a wrong password shows one generic line and keeps the email', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@hiflow.local');
    await page.getByLabel('Mật khẩu').fill('not-the-password');
    await page.getByRole('button', { name: 'Đăng nhập' }).click();

    // Next also keeps an empty role="alert" for route announcements.
    await expect(
      page.getByRole('alert').filter({ hasText: 'Email hoặc mật khẩu' }),
    ).toHaveText('Email hoặc mật khẩu không đúng.');
    await expect(page).toHaveURL('/login');
    await expect(page.getByLabel('Email')).toHaveValue('admin@hiflow.local');
    await expect(page.getByLabel('Mật khẩu')).toHaveValue('');
  });

  test('the login form asks for both fields', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page.getByText('Vui lòng nhập email.')).toBeVisible();
    await expect(page.getByText('Vui lòng nhập mật khẩu.')).toBeVisible();
  });

  test('a signed-in visitor keeps the menu on an address that is not a page', async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.admin.email);
    await expect(page).toHaveURL('/');
    await page.goto('/no-such-page');
    await expect(
      page.getByRole('heading', { name: 'Không tìm thấy trang' }),
    ).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'Menu chính' }),
    ).toBeVisible();
  });
});

test.describe('each role', () => {
  for (const [role, account] of Object.entries(ACCOUNTS)) {
    test(`${role} lands on the right page and sees the right menu`, async ({
      page,
    }) => {
      await signIn(page, account.email);
      await expect(page).toHaveURL(account.landing);
      await expect(
        page.getByRole('navigation', { name: 'Menu chính' }),
      ).toBeVisible();
      expect(await menuLabels(page)).toEqual(account.menu);
    });
  }
});

test.describe('session', () => {
  test('goes back to the page asked for after signing in', async ({ page }) => {
    await signIn(page, ACCOUNTS.admin.email, '/?from=login');
    await expect(page).toHaveURL('/?from=login');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Tổng quan' }),
    ).toBeVisible();
  });

  test('ignores a next that leaves the app', async ({ page }) => {
    await signIn(page, ACCOUNTS.admin.email, '//evil.example/x');
    await expect(page).toHaveURL('/');
  });

  test('keeps the token out of reach of scripts', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(ACCOUNTS.admin.email);
    await page.getByLabel('Mật khẩu').fill(PASSWORD);
    const [response] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().endsWith('/api/auth/login') && r.status() === 200,
      ),
      page.getByRole('button', { name: 'Đăng nhập' }).click(),
    ]);
    expect(await response.json()).not.toHaveProperty('accessToken');
    await expect(page).toHaveURL('/');

    const cookie = (await page.context().cookies()).find(
      (c) => c.name === 'hf_access_token',
    );
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe('Strict');

    const visibleToScripts = await page.evaluate(() => ({
      cookie: document.cookie,
      local: JSON.stringify({ ...localStorage }),
      session: JSON.stringify({ ...sessionStorage }),
    }));
    expect(visibleToScripts.cookie).not.toContain('hf_access_token');
    expect(visibleToScripts.local).not.toContain(cookie?.value ?? 'x');
    expect(visibleToScripts.session).not.toContain(cookie?.value ?? 'x');
  });

  test('signing out ends the session', async ({ page }) => {
    await signIn(page, ACCOUNTS.hr.email);
    await expect(page).toHaveURL('/');
    await page.getByRole('button', { name: /Tài khoản của/ }).click();
    await page.getByRole('menuitem', { name: 'Đăng xuất' }).click();
    await expect(page).toHaveURL('/login');

    await page.goto('/');
    await expect(page).toHaveURL('/login?next=%2F');
  });

  test('remembers a collapsed sidebar across a reload', async ({ page }) => {
    await signIn(page, ACCOUNTS.admin.email);
    await page.getByRole('button', { name: 'Thu gọn menu' }).click();
    await expect(
      page.getByRole('button', { name: 'Mở rộng menu' }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole('button', { name: 'Mở rộng menu' }),
    ).toBeVisible();
    // Collapsed or not, every link keeps its name for screen readers.
    expect(
      await page
        .getByRole('navigation', { name: 'Menu chính' })
        .getByRole('link')
        .count(),
    ).toBe(ACCOUNTS.admin.menu.length);
  });
});
