import { test, expect } from '@playwright/test';

test('courbes : isoler, masquer, restaurer et parcourir les performances au clavier', async ({
  page,
}) => {
  await page.goto('./#demo');
  const exerciseControls = page.getByRole('group', { name: 'Exercice affiché' });
  await exerciseControls.getByRole('button', { name: 'Traction', exact: true }).click();
  const card = page.locator('.performance-card');
  await expect(card).toHaveCount(1);
  const seriesCount = await card.locator('.legend-toggle').count();
  expect(seriesCount).toBeGreaterThan(1);
  await card.locator('.legend-isolate').first().click();
  await expect(card.locator('.chart-line')).toHaveCount(1);
  await expect(card.locator('.legend-toggle[aria-pressed="true"]')).toHaveCount(1);
  await card.locator('.legend-head').getByRole('button', { name: 'Tout afficher' }).click();
  await expect(card.locator('.chart-line')).toHaveCount(seriesCount);
  for (let i = 0; i < seriesCount; i++) await card.locator('.legend-toggle').nth(i).click();
  await expect(card.getByText('Toutes les séries sont masquées.')).toBeVisible();
  await card.locator('.empty-chart').getByRole('button', { name: 'Tout afficher' }).click();
  await expect(card.locator('.chart-line')).toHaveCount(seriesCount);
  const slider = card.getByRole('slider');
  await slider.focus();
  await slider.press('Home');
  await expect(slider).toHaveValue('0');
  await expect(card.getByText('POINT ÉPINGLÉ', { exact: true })).toBeVisible();
  const firstDate = await card.locator('.point-navigation strong').innerText();
  await slider.press('End');
  expect(await card.locator('.point-navigation strong').innerText()).not.toBe(firstDate);
  await card.getByRole('button', { name: 'Point précédent', exact: true }).click();
  const selectedDate = await card.locator('.point-navigation strong').innerText();
  await card.getByRole('button', { name: 'Voir la séance', exact: true }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(
    page.getByRole('dialog').getByText('Prescription conservée à la date de séance').first(),
  ).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Fermer', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(card.locator('.point-navigation strong')).toHaveText(selectedDate);
  await page.getByRole('button', { name: 'Points', exact: true }).click();
  await expect(card.locator('.chart-dot')).toHaveCount(0);
  await expect(card.locator('.chart-line')).toHaveCount(seriesCount);
  // Pin a point by touch/click, without depending on the native SVG title tooltip.
  await card.getByRole('button', { name: 'Libérer', exact: true }).click();
  await card.locator('svg[role="img"]').click({ position: { x: 80, y: 70 } });
  await expect(card.getByText('POINT ÉPINGLÉ', { exact: true })).toBeVisible();
  const weight = page.locator('.weight-card');
  await weight.getByRole('button', { name: /Limite de catégorie/ }).click();
  await expect(weight.locator('.chart-limit-line')).toHaveCount(0);
});

test('filtres lisibles, vue ciblée, recherche et détails historiques cohérents', async ({
  page,
}) => {
  await page.goto('./#demo');
  await expect(page.locator('.performance-card')).toHaveCount(4);
  const total = await page.locator('.history-row').count();
  await page
    .getByRole('group', { name: 'Période', exact: true })
    .getByRole('button', { name: '1 mois', exact: true })
    .click();
  await expect(page.getByRole('button', { name: '1 mois', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(await page.locator('.history-row').count()).toBeLessThan(total);
  await page.getByLabel('Mesure du graphique', { exact: true }).selectOption('e1rm');
  await expect(
    page.locator('.performance-card').first().getByText('Dernier pic · estimé'),
  ).toBeVisible();
  await page.getByLabel('Type de séance', { exact: true }).selectOption('Technique');
  const names = await page.locator('.performance-card .legend-toggle').allTextContents();
  expect(names.every((name) => name.includes('Technique'))).toBe(true);
  await page.getByRole('button', { name: 'Réinitialiser', exact: true }).click();
  await expect(page.locator('.history-row')).toHaveCount(total);
  await page.getByLabel('Rechercher dans l’historique', { exact: true }).fill('bilan');
  await expect(page.locator('.history-row')).toHaveCount(3);
  await page.locator('.history-row').first().click();
  await expect(page.getByRole('dialog').locator('.history-exercise')).toHaveCount(4);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Rechercher dans l’historique', { exact: true }).fill('introuvable-xyz');
  await expect(
    page.getByText('Aucune séance pour cette sélection.', { exact: true }),
  ).toBeVisible();
  await page.getByLabel('Rechercher dans l’historique', { exact: true }).fill('');
  await expect(page.locator('.history-row')).toHaveCount(total);
});

test('animations réglables, préférences système respectées et suivi sans débordement', async ({
  page,
}) => {
  await page.goto('./#demo');
  const motion = page.getByLabel('Animations de l’interface', { exact: true });
  await motion.selectOption('off');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
  expect(await page.locator('main').evaluate((el) => getComputedStyle(el).animationName)).toBe(
    'none',
  );
  await page.reload();
  await expect(motion).toHaveValue('off');
  await motion.selectOption('reduced');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await motion.selectOption('full');
  expect(await page.locator('main').evaluate((el) => getComputedStyle(el).animationName)).toBe(
    'none',
  );
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 850 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
});
