import { expect, test, type Page } from '@playwright/test';
import { closeDataInfo, openDataInfo } from './dataInfo';
import { mockDataHub } from './dataHubMocks';
import { mockLiveDataHub } from './liveDataHubMock';
import { mapRegion, markersOnMap } from './mapProbe';

/**
 * Jelajahi's full-screen layout: the map fills the viewport behind a floating sidebar at desktop
 * sizes, the panel becomes a bottom sheet below 960px, and folding the panel re-centres the map
 * beside it without remounting it or resetting the user's view. LIVE uses the mocked Data Hub (liveDataHubMock.ts), DEMO the
 * captured DEMO responses.
 */

const panel = (page: Page) => page.locator('[aria-label="Informasi wilayah"]');
const panelBar = (page: Page) => page.locator('button[aria-controls="panel-wilayah"]');

async function open(page: Page, mode: 'DEMO' | 'LIVE'): Promise<void> {
  if (mode === 'LIVE') await mockLiveDataHub(page);
  else await mockDataHub(page);
  await page.goto('/jelajahi');
  await page.waitForTimeout(1200); // the page's entrance stagger
  if (mode === 'LIVE') {
    await openDataInfo(page);
    await page.locator('label', { hasText: 'LIVE' }).click();
    await expect(page.getByText('Batas wilayah resmi (BIG)')).toBeVisible();
    await closeDataInfo(page);
  }
  await expect(mapRegion(page)).toBeVisible();
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
}

