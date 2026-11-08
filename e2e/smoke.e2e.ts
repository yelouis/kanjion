import { test, expect } from '@playwright/test';

test('smoke: open newspaper cover and dispatch line 1 to advance to passenger name page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /OPEN TODAY'S NEWSPAPER/i }).click();
  const input = page.locator('#telegram-input');
  await input.fill('click the top-left green box');
  await input.press('Enter');

  await expect(page.locator('#telegram-ledger')).toContainText('LINE 01:');
  await expect(page.locator('[data-testid="newspaper-left-page"] #input-passenger-name')).toBeVisible();
});
