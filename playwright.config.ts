import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'on-first-retry' },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  },
  projects: [
    {
      name: 'desktop-chromium',
      // Desktop is the default so an untagged future test still runs.
      grep: /@desktop|^(?!.*@(desktop|mobile))/,
      use: { ...devices['Desktop Chrome'] },
    },
    { name: 'mobile-chromium', grep: /@mobile/, use: { ...devices['Pixel 7'] } },
  ],
});
