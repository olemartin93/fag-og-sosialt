import { defineConfig, devices } from '@playwright/test';

const port = 4173;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${port}/fag-og-sosialt/`,
    trace: 'retain-on-failure',
    locale: 'nb-NO',
    timezoneId: 'Europe/Oslo',
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    // tests run against the production build (service worker included)
    command: `npm run build && npx vite preview --port ${port} --strictPort`,
    url: `http://localhost:${port}/fag-og-sosialt/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
  },
});
