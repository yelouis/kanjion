import { test, expect } from '@playwright/test';

test('smoke: open newspaper cover, dispatch 2 lines, reload, and verify LINE 03 persists', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /OPEN TODAY'S NEWSPAPER/i }).click();
  const input = page.locator('#telegram-input');
  await input.fill('Click the blue card on the right');
  await input.press('Enter');

  await expect(page.locator('#telegram-ledger')).toContainText('LINE 01:');
  await expect(page.locator('[data-testid="newspaper-left-page"] #input-passenger-name')).toBeVisible();

  await input.fill('Type TANAKA in the romaji box on the left');
  await input.press('Enter');

  await expect(page.locator('#active-line-label')).toContainText('LINE 03');

  await page.reload();
  await page.getByRole('button', { name: /OPEN TODAY'S NEWSPAPER/i }).click();
  await expect(page.locator('#active-line-label')).toContainText('LINE 03');
});

test('phone zoom: 2x stage zoom without horizontal page scroll and cursor centered after dispatch', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: /OPEN TODAY'S NEWSPAPER/i }).click();

  const leftPage = page.locator('[data-testid="newspaper-left-page"]');
  const pageTitle = leftPage.locator('[data-el="page_title"]');
  await expect(pageTitle).toBeVisible();

  const beforeBox = await pageTitle.boundingBox();
  expect(beforeBox).not.toBeNull();

  const zoomBtn = leftPage.getByRole('button', { name: '🔍 Zoom' });
  await zoomBtn.tap();

  await expect(leftPage.getByRole('button', { name: '↙ Fit' })).toBeVisible();

  const afterBox = await pageTitle.boundingBox();
  expect(afterBox).not.toBeNull();
  expect(afterBox!.height).toBeGreaterThanOrEqual(beforeBox!.height * 2);

  const docScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(docScrollWidth).toBe(375);

  const input = page.locator('#telegram-input');
  await input.fill('Click the blue card on the right');
  await input.press('Enter');

  await expect(page.locator('#telegram-ledger')).toContainText('LINE 01:');

  const stage = leftPage.locator('#sandbox-stage');
  const cursor = leftPage.locator('#agent-cursor');
  const stageBox = await stage.boundingBox();
  const cursorBox = await cursor.boundingBox();
  expect(stageBox).not.toBeNull();
  expect(cursorBox).not.toBeNull();

  const cursorCenterX = cursorBox!.x + cursorBox!.width / 2;
  const cursorCenterY = cursorBox!.y + cursorBox!.height / 2;
  expect(cursorCenterX).toBeGreaterThanOrEqual(stageBox!.x);
  expect(cursorCenterX).toBeLessThanOrEqual(stageBox!.x + stageBox!.width);
  expect(cursorCenterY).toBeGreaterThanOrEqual(stageBox!.y);
  expect(cursorCenterY).toBeLessThanOrEqual(stageBox!.y + stageBox!.height);

  // Also verify replay header zoom toggle works and keeps document scrollWidth at 375
  await page.getByRole('button', { name: /Right Page: Target Video/i }).tap();
  const rightPage = page.locator('[data-testid="newspaper-right-page"]');
  const replayZoomBtn = rightPage.getByRole('button', { name: '🔍 Zoom' });
  await replayZoomBtn.tap();
  await expect(rightPage.getByRole('button', { name: '↙ Fit' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
});

test('struggle share card: dispatch green, click back, Click the blue card on the right, close case -> line 2 of clipboard equals 🔙🔙🎯', async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as unknown as { __copiedText?: string }).__copiedText = '';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (window as unknown as { __copiedText?: string }).__copiedText = text;
        },
      },
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: /OPEN TODAY'S NEWSPAPER/i }).click();

  const input = page.locator('#telegram-input');
  await input.fill('green');
  await input.press('Enter');
  await expect(page.locator('#active-line-label')).toContainText('LINE 02');

  await input.fill('click back');
  await input.press('Enter');
  await expect(page.locator('#active-line-label')).toContainText('LINE 03');

  await input.fill('Click the blue card on the right');
  await input.press('Enter');
  await expect(page.locator('#active-line-label')).toContainText('LINE 04');

  await page.getByRole('button', { name: /CLOSE CASE FILE/i }).click();
  await expect(page.locator('#unsealed-exhibits-panel')).toBeVisible();

  await page.locator('#btn-copy-clipping').click();
  const copied = await page.evaluate(() => (window as unknown as { __copiedText?: string }).__copiedText ?? '');
  const lines = copied.split('\n');
  expect(lines[1]).toBe('🔙🔙🎯');
});
