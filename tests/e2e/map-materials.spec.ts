import { expect, test, type Page } from '@playwright/test';
import { mockDataHub } from './dataHubMocks';
import { mapRegion } from './mapProbe';

/**
 * Jelajahi's atlas materials: the sea renders in the Kapur & Kobalt colour of the active display
 * mode, and switching Normal ↔ Kaca recolours the same canvas instead of rebuilding it.
 */

const SEA = { normal: [0xdc, 0xe8, 0xff], kaca: [0x17, 0x36, 0x8c] } as const;
/** Lighting, fog and antialiasing move a rendered colour a few levels off its swatch. */
const TOLERANCE = 12;

/** Median colour of a small patch near the top centre of the map, where only sea is drawn. */
async function seaColour(page: Page): Promise<number[]> {
  const box = await mapRegion(page).boundingBox();
  if (!box) throw new Error('no map');
  await page.mouse.move(0, 0);
  const png = (
    await page.screenshot({ clip: { x: box.x + box.width / 2 - 6, y: box.y + 24, width: 12, height: 12 } })
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

test('the sea follows Normal and Kaca on the same canvas', async ({ page }) => {
  await mockDataHub(page);
  await page.goto('/jelajahi');
  await page.waitForTimeout(1200); // the page's entrance stagger
  await mapRegion(page).scrollIntoViewIfNeeded();
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveCount(1);
  await canvas.evaluate((element) => {
    element.dataset['qa'] = 'original';
  });

  await expect.poll(async () => close(await seaColour(page), SEA.normal)).toBe(true);

  const glass = page.getByRole('switch', { name: 'Mode tampilan kaca' });
  await glass.click();
  await expect(glass).toHaveAttribute('aria-checked', 'true');
  await expect.poll(async () => close(await seaColour(page), SEA.kaca), { timeout: 8000 }).toBe(true);

  await glass.click();
  await expect.poll(async () => close(await seaColour(page), SEA.normal), { timeout: 8000 }).toBe(true);
  await expect(page.locator('canvas[data-qa="original"]')).toHaveCount(1);
});
