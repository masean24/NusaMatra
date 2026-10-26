import { expect, test, type Page } from '@playwright/test';
import { mockDataHub } from './dataHubMocks';
import { mapRegion } from './mapProbe';

/**
 * Jelajahi's atlas: the sea is the page background itself (a transparent canvas over the same
 * surface as every other page), in Normal and in Kaca, and switching mode keeps the same canvas
 * instead of rebuilding it.
 */

/** Antialiasing and the faint graticule move a pixel a few levels off the page behind it. */
const TOLERANCE = 6;

/**
 * Median colour of a small patch of open sea: just above and left of the map buttons, south of the
 * archipelago and clear of the floating cards, the sidebar and the phone's bottom sheet (whose
 * shadow darkens the sea right above it).
 */
async function seaColour(page: Page): Promise<number[]> {
  const controls = await page.getByRole('group', { name: 'Kontrol peta' }).boundingBox();
  if (!controls) throw new Error('no map controls');
  await page.mouse.move(0, 0);
  const png = (
    await page.screenshot({
      clip: { x: controls.x - 28, y: controls.y - 24, width: 12, height: 12 },
    })
  ).toString('base64');
  return page.evaluate(async (data) => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d');
    if (!context) return [0, 0, 0];
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
    const channel = (offset: number) => {
      const values: number[] = [];
      for (let i = offset; i < pixels.length; i += 4) values.push(pixels[i] ?? 0);
      values.sort((a, b) => a - b);
      return values[Math.floor(values.length / 2)] ?? 0;
    };
    return [channel(0), channel(1), channel(2)];
  }, png);
}

const close = (actual: number[], expected: readonly number[]) =>
  expected.every((value, i) => Math.abs((actual[i] ?? -999) - value) <= TOLERANCE);

/** The open sea, compared with the same spot of the page with the map's canvas hidden. */
async function seaIsPage(page: Page): Promise<boolean> {
  const canvas = page.locator('canvas');
  const sea = await seaColour(page);
  await canvas.evaluate((element) => {
    element.style.visibility = 'hidden';
  });
  const pageBehind = await seaColour(page);
  await canvas.evaluate((element) => {
    element.style.visibility = '';
  });
  return close(sea, pageBehind);
}

test('the sea is the page background in Normal and Kaca, on the same canvas', async ({ page }) => {
  await mockDataHub(page);
  await page.goto('/jelajahi');
  await page.waitForTimeout(1200); // the page's entrance stagger
  await mapRegion(page).scrollIntoViewIfNeeded();
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveCount(1);
  await canvas.evaluate((element) => {
    element.dataset['qa'] = 'original';
  });

  await expect.poll(() => seaIsPage(page)).toBe(true);

  const glass = page.getByRole('switch', { name: 'Mode tampilan kaca' });
  await glass.click();
  await expect(glass).toHaveAttribute('aria-checked', 'true');
  await expect.poll(() => seaIsPage(page), { timeout: 8000 }).toBe(true);

  await glass.click();
  await expect.poll(() => seaIsPage(page), { timeout: 8000 }).toBe(true);
  await expect(page.locator('canvas[data-qa="original"]')).toHaveCount(1);
});
