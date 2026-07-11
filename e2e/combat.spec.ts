import { expect, test } from '@playwright/test';

test('loads a portrait canvas and accepts a horizontal drag', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('#game-root canvas');
  await expect(canvas).toBeVisible();

  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThan(box!.width);

  const initialX = await page.evaluate(() => {
    const game = (window as unknown as { __RICHOCHET_GAME__: { scene: { getScene(key: string): unknown } } }).__RICHOCHET_GAME__;
    return (game.scene.getScene('combat') as { paddle: { x: number } }).paddle.x;
  });

  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height * 0.97);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.75, box!.y + box!.height * 0.97, { steps: 5 });
  await page.mouse.up();
  const movedX = await page.evaluate(() => {
    const game = (window as unknown as { __RICHOCHET_GAME__: { scene: { getScene(key: string): unknown } } }).__RICHOCHET_GAME__;
    return (game.scene.getScene('combat') as { paddle: { x: number } }).paddle.x;
  });
  expect(movedX).toBeGreaterThan(initialX);
  expect(movedX).toBeGreaterThanOrEqual(48);
  expect(movedX).toBeLessThanOrEqual(402);
});

test('shows one defeat presentation when two enemies breach together', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game-root canvas')).toBeVisible();

  const defeatLabels = await page.evaluate(() => {
    const game = (window as unknown as { __RICHOCHET_GAME__: { scene: { getScene(key: string): unknown } } }).__RICHOCHET_GAME__;
    const scene = game.scene.getScene('combat') as {
      children: { list: Array<{ text?: string }> };
      damagePaddle(amount: number): void;
      health: { current: number; maximum: number; shield: number; defeated: boolean };
    };
    scene.health = { current: 2, maximum: 10, shield: 0, defeated: false };
    scene.damagePaddle(2);
    scene.damagePaddle(2);
    return scene.children.list.filter((child) => child.text === 'SYSTEM DOWN').length;
  });

  expect(defeatLabels).toBe(1);
});
