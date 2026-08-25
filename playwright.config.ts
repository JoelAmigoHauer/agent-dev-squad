import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './builds/thelma/tests/e2e',
  reporter: [
    ['json', { outputFile: 'builds/thelma/tests/test-results/e2e.json' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    // A trace beats an assertion message: it is the single biggest thing that keeps the
    // three-iteration fix cap sufficient.
    trace: 'retain-on-failure',
  },
  webServer: {
    // A production build, not `dev`. Dev-only behaviour passing and prod failing is a discovery
    // for Stage 6, and Stage 6 gets two attempts.
    command: 'npm run build && npm start',
    url: 'http://localhost:3000/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [{
    name: 'chromium',
    use: {
      browserName: 'chromium',
      // The container pre-installs Chromium build 1194; @playwright/test 1.62.1 expects 1234 and
      // otherwise tells you to run `npx playwright install`, which this environment forbids
      // (PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1, and GitHub release downloads 403 through the proxy).
      // Pointing at the installed binary is the documented route. See /ERRORS.md.
      launchOptions: { executablePath: '/opt/pw-browsers/chromium' },
    },
  }],
});
