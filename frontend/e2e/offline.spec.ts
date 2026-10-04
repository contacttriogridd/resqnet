import { expect, test } from '@playwright/test';
import { API, fillRequestForm, goOffline, goOnline, primeOnline, responderToken } from './helpers';

/**
 * User-acceptance scenarios from the RESQNET specification, executed in a
 * real browser against the production build and a real backend.
 */

test('Scenario 1 — online: submit emergency → backend receives it', async ({ page, request }) => {
  await primeOnline(page);
  await page.goto('/help');
  const place = `E2E-online ${Date.now()}: Gandhipuram 3rd street`;
  await fillRequestForm(page, place);
  await page.getByRole('button', { name: 'Send request for help' }).click();

  await expect(page.getByText('Received by RESQNET')).toBeVisible();
  const ref = (await page.getByText(/^RQ-[A-Z0-9]{6}$/).textContent())!;

  const token = await responderToken(request);
  const res = await request.get(`${API}/incidents`, { headers: { Authorization: `Bearer ${token}` } });
  const { incidents } = (await res.json()) as { incidents: { referenceCode: string; locationText: string; specialRequirements: string[] }[] };
  const found = incidents.find((i) => i.referenceCode === ref);
  expect(found).toMatchObject({ locationText: place, specialRequirements: ['ELDERLY'] });
});

test('Scenarios 2 & 3 — offline request is stored locally, then synced automatically on reconnect', async ({ page, request }) => {
  const place = `E2E-offline ${Date.now()}: Ukkadam lake road`;
  await primeOnline(page);
  await goOffline(page);
  await expect(page.getByText(/You are offline\. Emergency tools remain available\./)).toBeVisible();

  // Full reload while offline: the service worker must serve the app shell.
  await page.goto('/help');
  await expect(page.getByRole('heading', { name: 'Request help' })).toBeVisible();
  await expect(page.getByText('You are offline — you can still submit.')).toBeVisible();

  await fillRequestForm(page, place);
  await page.getByRole('button', { name: 'Send request for help' }).click();

  await expect(page.getByText('Waiting for connection', { exact: false }).first()).toBeVisible();
  await expect(
    page.getByText('Your emergency request has been saved on this device and will be synchronised automatically when connectivity returns.'),
  ).toBeVisible();
  await expect(page.getByText(/Local ID:/)).toBeVisible();
  await expect(page.getByText(/1 item waiting to send/)).toBeVisible();

  // Stored in IndexedDB, not localStorage.
  const stored = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open('resqnet');
        open.onsuccess = () => {
          const tx = open.result.transaction('syncQueue', 'readonly');
          const c = tx.objectStore('syncQueue').count();
          c.onsuccess = () => resolve(c.result);
          c.onerror = () => reject(c.error);
        };
        open.onerror = () => reject(open.error);
      }),
  );
  expect(stored).toBe(1);

  // Connection returns → automatic synchronisation, no user action.
  await goOnline(page);
  await expect(page.getByText('Received by RESQNET')).toBeVisible({ timeout: 30_000 });
  const ref = (await page.getByText(/^RQ-[A-Z0-9]{6}$/).textContent())!;

  const token = await responderToken(request);
  const res = await request.get(`${API}/incidents`, { headers: { Authorization: `Bearer ${token}` } });
  const { incidents } = (await res.json()) as { incidents: { referenceCode: string }[] };
  expect(incidents.filter((i) => i.referenceCode === ref)).toHaveLength(1);

  // A further flush must not create a duplicate.
  await page.goto('/offline');
  await page.getByRole('button', { name: 'Sync now' }).click();
  await expect(page.getByText('All emergency data synchronised.').first()).toBeVisible();
  const again = (await (await request.get(`${API}/incidents`, { headers: { Authorization: `Bearer ${token}` } })).json()) as {
    incidents: { locationText: string }[];
  };
  expect(again.incidents.filter((i) => i.locationText === place)).toHaveLength(1);
});

test('Scenario 4 — safety guide opens offline', async ({ page }) => {
  await primeOnline(page);
  await goOffline(page);
  await page.goto('/guides/flood');
  await expect(page.getByRole('heading', { name: 'Flood', level: 1 })).toBeVisible();
  await expect(page.getByText('Move to higher ground or an upper floor immediately.')).toBeVisible();
  await page.goto('/guides/earthquake');
  await expect(page.getByText('DROP to your hands and knees.')).toBeVisible();
});

test('Scenario 5 — emergency contacts open offline with call links', async ({ page }) => {
  await primeOnline(page);
  await goOffline(page);
  await page.goto('/contacts');
  const call112 = page.getByRole('link', { name: /Call National Emergency Number, 112/ });
  await expect(call112).toBeVisible();
  await expect(call112).toHaveAttribute('href', 'tel:112');
  await expect(page.getByRole('link', { name: /Call Ambulance, 108/ })).toHaveAttribute('href', 'tel:108');
});

test('Scenario 6 — cached shelters show offline with their last-sync time', async ({ page }) => {
  await primeOnline(page);
  await goOffline(page);
  await page.goto('/shelters');
  await expect(page.getByText('Shelter availability is not live while offline.')).toBeVisible();
  await expect(page.getByText(/Offline information — Shelter information last synchronised/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Peelamedu Multipurpose Stadium/ })).toBeVisible();
  await page.getByRole('link', { name: /Peelamedu Multipurpose Stadium/ }).click();
  await expect(page.getByText(/places free of 800/)).toBeVisible();
});

test('Status indicator reflects connectivity changes automatically', async ({ page }) => {
  await primeOnline(page);
  await goOffline(page);
  await goOnline(page);
  await expect(page.getByRole('link', { name: /Connection: Online/ })).toBeVisible({ timeout: 20_000 });
});

test('Mobile layout: no horizontal scrolling at 360 px and emergency action always visible', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  for (const path of ['/', '/sos', '/help', '/shelters', '/contacts', '/offline']) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(0);
    await expect(page.getByRole('link', { name: 'HELP', exact: true })).toBeVisible();
  }
});
