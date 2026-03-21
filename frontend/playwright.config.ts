import { defineConfig, devices } from '@playwright/test'

try { require('dotenv').config() } catch {}


export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html'], ['json', { outputFile: 'e2e-results.json' }]],
  timeout: 30_000,

  globalSetup: './e2e/global-setup.ts',

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    storageState: 'playwright/.auth/user.json',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'unauthenticated',
      use: {
        ...devices['Desktop Chrome'],
        storageState: { cookies: [], origins: [] },
      },
      testMatch: /auth\.spec\.ts/,
    },
    {
      name: 'authenticated',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /auth\.spec\.ts/,
    },
  ],

  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120_000,
      },
})
