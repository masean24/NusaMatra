import type { Page } from '@playwright/test';

/** The 3D map's own region (the canvas host), by its accessible name. */
export const mapRegion = (page: Page) =>
  page.getByRole('region', { name: 'Peta 3D interaktif wilayah Indonesia' });

/** Smallest dark blob counted as a marker disc, in screenshot pixels (drops outlines and specks). */
const MIN_DISC_PIXELS = 12;

/**
 * Epicentre markers on the map, by their hover labels. WebGL pixels cannot be read back directly,
 * so the dark marker discs are found as connected blobs in a screenshot of the map; each blob's
 * centre is hovered and the tooltip read, so a position counts only if the map itself says which
 * event is there. Overlapping markers form one blob and yield whichever is in front.
 */
export async function markersOnMap(page: Page): Promise<Map<string, { x: number; y: number }>> {
  const box = await mapRegion(page).boundingBox();
  if (!box) return new Map();
  await page.mouse.move(0, 0); // no tooltip in the screenshot
  const shot = (await page.screenshot({ clip: box })).toString('base64');
  const centres = await page.evaluate(
    async ({ png, minPixels }) => {
      const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${png}`)).blob());
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext('2d');
      if (!context) return [];
      context.drawImage(bitmap, 0, 0);
      const { data, width, height } = context.getImageData(0, 0, bitmap.width, bitmap.height);
      const scale = width / window.innerWidth > 1.5 ? window.devicePixelRatio : 1;
      // The disc fill (#121826) over the cobalt sea: dark in every channel, unlike sea or land.
      const dark = (index: number) =>
        (data[index * 4] ?? 255) < 70 &&
        (data[index * 4 + 1] ?? 255) < 80 &&
        (data[index * 4 + 2] ?? 255) < 120;
      const seen = new Uint8Array(width * height);
      const blobs: { x: number; y: number }[] = [];
      for (let start = 0; start < width * height; start += 1) {
        if (seen[start] || !dark(start)) continue;
        const stack = [start];
        seen[start] = 1;
        let count = 0;
        let sumX = 0;
        let sumY = 0;
        while (stack.length > 0) {
          const index = stack.pop() ?? 0;
          const x = index % width;
          const y = (index - x) / width;
          count += 1;
          sumX += x;
          sumY += y;
          for (const next of [index - 1, index + 1, index - width, index + width]) {
            const nx = next % width;
            if (next < 0 || next >= width * height || Math.abs(nx - x) > 1) continue;
            if (!seen[next] && dark(next)) {
              seen[next] = 1;
              stack.push(next);
            }
          }
        }
        const x = sumX / count;
        const y = sumY / count;
        // Leave out the frame's rounded corners and the boundary badge along the bottom edge.
        const inside = x > 12 && x < width - 12 && y > 12 && y < height - 60;
        if (count >= minPixels && inside) blobs.push({ x: x / scale, y: y / scale });
      }
      return blobs;
    },
    { png: shot, minPixels: MIN_DISC_PIXELS },
  );

  const tooltip = mapRegion(page).locator('p').first();
  const markers = new Map<string, { x: number; y: number }>();
  for (const centre of centres) {
    const point = { x: box.x + centre.x, y: box.y + centre.y };
    await page.mouse.move(point.x, point.y);
    const label = (await tooltip.isVisible()) ? await tooltip.textContent() : null;
    if (label?.startsWith('Magnitudo') && !markers.has(label)) markers.set(label, point);
  }
  return markers;
}

export const markerAt = (markers: Map<string, { x: number; y: number }>, pattern: RegExp) =>
  [...markers].find(([label]) => pattern.test(label))?.[1] ?? null;
