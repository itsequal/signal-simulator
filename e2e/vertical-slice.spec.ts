import { expect, test } from '@playwright/test';
import { BASE_PATH, collectPageErrors, expectStatus, expectTxPlotsRendered, openApp, readDebug } from './helpers';

test('E2E-01: el ejemplo inicial se simula al abrir y se dibujan tiempo y espectro', { tag: ['@smoke', '@deployed'] }, async ({ page, baseURL }) => {
  const errors = collectPageErrors(page);
  const appHost = new URL(baseURL ?? 'http://localhost').host;
  const foreign: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith('http') && url.host !== appHost) foreign.push(request.url());
  });
  await openApp(page);
  await expectStatus(page, 'Resultado válido');
  await expectTxPlotsRendered(page);
  await expect(page.getByTestId('indicators').locator('[data-indicator="rs"] dd')).toHaveText('100 baudios');
  await expect(page.getByTestId('indicators').locator('[data-indicator="duration"] dd')).toHaveText('160 ms');
  await expect(page.getByTestId('indicators').locator('[data-indicator="samples"] dd')).toContainText('7\u202F680');
  expect(errors).toEqual([]);
  expect(foreign).toEqual([]);
});

test('E2E-02: una entrada binaria inválida no simula y deja el resultado como desactualizado', { tag: ['@smoke'] }, async ({ page }) => {
  await openApp(page);
  await expectStatus(page, 'Resultado válido');
  await page.getByLabel('Bits (0 y 1)').fill('10a1');
  await expect(page.getByText('Carácter no permitido «a» (U+0061) en la línea 1, columna 3')).toBeVisible();
  await expectStatus(page, 'Resultado desactualizado');
  await expect(page.getByTestId('stale-banner')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reproducir señal modulada' })).toBeDisabled();
});

test('E2E-06: reproduce la señal modulada con cursor ligado al reloj de audio y la detiene', async ({ page }) => {
  await openApp(page);
  await expectStatus(page, 'Resultado válido');
  await page.getByRole('radiogroup', { name: 'Modulación' }).getByText('OOK', { exact: true }).click();
  await page.getByRole('combobox', { name: /Tasa de bits R_b/ }).selectOption('10');
  await expectStatus(page, 'Resultado válido');
  await page.getByRole('button', { name: 'Reproducir señal modulada' }).click();
  await expectStatus(page, 'Reproduciendo: señal modulada');
  await expect.poll(async () => (await readDebug(page)).activeSources).toBe(1);
  await expect.poll(async () => (await readDebug(page)).playheadMs ?? 0).toBeGreaterThan(20);
  await page.getByRole('button', { name: 'Detener señal modulada' }).click();
  await expect.poll(async () => (await readDebug(page)).activeSources).toBe(0);
  await expectStatus(page, 'Resultado válido');
});

test('E2E-11: el worker DSP se carga desde la ruta base', { tag: ['@deployed'] }, async ({ page }) => {
  const workerUrls: string[] = [];
  page.on('request', (request) => {
    if (/dsp\.worker/.test(request.url())) workerUrls.push(new URL(request.url()).pathname);
  });
  await openApp(page);
  await expectStatus(page, 'Resultado válido');
  expect((await readDebug(page)).workerMode).toBe('worker');
  expect(workerUrls.length).toBeGreaterThan(0);
  const base = process.env.DEPLOY_URL ? new URL(process.env.DEPLOY_URL).pathname : BASE_PATH;
  for (const path of workerUrls) expect(path.startsWith(base)).toBe(true);
});
