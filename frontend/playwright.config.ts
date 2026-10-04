import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end / PWA tests. Runs the PRODUCTION build (vite preview, with the
 * real service worker) against a dedicated backend + database, so offline
 * behaviour is tested exactly as users get it.
 *
 *   npm run build && npm run test:e2e
 */
const rootEnv = resolve(import.meta.dirname, '..', '.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const E2E_DB = process.env.TEST_E2E_DATABASE_URL;
if (!E2E_DB) throw new Error('Set TEST_E2E_DATABASE_URL (a database the E2E run may reset).');

export const API_PORT = 4100;
export const WEB_PORT = 4174;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  globalSetup: './e2e/global-setup.ts',
  use: {
    ...devices['Pixel 7'],
    baseURL: `http://localhost:${WEB_PORT}`,
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'npx tsx ../backend/src/server.ts',
      port: API_PORT,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        ...(process.env as Record<string, string>),
        DATABASE_URL: E2E_DB,
        PORT: String(API_PORT),
        CORS_ORIGINS: `http://localhost:${WEB_PORT}`,
        DEMO_MODE_ENABLED: 'true',
        LOG_LEVEL: 'warn',
      },
    },
    {
      command: `npx vite preview --port ${WEB_PORT} --strictPort`,
      port: WEB_PORT,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { ...(process.env as Record<string, string>), API_PROXY_TARGET: `http://localhost:${API_PORT}` },
    },
  ],
});
