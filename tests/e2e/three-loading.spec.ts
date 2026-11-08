import { expect, test, type Page } from '@playwright/test';
import { mockDataHub } from './dataHubMocks';

/**
 * three.js (with React Three Fiber) is the largest chunk by far. It belongs to the pages that draw
 * in 3D and must not ride along with the rest: the shell must not preload it, and a page without a
 * 3D scene must not download it.
 */
const THREE_CHUNK = /\/assets\/three-[^/]+\.js$/;

function scriptRequests(page: Page): string[] {
  const urls: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'script') urls.push(request.url());
  });
  return urls;
}

test.describe('three.js loads only where a 3D scene is drawn', () => {
  test('the page shell does not preload the three.js chunk', async ({ request }) => {
    const html = await (await request.get('/bandingkan')).text();
    const preloads = [...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g)].map((m) => m[1]);
    expect(preloads.length).toBeGreaterThan(0);
    expect(preloads.filter((href) => THREE_CHUNK.test(href))).toEqual([]);
  });

  for (const path of ['/bandingkan?a=3201&b=3273', '/lab-prioritas', '/paspor-bukti', '/metodologi']) {
    test(`${path} works without downloading three.js`, async ({ page }) => {
      await mockDataHub(page);
      const scripts = scriptRequests(page);
      await page.goto(path);
      await expect(page.locator('main')).toBeVisible();
      await page.waitForLoadState('networkidle');
      expect(scripts.filter((url) => THREE_CHUNK.test(url))).toEqual([]);
    });
  }

  test('Jelajahi still downloads three.js for its map', async ({ page }) => {
    await mockDataHub(page);
    const scripts = scriptRequests(page);
    await page.goto('/jelajahi');
    await expect.poll(() => scripts.some((url) => THREE_CHUNK.test(url)), { timeout: 15_000 }).toBe(true);
  });
});
