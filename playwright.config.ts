import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const base = process.env.BASE_PATH || '/pages-test/';
const deployUrl = process.env.DEPLOY_URL;
const localUrl = `http://localhost:4173${base}`;
const fakeAudioFile = path.resolve('e2e/fixtures/tone-1k-48k-mono.wav');

const chromiumMedia = {
  permissions: ['microphone'],
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${fakeAudioFile}`,
    ],
  },
};

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'retain-on-failure',
  },
  webServer: deployUrl
    ? undefined
    : {
        command: process.env.CI ? 'npm run preview' : 'npm run build && npm run preview',
        url: localUrl,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        env: { ...process.env, BASE_PATH: base } as Record<string, string>,
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], baseURL: localUrl, ...chromiumMedia },
      grepInvert: /@deployed-only/,
    },
    {
      name: 'firefox-smoke',
      use: {
        ...devices['Desktop Firefox'],
        baseURL: localUrl,
        launchOptions: {
          firefoxUserPrefs: {
            'media.navigator.streams.fake': true,
            'media.navigator.permission.disabled': true,
          },
        },
      },
      grep: /@smoke/,
    },
    {
      name: 'chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome', baseURL: localUrl, ...chromiumMedia },
      grepInvert: /@deployed-only/,
    },
    {
      name: 'msedge',
      use: { ...devices['Desktop Edge'], channel: 'msedge', baseURL: localUrl, ...chromiumMedia },
      grepInvert: /@deployed-only/,
    },
    {
      name: 'deployed',
      use: { ...devices['Desktop Chrome'], baseURL: deployUrl, ...chromiumMedia },
      grep: /@deployed/,
    },
  ],
});
