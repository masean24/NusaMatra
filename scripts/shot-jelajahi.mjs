// Screenshots of the selected-region experience on LIVE (real HTTP) for the Normal and Kaca themes.
// Usage: node scripts/shot-jelajahi.mjs <outDir> <label>   (needs `npm run preview -- --port 4173`)
import { mkdirSync } from 'node:fs';
import { chromium, devices } from '@playwright/test';

const outDir = process.argv[2];
const label = process.argv[3] ?? 'shot';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: false });
const profiles = [
  ['desktop', { viewport: { width: 1440, height: 900 } }],
  ['mobile', { ...devices['Pixel 7'] }],
];

for (const [device, options] of profiles) {
  for (const theme of ['normal', 'glass']) {
    const context = await browser.newContext(options);
    const page = await context.newPage();
    await page.goto('http://localhost:4173/jelajahi');
    if (theme === 'glass') {
      const toggle = page.locator('[role=switch]:visible').first();
      await toggle.click();
      await page.waitForTimeout(1200);
    }
    await page.locator('label', { hasText: 'LIVE' }).click();
    await page.getByText('Batas wilayah resmi (BIG)').waitFor({ timeout: 60000 });
    const canvas = page.locator('canvas').first();
    await canvas.scrollIntoViewIfNeeded();
    await page.waitForTimeout(2500);
    const box = await canvas.boundingBox();
    for (const [fx, fy] of [
      [0.5, 0.5],
      [0.42, 0.55],
      [0.55, 0.45],
      [0.35, 0.6],
      [0.6, 0.4],
      [0.3, 0.5],
      [0.7, 0.45],
    ]) {
      await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
      await page.waitForTimeout(1500);
      if (/kode=/.test(page.url())) break;
    }
    console.log(device, theme, page.url().split('?')[1] ?? 'no selection');
    await page.screenshot({ path: `${outDir}/${label}-${device}-${theme}.png` });
    // Second state: the phone sheet fully open, or the desktop panel collapsed.
    await page.locator('button[aria-controls="panel-wilayah"]').click();
    if (device === 'mobile')
      await page
        .locator('button[aria-controls="panel-wilayah"]')
        .click()
        .catch(() => undefined);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${outDir}/${label}-${device}-${theme}-state2.png` });
    await context.close();
  }
}
await browser.close();
