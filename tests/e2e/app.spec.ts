import { test, expect, type Page } from '@playwright/test';

async function nav(page: Page, name: RegExp) {
  await page.locator('nav:visible').getByRole('button', { name }).click();
}
async function startThursday(page: Page) {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: /Salut Karl/ })).toBeVisible();
  await page.getByRole('button', { name: 'Jeu 3 exos' }).click();
  await page.getByRole('button', { name: 'Démarrer la séance', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Muscle-up focus', exact: true })).toBeVisible();
}

test('jeudi, séries tactiles, reprise après fermeture, pic/RIR et historique figé', async ({
  page,
  context,
}) => {
  await startThursday(page);
  await expect(page.getByRole('button', { name: /Traction lestée/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Squat.*Technique/ })).toBeVisible();
  await page.getByRole('button', { name: 'Muscle-up Pic série 1', exact: true }).click();
  await page.getByRole('button', { name: 'RIR 3', exact: true }).click();
  await expect(page.getByText('SAUVEGARDÉ EN LOCAL', { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Muscle-up Pic série 1', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'RIR 3', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  // Close the entire tab, then resume with the same IndexedDB.
  await page.close();
  const resumed = await context.newPage();
  await resumed.goto('./#workout');
  await expect(
    resumed.getByRole('button', { name: 'Muscle-up Pic série 1', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  // Change the prescribed load in the program while the session is active.
  await nav(resumed, /Programme/);
  await resumed
    .locator('.program-choice')
    .filter({ hasText: 'Muscle-up focus' })
    .getByRole('button', { name: 'Modifier la séance' })
    .click();
  const editor = resumed.getByRole('dialog');
  const peak = editor.locator('.editor-exercise').first().locator('.editor-block').nth(3);
  await peak.getByLabel('Charge (kg)', { exact: true }).fill('15');
  await editor.getByRole('button', { name: 'Enregistrer le programme', exact: true }).click();
  await nav(resumed, /Entraînement|Séance/);
  await expect(
    resumed.locator('.peak-block').first().getByText('+10 kg', { exact: true }),
  ).toBeVisible();
  resumed.once('dialog', (dialog) => dialog.accept());
  await resumed.getByRole('button', { name: 'Terminer la séance', exact: true }).click();
  await expect(resumed.getByRole('heading', { name: 'Ta progression, en clair.' })).toBeVisible();
  await expect(resumed.locator('.history-row')).toHaveCount(1);
  await resumed.locator('.history-row').click();
  const detail = resumed.getByRole('dialog');
  await expect(detail.getByText('+10 kg · 1×3', { exact: true })).toBeVisible();
  await expect(detail.getByText('· RIR 3', { exact: false })).toBeVisible();
  await detail.getByRole('button', { name: 'Fermer', exact: true }).click();
  await nav(resumed, /Programme/);
  await resumed
    .locator('.program-choice')
    .filter({ hasText: 'Muscle-up focus' })
    .getByRole('button', { name: 'Modifier la séance' })
    .click();
  const updatedPeak = resumed
    .getByRole('dialog')
    .locator('.editor-exercise')
    .first()
    .locator('.editor-block')
    .nth(3);
  await updatedPeak.getByLabel('Charge (kg)', { exact: true }).fill('20');
  await resumed.getByRole('button', { name: 'Enregistrer le programme', exact: true }).click();
  await nav(resumed, /Progression/);
  await resumed.locator('.history-row').click();
  await expect(
    resumed.getByRole('dialog').getByText('+10 kg · 1×3', { exact: true }),
  ).toBeVisible();
});

test('PWA : rechargement hors connexion et sauvegarde persistante', async ({ page, context }) => {
  await startThursday(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Muscle-up focus', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Muscle-up Pic série 2', exact: true }).click();
  await expect(page.getByText('SAUVEGARDÉ EN LOCAL', { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Muscle-up Pic série 2', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await nav(page, /Progression/);
  await expect(page.getByRole('heading', { name: 'Ta progression, en clair.' })).toBeVisible();
  await nav(page, /Programme/);
  await expect(page.getByRole('heading', { name: 'Un programme qui évolue.' })).toBeVisible();
  await nav(page, /Paramètres|Réglages/);
  await expect(page.getByRole('heading', { name: 'Les réglages, simplement.' })).toBeVisible();
  await context.setOffline(false);
});

test('export JSON, restauration avec confirmation et pesée', async ({ page }) => {
  await page.goto('./#settings');
  await expect(page.getByRole('heading', { name: 'Les réglages, simplement.' })).toBeVisible();
  await page.getByLabel('Poids (kg)', { exact: true }).fill('77.2');
  await page.getByRole('button', { name: 'Enregistrer la pesée', exact: true }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter tout · JSON', exact: true }).click();
  const download = await downloaded;
  const path = await download.path();
  expect(path).toBeTruthy();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByLabel('Fichier de sauvegarde JSON', { exact: true }).setInputFiles(path!);
  await expect(page.getByText('Sauvegarde importée.', { exact: true })).toBeVisible();
  await nav(page, /Progression/);
  await expect(
    page.locator('.weight-stats').getByText('77,2', { exact: false }).first(),
  ).toBeVisible();
});

test('navigation responsive sans débordement et sans erreurs JavaScript', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const hash of ['home', 'workout', 'progress', 'program', 'settings']) {
    await page.goto(`./#${hash}`);
    await expect(page.locator('main')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});
