import { expect, test, type Page } from '@playwright/test';
import { mockLiveLab, type CompositeKind } from './liveLabMock';

/**
 * Lab Prioritas in LIVE, MOCKED (contract v2.1): captured production responses replayed for the Jateng,
 * Sumut and national scenarios, the labContractMock simulator for other weights (liveLabMock.ts). Proves the
 * frontend flow, not the deployed Data Hub; the read-only production probes are recorded in
 * docs/integration/lab-prioritas-live.md.
 */

async function openLiveLab(page: Page, composite: CompositeKind = 'v21') {
  const mock = await mockLiveLab(page, composite);
  await page.goto('/lab-prioritas');
  await expect(results(page).getByText('Kabupaten Demo Lampung 11')).toBeVisible(); // DEMO first
  await page.locator('label', { hasText: 'LIVE' }).click();
  return mock;
}

const results = (page: Page) => page.getByRole('region', { name: 'Daftar peringkat' });

test.describe('Lab Prioritas in LIVE (MOCKED contract v2.1)', () => {
  test('ranks LIVE regions with rank 1 = highest need, explains a score, and never shows DEMO names', async ({
    page,
  }) => {
    const mock = await openLiveLab(page);

    await expect(page.getByText('Hasil siap dan sudah diperiksa')).toBeVisible();
    await expect(results(page).getByText(/^10 dari \d+ wilayah$/)).toBeVisible();
    await expect(results(page).getByText(/peringkat 1 adalah prioritas tertinggi/)).toBeVisible();
    await expect(page.getByText(/Kabupaten Demo/)).toHaveCount(0);
    expect(mock.compositeRequests.at(-1)?.weights).toEqual({
      soc_hdi: 3000,
      dis_multihazard_index: 3000,
      soc_poverty_rate: 2000,
      hlt_stunting_prevalence: 2000,
    });
    await expect(results(page).locator('ol > li').first()).toContainText(/^1/);

    // The selected region's breakdown is shown beside the ranking, and follows the selection.
    await expect(page.getByRole('table', { name: /Sumbangan setiap kriteria/ })).toBeVisible();
    const second = await results(page).locator('ol > li').nth(1).locator('button').innerText();
    await results(page).locator('ol button').nth(1).click();
    await expect(page.getByRole('table', { name: /Sumbangan setiap kriteria/ })).toBeVisible();
    expect(second.length).toBeGreaterThan(0);

    const firstHigh = await results(page).locator('ol > li').first().innerText();
    await page.getByRole('button', { name: 'Prioritas terendah dulu' }).click();
    await expect(results(page).locator('ol > li').first()).not.toHaveText(firstHigh);
  });

  test('Jateng: 35 regions, Wonosobo first; Surakarta is flagged as partial data (captured response)', async ({
    page,
  }) => {
    const mock = await openLiveLab(page);
    await expect(results(page)).toBeVisible();
    await page.getByRole('button', { name: /Pengentasan Kemiskinan Ekstrem & Stunting/ }).click();
    await page.getByLabel('Cakupan wilayah').selectOption('33');
    await expect.poll(() => mock.compositeRequests.at(-1)?.filter_province_id).toBe('33');
    await expect(page.getByText(/^35 wilayah di Provinsi 33 dihitung dari data resmi LIVE/)).toBeVisible();
    await expect(results(page).locator('ol > li').first()).toContainText('Kabupaten Wonosobo');
    await expect(results(page).locator('ol > li').first()).toContainText('35,06');

    await page.getByRole('button', { name: 'Prioritas terendah dulu' }).click();
    const last = results(page).locator('ol > li').first();
    await expect(last).toContainText('Kota Surakarta');
    await expect(last).toContainText('Data sebagian · 70% bobot');
    await expect(last).toContainText('9,57');
  });

  test('Sumut: Padangsidimpuan is listed as insufficient data and is not ranked (captured response)', async ({
    page,
  }) => {
    await openLiveLab(page);
    await expect(results(page)).toBeVisible();
    await page.getByRole('button', { name: /Mitigasi Bencana & Ketahanan Infrastruktur/ }).click();
    await page.getByLabel('Cakupan wilayah').selectOption('12');
    await expect(page.getByText(/^32 wilayah di Provinsi 12 dihitung dari data resmi LIVE/)).toBeVisible();
    const insufficient = page.getByRole('region', { name: /Tidak diperingkat: data belum cukup \(1\)/ });
    await expect(insufficient).toContainText('Kota Padangsidimpuan (1277)');
    await expect(insufficient).toContainText('COVERAGE_BELOW_THRESHOLD');
    await expect(results(page)).not.toContainText('Padangsidimpuan');
  });

  test('the education 3T scenario (rankable = false) shows no ranking, though the server returns scores', async ({
    page,
  }) => {
    const mock = await openLiveLab(page, 'unrankable');
    await expect(page.getByText('Peringkat belum dapat ditampilkan')).toBeVisible();
    await page.getByRole('button', { name: /Pemerataan Kualitas Pendidikan Daerah 3T/ }).click();
    await expect(page.getByText(/ditandai Data Hub belum dapat diperingkat di LIVE/)).toBeVisible();
    await expect(page.getByText(/hanya 45% bobotnya punya data nasional/)).toBeVisible();
    await expect(results(page)).toHaveCount(0);
    expect(mock.compositeRequests.length).toBeGreaterThan(0);
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
    await expect(page.getByText(/wilayah di Provinsi 33 dihitung/)).toBeVisible();
  });

  test('withholds the pre-v2.1 composite and says why', async ({ page }) => {
    await openLiveLab(page, 'v1');
    await expect(page.getByText('Peringkat belum dapat ditampilkan')).toBeVisible();
    await expect(page.getByText(/Arah skor dari Data Hub tidak jelas/)).toBeVisible();
    // Short by default; the facts are one click away.
    await expect(page.getByText(/SCORE_DIRECTION_UNREPORTED/).first()).toBeHidden();
    await page.getByText('Lihat alasan dan detail teknis').click();
    await expect(page.getByText(/SCORE_DIRECTION_UNREPORTED/).first()).toBeVisible();
    await expect(page.getByText('Pembagian bobot')).toBeVisible();
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

/**
 * Real HTTP against the deployed Data Hub (no mocks), read-only. It needs the public network, so it only
 * runs on request:  NUSAMATRA_LIVE_E2E=1 npx playwright test priority-lab --grep "deployed Data Hub"
 *
 * The deployed data CHANGES under the same snapshot id (2026-10-23: indicator availability and a preset's
 * `rankable` flipped between 15:17Z and 20:17Z), so these tests assert INVARIANTS that hold for any data,
 * never a particular region, count or flag. Which branch applies is decided from the live presets read
 * inside the test.
 */
const API = 'https://api.orangkeren.me/api/v1';
const READY = 'Hasil siap dan sudah diperiksa';
const WITHHELD = 'Peringkat belum dapat ditampilkan';
const PASSPORT_LINK = 'Buat Paspor Bukti';
const SERVER_TIMEOUT = 90_000;

interface LivePreset {
  readonly preset_id: string;
  readonly title: string;
  readonly availability?: { readonly rankable?: boolean };
}

async function livePresets(page: Page): Promise<LivePreset[]> {
  const response = await page.request.get(`${API}/indicators/composite-presets?mode=live`, {
    headers: { 'X-Data-Mode': 'LIVE' },
  });
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as { meta: { mode: string }; data: LivePreset[] };
  expect(body.meta.mode).toBe('LIVE');
  expect(Array.isArray(body.data)).toBe(true);
  return body.data;
}

/** Waits for the Lab to finish calculating and says what it ended up showing. */
async function settledOutcome(page: Page): Promise<'ready' | 'withheld'> {
  const ready = page.getByText(READY);
  const withheld = page.getByText(WITHHELD);
  await expect(ready.or(withheld)).toBeVisible({ timeout: SERVER_TIMEOUT });
  return (await ready.isVisible()) ? 'ready' : 'withheld';
}

/** Invariants of any settled Lab state: a ranking is on screen exactly when the checks passed. */
async function expectConsistent(page: Page, outcome: 'ready' | 'withheld') {
  await expect(page.getByText(/Kabupaten Demo/)).toHaveCount(0);
  // The calculation notes (with the passport link) sit in a collapsed <details>; a role query skips hidden content.
  await page
    .locator('details', { hasText: 'Sumber, metodologi' })
    .last()
    .evaluate((element) => {
      (element as HTMLDetailsElement).open = true;
    });
  const passport = page.getByRole('link', { name: PASSPORT_LINK });
  if (outcome === 'ready') {
    await expect(results(page)).toBeVisible();
    await expect(results(page).locator('ol > li').first()).toContainText(/^1/); // rank 1 = highest need
    await expect(results(page).getByText(/peringkat 1 adalah prioritas tertinggi/)).toBeVisible();
    // The passport link needs the direction check to have finished; if that check could not run, the page says so.
    if ((await passport.count()) > 0) {
      await expect(passport).toHaveAttribute('href', /^\/paspor-bukti\?jenis=lab&mode=live&snap=/);
    } else {
      await expect(page.getByText(/Pemeriksaan arah skor belum selesai/)).toBeVisible();
    }
  } else {
    await expect(results(page)).toHaveCount(0);
    await expect(page.getByRole('table', { name: /Sumbangan setiap kriteria/ })).toHaveCount(0);
    await expect(passport).toHaveCount(0);
  }
}

async function openLive(page: Page) {
  await page.goto('/lab-prioritas');
  await page.locator('label', { hasText: 'LIVE' }).click();
}

test.describe('Lab Prioritas against the deployed Data Hub (read-only)', () => {
  test.skip(!process.env['NUSAMATRA_LIVE_E2E'], 'needs the public Data Hub; set NUSAMATRA_LIVE_E2E=1');

  test('the default scenario shows a ranking only when the checks pass, with rank 1 first and a passport link', async ({
    page,
  }) => {
    await openLive(page);
    const outcome = await settledOutcome(page);
    await expectConsistent(page, outcome);
  });

  test('a preset the server marks rankable = false is never ranked and has no passport link; a rankable one is ranked only after the checks pass', async ({
    page,
  }) => {
    const presets = await livePresets(page);
    expect(presets.length).toBeGreaterThan(0);
    await openLive(page);
    await expect(page.getByRole('group', { name: 'Skenario siap pakai' })).toBeVisible({
      timeout: SERVER_TIMEOUT,
    });

    for (const preset of presets) {
      const rankable = preset.availability?.rankable;
      await page.getByRole('button', { name: preset.title }).click();
      // The chosen weights are shown at once; the result follows after the debounce.
      await expect(page.getByText('Menghitung peringkat…')).toBeVisible();
      const outcome = await settledOutcome(page);
      if (rankable === false) {
        expect(outcome).toBe('withheld');
        await expect(page.getByText(/ditandai Data Hub belum dapat diperingkat di LIVE/)).toBeVisible();
      }
      await expectConsistent(page, outcome);
    }
  });

  test('limiting to a province keeps the same invariants and reports how many regions were ranked', async ({
    page,
  }) => {
    await openLive(page);
    await settledOutcome(page);
    await page.getByLabel('Cakupan wilayah').selectOption('33');
    // Either the province result (its status line names the province) or a withheld ranking.
    const provinceReady = page.getByText(/^\d+ wilayah di .+ dihitung dari data resmi LIVE/);
    await expect(provinceReady.or(page.getByText(WITHHELD))).toBeVisible({ timeout: SERVER_TIMEOUT });
    const outcome = (await provinceReady.isVisible()) ? 'ready' : 'withheld';
    await expectConsistent(page, outcome);
  });
});
