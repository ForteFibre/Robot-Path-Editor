import { expect, test, type Page } from '@playwright/test';

type WebManifest = {
  background_color: string;
  display: string;
  icons: Array<{
    purpose?: string;
    src: string;
    type: string;
  }>;
  name: string;
  short_name: string;
  theme_color: string;
};

const readManifest = async (page: Page): Promise<WebManifest> => {
  const manifestUrl = new URL('/manifest.webmanifest', page.url()).toString();
  const response = await page.request.get(manifestUrl);

  expect(response.ok()).toBeTruthy();

  return (await response.json()) as WebManifest;
};

const waitForActivatedServiceWorker = async (page: Page): Promise<void> => {
  await expect
    .poll(async () => {
      return await page.evaluate(async () => {
        if (!('serviceWorker' in navigator)) {
          return null;
        }

        const registration = await navigator.serviceWorker.getRegistration();
        return registration?.active?.state ?? null;
      });
    })
    .toBe('activated');
};

const waitForServiceWorkerController = async (page: Page): Promise<void> => {
  await expect
    .poll(async () => {
      return await page.evaluate(() => {
        return navigator.serviceWorker.controller?.scriptURL ?? null;
      });
    })
    .toContain('/sw.js');
};

test('production preview exposes PWA metadata and registers the service worker', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page.getByLabel('top toolbar')).toBeVisible();
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    '/manifest.webmanifest',
  );
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    'content',
    '#3b82f6',
  );
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
    'href',
    '/icons/favicon.svg',
  );
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    'href',
    '/icons/apple-touch-icon.svg',
  );

  const manifest = await readManifest(page);

  expect(manifest.name).toBe('Robot Path Editor');
  expect(manifest.short_name).toBe('Path Editor');
  expect(manifest.display).toBe('standalone');
  expect(manifest.background_color).toBe('#f8fafc');
  expect(manifest.theme_color).toBe('#3b82f6');
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        src: '/icons/icon.svg',
        type: 'image/svg+xml',
      }),
      expect.objectContaining({
        purpose: 'maskable',
        src: '/icons/maskable-icon.svg',
      }),
    ]),
  );

  await waitForActivatedServiceWorker(page);
  await waitForServiceWorkerController(page);

  const serviceWorkerResponse = await page.request.get(
    new URL('/sw.js', page.url()).toString(),
  );
  expect(serviceWorkerResponse.ok()).toBeTruthy();

  await page.reload();
  await expect(page.getByLabel('top toolbar')).toBeVisible();
});

test('production preview boots offline after the service worker activates', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByLabel('top toolbar')).toBeVisible();

  await waitForActivatedServiceWorker(page);

  await page.reload();
  await waitForServiceWorkerController(page);

  await page.context().setOffline(true);
  await page.reload();

  await expect(page.getByLabel('top toolbar')).toBeVisible();
});
