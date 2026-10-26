import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page, name: string) {
  await page.goto('./');
  await page.getByRole('button', { name: new RegExp(name) }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Hei');
}

/** Most recent past meeting in the demo data. */
async function openLastMeeting(page: Page, tab: string) {
  await page.goto('./#/moter');
  const link = page.locator('section[aria-labelledby="past-heading"] a').first();
  await link.waitFor();
  const href = (await link.getAttribute('href')) ?? '';
  await page.goto(`./${href}?fane=${tab}`);
}

test('has a valid PWA manifest and icons', async ({ page, request }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const manifest = await (await request.get(href as string)).json();
  expect(manifest.name).toBe('Fag & Sosialt');
  expect(manifest.display).toBe('standalone');
  expect(manifest.lang).toBe('nb');
  for (const icon of manifest.icons as { src: string }[]) {
    const res = await request.get(icon.src);
    expect(res.status(), icon.src).toBe(200);
    expect(res.headers()['content-type']).toContain('image/png');
  }
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveCount(1);
});

test('works offline after the first visit', async ({ page, context }) => {
  await signIn(page, 'Kari Nordmann');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload(); // now controlled by the service worker
  await expect(page.getByRole('heading', { name: 'Hei, Kari!' })).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hei, Kari!' })).toBeVisible();
  await expect(page.getByText('Du er frakoblet', { exact: false })).toBeVisible();
  await context.setOffline(false);
});

test('a full Friday: agenda, notes, points, rating and summary', async ({ page }) => {
  await signIn(page, 'Ola Hansen'); // organizer
  await openLastMeeting(page, 'agenda');

  // agenda: add + check off
  await page.getByRole('button', { name: 'Nytt punkt' }).click();
  await page.getByRole('dialog').getByLabel('Tittel').fill('E2E-tema');
  await page.getByRole('dialog').getByRole('button', { name: 'Lagre' }).click();
  const item = page.locator('li', { hasText: 'E2E-tema' });
  await item.getByRole('checkbox').click();
  await expect(item.getByRole('checkbox')).toHaveAttribute('aria-checked', 'true');

  // decision note
  await page.getByRole('tab', { name: 'Diskusjon' }).click();
  await page.locator('section', { hasText: 'Beslutninger' }).getByRole('button', { name: 'Nytt notat' }).click();
  await page.getByRole('dialog').getByLabel('Innhold').fill('Vi bestemte oss for E2E-testing');
  await page.getByRole('dialog').getByRole('button', { name: 'Lagre' }).click();
  await expect(page.getByText('Vi bestemte oss for E2E-testing')).toBeVisible();

  // points
  await page.getByRole('tab', { name: 'Poeng' }).click();
  await page.getByRole('button', { name: 'Registrer poeng' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Deltaker').selectOption({ label: 'Emil Dahl' });
  await dialog.getByLabel('Aktivitet').fill('E2E-quiz');
  await dialog.getByLabel('Poeng', { exact: true }).fill('42');
  await dialog.getByRole('button', { name: 'Lagre' }).click();
  await expect(page.getByText('E2E-quiz').first()).toBeVisible();

  // rating: give and change
  await page.getByRole('tab', { name: 'Vurdering' }).click();
  await page.getByRole('radio', { name: 'Karakter 9' }).click();
  await expect(page.getByText('Du har gitt 9', { exact: false })).toBeVisible();
  await page.getByRole('radio', { name: 'Karakter 8' }).click();
  await expect(page.getByText('Du har gitt 8', { exact: false })).toBeVisible();

  // summary contains everything
  await page.getByRole('tab', { name: 'Referat' }).click();
  const summary = page.getByRole('tabpanel');
  await expect(summary.getByText('E2E-tema')).toBeVisible();
  await expect(summary.getByText('Vi bestemte oss for E2E-testing')).toBeVisible();
  await expect(summary.getByText(/Emil Dahl: \d+ poeng/)).toBeVisible();

  // data survives a reload
  await page.reload();
  await expect(page.getByRole('tabpanel').getByText('E2E-tema')).toBeVisible();
});

test('every navigation section opens', async ({ page, isMobile }) => {
  await signIn(page, 'Ingrid Berg');
  const sections: [string, string][] = [
    ['Møter', 'Møtearkiv'],
    ['Kalender', 'Kalender'],
    ['Agenda', 'Agenda'],
    ['Poengtavle', 'Poengtavle'],
    ['Statistikk', 'Statistikk'],
    ['Deltakere', 'Deltakere'],
    ['Innstillinger', 'Innstillinger'],
    ['Hjem', 'Hei, Ingrid!'],
  ];
  for (const [link, heading] of sections) {
    const inBar = ['Hjem', 'Møter', 'Kalender', 'Poengtavle'].includes(link);
    if (isMobile && !inBar) await page.getByRole('button', { name: 'Mer' }).click();
    await page.getByRole('link', { name: link, exact: true }).locator('visible=true').first().click();
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  }
});

test('calendar opens the page for a Friday', async ({ page }) => {
  await signIn(page, 'Kari Nordmann');
  await page.goto('./#/kalender');
  await page.getByRole('button', { name: /^Fredag \d+\. \w+ \d{4}/ }).first().click();
  await expect(page).toHaveURL(/#\/moter\/\d{4}-\d\d-\d\d/);
});

test('has no horizontal scrolling on any main page', async ({ page }) => {
  await signIn(page, 'Kari Nordmann');
  for (const route of ['', '#/moter', '#/kalender', '#/agenda', '#/poengtavle', '#/statistikk', '#/deltakere', '#/innstillinger']) {
    await page.goto(`./${route}`);
    await page.getByRole('heading', { level: 1 }).waitFor();
    await page.waitForTimeout(200);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, route || 'home').toBeLessThanOrEqual(0);
  }
});
