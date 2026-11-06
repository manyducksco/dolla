import { defineConfig } from "@playwright/test";

/**
 * Browser tests for HMR: each test writes a small app, runs it on a real Vite dev
 * server with the packed dolla package installed, edits its files and checks the
 * page. Run with `npm run test:e2e`.
 */
export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  globalSetup: "./global-setup.ts",
  // Every test starts its own dev server on its own port, so they can run in parallel.
  fullyParallel: true,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  forbidOnly: !!process.env.CI,
  reporter: [["list"]],
  outputDir: ".work/test-results",
  use: {
    browserName: "chromium",
    trace: "retain-on-failure",
  },
});
