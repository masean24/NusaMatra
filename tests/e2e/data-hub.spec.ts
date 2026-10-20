import { expect, test } from '@playwright/test';
import { mockDataHub } from './dataHubMocks';

test.describe('Jelajahi with the Data Hub (captured DEMO responses)', () => {
  test('searches, opens a region, and shows its profile and indicator value with DEMO labels', async ({
    page,
  }) => {
    await mockDataHub(page);
    await page.goto('/jelajahi');

    await expect(page.getByText('Menampilkan 30 dari 514 wilayah')).toBeVisible();
    await expect(page.getByText('Simulasi — bukan data atau rekomendasi resmi.')).toBeVisible();

    await page.getByRole('searchbox', { name: 'Cari kabupaten/kota' }).fill('Demo Jabar 1');
    await page.getByRole('button', { name: /^Kabupaten Demo Jabar 1(?![0-9])/ }).click();

    await expect(page).toHaveURL(/[?&]kode=3201/);
    await expect(page.getByRole('heading', { name: 'Kabupaten Demo Jabar 1' })).toBeVisible();
    await expect(page.getByText('Nama sintetis (DEMO), bukan nama resmi').first()).toBeVisible();
    await expect(page.getByText('DEMO_EXAMPLE').first()).toBeVisible();
    await expect(page.getByText(/Peringkat 227/)).toBeVisible();
  });

  test('answers a search for "bogor" honestly instead of inventing Kabupaten Bogor', async ({ page }) => {
    await mockDataHub(page);
    await page.goto('/jelajahi?cari=bogor');

    await expect(page.getByText('Tidak ada wilayah yang cocok pada dataset DEMO saat ini')).toBeVisible();
    await expect(page.getByText('Kabupaten Bogor')).toHaveCount(0);
  });

  test('keeps the map illustrative and says why the Point-only boundaries are not used', async ({ page }) => {
    await mockDataHub(page);
    await page.goto('/jelajahi');

    await expect(
      page.getByText('Geometri Ilustratif DEMO (Batas Poligon Resmi Belum Tersedia)'),
    ).toBeVisible();
    await expect(page.getByText(/hanya mengirim geometri Point/)).toBeVisible();
  });

  test('blocks LIVE on HTTP 503: no data, no fallback, and DEMO again only on request', async ({ page }) => {
    const mock = await mockDataHub(page);
    await page.goto('/jelajahi');
    await expect(page.getByText('Menampilkan 30 dari 514 wilayah')).toBeVisible();

    await page.locator('label', { hasText: 'LIVE' }).click();

    await expect(page.getByText('LIVE Belum Tersedia').first()).toBeVisible();
    await expect(page.getByText(/Tidak ada fallback otomatis ke data DEMO/).first()).toBeVisible();
    await expect(page.getByText(/Kabupaten Demo/)).toHaveCount(0);
    await expect(page.getByText('DEMO_EXAMPLE')).toHaveCount(0);
    const afterSwitch = mock.requests.slice(mock.requests.findIndex((url) => url.includes('mode=live')));
    expect(afterSwitch.every((url) => url.includes('mode=live'))).toBe(true);

    await page.getByRole('button', { name: 'Beralih ke data DEMO' }).first().click();
    await expect(page.getByText('Menampilkan 30 dari 514 wilayah')).toBeVisible();
  });
});

test.describe('Lab Prioritas with the Data Hub (captured DEMO responses)', () => {
  test('ranks from the Data Hub preview, labels it a DEMO preview, and re-queries on a weight change', async ({
    page,
  }) => {
    const mock = await mockDataHub(page);
    await page.goto('/lab-prioritas');

    await expect(page.getByText('Pratinjau Simulasi DEMO (Tanpa Run ID Imutabel)')).toBeVisible();
    await expect(page.getByText('Kabupaten Demo Lampung 11')).toBeVisible();
    expect(mock.compositeRequests[0]).toMatchObject({
      weights: { dis_multihazard_index: 3500, soc_poverty_rate: 2500 },
    });

    const slider = page.getByLabel('Persentase Penduduk Miskin (P0)');
    await slider.focus();
    for (let step = 0; step < 10; step += 1) await slider.press('ArrowRight');

    await expect(page.getByText(/^Total: 100%/)).toBeVisible();
    await expect.poll(() => mock.compositeRequests.length).toBeGreaterThan(1);
    const latest = mock.compositeRequests.at(-1) as { weights: Record<string, number> };
    expect(Object.values(latest.weights).reduce((sum, bps) => sum + bps, 0)).toBe(10000);
    expect(latest.weights['soc_poverty_rate']).toBe(3500);
  });

  test('blocks LIVE: no ranking appears', async ({ page }) => {
    await mockDataHub(page);
    await page.goto('/lab-prioritas');
    await expect(page.getByText('Kabupaten Demo Lampung 11')).toBeVisible();

    await page.locator('label', { hasText: 'LIVE' }).click();

    await expect(page.getByText('LIVE Belum Tersedia').first()).toBeVisible();
    await expect(page.getByText(/Kabupaten Demo/)).toHaveCount(0);
  });
});
