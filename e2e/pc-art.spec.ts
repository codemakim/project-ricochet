import { expect, test } from '@playwright/test';
import type Phaser from 'phaser';
import type { CombatScene } from '../src/game/scenes/CombatScene';

for (const core of ['explosion', 'split', 'corrosion'] as const) {
  test(`PC art preserves trial hitboxes with ${core} @desktop`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      if (response.url().includes('/assets/combat/') && !response.ok()) {
        errors.push(`${response.status()} ${response.url()}`);
      }
    });
    await page.goto('/');
    await page.locator('[data-loadout-slot="0"]').selectOption(core);
    await page.getByRole('button', { name: '출격', exact: true }).click();
    await expect(page.locator('canvas')).toBeVisible();
    await expect.poll(() => page.evaluate(() => {
      const game = (window as unknown as { __RICHOCHET_GAME__: {
        scene: { getScene(key: string): CombatScene };
      } }).__RICHOCHET_GAME__;
      const enemies = game?.scene.getScene('combat')?.getDebugSnapshot().enemies ?? [];
      return enemies.length > 0 ? Math.min(...enemies.map(({ position }) => position.y)) : 0;
    })).toBeGreaterThan(100);
    const geometry = await page.evaluate(() => {
      const game = (window as unknown as { __RICHOCHET_GAME__: {
        scene: { getScene(key: string): CombatScene };
      } }).__RICHOCHET_GAME__;
      const scene = game.scene.getScene('combat');
      scene.debugFreezeEnemies?.();
      const images = scene.children.list.filter((child) => 'texture' in child) as Phaser.Physics.Arcade.Sprite[];
      const player = images.find(({ texture }) => texture.key === 'actor-player-default')!;
      const enemy = images.find(({ texture }) => texture.key === 'actor-enemy-basic-default')!;
      return {
        player: [player.body!.width, player.body!.height],
        enemy: [enemy.body!.width, enemy.body!.height],
        backgroundAlpha: images.find(({ texture }) => texture.key === 'combat-background')!.alpha,
        cores: scene.getDebugSnapshot().orbs.map(({ coreType }) => coreType),
      };
    });
    expect(geometry).toEqual({
      player: [40, 40], enemy: [70, 60], backgroundAlpha: 1,
      cores: [core, core, core],
    });
    const canvas = (await page.locator('canvas').boundingBox())!;
    await page.mouse.move(canvas.x + canvas.width * 0.52, canvas.y + canvas.height * 0.24);
    await expect.poll(() => page.evaluate(() => {
      const game = (window as unknown as { __RICHOCHET_GAME__: {
        scene: { getScene(key: string): CombatScene };
      } }).__RICHOCHET_GAME__;
      return game.scene.getScene('combat').getDebugSnapshot().orbs
        .filter(({ state }) => state === 'active').length;
    })).toBe(3);
    expect(errors).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`pc-trial-${core}.png`) });
  });
}
