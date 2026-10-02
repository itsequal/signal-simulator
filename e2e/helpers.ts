import { expect, type Page } from '@playwright/test';

export interface SignalSimDebug {
  activeSources: number;
  activeTracks: number;
  jobsCompleted: number;
  workerMode: string;
  contextSampleRate: number | null;
  captureSampleRate: number | null;
  playheadMs: number | null;
  workletUrl: string | null;
}

declare global {
  interface Window {
    __signalSimDebug?: SignalSimDebug;
  }
}

export const BASE_PATH = process.env.BASE_PATH || '/pages-test/';

export function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

export async function readDebug(page: Page): Promise<SignalSimDebug> {
  const debug = await page.evaluate(() => window.__signalSimDebug);
  if (!debug) throw new Error('window.__signalSimDebug no está disponible');
  return debug;
}

export async function openApp(page: Page, query = ''): Promise<void> {
  await page.goto(`./${query}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Simulador de modulaciones digitales binarias' })).toBeVisible();
}

export async function expectStatus(page: Page, label: string | RegExp): Promise<void> {
  await expect(page.getByTestId('status-badge')).toHaveText(label, { timeout: 20_000 });
}

export async function expectTxPlotsRendered(page: Page): Promise<void> {
  for (const kind of ['nrz', 'carrier', 'modulated']) {
    await expect(page.getByTestId(`plot-time-${kind}`).locator('.scatterlayer .trace')).not.toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByTestId(`plot-freq-${kind}`).locator('.scatterlayer .trace')).not.toHaveCount(0, { timeout: 20_000 });
  }
}

export async function selectModulation(page: Page, label: 'ASK' | 'OOK' | 'FSK' | 'BPSK'): Promise<void> {
  await page.getByRole('radiogroup', { name: 'Modulación' }).getByText(label, { exact: true }).click();
}

export async function selectSource(page: Page, label: 'Binario' | 'Texto' | 'Micrófono'): Promise<void> {
  await page.getByRole('radiogroup', { name: 'Fuente de los bits' }).getByText(label, { exact: true }).click();
}
