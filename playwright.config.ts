import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  use: {
    baseURL: 'http://localhost:4173',
  },
  projects: [
    {
      name: 'desktop-chromium',
      grepInvert: /phone zoom/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'mobile-chromium',
      grep: /phone zoom/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command:
      'npx vite build --outDir dist-e2e && npx vite preview --outDir dist-e2e --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    env: { VITE_ANIMATION_SCALE: '0.05', VITE_AGENT_MODEL_ID: '' },
  },
});
