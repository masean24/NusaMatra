import { expect, test } from '@playwright/test';
import { openRegionPanel } from './jelajahiHelpers';

/**
 * Real HTTP against the deployed Data Hub (no mocks): the check that mocked tests cannot give.
 * It needs the public network, so it only runs on request:
 *   NUSAMATRA_LIVE_E2E=1 npx playwright test live-api
 */
test.skip(!process.env['NUSAMATRA_LIVE_E2E'], 'needs the public Data Hub; set NUSAMATRA_LIVE_E2E=1');

const LIVE_SNAPSHOT = '2026.10.0-official-live';

test.describe('LIVE against the deployed Data Hub', () => {
  test('Jelajahi: finds a real regency, shows official indicators with agency and year, and BIG boundaries', async ({
    page,
  }) => {
    await page.goto('/jelajahi');
    await page.locator('label', { hasText: 'LIVE' }).click();
    await expect(page.getByText(LIVE_SNAPSHOT)).toBeVisible();
    await openRegionPanel(page);

    await page.getByRole('searchbox', { name: 'Cari kabupaten/kota' }).fill('Aceh Selatan');
    await page.getByRole('button', { name: /^Kabupaten Aceh Selatan/ }).click();

    await expect(page).toHaveURL(/[?&]kode=1101/);
    await expect(page.getByRole('heading', { name: 'Kabupaten Aceh Selatan' })).toBeVisible();
    await expect(page.getByText('Tahun 2024').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'BNPB' }).first()).toBeVisible();
    // The BIG polygons are a ~5.5 MB download, so allow for the real network.
    await expect(page.getByText('Batas wilayah resmi (BIG)')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText(/luas wilayah dari sumber tidak valid/)).toBeVisible();
    await expect(page.getByText('DEMO_EXAMPLE')).toHaveCount(0);
    await expect(page.getByText(/Kabupaten Demo/)).toHaveCount(0);
  });

  test('Jelajahi: a map click shows the region panel in the same view, with no scroll and the same canvas', async ({
    page,
  }) => {
    test.setTimeout(90_000); // finding land takes a few clicks over the real network
    await page.goto('/jelajahi');
    await page.locator('label', { hasText: 'LIVE' }).click();
    await expect(page.getByText('Batas wilayah resmi (BIG)')).toBeVisible({ timeout: 45_000 });
    const canvas = page.locator('canvas').first();
    // Start with the map just under the navbar, as a reader looking at it would.
    await canvas.evaluate((element) => {
      window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top - 92);
    });
    await page.waitForTimeout(2500);
    await canvas.evaluate((element) => {
      element.dataset['probe'] = 'same-canvas';
    });
    const scrollBefore = await page.evaluate(() => window.scrollY);
    const initialBox = await canvas.boundingBox();
    if (!initialBox) throw new Error('map has no box');
    let box = initialBox;

    // Scan the part of the map that is on screen (above a phone's bottom nav and sheet bar) for land.
    const viewport = page.viewportSize();
    let bottom = Math.min(box.y + box.height, (viewport?.height ?? 800) - 200);
    const grid = (xs: readonly number[], ys: readonly number[]) =>
      ys.flatMap((fy) => xs.map((fx) => [fx, fy] as const));
    const cell = (fx: number, fy: number) => {
      const top = Math.max(box.y, 0);
      return [fx, (top + (bottom - top) * fy - box.y) / box.height] as const;
    };
    const clickLand = async (
      points: readonly (readonly [number, number])[],
      not: string | null,
      stage: string,
    ) => {
      for (const [gx, gy] of points) {
        const [fx, fy] = cell(gx, gy);
        await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
        await page
          .waitForFunction(
            (previous) => {
              const code = new URLSearchParams(location.search).get('kode');
              return !!code && code !== previous;
            },
            not,
            { timeout: 900 },
          )
          .catch(() => undefined);
        const code = new URL(page.url()).searchParams.get('kode');
        if (code && code !== not) return code;
      }
      throw new Error(`no region was hit (${stage}; map ${JSON.stringify(box)}, bottom ${String(bottom)})`);
    };

    const lowerRows = [0.5, 0.35, 0.65, 0.2, 0.8];
    const columns = [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8];
    const first = await clickLand(grid(columns, lowerRows), null, 'first');
    const panel = page.getByLabel('Informasi wilayah');
    await expect(panel.getByRole('heading', { level: 2 }).last()).toBeVisible();
    await expect(panel.getByText('Data resmi LIVE')).toBeVisible({ timeout: 20_000 });

    // Same viewport: the panel is on screen and the page did not move.
    const panelBox = await panel.boundingBox();
    expect(panelBox && viewport && panelBox.y < viewport.height && panelBox.y + panelBox.height > 0).toBe(
      true,
    );
    const onDesktop = (viewport?.width ?? 0) >= 960;
    if (onDesktop) {
      expect(Math.abs((await page.evaluate(() => window.scrollY)) - scrollBefore)).toBeLessThan(2);
    }
    // On a phone the page may bring the map itself back into view above the sheet, nothing else.
    await page.waitForTimeout(900); // let the smooth scroll settle
    const nextBox = await canvas.boundingBox();
    if (!nextBox) throw new Error('map has no box');
    box = nextBox;

    // Another region updates the same panel; the WebGL canvas is the same element.
    // After the first selection a phone's sheet covers the lower part, so look in the upper rows.
    bottom = Math.min(box.y + box.height, (viewport?.height ?? 800) - 200);
    if (panelBox && panelBox.x < box.x + box.width) bottom = Math.min(bottom, panelBox.y - 20); // a phone's sheet now covers the lower map
    const second = await clickLand(grid(columns, lowerRows), first, 'second');
    expect(second).not.toBe(first);
    await expect(panel.getByText('Data resmi LIVE')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('canvas[data-probe="same-canvas"]')).toHaveCount(1);
    await expect(page.locator('canvas')).toHaveCount(1);
  });

  test('Jelajahi: indicators carry a verdict with text, not colour alone, and imputed values are not judged', async ({
    page,
  }) => {
    await page.goto('/jelajahi?kode=1101');
    await page.locator('label', { hasText: 'LIVE' }).click();
    const panel = page.getByLabel('Informasi wilayah');
    await expect(panel.getByText('Data resmi LIVE')).toBeVisible({ timeout: 30_000 });
    await openRegionPanel(page);

    const summary = panel.getByRole('region', { name: 'Ringkasan' });
    await expect(summary.getByRole('listitem')).toHaveCount(4);
    for (const badge of await summary.locator('[data-tone]').all()) {
      expect(['positive', 'negative', 'neutral', 'unknown']).toContain(await badge.getAttribute('data-tone'));
      expect((await badge.innerText()).trim().length).toBeGreaterThan(3);
    }

    await panel.getByText('Infrastruktur').click();
    const electricity = panel
      .locator('details', { hasText: 'Persentase Rumah Tangga Pengguna Listrik' })
      .last();
    await electricity.locator('summary').click();
    await expect(electricity.getByText('Tidak dinilai').first()).toBeVisible();
    await expect(electricity.getByText(/Diimputasi dari nilai tingkat provinsi/).first()).toBeVisible();
    await expect(electricity.getByText('Nilai asli (dari sumber)')).toBeVisible();
  });

  test('Bandingkan: compares two real regions and blocks what is not comparable', async ({ page }) => {
    await page.goto('/bandingkan?a=1101&b=3171');
    await page.locator('label', { hasText: 'LIVE' }).click();

    // Counts follow the live snapshot, so assert the shape of the summary, not its numbers.
    await expect(page.getByText(/Dari \d+ indikator wilayah, \d+ dapat dibandingkan/)).toBeVisible();
    await expect(page.getByText(`Snapshot ${LIVE_SNAPSHOT} · mode LIVE`)).toBeVisible();
    const imputed = page.getByRole('row', { name: /Pengguna Listrik/ });
    await expect(imputed.getByText('Tidak dibandingkan')).toBeVisible();
    await expect(imputed.getByText('Imputasi provinsi, bukan observasi kab/kota').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Buat Paspor Bukti' })).toHaveAttribute(
      'href',
      /^\/paspor-bukti\?jenis=bandingkan&mode=live&snap=[^&]+&a=1101&b=3171$/,
    );
    await expect(page.getByText(/Kabupaten Demo/)).toHaveCount(0);
  });

  test('Lab Prioritas: shows a LIVE ranking only if it passes the integrity check, never a DEMO one', async ({
    page,
  }) => {
    await page.goto('/lab-prioritas');
    await page.locator('label', { hasText: 'LIVE' }).click();

    // Either the checked ranking or an explained hold; the detailed invariants live in priority-lab.spec.ts.
    const ready = page.getByText('Hasil siap dan sudah diperiksa');
    const withheld = page.getByText(/Hasil ditahan agar tidak menyesatkan/);
    await expect(ready.or(withheld)).toBeVisible({ timeout: 30_000 });
    if (await ready.isVisible()) {
      await expect(page.getByText(/peringkat 1 adalah prioritas tertinggi/)).toBeVisible();
    }
    await expect(page.getByText(/Kabupaten Demo/)).toHaveCount(0);
  });
});
