import type { Page } from '@playwright/test';

/** On a phone the region panel starts folded to a bar; open it. On desktop it is already open. */
export async function openRegionPanel(page: Page): Promise<void> {
  const bar = page.locator('button[aria-controls="panel-wilayah"]');
  await bar.waitFor();
  if ((await bar.getAttribute('aria-expanded')) === 'false') await bar.click();
}
