import { expect, test } from '@playwright/test';
import { openRegionPanel } from './jelajahiHelpers';

/**
 * Real HTTP against the deployed Data Hub (no mocks): the check that mocked tests cannot give.
 * It needs the public network, so it only runs on request:
 *   NUSAMATRA_LIVE_E2E=1 npx playwright test live-api
 */
test.skip(!process.env['NUSAMATRA_LIVE_E2E'], 'needs the public Data Hub; set NUSAMATRA_LIVE_E2E=1');

// v2.2 snapshot ids are content-addressed (`<release>-live-<first 16 hex of content_sha256>`) and change
// with the data, so the id is matched by that documented shape, never by one value.
const LIVE_SNAPSHOT = /\d{4}\.\d{2}\.\d+-live-[0-9a-f]{16}/;

test.describe('LIVE against the deployed Data Hub', () => {
  test('first load: the production build opens in LIVE, and DEMO is an explicit, labelled choice', async ({
    page,
  }) => {
    await page.goto('/jelajahi?kode=9507');
    // No click: LIVE is the production default.
    await expect(page.getByRole('radio', { name: 'LIVE' })).toBeChecked();
    await expect(page.getByText(LIVE_SNAPSHOT).first()).toBeVisible({ timeout: 30_000 });
    const panel = page.getByLabel('Informasi wilayah');
    await expect(panel.getByText('Data resmi LIVE')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Kabupaten Demo/)).toHaveCount(0);
    // Lanny Jaya is among the worst-off regions: the undocumented percentile must not make it "better".
    await expect(panel.getByText(/Relatif lebih baik|Lebih baik daripada sekitar/)).toHaveCount(0);

    await page.locator('label', { hasText: 'DEMO' }).click();
    await expect(page.getByRole('radio', { name: 'DEMO' })).toBeChecked();
    await expect(page.getByText('Simulasi — bukan data atau rekomendasi resmi.').first()).toBeVisible();
    await expect(page.getByText('2026.10.0-wia-demo').first()).toBeVisible({ timeout: 30_000 });

    // The choice holds across pages within the session. Lab keeps the switch folded under "Ganti data".
    await page.getByRole('link', { name: 'Lab Prioritas' }).first().click();
    await expect(page.getByText('DEMO · data simulasi')).toBeVisible();
    await page.getByText('Ganti data').click();
    await expect(page.getByRole('radio', { name: 'DEMO' })).toBeChecked();
  });

  test('Jelajahi: finds a real regency, shows official indicators with agency and year, and BIG boundaries', async ({
    page,
  }) => {
    await page.goto('/jelajahi');
    // The production build opens in LIVE and has no mode switch.
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
    // The production build opens in LIVE and has no mode switch.
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

    // Scan only the open map for land: right of the desktop sidebar, under the phone's status cards,
    // above the phone's bottom nav and sheet bar. A click on the sidebar's region list would also set
    // a code, so the scan must never land there.
    const viewport = page.viewportSize();
    const onDesktop = (viewport?.width ?? 0) >= 960;
    const panel = page.getByLabel('Informasi wilayah');
    const status = await page.getByRole('region', { name: 'Status data peta' }).boundingBox();
    const sidebar = await panel.boundingBox();
    const left = onDesktop && sidebar ? sidebar.x + sidebar.width + 8 : box.x;
    const top = !onDesktop && status ? status.y + status.height + 8 : Math.max(box.y, 0);
    let bottom = Math.min(box.y + box.height, (viewport?.height ?? 800) - 200);
    const grid = (xs: readonly number[], ys: readonly number[]) =>
      ys.flatMap((fy) => xs.map((fx) => [fx, fy] as const));
    const clickLand = async (
      points: readonly (readonly [number, number])[],
      not: string | null,
      stage: string,
    ) => {
      const right = box.x + box.width;
      for (const [fx, fy] of points) {
        await page.mouse.click(left + (right - left) * fx, top + (bottom - top) * fy);
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
      throw new Error(
        `no region was hit (${stage}; map ${JSON.stringify(box)}, scan ${String(left)},${String(top)} to bottom ${String(bottom)})`,
      );
    };

    const lowerRows = [0.5, 0.35, 0.65, 0.2, 0.8];
    const columns = [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8];
    const first = await clickLand(grid(columns, lowerRows), null, 'first');
    await expect(panel.getByRole('heading', { level: 2 }).last()).toBeVisible();
    await expect(panel.getByText('Data resmi LIVE')).toBeVisible({ timeout: 20_000 });

    // Same viewport: the panel is on screen and the page did not move.
    const panelBox = await panel.boundingBox();
    expect(panelBox && viewport && panelBox.y < viewport.height && panelBox.y + panelBox.height > 0).toBe(
      true,
    );
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
    if (!onDesktop && panelBox) bottom = Math.min(bottom, panelBox.y - 20); // a phone's sheet now covers the lower map
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
    // The production build opens in LIVE and has no mode switch.
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
    // The production build opens in LIVE and has no mode switch.

    // Counts follow the live snapshot, so assert the shape of the summary, not its numbers.
    await expect(page.getByText(/Dari \d+ indikator wilayah, \d+ dapat dibandingkan/)).toBeVisible();
    await expect(page.getByText(new RegExp(`Snapshot ${LIVE_SNAPSHOT.source} · mode LIVE`))).toBeVisible();
    const imputed = page.getByRole('row', { name: /Pengguna Listrik/ });
    await expect(imputed.getByText('Tidak dibandingkan')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Buat Paspor Bukti' })).toHaveAttribute(
      'href',
      /^\/paspor-bukti\?jenis=bandingkan&mode=live&snap=[^&]+&a=1101&b=3171$/,
    );
    await expect(page.getByText(/Kabupaten Demo/)).toHaveCount(0);

    // The full detail (quality labels, sources, reasons) is one click away.
    await page.getByRole('link', { name: 'Selengkapnya' }).click();
    await expect(page).toHaveURL(/\/bandingkan\/rincian\?a=1101&b=3171$/);
    const imputedDetail = page.getByRole('row', { name: /Pengguna Listrik/ });
    await expect(
      imputedDetail.getByText('Imputasi provinsi, bukan observasi kab/kota').first(),
    ).toBeVisible();
  });

  test('Lab Prioritas: shows a LIVE ranking only if it passes the integrity check, never a DEMO one', async ({
    page,
  }) => {
    await page.goto('/lab-prioritas');
    await page.getByText('Ganti data').click();
    // The production build opens in LIVE and has no mode switch.

    // Either the checked ranking or an explained hold; the detailed invariants live in priority-lab.spec.ts.
    const ready = page.getByText('Hasil siap dan sudah diperiksa');
    const withheld = page.getByText(/Hasil ditahan agar tidak menyesatkan/);
    await expect(ready.or(withheld)).toBeVisible({ timeout: 30_000 });
    if (await ready.isVisible()) {
      // The one-line reading above the ranking; the full one is folded under "Cara membaca skor".
      await expect(
        page
          .getByRole('region', { name: 'Peringkat wilayah' })
          .getByText(/makin tinggi, makin tinggi kebutuhan intervensi/),
      ).toBeVisible();
    }
    await expect(page.getByText(/Kabupaten Demo/)).toHaveCount(0);
  });

  test('Paspor Bukti: a Lab passport is pinned to the active reproducible snapshot and states its digest', async ({
    page,
  }) => {
    // The kemiskinan + stunting scenario, national, focused on Lanny Jaya (9507); no snapshot in the link.
    await page.goto(
      '/paspor-bukti?jenis=lab&mode=live&bobot=hlt_stunting_prevalence:3000,inf_safe_sanitation_pct:2000,inf_safe_water_pct:2000,soc_poverty_rate:3000&kode=9507',
    );
    const passport = page.getByRole('article', { name: /^Bukti hasil Lab/ });
    await expect(passport).toBeVisible({ timeout: 30_000 });
    const status = passport.getByRole('region', { name: /Status sumber data/ });
    await expect(status).toContainText('Dapat direproduksi: dikunci ke snapshot aktif saat dibuka.');
    await expect(status).toContainText(LIVE_SNAPSHOT);
    await expect(status).toContainText(/[0-9a-f]{64}/);
    await expect(passport).toContainText('Dirangkai di peramban, bukan arsip/sertifikat resmi.');
    // Whatever the current data, a ranking is either shown with its checks or withheld with a reason.
    await expect(passport.getByText(/Kabupaten Demo/)).toHaveCount(0);
    // The summary comes first; a shown ranking is paged (20 rows), never every region at once.
    const summary = passport.getByRole('region', { name: /Ringkasan hasil/ });
    await expect(summary).toBeVisible();
    const ranking = passport.getByRole('table', { name: /^Peringkat \d+ wilayah/ });
    if (await ranking.count()) {
      await expect(summary.getByRole('list', { name: 'Wilayah dengan prioritas tertinggi' })).toBeVisible();
      expect(await ranking.locator('tbody tr').count()).toBeLessThanOrEqual(20);
    } else {
      await expect(summary).toContainText('Peringkat ditahan');
    }
  });

  test('Paspor Bukti: a link to a snapshot the Data Hub does not have fails instead of showing newer data', async ({
    page,
  }) => {
    await page.goto('/paspor-bukti?jenis=wilayah&mode=live&snap=2026.10.0-official-live&kode=1101');
    await expect(page.getByText('Snapshot pada tautan tidak tersedia')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('article', { name: /^Bukti / })).toHaveCount(0);
  });
});
