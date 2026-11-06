import process from 'node:process';
import { defineConfig } from '@playwright/test';
const api=process.env.NS_E2E_API || 'http://127.0.0.1:8000';
const web=process.env.NS_E2E_WEB || 'http://127.0.0.1:5173';
const apiPort=new URL(api).port, webPort=new URL(web).port;
export default defineConfig({
  testDir: './e2e', fullyParallel: false, workers: 1, timeout: 60000,
  use: { reducedMotion: 'reduce', baseURL: web, viewport: { width: 390, height: 844 }, trace: 'retain-on-failure' },
  webServer: [
    { command: `VITE_API_URL=${api} npm run dev -- --host 127.0.0.1 --port ${webPort} --strictPort`, url: web, reuseExistingServer: false },
    { command: `NS_E2E_ORIGIN=${web} bash scripts/dev_e2e_backend.sh ${apiPort}`, url: `${api}/ready`, reuseExistingServer: false, timeout: 90000 },
  ],
});
