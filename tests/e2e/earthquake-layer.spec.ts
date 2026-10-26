import { expect, test, type Page } from '@playwright/test';
import { openDataInfo } from './dataInfo';
import { openRegionPanel } from './jelajahiHelpers';
import { mockLiveDataHub } from './liveDataHubMock';
import { mapRegion as map, markerAt as at, markersOnMap } from './mapProbe';

/**
 * The "Gempa BMKG" layer in a real browser, on LIVE geography, against a mocked Data Hub. The bodies
 * are the LIVE responses captured on 2026-10-21/22 (src/services/api/__fixtures__/live); the
 * earthquake feed gets the provenance metadata of the Data Hub contract (backend e672231):
 * data_origin, last_success_at, is_stale, cache_ttl_seconds. Only three BIG polygons were captured
 * (Kota Bukittinggi, Kota Padang Panjang, Kota Magelang), so the map frames western Indonesia; the
 * Bogor and Tanggamus epicentres fall inside it. This proves the frontend, not the deployed API:
 * live-api.spec.ts covers that.
 */

const layerSwitch = (page: Page) => page.getByRole('switch', { name: 'Gempa BMKG' });
const layer = (page: Page) => page.getByRole('region', { name: 'Lapisan gempa BMKG' });

async function openLiveJelajahi(page: Page): Promise<void> {
  await page.goto('/jelajahi');
  await openDataInfo(page);
  await page.locator('label', { hasText: 'LIVE' }).click();
  await expect(page.getByText('Batas wilayah resmi (BIG)')).toBeVisible();
  await expect(layerSwitch(page)).toBeEnabled();
}

