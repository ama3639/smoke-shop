import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";

const python = resolve(
  "../backend/.venv",
  process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
);
const backendScript = resolve("../scripts/e2e_backend.py");
const installedBrowser =
  process.platform === "win32"
    ? [
        join(
          process.env["PROGRAMFILES(X86)"] || "C:/Program Files (x86)",
          "Microsoft/Edge/Application/msedge.exe",
        ),
        join(
          process.env.PROGRAMFILES || "C:/Program Files",
          "Microsoft/Edge/Application/msedge.exe",
        ),
        join(
          process.env.PROGRAMFILES || "C:/Program Files",
          "Google/Chrome/Application/chrome.exe",
        ),
        join(
          process.env.LOCALAPPDATA || "C:/",
          "Google/Chrome/Application/chrome.exe",
        ),
      ].find(existsSync)
    : undefined;
const browserPath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || installedBrowser;
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3010",
    trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_BROWSER_CHANNEL
      ? { channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL }
      : browserPath
        ? { executablePath: browserPath }
        : undefined,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: [
    {
      command: `"${python}" "${backendScript}"`,
      url: "http://127.0.0.1:8010/api/v1/health/",
      reuseExistingServer: false,
    },
    {
      command: "npm run dev -- --port 3010",
      url: "http://127.0.0.1:3010",
      env: {
        BACKEND_URL: "http://127.0.0.1:8010",
        NEXT_TELEMETRY_DISABLED: "1",
        NEXT_DIST_DIR: ".next-e2e",
      },
      reuseExistingServer: false,
    },
  ],
});