async function geometry(page: Page) {
  return page.evaluate(() => {
    const rect = (label: string) =>
      document.querySelector(`[aria-label="${label}"]`)?.getBoundingClientRect() ?? null;
    return {
      map: rect('Peta 3D interaktif wilayah Indonesia'),
      panel: rect('Informasi wilayah'),
      viewport: { width: window.innerWidth, height: window.innerHeight },
      overflowX: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
}

test.describe('Jelajahi map-first layout', () => {
  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
  ]) {
    for (const mode of ['LIVE', 'DEMO'] as const) {
      test(`${String(viewport.width)}×${String(viewport.height)} ${mode}: the map dominates and fits the first viewport`, async ({
        page,
      }, testInfo) => {
        test.skip(testInfo.project.name === 'mobile', 'desktop viewports');
        await page.setViewportSize(viewport);
        await open(page, mode);
        const { map, panel: side, overflowX } = await geometry(page);
        if (!map || !side) throw new Error('map or panel missing');

        expect(overflowX).toBe(false);
        expect(map.bottom).toBeLessThanOrEqual(viewport.height);
        expect(map.height / viewport.height).toBeGreaterThanOrEqual(0.65);
        const workspace = side.right - map.left;
        expect(map.width / workspace).toBeGreaterThanOrEqual(0.68);
        expect(side.width).toBeGreaterThanOrEqual(360);
        // Widened for readability: clamp(360px, 30vw, 440px).
        expect(side.width).toBeLessThanOrEqual(440);
      });
    }
  }

  test('folding the panel widens the same map and keeps the selection and the zoom', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'the side column exists on desktop only');
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, 'LIVE');
    await page.getByRole('switch', { name: 'Gempa BMKG' }).click();
    await expect(page.getByText('Data BMKG', { exact: true })).toBeVisible();

    const canvas = page.locator('canvas');
    await expect(canvas).toHaveCount(1);
    await canvas.evaluate((element) => {
      element.dataset['qa'] = 'original';
    });

    // Zoom in, so a resize that snapped back to the whole frame would show.
    const box = await mapRegion(page).boundingBox();
    if (!box) throw new Error('no map');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    for (let i = 0; i < 8; i += 1) await page.mouse.wheel(0, -120);
    await page.waitForTimeout(1200); // damped controls settle

    // Epicentres seen before and after a change; the farthest pair seen in both measures the zoom.
    const spreadRatio = (
      before: Map<string, { x: number; y: number }>,
      after: Map<string, { x: number; y: number }>,
    ) => {
      const common = [...before.keys()].filter((label) => after.has(label));
      let best = { span: 0, ratio: Number.NaN };
      for (const one of common) {
        for (const two of common) {
          const [b1, b2, a1, a2] = [before.get(one), before.get(two), after.get(one), after.get(two)];
          if (!b1 || !b2 || !a1 || !a2) continue;
          const span = Math.hypot(b2.x - b1.x, b2.y - b1.y);
          if (span > best.span) best = { span, ratio: Math.hypot(a2.x - a1.x, a2.y - a1.y) / span };
        }
      }
      expect(best.span, `markers in both views: ${common.join(' | ')}`).toBeGreaterThan(80);
      return best.ratio;
    };
    await page.getByText('Daftar gempa (28)').click();
    await page
      .getByRole('list', { name: 'Gempa, terbaru lebih dulu' })
      .getByRole('button', { name: /Magnitudo 5,7.*SUKABUMI/ })
      .click();
    const detail = page.getByRole('article', { name: 'Gempa Magnitudo 5,7' });
    await expect(detail).toBeVisible();
    await page.waitForTimeout(1500); // the map flies to the epicentre
    const before = await markersOnMap(page);
    // The map always fills the screen; folding the sidebar moves the view's centre (its inset) instead.
    const inset = () =>
      page.evaluate(() =>
        parseFloat(
          getComputedStyle(
            document.querySelector('[data-explore-panel]')?.parentElement ?? document.body,
          ).getPropertyValue('--explore-map-inset'),
        ),
      );
    const openInset = await inset();

    await panelBar(page).click();
    await expect(panelBar(page)).toHaveAttribute('aria-expanded', 'false');
    await expect.poll(inset).toBeLessThan(openInset - 250);
    await page.waitForTimeout(600);
    await expect(page.locator('canvas[data-qa="original"]')).toHaveCount(1);
    await page.screenshot({ path: testInfo.outputPath('panel-folded.png') });

    // Same zoom: the distance between two epicentres scales with the canvas, not back to the frame.
    const ratio = spreadRatio(before, await markersOnMap(page));
    // 1.0 here (the sample frame keeps the fitted distance); the old snap-to-frame resize gave 0.62.
    expect(ratio).toBeGreaterThan(0.85);
    expect(ratio).toBeLessThan(1.6);

    await panelBar(page).click();
    await expect(detail).toBeVisible();
    await expect(page.locator('canvas[data-qa="original"]')).toHaveCount(1);
  });

  test('tablet: the panel is a sheet and the map spans the width', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'set viewport');
    await page.setViewportSize({ width: 768, height: 1024 });
    await open(page, 'LIVE');
    const { map, viewport, overflowX } = await geometry(page);
    if (!map) throw new Error('no map');
    expect(overflowX).toBe(false);
    expect(map.width / viewport.width).toBeGreaterThan(0.88);
    expect(map.bottom).toBeLessThanOrEqual(viewport.height);
    await expect(panel(page)).toHaveCSS('position', 'fixed');
  });

  test('phone: full-width map near the top, and a bottom sheet that opens and closes over it', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'touch device');
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, 'LIVE');
    const { map, viewport, overflowX } = await geometry(page);
    if (!map) throw new Error('no map');
    expect(overflowX).toBe(false);
    expect(map.width / viewport.width).toBeGreaterThan(0.88);
    expect(map.top / viewport.height).toBeLessThan(0.55);

    const canvas = page.locator('canvas');
    await canvas.evaluate((element) => {
      element.dataset['qa'] = 'original';
    });
    await expect(panelBar(page)).toHaveAttribute('aria-expanded', 'false');
    await panelBar(page).tap();
    await expect(panelBar(page)).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('button', { name: /^Kota Magelang/ }).tap();
    await expect(page.getByRole('heading', { name: 'Kota Magelang' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('sheet.png') });
    await expect(page.locator('canvas[data-qa="original"]')).toHaveCount(1);
  });

  test('phone: laid out as a map app, with the search over the map and the buttons at its edge', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'touch device');
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, 'LIVE');

    // The search field stands where the page bar was, with the way home and the settings in it.
    const search = page.getByRole('searchbox', { name: 'Cari kabupaten/kota' });
    await expect(search).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Nusa Matra — Beranda' }).filter({ visible: true }),
    ).toHaveCount(1);
    await expect(
      page.getByRole('switch', { name: 'Mode tampilan kaca' }).filter({ visible: true }),
    ).toHaveCount(0);
    await page.getByLabel('Bahasa dan tampilan').tap();
    await expect(
      page.getByRole('switch', { name: 'Mode tampilan kaca' }).filter({ visible: true }),
    ).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'English' }).filter({ visible: true })).toHaveCount(1);
    await page.getByLabel('Bahasa dan tampilan').tap();

    // Chips under it, and the map's buttons in one column at the right edge, clear of them.
    const chips = page.getByRole('region', { name: 'Status data peta' });
    const controls = page.getByRole('group', { name: 'Kontrol peta' });
    const [chipBox, controlBox] = [await chips.boundingBox(), await controls.boundingBox()];
    if (!chipBox || !controlBox) throw new Error('missing box');
    expect(chipBox.height).toBeLessThan(60);
    expect(controlBox.width).toBeLessThan(controlBox.height);
    expect(controlBox.x + controlBox.width).toBeGreaterThan(350);
    expect(controlBox.y).toBeGreaterThan(chipBox.y + chipBox.height);

    // Searching opens the results in the sheet, and picking one lands the region above the sheet.
    await search.tap();
    await expect(panel(page)).toHaveAttribute('data-state', 'open');
    await search.fill('Magelang');
    await expect(panelBar(page)).toContainText('Hasil pencarian');
    await page.getByRole('button', { name: /^Kota Magelang/ }).tap();
    await expect(panel(page)).toHaveAttribute('data-state', 'peek');
    await expect(page.getByRole('heading', { name: 'Kota Magelang' })).toBeVisible();
    await expect(search).toHaveValue('');
    await expect(search).toHaveAttribute('placeholder', 'Kota Magelang');
    await page.screenshot({ path: testInfo.outputPath('map-app.png') });
  });

  test('phone: the sheet follows the finger, then settles at a stop', async ({ page, context }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'touch device');
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, 'LIVE');
    const cdp = await context.newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', y = 0) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: type === 'touchEnd' ? [] : [{ x: 195, y, id: 1 }],
      });
    const top = async () => (await panel(page).boundingBox())?.y ?? Number.NaN;
    const settled = async () => {
      await page.waitForTimeout(700); // the glide to a stop
      return top();
    };
    const state = () => panel(page).getAttribute('data-state');

    const folded = await top();
    expect(await state()).toBe('collapsed');

    // Under the finger, pixel for pixel, before it lets go.
    await touch('touchStart', folded + 20);
    await touch('touchMove', folded - 60);
    await touch('touchMove', folded - 170);
    await page.waitForTimeout(60);
    expect(await panel(page).getAttribute('data-dragging')).toBe('true');
    expect(Math.abs((await top()) - (folded - 190))).toBeLessThan(4);
    await page.waitForTimeout(150); // stopped before lifting: no flick
    await touch('touchEnd');
    const middle = await settled();
    expect(await state()).toBe('peek');
    expect(middle).toBeLessThan(folded - 190);
    expect(await panel(page).getAttribute('data-dragging')).toBeNull();
    await expect(panelBar(page)).toHaveAttribute('aria-expanded', 'true');

    // The content drags too, until the sheet is fully open.
    await touch('touchStart', middle + 200);
    for (const y of [middle + 100, middle - 40, middle - 180]) await touch('touchMove', y);
    await page.waitForTimeout(150);
    await touch('touchEnd');
    const high = await settled();
    expect(await state()).toBe('open');
    expect(high).toBeLessThan(100);

    // Fully open, the content scrolls and the sheet stays.
    const body = page.locator('#panel-wilayah');
    await touch('touchStart', 700);
    for (const y of [650, 550, 450, 350, 250]) {
      await touch('touchMove', y);
      await page.waitForTimeout(20);
    }
    await touch('touchEnd');
    await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeGreaterThan(100);
    expect(await top()).toBe(high);

    // A pull down moves the sheet only from the very top of the content.
    await touch('touchStart', 300);
    for (const y of [330, 360]) {
      await touch('touchMove', y);
      await page.waitForTimeout(20);
    }
    await touch('touchEnd');
    await page.waitForTimeout(300);
    expect(await top()).toBe(high);
    await body.evaluate((element) => {
      element.scrollTop = 0;
    });
    await touch('touchStart', 300);
    for (const y of [400, 500, 620]) await touch('touchMove', y);
    await page.waitForTimeout(150);
    await touch('touchEnd');
    expect(await settled()).toBeCloseTo(middle, 0);

    // A dropdown takes the sheet up, where its options fit, and a tap on one reaches only that option:
    // no region under the list gets chosen with it.
    await page.getByRole('combobox', { name: 'Provinsi' }).tap();
    await expect(panel(page)).toHaveAttribute('data-state', 'open');
    await page.getByRole('option').nth(1).tap();
    await expect(page.getByRole('combobox', { name: 'Provinsi' })).not.toHaveText('Semua provinsi');
    await page.waitForTimeout(300);
    await expect(panel(page)).toHaveAttribute('data-state', 'open');
    await expect(page).not.toHaveURL(/kode=/);

    await touch('touchStart', 90);
    for (const y of [190, 300, 420]) await touch('touchMove', y);
    await page.waitForTimeout(150);
    await touch('touchEnd');
    expect(await settled()).toBeCloseTo(middle, 0);

    // A flick down goes on to the next stop however little it travelled.
    await touch('touchStart', middle + 20);
    await touch('touchMove', middle + 60);
    await touch('touchMove', middle + 120);
    await touch('touchEnd');
    expect(await settled()).toBeCloseTo(folded, 0);
    expect(await state()).toBe('collapsed');
  });

  test('phone: the data status folds into one control that leaves the map and its buttons clear', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'touch device');
    await page.setViewportSize({ width: 360, height: 800 });
    await open(page, 'DEMO');

    const status = page.getByRole('region', { name: 'Status data peta' });
    const controls = page.getByRole('group', { name: 'Kontrol peta' });
    const summary = status.locator('summary', { hasText: 'Info data' });
    await expect(summary).toContainText('DEMO');
    const overlaps = async () => {
      const [a, b] = [await status.boundingBox(), await controls.boundingBox()];
      if (!a || !b) throw new Error('missing box');
      return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    };
    // Folded: one row under the top bar.
    expect((await status.boundingBox())?.height).toBeLessThan(60);
    expect(await overlaps()).toBe(false);

    // Unfolded with the keyboard: every card is there, and it still ends above the map buttons.
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('Simulasi — bukan data atau rekomendasi resmi.')).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Gempa BMKG' })).toBeAttached();
    await expect(page.getByText(/Geometri Ilustratif DEMO/)).toBeAttached();
    expect(await overlaps()).toBe(false);
  });
});
