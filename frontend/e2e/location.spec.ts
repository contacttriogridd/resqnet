import { expect, test } from '@playwright/test';
import { API, goOffline, goOnline, primeOnline, responderToken } from './helpers';

const RESCUE = { latitude: 10.98912, longitude: 76.96143, accuracy: 12 };

test('Rescue location is detected by GPS while the internet is down, and synced with the request', async ({ page, context, request }) => {
  await primeOnline(page);
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation(RESCUE);
  await goOffline(page);

  await page.goto('/sos');
  // Location is found automatically on the SOS screen, with no internet.
  await expect(page.getByText(/^Location found/)).toBeVisible();
  await expect(page.getByText(/10\.98912° N, 76\.96143° E/)).toBeVisible();
  await expect(page.getByText(/accurate to ~12 m/)).toBeVisible();

  await page.getByRole('radio', { name: 'Trapped person' }).click();
  const place = `E2E-gps ${Date.now()}`;
  await page.getByLabel('Describe the place (optional)').fill(place);
  await page.getByRole('button', { name: 'Send emergency request' }).click();
  await expect(page.getByText('Waiting for connection', { exact: false }).first()).toBeVisible();
  await expect(page.getByText(/10\.98912° N, 76\.96143° E/)).toBeVisible();

  await goOnline(page);
  await expect(page.getByText('Received by RESQNET')).toBeVisible({ timeout: 30_000 });

  const token = await responderToken(request);
  const res = await request.get(`${API}/incidents`, { headers: { Authorization: `Bearer ${token}` } });
  const { incidents } = (await res.json()) as {
    incidents: { locationText: string; latitude: number; longitude: number; locationSource: string; receivedVia: string }[];
  };
  expect(incidents.find((i) => i.locationText === place)).toMatchObject({
    latitude: RESCUE.latitude,
    longitude: RESCUE.longitude,
    locationSource: 'GPS',
    receivedVia: 'SYNC',
  });
});

test('Falls back to the last known location when a new fix is impossible', async ({ page, context }) => {
  await primeOnline(page);
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation(RESCUE);
  await page.goto('/sos');
  await expect(page.getByText(/^Location found/)).toBeVisible();

  // The internet goes down, and location access is blocked.
  await goOffline(page);
  await context.clearPermissions();
  await page.goto('/help');
  await expect(page.getByText(/permission was denied/)).toBeVisible();

  await page.getByRole('button', { name: /Last known location/ }).click();
  await expect(page.getByText('Using a saved location')).toBeVisible();
  await expect(page.getByText(/10\.98912° N, 76\.96143° E/)).toBeVisible();
  await expect(page.getByLabel('Describe the place (optional)')).toHaveValue(/Last known GPS position from/);
});
