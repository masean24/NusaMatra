import { expect, test, type Page } from '@playwright/test';

function splash(page: Page) {
  return page.locator('[data-intro-splash]');
}

/** How opaque the Beranda's heading is, through every parent. */
function headingOpacity(page: Page): Promise<number> {
  return page.evaluate(() => {
    let opacity = 1;
    let element: Element | null = document.querySelector('h1');
    while (element) {
      opacity *= Number(getComputedStyle(element).opacity);
      element = element.parentElement;
    }
    return opacity;
  });
}

/**
 * The page's clock stands still, so the opening's frames and timers wait for the test (loading the
 * Beranda's 3D scene can take longer than the whole opening). CSS animations still run on their own.
 */
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-04T08:00:00') });
  await page.clock.pauseAt(new Date('2026-11-04T08:00:01'));
});

test.describe('Opening splash', () => {
  test('plays on each refresh, leaves by itself, and gives the Beranda back whole', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.goto('/');
    await expect(splash(page)).toBeVisible();
    await expect(splash(page)).toHaveAttribute('aria-hidden', 'true');
    expect(await headingOpacity(page)).toBe(0);
    // The page does not scroll under it...
    await page.mouse.wheel(0, 600);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    // ...and keeps its scrollbar, so nothing fixed jumps sideways when the overlay leaves.
    const pageWidth = () => page.evaluate(() => document.documentElement.clientWidth);
    const widthDuringIntro = await pageWidth();

    await page.clock.runFor(2700);
    await expect(splash(page)).toHaveAttribute('data-phase', 'out');
    await page.clock.runFor(150);
    await expect(splash(page)).toHaveAttribute('data-phase', 'portal');
    await expect(page.locator('html')).toHaveAttribute('data-intro', 'leaving');
    await page.clock.runFor(1000);
    await expect(splash(page)).toHaveCount(0);
    await expect(page.locator('#konten-utama')).toBeFocused();
    expect(await pageWidth()).toBe(widthDuringIntro);
    await expect(page.locator('html')).toHaveAttribute('data-intro', 'done');
    await expect.poll(() => headingOpacity(page)).toBe(1);

    // Coming back to the Beranda from another page of the site does not play it again...
    await page.getByRole('link', { name: 'Jelajahi' }).filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/jelajahi$/);
    await page.getByRole('link', { name: 'Nusa Matra — Beranda' }).filter({ visible: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(splash(page)).toHaveCount(0);

    // ...but a refresh on the Beranda does, every time.
    await page.reload();
    await expect(splash(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await page.clock.runFor(1000);
    await expect(splash(page)).toHaveCount(0);
    await page.reload();
    await expect(splash(page)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('does not play when the site is opened on another page', async ({ page }) => {
    await page.goto('/bandingkan');
    await expect(page.locator('#konten-utama')).toBeAttached();
    await page.clock.runFor(2000);
    await expect(splash(page)).toHaveCount(0);
    await expect(page.locator('html')).not.toHaveAttribute('data-intro');
  });

  for (const [way, enter] of [
    ['Enter', (page: Page) => page.keyboard.press('Enter')],
    ['Space', (page: Page) => page.keyboard.press('Space')],
    ['Escape', (page: Page) => page.keyboard.press('Escape')],
    ['a click anywhere', (page: Page) => splash(page).click({ position: { x: 40, y: 40 } })],
  ] as const) {
    test(`${way} enters at once, without a second exit`, async ({ page }) => {
      await page.goto('/');
      await expect(splash(page)).toBeVisible();
      await enter(page);
      await expect(splash(page)).toHaveAttribute('data-phase', 'out');
      await page.keyboard.press('Escape');
      await page.clock.runFor(150);
      await expect(splash(page)).toHaveAttribute('data-phase', 'portal');
      await page.keyboard.press('Enter');
      await page.clock.runFor(850);
      await expect(splash(page)).toHaveCount(0);
      await expect.poll(() => headingOpacity(page)).toBe(1);
    });
  }

  test('follows the display mode', async ({ page }) => {
    const logoFile = () =>
      splash(page)
        .locator('img')
        .first()
        .evaluate((image: HTMLImageElement) => image.src);
    await page.goto('/');
    await expect(splash(page)).toBeVisible();
    expect(await logoFile()).toContain('body-normal');
    await page.evaluate(() => {
      window.localStorage.setItem('nusa-matra:display-mode', 'glass');
    });
    await page.reload();
    await expect(splash(page)).toBeVisible();
    expect(await logoFile()).toContain('body-kaca');
    await expect(splash(page)).toHaveCSS('background-image', /rgb\(14, 22, 56\)/);
  });

  test('fits a phone: the slogan is whole and nothing scrolls sideways', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(splash(page)).toBeVisible();
    const box = await splash(page).getByText('Memahami wilayah, menentukan arah.').boundingBox();
    expect(box?.x).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
    ).toBeLessThanOrEqual(0);
  });
});

test.describe('Opening splash with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('stands still and complete for 1.2 s, then fades away', async ({ page }) => {
    await page.goto('/');
    await expect(splash(page)).toHaveAttribute('data-reduced', 'true');
    await expect(splash(page).getByText('100%')).toBeVisible();
    expect(
      await page.evaluate(
        () => document.querySelector('[data-intro-splash]')?.getAnimations({ subtree: true }).length,
      ),
    ).toBe(0);
    await page.clock.runFor(1200);
    await expect(splash(page)).toHaveAttribute('data-phase', 'portal');
    await page.clock.runFor(400);
    await expect(splash(page)).toHaveCount(0);
    await expect.poll(() => headingOpacity(page)).toBe(1);
  });
});
