import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', fullyParallel: false, workers: 1, timeout: 60000,
  use: { reducedMotion: 'reduce', baseURL: 'http://127.0.0.1:5173', viewport: { width: 390, height: 844 }, trace: 'retain-on-failure' },
  webServer: [
    { command: 'VITE_API_URL=http://127.0.0.1:8000 npm run dev -- --host 127.0.0.1', url: 'http://127.0.0.1:5173', reuseExistingServer: false },
    { command: 'bash scripts/dev_e2e_backend.sh 8000', url: 'http://127.0.0.1:8000/ready', reuseExistingServer: false, timeout: 90000 },
  ],
});
