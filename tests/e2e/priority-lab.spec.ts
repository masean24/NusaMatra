import { expect, test, type Page } from '@playwright/test';
import { mockLiveLab, type CompositeKind } from './liveLabMock';

/**
 * Lab Prioritas in LIVE, MOCKED: the guide v2 contract simulated over the captured LIVE data
 * (liveLabMock.ts). Proves the frontend flow, not the deployed Data Hub.
 */

async function openLiveLab(page: Page, composite: CompositeKind = 'v2') {
  const mock = await mockLiveLab(page, composite);
  await page.goto('/lab-prioritas');
  await expect(page.getByText('Kabupaten Demo Lampung 11')).toBeVisible(); // DEMO first
  await page.locator('label', { hasText: 'LIVE' }).click();
  return mock;
}

const results = (page: Page) => page.getByRole('region', { name: 'Daftar peringkat' });

test.describe('Lab Prioritas in LIVE (MOCKED guide v2 contract)', () => {
  test('ranks LIVE regions, discloses the rest, explains a score, and never shows DEMO names', async ({
    page,
  }) => {
    const mock = await openLiveLab(page);

    await expect(page.getByText('Data resmi LIVE · pratinjau, belum disimpan')).toBeVisible();
    await expect(page.getByText(/wilayah tidak masuk peringkat — lihat daftar/)).toBeVisible();
    await expect(results(page).getByText(/^Menampilkan 10 dari \d+ wilayah/)).toBeVisible();
    await expect(page.getByText(/Kabupaten Demo/)).toHaveCount(0);
    expect(mock.compositeRequests.at(-1)?.weights).toEqual({
      soc_hdi: 3000,
      dis_multihazard_index: 3000,
      soc_poverty_rate: 2000,
      hlt_stunting_prevalence: 2000,
    });

    const firstBest = await results(page).locator('ol > li').first().innerText();
    await page.getByRole('button', { name: 'Kondisi paling berat dulu' }).click();
    await expect(results(page).locator('ol > li').first()).not.toHaveText(firstBest);

    await page.getByRole('button', { name: 'Mengapa skor ini?' }).first().click();
    const breakdown = page.getByRole('table', { name: /Sumbangan setiap kriteria/ });
    await expect(breakdown).toBeVisible();
    await expect(breakdown.getByRole('row')).toHaveCount(6);
  });

  test('a preset with an indicator without data shows where its weight went', async ({ page }) => {
    await openLiveLab(page);
    await expect(results(page)).toBeVisible();

    await page.getByRole('button', { name: 'Risiko bencana & sekolah' }).click();
    await expect(page.getByText(/1 kriteria belum punya data, jadi bobotnya dialihkan/)).toBeVisible();
    const table = page.getByRole('table', { name: /Bobot pilihan Anda/ });
    await expect(table.getByText('Tidak dipakai (tanpa data)')).toBeVisible();
    await expect(table.getByText('43,75%')).toBeVisible();
  });

  test('dragging a slider settles to one request with weights summing to exactly 10 000', async ({
    page,
  }) => {
    const mock = await openLiveLab(page);
    await expect(results(page)).toBeVisible();
    const before = mock.compositeRequests.length;

    const slider = page.getByLabel('Bobot Persentase Penduduk Miskin (P0)');
    await slider.focus();
    for (let step = 0; step < 15; step += 1) await slider.press('ArrowRight');
    await expect(page.getByText(/^Total: 100%/)).toBeVisible();
    await expect.poll(() => mock.compositeRequests.at(-1)?.weights['soc_poverty_rate']).toBe(3500);
    await expect(results(page)).toBeVisible();

    const sent = mock.compositeRequests.slice(before);
    expect(sent.length).toBeLessThanOrEqual(3); // debounced, not one request per key press
    for (const body of sent) expect(Object.values(body.weights).reduce((a, b) => a + b, 0)).toBe(10000);
  });

  test('limits the ranking to one province', async ({ page }) => {
    const mock = await openLiveLab(page);
    await expect(results(page)).toBeVisible();
    await page.getByLabel('Cakupan wilayah').selectOption('33');
    await expect.poll(() => mock.compositeRequests.at(-1)?.filter_province_id).toBe('33');
    await expect(page.getByText(/di provinsi 33/)).toBeVisible();
  });

  test('withholds the deployed v1 composite and names a counterexample', async ({ page }) => {
    await openLiveLab(page, 'v1');
    await expect(page.getByText('Peringkat ditahan: hasil perhitungan tidak konsisten')).toBeVisible();
    await expect(page.getByText(/dihitung sebagai 0/)).toBeVisible();
    await expect(page.getByText(/3372/)).toBeVisible();
    await expect(results(page)).toHaveCount(0);
  });

  test('a failed calculation shows an error with retry and no DEMO fallback', async ({ page }) => {
    const mock = await openLiveLab(page, 'error');
    await expect(page.getByRole('button', { name: /Coba lagi/ }).first()).toBeVisible();
    await expect(results(page)).toHaveCount(0);
    await expect(page.getByText(/Kabupaten Demo/)).toHaveCount(0);
    expect(mock.compositeRequests.length).toBeGreaterThan(0);
  });

  test('reads in Kaca and fits a phone without sideways scrolling', async ({ page }, testInfo) => {
    await openLiveLab(page);
    await expect(results(page)).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('lab-normal.png'), fullPage: true });
    await page.getByRole('switch', { name: 'Mode tampilan kaca' }).click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: testInfo.outputPath('lab-kaca.png'), fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });
});
