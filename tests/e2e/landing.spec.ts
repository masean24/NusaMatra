import { expect, test, type Page } from '@playwright/test';

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
      'Ubah bobot, lihat urutan bergeser',
      'Kami juga menunjukkan yang belum kami ketahui',
      'Banyak orang tinggal tepat di tempat air berkumpul',
      'Sumber dan metodologi',
      'Mulai dari wilayah Anda',
    ]) {
      await expect(page.getByRole('heading', { name })).toBeAttached();
    }
    await expect(page.getByText('Data simulasi untuk prototipe').first()).toBeVisible();
    expect(errors).toEqual([]);
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
    await nav.getByRole('link', { name: 'Bandingkan' }).click();
    await expect(page).toHaveURL(/\/bandingkan$/);
    await expect(nav.getByRole('link', { name: 'Bandingkan' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByText('Sedang dikembangkan')).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/peta\?wilayah=ID-DEMO-JAWA$/);
    await expect(nav.getByRole('link', { name: 'Bandingkan' })).not.toHaveAttribute('aria-current', 'page');
  });

  test('region search validates and hands the query to Jelajahi', async ({ page }) => {
    await page.goto('/');
    const search = page.getByRole('searchbox', { name: 'Cari kabupaten/kota' }).first();
    await search.press('Enter');
    await expect(page.getByRole('alert').first()).toHaveText('Ketik minimal 2 huruf nama kabupaten/kota.');
    await search.fill('Kota Semarang');
    await search.press('Enter');
    await expect(page).toHaveURL(/\/jelajahi\?cari=Kota\+Semarang$/);
    await expect(page.getByText('Pencarian “Kota Semarang”')).toBeVisible();
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
