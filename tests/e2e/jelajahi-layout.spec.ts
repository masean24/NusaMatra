import { expect, test, type Page } from '@playwright/test';
import { mockDataHub } from './dataHubMocks';
import { mockLiveDataHub } from './liveDataHubMock';
import { mapRegion, markersOnMap } from './mapProbe';

/**
 * Jelajahi's map-first layout: the map dominates the first viewport at desktop sizes, the panel
 * becomes a bottom sheet below 960px, and folding the panel widens the map without remounting it
 * or resetting the user's view. LIVE uses the mocked Data Hub (liveDataHubMock.ts), DEMO the
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
    await page.locator('label', { hasText: 'LIVE' }).click();
    await expect(page.getByText('Batas wilayah resmi (BIG)')).toBeVisible();
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
        expect(side.width).toBeLessThanOrEqual(420);
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
    const before = await markersOnMap(page);

    await page.getByText('Daftar gempa (28)').click();
    await page.getByRole('button', { name: /Magnitudo 5,7.*SUKABUMI/ }).click();
    const detail = page.getByRole('article', { name: 'Gempa Magnitudo 5,7' });
    await expect(detail).toBeVisible();
    const openWidth = (await mapRegion(page).boundingBox())?.width ?? 0;

    await panelBar(page).click();
    await expect(panelBar(page)).toHaveAttribute('aria-expanded', 'false');
    await expect
      .poll(async () => (await mapRegion(page).boundingBox())?.width ?? 0)
      .toBeGreaterThan(openWidth + 250);
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
});
