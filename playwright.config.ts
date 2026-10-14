import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://localhost:5199",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    command: "node node_modules/vite/bin/vite.js preview --port 5199 --strictPort",
    port: 5199,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
