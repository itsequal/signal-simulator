import { expect, test } from '@playwright/test';
import { expectStatus, expectTxPlotsRendered, openApp, selectModulation } from './helpers';

test('E2E-03: FSK y BPSK se regeneran con los mismos bits', async ({ page }) => {
  await openApp(page);
  await expectStatus(page, 'Resultado válido');
  await selectModulation(page, 'FSK');
  await expectStatus(page, 'Resultado válido');
  await expect(page.getByTestId('indicators').locator('[data-indicator="f0"] dd')).toHaveText('750 Hz');
  await expect(page.getByTestId('indicators').locator('[data-indicator="f1"] dd')).toHaveText('1\u202F250 Hz');
  await selectModulation(page, 'BPSK');
  await expectStatus(page, 'Resultado válido');
  await expectTxPlotsRendered(page);
});

test('E2E-04: un parámetro inválido no regenera y explica el error', async ({ page }) => {
  await openApp(page);
  await expectStatus(page, 'Resultado válido');
  const carrier = page.getByTestId('field-carrier').getByRole('textbox');
  await carrier.fill('12');
  await carrier.blur();
  await expect(page.getByText('debe estar entre')).toBeVisible();
  await expectStatus(page, 'Resultado desactualizado');
  await expect(page.getByRole('button', { name: 'Reproducir portadora' })).toBeDisabled();
});
