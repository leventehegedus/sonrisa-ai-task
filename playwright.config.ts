import { defineConfig } from '@playwright/test'

// Isolated stack (API :3002, web :5175, throwaway DB) so a dev instance on :3000/:5173 and data/alerts.db are never touched.
const dbDir = '/tmp/world-alerts-e2e'

export default defineConfig({
  testDir: 'e2e',
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://localhost:5175' },
  webServer: [
    {
      command: `rm -rf ${dbDir} && mkdir -p ${dbDir} && npm run start -w server`,
      env: { PORT: '3002', DB_PATH: `${dbDir}/e2e.db` },
      url: 'http://127.0.0.1:3002/api/me', // 401 counts as up
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'npm run dev -w web -- --port 5175 --strictPort',
      env: { API_TARGET: 'http://localhost:3002' },
      url: 'http://localhost:5175',
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
})
