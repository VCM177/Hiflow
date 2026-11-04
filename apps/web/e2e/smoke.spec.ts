import { expect, test } from '@playwright/test';

// B4 replaces this with the real /login flow once the page exists.
test('the web app starts and serves its first page', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('body')).toBeVisible();
});
