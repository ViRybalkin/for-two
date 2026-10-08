import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",
  use: {
    baseURL: "http://127.0.0.1:3012",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } }
    },
    {
      name: "iphone-webkit",
      use: { ...devices["iPhone 15"] }
    }
  ],
  webServer: {
    command: "npm run start -- -H 127.0.0.1 -p 3012",
    url: "http://127.0.0.1:3012/api/health",
    env: {
      OPENAI_API_KEY: "",
      SUPABASE_URL: "",
      SUPABASE_SECRET_KEY: ""
    },
    reuseExistingServer: true,
    timeout: 30_000,
    stdout: "ignore",
    stderr: "pipe"
  }
});
