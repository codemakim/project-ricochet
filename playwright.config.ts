import { defineConfig, devices } from '@playwright/test';

declare const process: { env: Record<string, string | undefined> };

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'on-first-retry' },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'desktop-chromium', grep: /@desktop/, use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', grep: /@mobile/, use: { ...devices['Pixel 7'] } },
  ],
});
