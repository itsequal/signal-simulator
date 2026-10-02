import { expect, test } from '@playwright/test';
import { collectPageErrors } from './helpers';

test('carga bajo la ruta base y sobrevive a una recarga', { tag: ['@smoke', '@deployed'] }, async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.goto('./');
  const heading = page.getByRole('heading', { level: 1, name: 'Simulador de modulaciones digitales binarias' });
  await expect(heading).toBeVisible();
  await expect(page.getByText(/^Versión /)).toBeVisible();
  await page.reload();
  await expect(heading).toBeVisible();
  expect(errors).toEqual([]);
});
