import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: { baseURL: "http://localhost:5173" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command:
        "docker compose up -d --wait db && bun run db:migrate && bun run db:seed && bun run dev:api",
      cwd: "../..",
      url: "http://127.0.0.1:3001/health",
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: "bun run dev:web",
      cwd: "../..",
      url: "http://localhost:5173",
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
