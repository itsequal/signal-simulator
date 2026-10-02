import { expect, test } from '@playwright/test';
import { expectStatus, openApp, readDebug, selectSource } from './helpers';

test('E2E-05: el texto «A» muestra el byte 41 y sus bits', { tag: ['@smoke'] }, async ({ page }) => {
  await openApp(page);
  await selectSource(page, 'Texto');
  await page.getByRole('textbox', { name: 'Texto' }).fill('A');
  await expect(page.getByRole('cell', { name: '41', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '01000001' })).toBeVisible();
  await expectStatus(page, 'Resultado válido');
  await expect(page.getByTestId('indicators').locator('[data-indicator="duration"] dd')).toHaveText('80 ms');
});

test('E2E-07: graba con el micrófono sintético, convierte a PCM y libera la pista', async ({ page }) => {
  await openApp(page);
  await selectSource(page, 'Micrófono');
  await page.getByRole('button', { name: 'Grabar' }).click();
  await expect(page.getByTestId('mic-status')).toContainText('grabando');
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: 'Detener' }).click();
  await expect(page.getByTestId('plot-original-time')).toBeVisible({ timeout: 20_000 });
  const debug = await readDebug(page);
  expect(debug.activeTracks).toBe(0);
  expect(debug.captureSampleRate).toBe(debug.contextSampleRate);
  await expectStatus(page, 'Resultado válido');
});

