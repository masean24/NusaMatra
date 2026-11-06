import { expect, test, type Page } from '@playwright/test';

const english = (page: Page) => page.getByRole('button', { name: 'English' }).filter({ visible: true });
const indonesian = (page: Page) =>
  page.getByRole('button', { name: 'Bahasa Indonesia' }).filter({ visible: true });

async function openBeranda(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test.describe('Interface language', () => {
  test('starts in Indonesian, switches to English without replaying the opening, and remembers it', async ({
    page,
  }) => {
    await openBeranda(page);
    await expect(page.locator('html')).toHaveAttribute('lang', 'id');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Memahami wilayah, menentukan arah.');
    await expect(indonesian(page)).toHaveAttribute('aria-pressed', 'true');

    await english(page).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Understand regions, set direction.');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(english(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveTitle(/Understand regions/);

    await page.goto('/lab-prioritas');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Priority Lab');
    await expect(
      page.getByRole('link', { name: 'Compare', exact: true }).filter({ visible: true }),
    ).toHaveCount(1);

    await indonesian(page).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'id');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Lab Prioritas');
  });

  test('opens directly in the saved language', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('nusa-matra:language', 'en');
    });
    await page.goto('/metodologi');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('How Scores Are Calculated');
  });
});
