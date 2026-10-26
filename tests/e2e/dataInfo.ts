import type { Page } from '@playwright/test';

/** On phones (< 600px) Jelajahi folds its data-status cards (mode, BMKG, boundaries) into "Info data". */
const summary = (page: Page) => page.locator('summary', { hasText: 'Info data' });

async function setDataInfo(page: Page, open: boolean): Promise<void> {
  await page.getByRole('region', { name: 'Status data peta' }).waitFor();
  if ((await summary(page).count()) === 0) return; // tablet and desktop: the cards are always shown
  const isOpen = await summary(page).evaluate(
    (element) => (element.parentElement as HTMLDetailsElement).open,
  );
  if (isOpen !== open) await summary(page).click();
}

/** Shows the data-status cards, opening the phone disclosure if there is one. */
export function openDataInfo(page: Page): Promise<void> {
  return setDataInfo(page, true);
}

/** Folds the phone disclosure again, so the map is clear. */
export function closeDataInfo(page: Page): Promise<void> {
  return setDataInfo(page, false);
}
