import { test, expect } from '@playwright/test';

test('smoke: open newspaper cover, dispatch 2 lines, reload, and verify LINE 03 persists', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /OPEN TODAY'S NEWSPAPER/i }).click();
  const input = page.locator('#telegram-input');
  await input.fill('click the top-left green box');
  await input.press('Enter');

  await expect(page.locator('#telegram-ledger')).toContainText('LINE 01:');
  await expect(page.locator('[data-testid="newspaper-left-page"] #input-passenger-name')).toBeVisible();

  await input.fill('type TANAKA in the passenger name box');
  await input.press('Enter');

  await expect(page.locator('#active-line-label')).toContainText('LINE 03');

  await page.reload();
  await page.getByRole('button', { name: /OPEN TODAY'S NEWSPAPER/i }).click();
  await expect(page.locator('#active-line-label')).toContainText('LINE 03');
});
