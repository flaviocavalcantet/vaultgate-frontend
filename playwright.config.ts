import { defineConfig, devices } from '@playwright/test'

/**
 * Browser tests against a running VaultGate (F6), not part of `npm run check`: they
 * need the whole stack. By default, VaultGate's local cluster (`make k3d-up` in the
 * vaultgate repository), whose app is https://localhost:5174. The browser must trust
 * VaultGate's local root, as a person's does (see the README).
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  // One VaultGate, one user's files: the tests run one at a time, in order.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  // Scans run in the background: a file takes seconds to get its verdict.
  timeout: 180_000,
  expect: { timeout: 30_000 },
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: 'e2e-report' }]]
    : 'list',
  use: {
    baseURL: process.env.VAULTGATE_E2E_URL ?? 'https://localhost:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // A Chromium already on the machine, when it isn't the one this Playwright installs.
    ...(process.env.VAULTGATE_E2E_CHROMIUM
      ? { launchOptions: { executablePath: process.env.VAULTGATE_E2E_CHROMIUM } }
      : {}),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
