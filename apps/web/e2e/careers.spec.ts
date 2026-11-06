import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';

// Runs against a real API seeded with `seed:base`. It opens one job tagged E2E-, applies
// to it with e2e- addresses, and removes what it made. Public pages need no sign-in.
const PASSWORD = process.env.E2E_PASSWORD ?? 'Hiflow@2026';
const RUN = Date.now().toString(36);
const TITLE = `E2E-Ke toan ${RUN}`;
const MAIL = (label: string) => `e2e-careers-${RUN}-${label}@example.com`;

const PDF = {
  name: 'cv.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'),
};

let jobId = '';
let requisitionId = '';

async function adminJson<T>(
  request: APIRequestContext,
  method: 'get' | 'post' | 'delete',
  path: string,
  data?: object,
): Promise<T> {
  const response = await request[method](`/api${path}`, { data });
  expect(response.ok(), `${method} ${path} → ${response.status()}`).toBe(true);
  return (response.status() === 204 ? undefined : await response.json()) as T;
}

async function fillForm(page: Page, email: string) {
  await page.getByLabel(/^Họ và tên/).fill('Nguyễn Văn E2E');
  await page.getByLabel(/^Email/).fill(email);
  await page.getByLabel(/^Số điện thoại/).fill('0901234567');
}

test.describe('careers (public portal)', () => {
  test.beforeAll(async ({ request }) => {
    await adminJson(request, 'post', '/auth/login', {
      email: 'admin@hiflow.local',
      password: PASSWORD,
    });
    const positions = await adminJson<{ items: { id: string }[] }>(
      request,
      'get',
      '/positions?limit=1',
    );
    const departments = await adminJson<{ items: { id: string }[] }>(
      request,
      'get',
      '/departments?limit=1',
    );
    const requisition = await adminJson<{ id: string }>(
      request,
      'post',
      '/requisitions',
      {
        title: TITLE,
        positionId: positions.items[0].id,
        departmentId: departments.items[0].id,
        quantity: 3,
      },
    );
    requisitionId = requisition.id;
    await adminJson(request, 'post', `/requisitions/${requisitionId}/submit`);
    await adminJson(request, 'post', `/requisitions/${requisitionId}/approve`);
    const job = await adminJson<{ id: string }>(request, 'post', '/jobs', {
      requisitionId,
      location: 'Hà Nội',
      salaryMin: 10_000_000,
      salaryMax: 20_000_000,
      description:
        '<p>Mô tả công việc E2E</p><script>window.__xss = true</script><img src=x onerror="window.__xss = true">',
    });
    jobId = job.id;
    await adminJson(request, 'post', `/jobs/${jobId}/publish`);
  });

  test.afterAll(async ({ request }) => {
    // Best effort. Applications and candidates made here carry e2e-careers-<RUN> addresses
    // and are deleted. A published job and an approved requisition cannot be deleted
    // through the API (only drafts can), so they are stopped and closed and keep their
    // E2E- title; remove them with the owner role if the database must be clean.
    await request.post('/api/auth/login', {
      data: { email: 'admin@hiflow.local', password: PASSWORD },
    });
    const apps = await request.get(
      `/api/applications?jobId=${jobId}&limit=100`,
    );
    if (apps.ok()) {
      const body = (await apps.json()) as { items: { id: string }[] };
      for (const item of body.items) {
        await request.delete(`/api/applications/${item.id}`);
      }
    }
    const candidates = await request.get(
      `/api/candidates?search=e2e-careers-${RUN}&limit=100`,
    );
    if (candidates.ok()) {
      const body = (await candidates.json()) as { items: { id: string }[] };
      for (const item of body.items) {
        await request.delete(`/api/candidates/${item.id}`);
      }
    }
    await request.post(`/api/jobs/${jobId}/stop`);
    await request.post(`/api/requisitions/${requisitionId}/close`);
  });

  test('lists the job, finds it by search and shows the page without scripts', async ({
    page,
  }) => {
    await page.goto('/careers');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Cơ hội nghề nghiệp' }),
    ).toBeVisible();
    await page.getByLabel('Tìm vị trí').fill(TITLE);
    await page.getByRole('button', { name: 'Tìm' }).click();
    await page.getByRole('link', { name: TITLE }).click();

    await expect(
      page.getByRole('heading', { level: 1, name: TITLE }),
    ).toBeVisible();
    await expect(page.getByText('Mô tả công việc E2E')).toBeVisible();
    await expect(page.getByText(/10\.000\.000/)).toBeVisible();
    expect(await page.evaluate(() => 'window.__xss' in window)).toBe(false);
    await expect(page.locator('.job-description script')).toHaveCount(0);
    await expect(page.locator('.job-description img')).toHaveCount(0);
  });

  test('a wrong slug is redirected to the canonical address', async ({
    page,
  }) => {
    await page.goto(`/careers/old-title-${jobId}`);
    await expect(page).toHaveURL(
      new RegExp(`/careers/e2e-ke-toan-${RUN}-${jobId}$`),
    );
    await expect(
      page.getByRole('heading', { level: 1, name: TITLE }),
    ).toBeVisible();
  });

  test('applies and lands on the thank-you page', async ({ page }) => {
    await page.goto(`/careers/${jobId}`);
    await fillForm(page, MAIL('ok'));
    await page.getByLabel(/^CV/).setInputFiles(PDF);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Gửi hồ sơ' }).click();
    await expect(page).toHaveURL(/\/thanks$/);
    await expect(
      page.getByRole('heading', { name: 'Chúng tôi đã nhận hồ sơ của bạn' }),
    ).toBeVisible();
  });

  test('says the file format before and after a wrong pick', async ({
    page,
  }) => {
    await page.goto(`/careers/${jobId}`);
    await expect(page.getByText('PDF hoặc DOCX, tối đa 5 MB.')).toBeVisible();
    await fillForm(page, MAIL('fmt'));
    await page.getByLabel(/^CV/).setInputFiles({
      name: 'cv.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('hello'),
    });
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Gửi hồ sơ' }).click();
    await expect(
      page.getByText('Chỉ chấp nhận tệp PDF hoặc DOCX.'),
    ).toBeVisible();
    await expect(page).not.toHaveURL(/thanks/);
  });

  test('refuses a file over 5 MB in the browser', async ({ page }) => {
    await page.goto(`/careers/${jobId}`);
    await fillForm(page, MAIL('big'));
    await page.getByLabel(/^CV/).setInputFiles({
      name: 'cv.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
    });
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Gửi hồ sơ' }).click();
    await expect(page.getByText('Tệp CV tối đa 5 MB.')).toBeVisible();
  });

  test('needs the consent', async ({ page }) => {
    await page.goto(`/careers/${jobId}`);
    await fillForm(page, MAIL('consent'));
    await page.getByLabel(/^CV/).setInputFiles(PDF);
    await page.getByRole('button', { name: 'Gửi hồ sơ' }).click();
    await expect(page.getByText('Bạn cần đồng ý để gửi hồ sơ.')).toBeVisible();
    await expect(page).not.toHaveURL(/thanks/);
  });

  test('shows the wait time of a 429 and keeps the input', async ({ page }) => {
    await page.route('**/api/public/jobs/*/applications', (route) =>
      route.fulfill({
        status: 429,
        headers: { 'Retry-After': '30', 'Content-Type': 'application/json' },
        body: JSON.stringify({ statusCode: 429, message: 'Too Many Requests' }),
      }),
    );
    await page.goto(`/careers/${jobId}`);
    await fillForm(page, MAIL('429'));
    await page.getByLabel(/^CV/).setInputFiles(PDF);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Gửi hồ sơ' }).click();
    await expect(page.getByText(/Thử lại sau \d+ giây/)).toBeVisible();
    await expect(page.getByLabel(/^Email/)).toHaveValue(MAIL('429'));
  });

  test('a stopped job, a draft-like id and a bad address look the same', async ({
    page,
    request,
  }) => {
    await request.post('/api/auth/login', {
      data: { email: 'admin@hiflow.local', password: PASSWORD },
    });
    await request.post(`/api/jobs/${jobId}/stop`);
    for (const path of [
      `/careers/${jobId}`,
      '/careers/00000000-0000-4000-8000-000000000000',
      '/careers/khong-co-id',
    ]) {
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
      await expect(
        page.getByRole('heading', { name: 'Tin này không còn nhận hồ sơ' }),
      ).toBeVisible();
      await expect(
        page.getByRole('link', { name: 'Xem tất cả vị trí' }),
      ).toBeVisible();
    }
  });
});
