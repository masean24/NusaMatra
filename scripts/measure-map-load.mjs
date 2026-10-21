// Where the time goes between choosing LIVE on Jelajahi and the first drawn frame of the map, and
// what the user sees meanwhile. Real HTTP against the public Data Hub; read-only.
// Usage: node scripts/measure-map-load.mjs [cold|warm]   (needs `npm run preview -- --port 4173`)
import { chromium } from '@playwright/test';

const scenario = process.argv[2] ?? 'cold';
const browser = await chromium.launch({ channel: 'chrome', headless: false });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

await page.addInitScript(() => {
  window.__long = [];
  window.__seen = [];
  window.__cls = 0;
  new PerformanceObserver((list) =>
    list.getEntries().forEach((e) => {
      if (!e.hadRecentInput) window.__cls += e.value;
    }),
  ).observe({ type: 'layout-shift', buffered: true });
  new PerformanceObserver((list) =>
    list.getEntries().forEach((e) => window.__long.push([Math.round(e.startTime), Math.round(e.duration)])),
  ).observe({ entryTypes: ['longtask'] });
  // Record what is on screen every animation frame: which loading states appear and when.
  const texts = [
    'Memuat peta 3D…',
    'Menyiapkan peta 3D…',
    'Mengunduh batas wilayah resmi…',
    'Memuat batas wilayah resmi…',
    'Memeriksa data batas wilayah…',
  ];
  const tick = () => {
    const body = document.body?.innerText ?? '';
    const engine = document.querySelector('[data-engine]')?.getAttribute('data-engine') ?? 'none';
    window.__seen.push([
      Math.round(performance.now()),
      engine,
      texts.filter((t) => body.includes(t)).length,
      !!document.querySelector('canvas'),
    ]);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

const open = async () => {
  await page.goto('http://localhost:4173/jelajahi');
  await page.waitForTimeout(1500);
};

await open();
if (scenario === 'warm') {
  // First visit warms the HTTP cache and the lazy chunks; then leave the route and come back.
  await page.locator('label', { hasText: 'LIVE' }).click();
  await page.getByText('Batas wilayah resmi (BIG)').waitFor({ timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.getByRole('link', { name: 'Bandingkan' }).first().click();
  await page.waitForTimeout(800);
}

const t0 = await page.evaluate(() => {
  window.__long.length = 0;
  window.__seen.length = 0;
  window.__cls = 0;
  return performance.now();
});
// Warm: come back to Jelajahi by the navbar (mode stays LIVE); cold: choose LIVE.
if (scenario === 'warm') await page.getByRole('link', { name: 'Jelajahi' }).first().click();
else await page.locator('label', { hasText: 'LIVE' }).click();
await page.waitForTimeout(500);
await page.getByText('Batas wilayah resmi (BIG)').waitFor({ timeout: 60000 });
await page.locator('[data-engine="ready"]').waitFor({ timeout: 60000 });
await page.waitForTimeout(1500);

const report = await page.evaluate((t0) => {
  const rel = (t) => Math.round(t - t0);
  const resources = performance
    .getEntriesByType('resource')
    .filter(
      (r) => r.startTime >= t0 - 50 && /boundaries|three-|engineAdapters|regions\?|indicators\?/.test(r.name),
    )
    .map(
      (r) =>
        `${r.name.split('/').pop()?.slice(0, 40)} start ${rel(r.startTime)} end ${rel(r.responseEnd)} (${Math.round(r.transferSize / 1024)} kB transferred)`,
    );
  const seen = window.__seen;
  const firstOf = (pred) => {
    const hit = seen.find(pred);
    return hit ? rel(hit[0]) : null;
  };
  let lastLoadingText = null;
  for (const entry of seen) if (entry[2] > 0) lastLoadingText = rel(entry[0]);
  return {
    resources,
    engineStates: [...new Set(seen.map((s) => s[1]))],
    canvasAppearsAt: firstOf((s) => s[3]),
    liveMapReadyAt: (() => {
      const loading = seen.findIndex((s) => s[1] === 'loading' || s[1] === 'none');
      const hit = loading < 0 ? undefined : seen.slice(loading).find((s) => s[1] === 'ready');
      return hit ? rel(hit[0]) : null;
    })(),
    loadingTextLastSeenAt: lastLoadingText,
    layoutShiftScore: +window.__cls.toFixed(3),
    longTasks: window.__long.map(([start, dur]) => `${rel(start)}+${dur}ms`),
  };
}, t0);

console.log(JSON.stringify({ scenario, ...report }, null, 1));
await browser.close();
