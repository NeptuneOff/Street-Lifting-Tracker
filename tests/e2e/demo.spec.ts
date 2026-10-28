import { test, expect, type Page } from '@playwright/test';
import { mockBackend } from './fixtures';
async function nav(page: Page, name: RegExp) {
  await page.locator('nav:visible').getByRole('button', { name }).click();
}

test('démo sans Supabase : graphiques remplis, historique détaillé et réinitialisation', async ({
  page,
}) => {
  const backendRequests: string[] = [];
  page.on('request', (r) => {
    if (/supabase\.co/.test(r.url())) backendRequests.push(r.url());
  });
  await page.goto('./');
  await page.getByRole('button', { name: 'Essayer la démo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ta progression, en clair.' })).toBeVisible();
  await expect(page.getByLabel('Mode démonstration')).toBeVisible();
  await expect(page.locator('.performance-card svg[role="img"]')).toHaveCount(4);
  expect(await page.locator('.history-row').count()).toBeGreaterThanOrEqual(40);
  await page.locator('.history-row').first().click();
  await page
    .getByRole('dialog')
    .getByText('Prescription conservée à la date de séance')
    .first()
    .click();
  await expect(page.getByRole('dialog').locator('.snapshot-blocks').first()).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Fermer', exact: true }).click();
  await nav(page, /Programme/);
  await page
    .locator('.program-choice')
    .first()
    .getByRole('button', { name: 'Modifier la séance' })
    .click();
  await page.getByLabel('Nom de la séance', { exact: true }).fill('MODIFICATION DEMO');
  await page.getByRole('button', { name: 'Enregistrer le programme', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Sauvegarde locale active', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'MODIFICATION DEMO', exact: true })).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Réinitialiser la démo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'MODIFICATION DEMO', exact: true })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Quitter la démo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Essayer la démo', exact: true })).toBeVisible();
  await expect(page.locator('main')).toHaveCount(0);
  expect(backendRequests).toEqual([]);
});
test('la démo préserve le compte connecté et ne contacte pas son backend', async ({
  page,
  context,
}) => {
  await mockBackend(context, true);
  let requests = 0;
  page.on('request', (r) => {
    if (/supabase\.co/.test(r.url())) requests++;
  });
  await page.goto('./#demo');
  await expect(page.getByRole('heading', { name: 'Ta progression, en clair.' })).toBeVisible();
  await expect(page.getByLabel('Mode démonstration')).toBeVisible();
  await nav(page, /Paramètres|Réglages/);
  await expect(
    page.getByRole('heading', { name: 'Compte de démonstration', exact: true }),
  ).toBeVisible();
  expect(requests).toBe(0);
  await page
    .getByLabel('Mode démonstration')
    .getByRole('button', { name: 'Quitter la démo', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: /Salut Karl/ })).toBeVisible();
  await expect(page.getByLabel('Mode démonstration')).toHaveCount(0);
  await nav(page, /Progression/);
  await expect(page.locator('.history-row')).toHaveCount(0);
});
test('la démo reste consultable hors ligne et sans débordement mobile', async ({
  page,
  context,
}) => {
  await page.goto('./#demo');
  await expect(page.getByRole('heading', { name: 'Ta progression, en clair.' })).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.performance-card svg[role="img"]')).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
