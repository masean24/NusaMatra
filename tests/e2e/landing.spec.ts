import { expect, test, type Page } from '@playwright/test';
import { mockDataHub } from './dataHubMocks';

function visibleNav(page: Page) {
  // Desktop renders the floating bar, phones the bottom tab bar; only one is visible.
  return page.getByRole('navigation', { name: 'Navigasi utama' }).filter({ visible: true });
}

test.describe('landing', () => {
  test('renders every Figma section with the Nusa Matra brand and no runtime errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.goto('/');
    await expect(page).toHaveTitle(/Nusa Matra/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Memahami wilayah, menentukan arah.' }),
    ).toBeVisible();
    for (const name of [
      'Dari pertanyaan sederhana ke keputusan yang bisa diperiksa',
      'Wilayah mana yang perlu didahulukan?',
      'Kami juga menunjukkan yang belum kami ketahui',
      'Sumber dan metodologi',
      'Mulai dari wilayah Anda',
    ]) {
      await expect(page.getByRole('heading', { name })).toBeAttached();
    }
    // Cerita Wilayah is still in development, so the landing no longer promotes it.
    await expect(
      page.getByRole('heading', { name: 'Banyak orang tinggal tepat di tempat air berkumpul' }),
    ).toHaveCount(0);
    await expect(page.getByText('Data simulasi untuk prototipe').first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('makes no universal claim: priorities depend on the choices, and examples say CONTOH', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(
      page.getByText(/Hasilnya bergantung pada indikator, bobot, data yang tersedia/),
    ).toBeVisible();
    await expect(page.getByText(/objektif/)).toHaveCount(0);
    await expect(page.getByText(/belum terhubung di prototipe/)).toHaveCount(0);
    await expect(page.getByText('Paspor Bukti · CONTOH-0412')).toBeAttached();
  });

  test('keeps the Nusa Matra wordmark inside its box, clear of the navbar dividers', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'the full floating bar is a desktop layout');
    await page.goto('/');
    const bar = page.locator('header > div').first();
    const wordmark = bar.getByText('Nusa Matra', { exact: false }).first();
    const home = bar.getByRole('link', { name: 'Nusa Matra — Beranda' });
    const divider = bar.locator('span[aria-hidden="true"]').first();
    const [wordBox, homeBox, dividerBox, barBox] = await Promise.all([
      wordmark.boundingBox(),
      home.boundingBox(),
      divider.boundingBox(),
      bar.boundingBox(),
    ]);
    if (!wordBox || !homeBox || !dividerBox || !barBox) throw new Error('navbar parts not laid out');

    // The seam bug: the brand box was narrower than its text, so the divider cut through "Matra".
    expect(wordBox.x + wordBox.width).toBeLessThanOrEqual(homeBox.x + homeBox.width + 0.5);
    expect(dividerBox.x - (homeBox.x + homeBox.width)).toBeGreaterThanOrEqual(12);
    // The whole bar stays inside the viewport with a visible margin.
    const viewport = page.viewportSize();
    expect(barBox.x).toBeGreaterThanOrEqual(16);
    expect(barBox.x + barBox.width).toBeLessThanOrEqual((viewport?.width ?? 0) - 16);
  });

  test('hero hexagon map: pins drop after the entrance and highlight their region card', async ({ page }) => {
    await page.goto('/');
    const pinB = page.getByRole('button', { name: /Sorot kartu Wilayah B/ });
    await expect(page.locator('canvas').first()).toBeVisible();
    // Pins and cards stay hidden until the hexagons have settled, then appear in order.
    await expect(pinB).toHaveCSS('opacity', '1', { timeout: 10_000 });
    const cardB = page.locator('[data-card="b"]');
    await expect(cardB.locator('[data-card-hold]')).toHaveCSS('opacity', '1', { timeout: 10_000 });

    await pinB.click();
    await expect(pinB).toHaveAttribute('aria-pressed', 'true');
    await expect(cardB.locator('[data-highlighted]')).toBeVisible();
    await pinB.click();
    await expect(pinB).toHaveAttribute('aria-pressed', 'false');
  });

  test('hero map stays in the hero: right of the copy, over its pins, above the next section', async ({
    page,
    isMobile,
  }) => {
    await page.goto('/');
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();
    const pin = page.getByRole('button', { name: /Sorot kartu Wilayah B/ });
    await expect(pin).toHaveCSS('opacity', '1', { timeout: 10_000 });

    const rect = (locator: typeof canvas) =>
      locator.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return { left: box.left, right: box.right, top: box.top + scrollY, bottom: box.bottom + scrollY };
      });
    const [map, copy, next, pinBox] = await Promise.all([
      rect(canvas),
      rect(page.getByRole('heading', { level: 1 })),
      rect(page.locator('main section').nth(1)),
      rect(pin),
    ]);

    // Never spills into the next section, and every pin sits inside the map's own box.
    expect(map.bottom).toBeLessThanOrEqual(next.top);
    expect(pinBox.left).toBeGreaterThanOrEqual(map.left);
    expect(pinBox.right).toBeLessThanOrEqual(map.right);
    expect(pinBox.top).toBeGreaterThanOrEqual(map.top);
    expect(pinBox.bottom).toBeLessThanOrEqual(map.bottom);
    if (!isMobile) {
      // Two columns: the headline on the left, the whole map on the right, both on the first screen.
      expect(map.left).toBeGreaterThanOrEqual(copy.right - 40);
      expect(map.top).toBeLessThan(page.viewportSize()?.height ?? 0);
    }
    // The cards are on screen, and the tiles were really painted into the map's own box: count
    // orange pixels in a screenshot of it (a blank or misplaced canvas leaves none).
    await expect(page.locator('[data-card="a"] [data-card-hold]')).toHaveCSS('opacity', '1', {
      timeout: 10_000,
    });
    await canvas.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const png = (await canvas.screenshot()).toString('base64');
    const orange = await page.evaluate(async (data) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const surface = document.createElement('canvas');
      surface.width = image.width;
      surface.height = image.height;
      const context = surface.getContext('2d');
      if (!context) return 0;
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, image.width, image.height).data;
      let count = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        const [r, g, b] = [pixels[index] ?? 0, pixels[index + 1] ?? 0, pixels[index + 2] ?? 0];
        if (r > 200 && g > 90 && g < 200 && b < 140 && r - b > 90) count += 1;
      }
      return count;
    }, png);
    expect(orange).toBeGreaterThan(300);
  });

  test('how-it-works cards show only number and title until hovered (or tapped on touch)', async ({
    page,
    isMobile,
  }) => {
    await page.goto('/');
    const card = page.getByRole('link', { name: /Langkah 3/ });
    await card.scrollIntoViewIfNeeded();
    const description = card.getByText('Atur bobot kriteria dan lihat urutan bergeser.');
    const reveal = description.locator('xpath=..');
    await expect(reveal).toHaveCSS('opacity', '0');

    if (isMobile) {
      await card.tap();
      await expect(card).toHaveAttribute('data-open', 'true');
      await expect(page).toHaveURL(/\/$/); // the first tap only opens the card
    } else {
      await card.hover();
    }
    await expect(reveal).toHaveCSS('opacity', '1');
  });

  test('Kaca background lights never make the page scroll sideways', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('nusa-matra:display-mode', 'glass');
    });
    await page.setViewportSize({ width: 1900, height: 900 });
    await page.goto('/');
    await page.waitForTimeout(1500);
    const scrolled = await page.evaluate(() => {
      window.scrollTo(600, 0);
      return window.scrollX;
    });
    expect(scrolled).toBe(0);
  });

  test('has no horizontal page overflow', async ({ page }) => {
    await page.goto('/');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('primary CTA and navbar lead to honest destinations with an active state', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Mulai jelajahi' }).first().click();
    await expect(page).toHaveURL(/\/peta$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Peta Utama' })).toBeVisible();
    // External 3D engine on Peta Utama, with the keyboard alternative owned by the host.
    await expect(page.getByRole('region', { name: 'Peta 3D wilayah' })).toBeVisible();
    await page.getByRole('button', { name: 'Gugus Pulau Jawa & Madura (Simulasi)' }).click();
    await expect(page).toHaveURL(/\/peta\?wilayah=ID-DEMO-JAWA$/);
    await expect(page.getByText('Gugus Pulau Jawa & Madura (Simulasi) dipilih')).toBeVisible();

    const nav = visibleNav(page);
    // Only the four working features are primary destinations; unfinished pages are not offered.
    await expect(nav.getByRole('link')).toHaveText([
      'Jelajahi',
      'Bandingkan',
      'Lab Prioritas',
      'Paspor Bukti',
    ]);
    await nav.getByRole('link', { name: 'Bandingkan' }).click();
    await expect(page).toHaveURL(/\/bandingkan$/);
    await expect(nav.getByRole('link', { name: 'Bandingkan' })).toHaveAttribute('aria-current', 'page');

    await page.goBack();
    await expect(page).toHaveURL(/\/peta\?wilayah=ID-DEMO-JAWA$/);
    await expect(nav.getByRole('link', { name: 'Bandingkan' })).not.toHaveAttribute('aria-current', 'page');
    await page.goForward();
    await expect(page).toHaveURL(/\/bandingkan$/);
    await expect(nav.getByRole('link', { name: 'Bandingkan' })).toHaveAttribute('aria-current', 'page');
  });

  test('one selection pill glides to the hovered item, back on leave, and to the clicked item', async ({
    page,
    isMobile,
  }) => {
    await page.goto('/jelajahi');
    const nav = visibleNav(page);
    const pill = nav.locator('[data-nav-indicator]');
    const pillLeft = async () => (await pill.boundingBox())?.x ?? Number.NaN;
    const linkLeft = async (name: string) =>
      (await nav.getByRole('link', { name }).boundingBox())?.x ?? Number.NaN;

    await expect.poll(pillLeft).toBeCloseTo(await linkLeft('Jelajahi'), 0);

    if (!isMobile) {
      await nav.getByRole('link', { name: 'Paspor Bukti' }).hover();
      await expect.poll(pillLeft).toBeCloseTo(await linkLeft('Paspor Bukti'), 0);
      await expect(page).toHaveURL(/\/jelajahi$/); // hover never navigates
      await page.mouse.move(700, 450);
      await expect.poll(pillLeft).toBeCloseTo(await linkLeft('Jelajahi'), 0);
    }

    await nav.getByRole('link', { name: 'Paspor Bukti' }).click();
    await expect(page).toHaveURL(/\/paspor-bukti$/);
    await expect.poll(pillLeft).toBeCloseTo(await linkLeft('Paspor Bukti'), 0);
  });

  test('region search validates and hands the query to Jelajahi', async ({ page }) => {
    await mockDataHub(page);
    await page.goto('/');
    const search = page.getByRole('combobox', { name: 'Cari kabupaten/kota' }).first();
    await search.press('Enter');
    await expect(page.getByRole('alert').first()).toHaveText('Ketik minimal 2 huruf nama kabupaten/kota.');
    await search.fill('Kota Semarang');
    await search.press('Enter');
    await expect(page).toHaveURL(/\/jelajahi\?cari=Kota\+Semarang$/);
    await expect(page.getByRole('searchbox', { name: 'Cari kabupaten/kota' }).last()).toHaveValue(
      'Kota Semarang',
    );
    await expect(page.getByText('Tidak ada wilayah yang cocok pada dataset DEMO saat ini')).toBeVisible();
  });

  test('region search suggests regions while typing and opens the one picked', async ({ page }) => {
    await mockDataHub(page);
    await page.goto('/');
    const search = page.getByRole('combobox', { name: 'Cari kabupaten/kota' }).first();
    await search.pressSequentially('aceh');
    const first = page.getByRole('option').first();
    await expect(first).toBeVisible();
    await expect(search).toHaveAttribute('aria-expanded', 'true');
    await search.press('ArrowDown');
    await search.press('Enter');
    await expect(page).toHaveURL(/\/jelajahi\?kode=\w+$/);
  });

  test('"Lihat cara kerjanya" glides to the section and rests it mid-screen', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Lihat cara kerjanya' }).click();
    const section = page.locator('#cara-kerja');
    await expect(section).toBeFocused();
    // Settled: the gap above the section (below the 96px navbar band) matches the gap below it.
    await expect
      .poll(async () =>
        section.evaluate((element) => {
          const box = element.getBoundingClientRect();
          if (box.height > window.innerHeight - 96) return 0;
          return Math.abs(Math.round(box.top - 96 - (window.innerHeight - box.bottom)));
        }),
      )
      .toBeLessThanOrEqual(2);
  });

  test('display mode switches to Kaca, survives a reload and keeps the route', async ({ page }) => {
    await page.goto('/bandingkan');
    const toggle = page.getByRole('switch', { name: 'Mode tampilan kaca' }).filter({ visible: true });
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-display-mode', 'glass');
    await expect(toggle).toHaveAttribute('aria-checked', 'true');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-display-mode', 'glass');
    await expect(page).toHaveURL(/\/bandingkan$/);
  });

  test('keyboard users can skip to content and reach the navbar', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard traversal is checked on desktop');
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Lewati ke konten utama' })).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Jelajahi' }).first()).toBeFocused();
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('shows all content immediately and switches mode without the liquid', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Sumber dan metodologi' })).toHaveCSS('opacity', '1');
    const toggle = page.getByRole('switch', { name: 'Mode tampilan kaca' }).filter({ visible: true });
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-display-mode', 'glass');
  });
});
