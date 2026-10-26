import { defineConfig, devices } from '@playwright/test';

/**
 * Browser smoke tests against the production build (`vite preview`). Uses the locally installed
 * Chrome (`channel: 'chrome'`) so no browser download is needed; in CI run
 * `npx playwright install chromium` and drop the channel.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1440, height: 900 } },
    },
    { name: 'mobile', use: { ...devices['Pixel 7'], channel: 'chrome' } },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 180_000,
    // The mocked suites answer from captured DEMO fixtures, so they build with DEMO as the first mode
    // and the DEMO/LIVE switch visitors never see (VITE_DATA_MODE_SWITCH).
    // The read-only LIVE suite (NUSAMATRA_LIVE_E2E=1) tests the real production default instead.
    // Stop any running preview before switching suites: an existing server is reused as built.
    env: process.env['NUSAMATRA_LIVE_E2E'] ? {} : { VITE_DATA_MODE: 'demo', VITE_DATA_MODE_SWITCH: '1' },
  },
});
