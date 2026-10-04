import { expect, type Page } from '@playwright/test';

export const API = 'http://localhost:4100/api';

/**
 * Opens the app online and waits until the service worker controls the page
 * and the regional offline pack has been downloaded — i.e. the state a
 * device is in after its first online visit.
 */
export async function primeOnline(page: Page) {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // Reload so the (now active) service worker controls the page.
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await expect(page.getByRole('link', { name: /Connection: Online/ })).toBeVisible();
  // Wait for the offline pack (shelters/alerts) to land in IndexedDB.
  await expect(page.getByText(/Alerts last synchronised/)).toBeVisible();
}

export async function goOffline(page: Page) {
  await page.context().setOffline(true);
  await expect(page.getByRole('link', { name: /Connection: Offline/ })).toBeVisible();
}

export async function goOnline(page: Page) {
  await page.context().setOffline(false);
}

/** Fills the full "Request help" form with a manual location. */
export async function fillRequestForm(page: Page, place: string) {
  await page.getByLabel('Flood').check();
  await page.getByLabel(/^High/).check();
  await page.getByLabel('2–5').check();
  await page.getByLabel('Elderly person').check();
  await page.getByLabel('Where are you?').fill(place);
  await page.getByLabel('Additional message').fill('Water entering the ground floor');
}

export async function responderToken(request: import('@playwright/test').APIRequestContext) {
  const res = await request.post(`${API}/auth/login`, {
    data: { email: 'responder@resqnet.local', password: process.env.SEED_DEMO_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
  return ((await res.json()) as { accessToken: string }).accessToken;
}
