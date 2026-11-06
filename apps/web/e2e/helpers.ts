import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type Page,
} from '@playwright/test';

export const PASSWORD = process.env.E2E_PASSWORD ?? 'Hiflow@2026';

/** A browser context signed in as one of the demo accounts. Close its `context()` when done. */
export async function openAs(browser: Browser, email: string): Promise<Page> {
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

/** The API through the web app's /api proxy, signed in as `email` (cookie kept in the context). */
export async function apiAs(
  browser: Browser,
  email: string,
): Promise<APIRequestContext> {
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
  });
  const login = await context.request.post('/api/auth/login', {
    data: { email, password: PASSWORD },
  });
  expect(login.ok()).toBe(true);
  return context.request;
}

export async function json<T>(
  request: APIRequestContext,
  method: 'get' | 'post' | 'patch' | 'put' | 'delete',
  path: string,
  data?: object,
): Promise<T> {
  const response = await request[method](`/api${path}`, { data });
  expect(response.ok(), `${method} ${path} → ${response.status()}`).toBe(true);
  return (response.status() === 204 ? undefined : await response.json()) as T;
}

/** A published job (an approved requisition behind it), made through the API as the admin. */
export async function openJob(
  admin: APIRequestContext,
  title: string,
  quantity = 3,
): Promise<{ jobId: string; requisitionId: string }> {
  const positions = await json<{ items: { id: string }[] }>(
    admin,
    'get',
    '/positions?limit=1',
  );
  const departments = await json<{ items: { id: string }[] }>(
    admin,
    'get',
    '/departments?limit=1',
  );
  const requisition = await json<{ id: string }>(
    admin,
    'post',
    '/requisitions',
    {
      title,
      positionId: positions.items[0].id,
      departmentId: departments.items[0].id,
      quantity,
    },
  );
  await json(admin, 'post', `/requisitions/${requisition.id}/submit`);
  await json(admin, 'post', `/requisitions/${requisition.id}/approve`);
  const job = await json<{ id: string }>(admin, 'post', '/jobs', {
    requisitionId: requisition.id,
    description: '<p>Mô tả E2E</p>',
  });
  await json(admin, 'post', `/jobs/${job.id}/publish`);
  return { jobId: job.id, requisitionId: requisition.id };
}

export const PDF = {
  name: 'cv.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'),
};
