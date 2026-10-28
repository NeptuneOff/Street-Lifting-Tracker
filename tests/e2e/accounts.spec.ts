import { test, expect, type Page } from '@playwright/test';
import { mockBackend, A } from './fixtures';
async function login(page: Page, email: string) {
  await page.getByLabel('Adresse e-mail', { exact: true }).fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill('correct-horse-123');
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Salut/ })).toBeVisible();
}
async function nav(page: Page, name: RegExp) {
  await page.locator('nav:visible').getByRole('button', { name }).click();
}
async function logout(page: Page) {
  await nav(page, /Paramètres|Réglages/);
  await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Se connecter', exact: true })).toBeVisible();
}
async function rename(page: Page, name: string) {
  await nav(page, /Programme/);
  await page
    .locator('.program-choice')
    .first()
    .getByRole('button', { name: 'Modifier la séance' })
    .click();
  await page.getByLabel('Nom de la séance', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Enregistrer le programme', exact: true }).click();
}

test('aucune donnée ni navigation personnelle avant connexion, même par lien direct', async ({
  page,
  context,
}) => {
  await mockBackend(context, false);
  for (const route of ['home', 'program', 'progress', 'settings', 'workout']) {
    await page.goto(`./#${route}`);
    await expect(page.getByRole('button', { name: 'Se connecter', exact: true })).toBeVisible();
    await expect(page.locator('main')).toHaveCount(0);
    await expect(page.getByText('Karl', { exact: true })).toHaveCount(0);
  }
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Se connecter', exact: true })).toBeVisible();
  await expect(page.locator('main')).toHaveCount(0);
});
test('deux utilisateurs sur le même navigateur : programmes et séance restent privés après déconnexion', async ({
  page,
  context,
}) => {
  await mockBackend(context, false);
  await page.goto('./');
  await login(page, 'karl@example.test');
  await expect(
    page.locator('.preview-exercises').getByText('+10 kg', { exact: true }),
  ).toBeVisible();
  await rename(page, 'PROGRAMME PRIVE KARL');
  await nav(page, /Entraînement|Séance/);
  await page
    .locator('.program-choice')
    .filter({ hasText: 'Muscle-up focus' })
    .getByRole('button', { name: 'Démarrer', exact: true })
    .click();
  await page.getByRole('button', { name: 'Muscle-up Pic série 1', exact: true }).click();
  await page.getByRole('button', { name: 'RIR 3', exact: true }).click();
  await expect(page.getByText('SAUVEGARDÉ EN LOCAL', { exact: true })).toBeVisible();
  await logout(page);
  await expect(page.getByText('PROGRAMME PRIVE KARL', { exact: true })).toHaveCount(0);
  await login(page, 'bob@example.test');
  await expect(page.getByRole('heading', { name: /Salut Bob/ })).toBeVisible();
  await nav(page, /Programme/);
  await expect(page.getByText('PROGRAMME PRIVE KARL', { exact: true })).toHaveCount(0);
  await rename(page, 'PROGRAMME PRIVE BOB');
  await nav(page, /Entraînement|Séance/);
  await expect(page.getByRole('heading', { name: 'À toi de jouer.' })).toBeVisible();
  await logout(page);
  await login(page, 'karl@example.test');
  await nav(page, /Programme/);
  await expect(
    page.getByRole('heading', { name: 'PROGRAMME PRIVE KARL', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('PROGRAMME PRIVE BOB', { exact: true })).toHaveCount(0);
  await nav(page, /Entraînement|Séance/);
  await expect(
    page.getByRole('button', { name: 'Muscle-up Pic série 1', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'RIR 3', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
test('une réponse réseau tardive du compte A ne remplit jamais le carnet de B', async ({
  page,
  context,
}) => {
  const backend = await mockBackend(context, false);
  await page.goto('./');
  await login(page, 'karl@example.test');
  await expect(
    page.locator('.preview-exercises').getByText('+10 kg', { exact: true }),
  ).toBeVisible();
  const release = backend.holdNextRead(A);
  await nav(page, /Paramètres|Réglages/);
  await page.getByRole('button', { name: 'Synchroniser maintenant', exact: true }).click();
  await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Se connecter', exact: true })).toBeVisible();
  await login(page, 'bob@example.test');
  release();
  await expect(page.getByRole('heading', { name: /Salut Bob/ })).toBeVisible();
  await nav(page, /Paramètres|Réglages/);
  await expect(page.getByText('karl@example.test', { exact: true })).toHaveCount(0);
  await expect(page.getByText('bob@example.test', { exact: true })).toBeVisible();
});
test('création de compte : confirmation nécessaire avant tout accès privé', async ({
  page,
  context,
}) => {
  await mockBackend(context, false);
  await page.goto('./');
  await page.getByRole('button', { name: 'Créer un compte', exact: true }).click();
  await page.getByLabel('Prénom', { exact: true }).fill('Bob');
  await page.getByLabel('Adresse e-mail', { exact: true }).fill('bob@example.test');
  await page.getByLabel('Mot de passe', { exact: true }).fill('correct-horse-123');
  await page.getByRole('button', { name: 'Créer mon espace', exact: true }).click();
  await expect(
    page.getByText('Vérifie ta boîte e-mail pour confirmer ton compte, puis connecte-toi.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator('main')).toHaveCount(0);
});
