import { defineConfig, devices } from "@playwright/test";
import { requireIsolatedTestEnvironment } from "./lib/test-isolation";

requireIsolatedTestEnvironment(process.env);

const port = Number(process.env.E2E_PORT || 3001);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: {
    // Production server avoids Next.js single-dev-server lock on this project dir.
    command: process.env.E2E_SKIP_BUILD
      ? `npx next start -p ${port} -H 127.0.0.1`
      : `npx next build && npx next start -p ${port} -H 127.0.0.1`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 360_000,
    env: {
      ...process.env,
      STELLAR_USE_FAKE_RPC: "1",
      STELLAR_ALLOW_SUBMISSION: "0",
      NEXT_DIST_DIR: ".next-e2e",
      PORT: String(port),
    },
  },
});
