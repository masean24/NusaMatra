import { expect, test, type Page } from '@playwright/test';
import { mockDataHub } from './dataHubMocks';

const API = '**/api/v1/**';

/** Added after the mock, so it answers first: nothing reaches the Data Hub until it is removed. */
async function cutConnection(page: Page) {
  let requests = 0;
  await page.route(API, (route) => {
    requests += 1;
    return route.abort();
  });
  return {
    requests: () => requests,
    restore: () => page.unroute(API),
  };
}

test.describe('Recovering from a connection failure', () => {
  test('Lab Prioritas blames the connection, stays put, and recovers without a reload', async ({ page }) => {
    await mockDataHub(page);
    const connection = await cutConnection(page);
    let navigations = 0;
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) navigations += 1;
    });
    await page.goto('/lab-prioritas');

    await expect(page.getByText('Data belum dapat dimuat')).toBeVisible();
    await expect(page.getByText(/belum diverifikasi/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Beralih ke data DEMO' })).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Peringkat wilayah' })).toHaveCount(0);

    // Still down: the failure stays, and nothing retries by itself.
    const retry = page.getByRole('button', { name: 'Coba lagi' }).first();
    await retry.click();
    await expect(page.getByText('Data belum dapat dimuat')).toBeVisible();
    const afterRetry = connection.requests();
    await page.waitForTimeout(1500);
    expect(connection.requests()).toBe(afterRetry);

    const navigationsBefore = navigations;
    await connection.restore();
    await retry.click();

    await expect(page.getByRole('region', { name: 'Peringkat wilayah' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Coba lagi' })).toHaveCount(0);
    expect(navigations).toBe(navigationsBefore);
  });

  test('Jelajahi: one "Coba lagi" recovers every panel that failed', async ({ page, isMobile }) => {
    // This suite builds DEMO, whose map has no boundary request, so on a phone every failed panel is
    // folded away. The LIVE map keeps its own retry on screen.
    test.skip(isMobile, 'the phone retry lives on the LIVE map panel, which a DEMO build does not have');
    await mockDataHub(page);
    const connection = await cutConnection(page);
    await page.goto('/jelajahi');
    const visibleRetry = page.getByRole('button', { name: 'Coba lagi' }).filter({ visible: true }).first();
    await expect(visibleRetry).toBeVisible();
    await expect(page.getByText('Tidak ada data LIVE untuk ditampilkan di sini.')).toHaveCount(0);
    await expect.poll(() => page.getByRole('button', { name: 'Coba lagi' }).count()).toBeGreaterThan(1);

    await connection.restore();
    await visibleRetry.click();

    await expect(page.getByRole('button', { name: 'Coba lagi' })).toHaveCount(0);
  });

  test('Bandingkan keeps both chosen regions in the address while it recovers', async ({ page }) => {
    await mockDataHub(page);
    const connection = await cutConnection(page);
    const address = '/bandingkan?a=3201&b=3273';
    await page.goto(address);
    await expect(page.getByRole('button', { name: 'Coba lagi' }).first()).toBeVisible();

    await connection.restore();
    await page.getByRole('button', { name: 'Coba lagi' }).first().click();

    await expect(page).toHaveURL(new RegExp(address.replace('?', '\\?')));
    await expect(page.getByText('Koneksi sedang bermasalah', { exact: false })).toHaveCount(0);
  });
});
