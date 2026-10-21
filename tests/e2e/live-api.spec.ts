import { expect, test } from '@playwright/test';

/**
 * Real HTTP against the deployed Data Hub (no mocks): the check that mocked tests cannot give.
 * It needs the public network, so it only runs on request:
 *   NUSAMATRA_LIVE_E2E=1 npx playwright test live-api
 */
test.skip(!process.env['NUSAMATRA_LIVE_E2E'], 'needs the public Data Hub; set NUSAMATRA_LIVE_E2E=1');

const LIVE_SNAPSHOT = '2026.10.0-official-live';

test.describe('LIVE against the deployed Data Hub', () => {
  test('Jelajahi: finds a real regency, shows official indicators with agency and year, and BIG boundaries', async ({
    page,
  }) => {
    await page.goto('/jelajahi');
    await page.locator('label', { hasText: 'LIVE' }).click();
    await expect(page.getByText(LIVE_SNAPSHOT)).toBeVisible();

    await page.getByRole('searchbox', { name: 'Cari kabupaten/kota' }).fill('Aceh Selatan');
    await page.getByRole('button', { name: /^Kabupaten Aceh Selatan/ }).click();

    await expect(page).toHaveURL(/[?&]kode=1101/);
    await expect(page.getByRole('heading', { name: 'Kabupaten Aceh Selatan' })).toBeVisible();
    await expect(page.getByText('Tahun 2024').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'BNPB' }).first()).toBeVisible();
    // The BIG polygons are a ~5.5 MB download, so allow for the real network.
    await expect(page.getByText('Batas wilayah resmi (BIG)')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText(/luas wilayah dari sumber tidak valid/)).toBeVisible();
    await expect(page.getByText('DEMO_EXAMPLE')).toHaveCount(0);
    await expect(page.getByText(/Kabupaten Demo/)).toHaveCount(0);
  });

  test('Bandingkan: compares two real regions and blocks what is not comparable', async ({ page }) => {
    await page.goto('/bandingkan?a=1101&b=3171');
    await page.locator('label', { hasText: 'LIVE' }).click();

    await expect(page.getByText(/Dari 16 indikator, 14 dapat dibandingkan/)).toBeVisible();
    const imputed = page.getByRole('row', { name: /Pengguna Listrik/ });
    await expect(imputed.getByText('Tidak dibandingkan')).toBeVisible();
    await expect(imputed.getByText(/diimputasi dari nilai provinsi/)).toBeVisible();
    await expect(page.getByText(/Kabupaten Demo/)).toHaveCount(0);
  });

  test('Lab Prioritas: shows a LIVE ranking only if it passes the integrity check, never a DEMO one', async ({
    page,
  }) => {
    await page.goto('/lab-prioritas');
    await page.locator('label', { hasText: 'LIVE' }).click();

    await expect(page.getByText('Pratinjau Eksploratif LIVE (Tanpa Run ID Imutabel)')).toBeVisible();
    const withheld = page.getByText('Peringkat ditahan: hasil komposit tidak konsisten');
    const ranking = page.getByText(/^Menampilkan \d+ dari \d+ wilayah/);
    await expect(withheld.or(ranking)).toBeVisible();
    await expect(page.getByText(/Kabupaten Demo/)).toHaveCount(0);
    await expect(page.getByText(/bukan wilayah dengan prioritas intervensi tertinggi/)).toBeVisible();
  });
});
