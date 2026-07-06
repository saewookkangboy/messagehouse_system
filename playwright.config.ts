import { defineConfig, devices } from "@playwright/test";

const e2eEnv = {
  DATABASE_URL: "file:./e2e.db",
  NEON_DATABASE_URL: "",
  DIRECT_DATABASE_URL: "",
  AUTH_DISABLED: "true",
  AI_PROVIDER: "stub",
  RESEARCH_PROVIDER: "stub",
  EMBEDDING_PROVIDER: "stub",
  VECTOR_BACKEND: "sqlite",
};

export default defineConfig({
  testDir: "./e2e",
  timeout: 180_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 1,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://localhost:3099",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npx prisma migrate deploy && npm run dev -- --port 3099",
    url: "http://localhost:3099",
    reuseExistingServer: false,
    timeout: 120_000,
    env: e2eEnv,
  },
});
