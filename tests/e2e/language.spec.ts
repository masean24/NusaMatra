import { expect, test, type Page } from '@playwright/test';

const english = (page: Page) => page.getByRole('button', { name: 'English' }).filter({ visible: true });
const indonesian = (page: Page) =>
  page.getByRole('button', { name: 'Bahasa Indonesia' }).filter({ visible: true });

/** A value on `window` survives only as long as the page is not reloaded. */
async function markPage(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { samePage: boolean }).samePage = true;
  });
}
const pageWasKept = (page: Page) =>
  page.evaluate(() => (window as unknown as { samePage?: boolean }).samePage === true);

async function openBeranda(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test.describe('Interface language', () => {
  test('switches in place, without reloading, and remembers the choice', async ({ page }) => {
    await openBeranda(page);
    await expect(page.locator('html')).toHaveAttribute('lang', 'id');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Memahami wilayah, menentukan arah.');
    await expect(indonesian(page)).toHaveAttribute('aria-pressed', 'true');
    await markPage(page);

    await english(page).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Understand regions, set direction.');
    await expect(english(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveTitle(/Understand regions/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await pageWasKept(page)).toBe(true);

    await page.goto('/lab-prioritas');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Priority Lab');
    await expect(
      page.getByRole('link', { name: 'Compare', exact: true }).filter({ visible: true }),
    ).toHaveCount(1);

    await markPage(page);
    await indonesian(page).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'id');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Lab Prioritas');
    expect(await pageWasKept(page)).toBe(true);
  });

  test('opens directly in the saved language', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('nusa-matra:language', 'en');
    });
    await page.goto('/metodologi');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('How Scores Are Calculated');
  });

  test('keeps what the user set in the Lab', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'the settings panel folds on a phone');
    await page.goto('/lab-prioritas');
    const slider = page.getByRole('slider').first();
    await expect(slider).toBeVisible();
    await slider.focus();
    for (let step = 0; step < 6; step += 1) await slider.press('ArrowRight');
    const value = await slider.inputValue();

    await english(page).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Priority Lab');
    await expect(page.getByRole('slider').first()).toHaveValue(value);
  });

  test('keeps the same map on Jelajahi', async ({ page }) => {
    await page.goto('/jelajahi');
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();
    await canvas.evaluate((element) => {
      element.dataset['qa'] = 'same-map';
    });
    await english(page).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('canvas[data-qa="same-map"]')).toHaveCount(1);
  });
});
