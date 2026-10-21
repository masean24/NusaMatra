// One-off: screenshot of the LIVE map with a hover tooltip and a selected region.
import { chromium } from '@playwright/test';

const out = process.argv[2];
const browser = await chromium.launch({ channel: 'chrome', headless: false });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto('http://localhost:4173/jelajahi');
await page.locator('label', { hasText: 'LIVE' }).click();
await page.getByText('Batas wilayah resmi (BIG)').waitFor({ timeout: 60000 });
const canvas = page.locator('canvas').first();
await page.waitForTimeout(3000);
const box = await canvas.boundingBox();
await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
await page.waitForTimeout(800);
await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.45, { steps: 8 });
await page.waitForTimeout(800);
console.log(page.url());
await canvas.locator('xpath=..').screenshot({ path: out });
await browser.close();