test.describe('Gempa BMKG layer on LIVE geography (mocked Data Hub contract)', () => {
  test('shows a fresh bmkg_cache feed as official BMKG data, without the preview opt-in', async ({
    page,
  }) => {
    const mock = await mockLiveDataHub(page, 'cache');
    await openLiveJelajahi(page);
    await layerSwitch(page).click();

    await expect(layer(page).getByText('Data BMKG', { exact: true })).toBeVisible();
    await expect(layer(page).getByText(/^28 gempa · diperbarui BMKG ±0 menit lalu$/)).toBeVisible();
    await expect(layer(page).getByText(/Pratinjau|Mungkin usang|ditahan/)).toHaveCount(0);
    expect(mock.earthquakeRequests[0]).toContain('mode=live');
  });

  test('treats bmkg_live the same way', async ({ page }) => {
    await mockLiveDataHub(page, 'live');
    await openLiveJelajahi(page);
    await layerSwitch(page).click();
    await expect(layer(page).getByText('Data BMKG', { exact: true })).toBeVisible();
    await expect(layer(page).getByText('Mungkin usang')).toHaveCount(0);
  });

  test('labels a feed the Data Hub flags stale, and keeps showing it as BMKG data', async ({ page }) => {
    await mockLiveDataHub(page, 'stale');
    await openLiveJelajahi(page);
    await layerSwitch(page).click();
    await expect(layer(page).getByText('Mungkin usang')).toBeVisible();
    await expect(layer(page).getByText(/menandai data ini usang/)).toBeVisible();
    await expect(layer(page).getByText(/sekitar 45 menit lalu/)).toBeVisible();
  });

  test('withholds a fixture answer in LIVE and lists no events', async ({ page }) => {
    await mockLiveDataHub(page, 'fixture');
    await openLiveJelajahi(page);
    await layerSwitch(page).click();
    await expect(layer(page).getByText('Gempa ditahan: asal data belum jelas')).toBeVisible();
    await expect(layer(page).getByText(/fixture lokal/)).toBeVisible();
    await expect(layer(page).getByText(/Daftar gempa/)).toHaveCount(0);
  });

  test('fails closed on a BMKG outage (HTTP 503): an error, no events', async ({ page }) => {
    await mockLiveDataHub(page, 'outage');
    await openLiveJelajahi(page);
    await layerSwitch(page).click();
    await expect(layer(page).getByText('Data belum dapat dimuat')).toBeVisible();
    await expect(layer(page).getByText(/Daftar gempa|Data BMKG/)).toHaveCount(0);
  });

  test('opens an event from the list in the side panel with BMKG’s own coordinates and text', async ({
    page,
  }, testInfo) => {
    await mockLiveDataHub(page);
    await openLiveJelajahi(page);
    await layerSwitch(page).click();
    await layer(page).getByText('Daftar gempa (28)').click();
    await layer(page)
      .getByRole('button', { name: /Magnitudo 3,9.*10 km utara Tanggamus/ })
      .click();

    await openRegionPanel(page);
    const detail = page.getByRole('article', { name: 'Gempa Magnitudo 3,9' });
    await expect(detail).toBeVisible();
    await expect(detail.getByText('5,39° LS, 104,68° BT')).toBeVisible();
    await expect(detail.getByText('10 km', { exact: true })).toBeVisible();
    await expect(detail.getByText('21 Okt 2026, 18:03:28 WIB')).toBeVisible();
    await expect(detail.getByText(/III Ulu Belu, Tanggamus/)).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('detail.png') });
    await detail.getByRole('button', { name: 'Tutup detail gempa' }).click();
    await expect(detail).toHaveCount(0);
  });

  test('draws epicentres where they belong on the same 3D map, and a click opens the detail', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'hover needs a pointer; the event list covers touch');
    test.setTimeout(120_000);
    await mockLiveDataHub(page);
    await openLiveJelajahi(page);
    const canvas = page.locator('canvas');
    await expect(canvas).toHaveCount(1);
    await canvas.evaluate((element) => {
      element.dataset['qa'] = 'before-layer';
    });

    await layerSwitch(page).click();
    await expect(layer(page).getByText('Data BMKG', { exact: true })).toBeVisible();
    await map(page).evaluate((element) => {
      element.scrollIntoView({ block: 'center' });
    });
    await page.waitForTimeout(1000); // the one-off appear animation
    // Same renderer and canvas, BIG polygons still the drawn geography.
    await expect(page.locator('canvas[data-qa="before-layer"]')).toHaveCount(1);
    await page.getByText('Tentang batas wilayah').click();
    await expect(
      page.getByText(/Poligon batas 3 kabupaten\/kota dari Badan Informasi Geospasial/),
    ).toBeVisible();

    // Fold the note again: open, it covers part of the map the markers are read from.
    await page.getByText('Tentang batas wilayah').click();
    // The mocked geography is three small western regions, so the map is framed on Sumatra and Java
    // and the eastern epicentres sit under the status cards. Fold the side panel (the framing follows
    // it) and pan the map down with a right-button drag, as a user would, to bring them into view.
    await page.getByRole('button', { name: 'Ciutkan panel' }).click();
    await page.waitForTimeout(800); // the panel folds and the map reframes
    await page.mouse.move(900, 600);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(900, 700, { steps: 10 });
    await page.mouse.up({ button: 'right' });
    await page.waitForTimeout(800); // the controls' damping settles
    const markers = await markersOnMap(page);
    const calang = at(markers, /CALANG/);
    const sukabumi = at(markers, /SUKABUMI/);
    // Two events lie off Kodi (M 6,1 and M 4,6, both near 119 °E, 9.5–10 °S); their discs overlap, so
    // whichever is in front stands for the place.
    const kodi = at(markers, /KODI/);
    const bitung = at(markers, /BITUNG/);
    const pohuwato = at(markers, /POHUWATO/);
    const found = [calang, sukabumi, kodi, bitung, pohuwato];
    expect(found.every(Boolean), [...markers.keys()].join('\n')).toBe(true);
    if (!calang || !sukabumi || !kodi || !bitung || !pohuwato) return;
    // West to east: 94.97, 106.47, 118.92, 126.03 °E. North to south: 4.56 °N above 8.73 °S, and
    // 0.64 °N above 9.70 °S. A lon/lat swap or a lost sign breaks this order.
    expect(calang.x).toBeLessThan(sukabumi.x);
    expect(sukabumi.x).toBeLessThan(kodi.x);
    expect(kodi.x).toBeLessThan(bitung.x);
    expect(calang.y).toBeLessThan(sukabumi.y);
    expect(pohuwato.y).toBeLessThan(kodi.y);

    await page.mouse.click(sukabumi.x, sukabumi.y);
    const detail = page.getByRole('article', { name: 'Gempa Magnitudo 5,7' });
    await expect(detail).toBeVisible();
    await expect(detail.getByText('8,73° LS, 106,47° BT')).toBeVisible();
    await expect(detail.getByText(/193 km BaratDaya KAB-SUKABUMI-JABAR/)).toBeVisible();

    await page.screenshot({ path: testInfo.outputPath('normal.png') });
    const glass = page.getByRole('switch', { name: 'Mode tampilan kaca' });
    await glass.click();
    await expect(glass).toHaveAttribute('aria-checked', 'true');
    await page.waitForTimeout(1200); // the liquid theme transition
    await expect(detail).toBeVisible();
    await expect(page.locator('canvas[data-qa="before-layer"]')).toHaveCount(1);
    await page.screenshot({ path: testInfo.outputPath('kaca.png') });
  });

  test('polls about every two minutes while on, and stops when switched off or the page is left', async ({
    page,
  }) => {
    await page.clock.install();
    const mock = await mockLiveDataHub(page);
    await openLiveJelajahi(page);
    await layerSwitch(page).click();
    await expect(layer(page).getByText('Data BMKG', { exact: true })).toBeVisible();
    expect(mock.earthquakeRequests).toHaveLength(1);

    await page.clock.fastForward(120_000);
    await expect.poll(() => mock.earthquakeRequests.length).toBe(2);

    await layerSwitch(page).click();
    await page.clock.fastForward(360_000);
    expect(mock.earthquakeRequests).toHaveLength(2);

    await layerSwitch(page).click();
    await expect.poll(() => mock.earthquakeRequests.length).toBe(3);
    await page.getByRole('link', { name: 'Bandingkan' }).first().click();
    // Jelajahi unmounts only once the lazy Bandingkan route has loaded; time moves on after that.
    await expect(page).toHaveURL(/\/bandingkan/);
    await expect(layerSwitch(page)).toHaveCount(0);
    await page.clock.fastForward(360_000);
    expect(mock.earthquakeRequests).toHaveLength(3);
  });

  test('is unavailable in DEMO: no request for BMKG events', async ({ page }) => {
    const mock = await mockLiveDataHub(page);
    await page.goto('/jelajahi');
    await openDataInfo(page);
    await expect(layerSwitch(page)).toBeDisabled();
    expect(mock.earthquakeRequests).toHaveLength(0);
  });
});
