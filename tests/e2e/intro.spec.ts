import { expect, test, type Page } from '@playwright/test';

const DIALOG_NAME = 'Pembuka Nusa Matra. Tekan Enter untuk masuk.';

function intro(page: Page) {
  return page.getByRole('dialog', { name: DIALOG_NAME });
}

/** The Beranda elements the opening holds back and lets in again. */
async function heldBackCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      [...document.querySelectorAll('[data-intro-step]')].filter((element) => {
        const style = getComputedStyle(element);
        return style.display !== 'none' && Number(style.opacity) < 1;
      }).length,
  );
}

/**
 * The page's clock stands still, so the opening's timers wait for the test (loading the Beranda's
 * 3D scene can take longer than the whole opening). CSS animations still run on their own.
 */
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-04T08:00:00') });
  await page.clock.pauseAt(new Date('2026-11-04T08:00:01'));
});

test.describe('Garis Pantai opening', () => {
  test('plays once per session, leaves by itself, and gives the Beranda back whole', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.goto('/');
    await expect(intro(page)).toBeVisible();
    await expect(intro(page)).toBeFocused();
    // The page does not scroll under it...
    await page.mouse.wheel(0, 600);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    // ...and keeps its scrollbar, so nothing fixed jumps sideways when the overlay leaves.
    const pageWidth = () => page.evaluate(() => document.documentElement.clientWidth);
    const widthDuringIntro = await pageWidth();

    // Leaves by itself at 4.7 s, is gone 1.18 s later, and the entrance ends 0.87 s after that.
    await page.clock.runFor(4700);
    await expect(intro(page)).toHaveAttribute('data-phase', 'leaving');
    await page.clock.runFor(1180);
    await expect(intro(page)).toHaveCount(0);
    await expect(page.locator('#konten-utama')).toBeFocused();
    expect(await pageWidth()).toBe(widthDuringIntro);
    await page.clock.runFor(900);
    await expect(page.locator('html')).toHaveAttribute('data-intro', 'done');
    await expect.poll(() => heldBackCount(page)).toBe(0);

    // Coming back to the Beranda from another page of the site does not play it again...
    await page.getByRole('link', { name: 'Jelajahi' }).filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/jelajahi$/);
    await page.getByRole('link', { name: 'Nusa Matra — Beranda' }).filter({ visible: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(intro(page)).toHaveCount(0);

    // ...but a reload on the Beranda does.
    await page.reload();
    await expect(intro(page)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('does not play when the site is opened on another page', async ({ page }) => {
    await page.goto('/bandingkan');
    await expect(page.locator('#konten-utama')).toBeAttached();
    await page.clock.runFor(2000);
    await expect(intro(page)).toHaveCount(0);
    await expect(page.locator('html')).not.toHaveAttribute('data-intro');
  });

  for (const [way, enter] of [
    ['Enter', (page: Page) => page.keyboard.press('Enter')],
    ['a click anywhere', (page: Page) => intro(page).click({ position: { x: 40, y: 40 } })],
  ] as const) {
    test(`${way} enters at once, without a second exit`, async ({ page }) => {
      await page.goto('/');
      await expect(intro(page)).toBeVisible();
      await enter(page);
      await expect(intro(page)).toHaveAttribute('data-phase', 'leaving');
      await page.keyboard.press('Escape');
      await page.clock.runFor(1180);
      await expect(intro(page)).toHaveCount(0);
      await page.clock.runFor(900);
      await expect(page.locator('html')).toHaveAttribute('data-intro', 'done');
      await expect.poll(() => heldBackCount(page)).toBe(0);
    });
  }

  test('fits a phone: the tagline is whole and nothing scrolls sideways', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(intro(page)).toBeVisible();
    for (const text of ['Memahami wilayah', 'Menentukan arah']) {
      const box = await intro(page).getByText(text).boundingBox();
      expect(box?.x).toBeGreaterThanOrEqual(0);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390);
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
    ).toBeLessThanOrEqual(0);
  });
});

test.describe('Garis Pantai opening with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('stands still for 1.2 s, then fades away', async ({ page }) => {
    await page.goto('/');
    await expect(intro(page)).toHaveAttribute('data-reduced', 'true');
    const drawing = await page.evaluate(
      () => document.querySelector('[role="dialog"] path[pathLength="1"]')?.getAnimations().length ?? -1,
    );
    expect(drawing).toBe(0);
    await page.clock.runFor(1200);
    await expect(intro(page)).toHaveAttribute('data-phase', 'leaving');
    await page.clock.runFor(400);
    await expect(intro(page)).toHaveCount(0);
    await expect.poll(() => heldBackCount(page)).toBe(0);
  });
});
