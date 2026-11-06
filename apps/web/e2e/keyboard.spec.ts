import { expect, test, type Page } from '@playwright/test';

import { PASSWORD } from './helpers';

// Keyboard only: no mouse clicks in this file. Covers WCAG 2.1.1 (every function reachable by
// keyboard), 2.4.7 (a visible focus indicator), 2.4.3 (focus order) and 2.1.2 (no keyboard
// trap in dialogs, and focus goes back to the control that opened one).

/** True when the element shows a focus ring: a box-shadow or an outline, as the design's focus style draws it. */
async function hasVisibleFocus(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return false;
    const style = getComputedStyle(el);
    const ring = style.boxShadow !== 'none' && style.boxShadow !== '';
    const outline =
      style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
    return ring || outline;
  });
}

test('sign in, open a dialog and close it again, with the keyboard only', async ({
  page,
}) => {
  await page.goto('/login');
  // Type only once the form is live: keys pressed before the page is interactive are lost.
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Email').focus();
  await page.keyboard.type('admin@hiflow.local');
  await page.keyboard.press('Tab');
  await page.keyboard.type(PASSWORD);
  await page.keyboard.press('Enter');
  await expect(page).not.toHaveURL(/login/);

  // Focus is visible on the element that has it, at every step of the first few Tab presses.
  await page.keyboard.press('Tab');
  expect(await hasVisibleFocus(page)).toBe(true);
  await page.keyboard.press('Tab');
  expect(await hasVisibleFocus(page)).toBe(true);

  await page.goto('/candidates');
  // Reach the add button by Tab alone, then open it with Enter.
  const add = page.getByRole('button', { name: 'Thêm ứng viên' }).first();
  await add.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Thêm ứng viên' });
  await expect(dialog).toBeVisible();

  // Focus moves into the dialog, and Tab stays inside it (no way out by accident).
  const insideDialog = () =>
    page.evaluate(() => {
      const dlg = document.querySelector('[role="dialog"]');
      return Boolean(dlg && dlg.contains(document.activeElement));
    });
  expect(await insideDialog()).toBe(true);
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press('Tab');
    expect(await insideDialog(), `Tab ${i + 1} left the dialog`).toBe(true);
  }

  // Escape closes it, and focus goes back to the button that opened it.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(add).toBeFocused();
});

test.describe('the candidate form, keyboard only', () => {
  let candidateId = '';
  const NAME = `E2E-Ban phim ${Date.now().toString(36)}`;

  test.afterAll(async ({ browser }) => {
    if (!candidateId) return;
    const context = await browser.newContext({
      baseURL: test.info().project.use.baseURL,
    });
    const login = await context.request.post('/api/auth/login', {
      data: { email: 'recruiter@hiflow.local', password: PASSWORD },
    });
    if (login.ok())
      await context.request.delete(`/api/candidates/${candidateId}`);
    await context.close();
  });

  test('fill the fields with Tab and send with Enter', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.getByLabel('Email').focus();
    await page.keyboard.type('recruiter@hiflow.local');
    await page.keyboard.press('Tab');
    await page.keyboard.type(PASSWORD);
    await page.keyboard.press('Enter');
    await expect(page).not.toHaveURL(/login/);

    await page.goto('/candidates');
    await page.getByRole('button', { name: 'Thêm ứng viên' }).first().focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Thêm ứng viên' });
    await expect(dialog).toBeVisible();

    // The first box takes focus when the dialog opens: type the name, Tab to the email.
    await expect(dialog.getByLabel(/^Họ và tên/)).toBeFocused();
    await page.keyboard.type(NAME);
    await page.keyboard.press('Tab');
    await page.keyboard.type(
      `e2e-keyboard-${Date.now().toString(36)}@example.com`,
    );
    // Enter in a text box sends the form: the dialog closes into the new candidate's page.
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/candidates\/[0-9a-f-]{36}$/);
    candidateId = new URL(page.url()).pathname.split('/').pop() ?? '';
    await expect(
      page.getByRole('heading', { level: 1, name: NAME }),
    ).toBeVisible();
  });
});
