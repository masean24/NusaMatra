// Measures the LIVE Jelajahi 3D map: frame times while idle, hovering and orbiting, draw calls,
// triangles and geometry rebuilds. Real HTTP against the public Data Hub; read-only.
// Usage: node scripts/perf-map.mjs [normal|glass] [baseUrl]   (needs `npm run preview -- --port 4173`)
import { chromium } from '@playwright/test';

const mode = process.argv[2] ?? 'normal';
const baseUrl = process.argv[3] ?? 'http://localhost:4173';

const browser = await chromium.launch({
  channel: 'chrome',
  headless: process.env.HEADLESS === '1',
  args: ['--enable-gpu-rasterization', '--ignore-gpu-blocklist'],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

// Count GL work and geometry builds from the page, before any script runs.
await page.addInitScript(() => {
  const stats = { draws: 0, triangles: 0, frames: 0, geometryBuilds: 0 };
  window.__glStats = stats;
  for (const proto of [WebGL2RenderingContext.prototype, WebGLRenderingContext.prototype]) {
    for (const name of [
      'clear',
      'bufferData',
      'drawElements',
      'drawArrays',
      'drawElementsInstanced',
      'drawArraysInstanced',
    ]) {
      const original = proto[name];
      proto[name] = function (mode, a, b) {
        if (name === 'clear') {
          stats.clears = (stats.clears ?? 0) + 1;
          return original.apply(this, arguments);
        }
        if (name === 'bufferData') {
          stats.uploads = (stats.uploads ?? 0) + 1;
          return original.apply(this, arguments);
        }
        stats.draws += 1;
        const count = name.startsWith('drawElements') ? b : a === undefined ? 0 : b;
        if (mode === this.TRIANGLES) stats.triangles += (name.startsWith('drawElements') ? b : b) / 3;
        void count;
        return original.apply(this, arguments);
      };
    }
  }
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) =>
    raf((t) => {
      cb(t);
    });
});

const canvas = page.locator('canvas').first();
let box;
async function openLive() {
  await page.goto(`${baseUrl}/jelajahi`);
  if (mode === 'glass') {
    const toggle = page.locator('[role=switch]:visible').first();
    if ((await toggle.getAttribute('aria-checked')) !== 'true') await toggle.click();
    await page.waitForTimeout(1200);
  }
  await page.locator('label', { hasText: 'LIVE' }).click();
  await page.getByText('Batas wilayah resmi (BIG)').waitFor({ timeout: 60000 });
  await canvas.waitFor();
  await page.waitForTimeout(3000);
  await canvas.scrollIntoViewIfNeeded();
  box = await canvas.boundingBox();
}
await openLive();
if (process.env.NOBLUR === '1') {
  await page.addStyleTag({
    content: '*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}',
  });
}
console.log(
  JSON.stringify({
    glassSwitchChecked: await page.locator('[role=switch]:visible').first().getAttribute('aria-checked'),
  }),
);

const frames = (label, durationMs, action) =>
  page
    .evaluate(
      async ([durationMs]) => {
        const times = [];
        const perFrame = [];
        let last = performance.now();
        const longTasks = [];
        const observer = new PerformanceObserver((list) =>
          list.getEntries().forEach((e) => longTasks.push(e.duration)),
        );
        try {
          observer.observe({ entryTypes: ['longtask'] });
        } catch {}
        window.__glStats.draws = 0;
        window.__glStats.triangles = 0;
        const uploadsBefore = window.__glStats.uploads ?? 0;
        const end = performance.now() + durationMs;
        await new Promise((resolve) => {
          let lastDraws = window.__glStats.draws;
          let lastClears = window.__glStats.clears ?? 0;
          const tick = (now) => {
            perFrame.push([window.__glStats.draws - lastDraws, (window.__glStats.clears ?? 0) - lastClears]);
            lastDraws = window.__glStats.draws;
            lastClears = window.__glStats.clears ?? 0;
            times.push(now - last);
            last = now;
            if (now < end) requestAnimationFrame(tick);
            else resolve();
          };
          requestAnimationFrame(tick);
        });
        observer.disconnect();
        times.shift();
        const sorted = [...times].sort((a, b) => a - b);
        const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
        const total = times.reduce((a, b) => a + b, 0);
        return {
          fps: +(times.length / (total / 1000)).toFixed(1),
          avgMs: +(total / times.length).toFixed(1),
          p95Ms: +q(0.95).toFixed(1),
          maxMs: +sorted.at(-1).toFixed(1),
          over33ms: times.filter((t) => t > 33.4).length,
          longTasks: longTasks.length,
          bufferUploads: (window.__glStats.uploads ?? 0) - uploadsBefore,
          drawsPerFrame: Math.round(window.__glStats.draws / times.length),
          sampleFrame: perFrame
            .slice(5, 8)
            .map(([d, c]) => `${d}d/${c}c`)
            .join(' '),
          trianglesPerFrame: Math.round(window.__glStats.triangles / times.length),
        };
      },
      [durationMs],
    )
    .then(async (result) => ({ label, ...result }));

const run = async (label, durationMs, action) => {
  const pending = frames(label, durationMs);
  await action();
  return pending;
};

const results = [];
results.push(await run('idle', 3000, async () => {}));

const cdp = await context.newCDPSession(page);
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
await cdp.send('Profiler.start');
results.push(
  await run('hover sweep', 4000, async () => {
    for (let pass = 0; pass < 3; pass += 1) {
      for (let i = 0; i <= 60; i += 1) {
        await page.mouse.move(
          box.x + box.width * (0.2 + 0.6 * (i / 60)),
          box.y + box.height * (0.35 + 0.1 * Math.sin(i / 6 + pass)),
        );
        await page.waitForTimeout(16);
      }
    }
  }),
);

{
  const { profile } = await cdp.send('Profiler.stop');
  const self = new Map();
  const dt = profile.timeDeltas;
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  profile.samples.forEach((id, i) => {
    const f = byId.get(id).callFrame;
    const key = `${f.functionName || '(anonymous)'} ${f.url.split('/').pop()}:${f.lineNumber}`;
    self.set(key, (self.get(key) ?? 0) + (dt[i] ?? 0) / 1000);
  });
  const total = [...self.values()].reduce((a, b) => a + b, 0);
  const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.log('hover CPU profile (self ms of ' + total.toFixed(0) + ' ms sampled):');
  for (const [name, ms] of top) console.log('  ' + ms.toFixed(0).padStart(5) + ' ms  ' + name);
}
results.push(
  await run('orbit drag', 4000, async () => {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    for (let i = 0; i <= 120; i += 1) {
      await page.mouse.move(
        box.x + box.width / 2 + Math.sin(i / 15) * 220,
        box.y + box.height / 2 + Math.cos(i / 15) * 90,
      );
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
  }),
);

results.push(
  await run('wheel zoom', 3000, async () => {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    for (let i = 0; i < 20; i += 1) {
      await page.mouse.wheel(0, i < 10 ? -240 : 240);
      await page.waitForTimeout(60);
    }
  }),
);

// Cost of one selection (click): how long until the map has settled.
await openLive(); // fresh camera, so the click lands on land
await page.evaluate(() => {
  window.__long = [];
  new PerformanceObserver((list) =>
    list.getEntries().forEach((e) => window.__long.push(Math.round(e.duration))),
  ).observe({
    entryTypes: ['longtask'],
  });
});
const uploadsBeforeClick = await page.evaluate(() => window.__glStats.uploads ?? 0);
let selectedUrl = null;
const clickStart = Date.now();
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
  await page.waitForTimeout(1200);
  if (/kode=/.test(page.url())) {
    selectedUrl = page.url().split('?')[1];
    break;
  }
}
const clickReport = await page.evaluate(
  (uploadsBefore) => ({
    longTasksAfterClickMs: window.__long,
    geometryUploadsDuringClick: (window.__glStats.uploads ?? 0) - uploadsBefore,
  }),
  uploadsBeforeClick,
);
console.log(JSON.stringify({ mode, selectedUrl, ...clickReport, waitedMs: Date.now() - clickStart }));

console.table(results);
console.log(
  JSON.stringify(
    await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl');
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'n/a',
        canvases: document.querySelectorAll('canvas').length,
        clearsTotal: window.__glStats.clears,
        bufferUploadsTotal: window.__glStats.uploads,
      };
    }),
  ),
);
const info = await page.evaluate(() => ({
  dpr: devicePixelRatio,
  canvas: [document.querySelector('canvas').width, document.querySelector('canvas').height],
}));
console.log(JSON.stringify(info));
await browser.close();
