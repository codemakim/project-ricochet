import { expect, test } from '@playwright/test';

test('loads a portrait canvas and accepts a horizontal drag', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('#game-root canvas');
  await expect(canvas).toBeVisible();

  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThan(box!.width);

  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height * 0.97);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.75, box!.y + box!.height * 0.97, { steps: 5 });
  await page.mouse.up();
  await expect(canvas).toBeVisible();
});
