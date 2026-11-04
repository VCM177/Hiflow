import { defineConfig, devices } from '@playwright/test';

// The browser tests drive the real web app against a real API. Start the API
// first (see README.md) and point E2E_API_URL at it; the web server below is
// started for you and forwards /api to that origin.
const port = Number(process.env.E2E_WEB_PORT ?? 3100);
const apiUrl = process.env.E2E_API_URL ?? 'http://localhost:4000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { API_ORIGIN: apiUrl },
  },
});
