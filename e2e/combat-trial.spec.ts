import { expect, test, type Page } from '@playwright/test';
import type { CombatScene } from '../src/game/scenes/CombatScene';
import { BOSS_GEOMETRY } from '../src/game/bosses/bossGeometry';

async function snapshot(page: Page) {
  return page.evaluate(() => {
    const game = (window as unknown as {
      __RICHOCHET_GAME__?: { scene: { getScene(key: string): CombatScene | undefined } };
    }).__RICHOCHET_GAME__;
    return game?.scene.getScene('combat')?.getDebugSnapshot() ?? null;
  });
}

// One real-input run covers the new integration boundary. No debug damage,
// health overrides, synthetic XP, time jumps, or repeated per-module scenarios.
test('combat trial: sample real-input growth, survival and retry @desktop', async ({ page }, testInfo) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '리코셰 전투 시험판' })).toBeVisible();
  const saved = await page.evaluate(() => localStorage.getItem('project-ricochet.meta'));
  await page.getByRole('button', { name: '출격', exact: true }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(async () => (await snapshot(page))?.orbs.length).toBe(3);
  const initial = (await snapshot(page))!;
  expect(initial.enemies.every((enemy) => enemy.kind === 'basic' && enemy.hp <= 1.5)).toBe(true);
  expect(initial.experiment.autoReturnAfterMs).toBe(4800);
  await page.screenshot({ path: testInfo.outputPath('trial-opening.png') });

  let held = '';
  const move = async (next: string) => {
    if (held === next) return;
    if (held) await page.keyboard.up(held);
    if (next) await page.keyboard.down(next);
    held = next;
  };
  let firstUpgradeMs: number | null = null;
  let choices = 0;
  let recovered = false;
  let maximumOrbs = 3;
  const phases = new Set<string>();
  const waves = new Set<string>();
  const started = Date.now();
  let latest = initial;
  while (Date.now() - started < 210000) {
    if (await page.locator('[data-action="retry-trial"]').isVisible()) break;
    const state = await snapshot(page);
    if (!state) break;
    latest = state;
    maximumOrbs = Math.max(maximumOrbs, state.orbs.length);
    recovered ||= state.orbs.some((orb) => orb.lastRecoverySource === 'proximity');
    if (state.encounter.lastFormationId) waves.add(state.encounter.lastFormationId);
    if (state.levelUpVisible) {
      await move('');
      firstUpgradeMs ??= state.gameplayElapsedMs;
      expect(state.progression.choices.every((choice) => choice.kind === 'orb-add' || choice.kind === 'orb-upgrade')).toBe(true);
      if (choices === 0) await page.screenshot({ path: testInfo.outputPath('trial-growth.png') });
      const preferred = ['corrosion', 'split', 'explosion'][choices % 3];
      const index = state.progression.choices.findIndex((choice) => 'coreType' in choice && choice.coreType === preferred);
      await page.keyboard.press(String(Math.max(0, index) + 1));
      choices += 1;
      continue;
    }
    if (state.boss.active && state.boss.phase && !phases.has(state.boss.phase)) {
      phases.add(state.boss.phase);
      await page.screenshot({ path: testInfo.outputPath(`trial-boss-${state.boss.phase}.png`) });
      if (state.boss.phase === 'twoWeakpoints') {
        await move('');
        await page.setViewportSize({ width: 320, height: 700 });
        await expect.poll(async () => {
          const bounds = await page.locator('canvas').boundingBox();
          return Boolean(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 320);
        }).toBe(true);
        const hud = await page.locator('.combat-hud').boundingBox();
        const canvas = await page.locator('canvas').boundingBox();
        expect(hud!.y + hud!.height).toBeLessThanOrEqual(canvas!.y + 1);
        await page.screenshot({ path: testInfo.outputPath('trial-boss-narrow.png') });
        await page.setViewportSize({ width: 1280, height: 720 });
      }
    }
    const targetX = 225 + Math.sin(state.gameplayElapsedMs / 1000 * 1.3) * 155;
    await move(Math.abs(state.player.x - targetX) < 24 ? '' : state.player.x < targetX ? 'd' : 'a');
    let target = [...state.enemies].sort((a, b) => b.position.y - a.position.y)[0]?.position ?? { x: 225, y: 120 };
    if (state.boss.active && state.boss.position && state.boss.parts) {
      const offset = state.boss.parts.leftWeakpoint! > 0 ? -BOSS_GEOMETRY.weakpointOffsetX
        : state.boss.parts.rightWeakpoint! > 0 ? BOSS_GEOMETRY.weakpointOffsetX : 0;
      target = { x: state.boss.position.x + offset, y: state.boss.position.y };
    }
    const bounds = await page.locator('canvas').boundingBox();
    if (!bounds) break;
    await page.mouse.move(bounds.x + target.x / 450 * bounds.width, bounds.y + target.y / 800 * bounds.height);
    // This interval samples a live, unaccelerated run; it is not a loading wait.
    await page.waitForTimeout(120);
  }
  await move('');
  await testInfo.attach('trial-observations', { body: JSON.stringify({
    firstUpgradeMs, choices, recovered, maximumOrbs, waves: [...waves], phases: [...phases],
    finalHealth: latest.health, elapsedMs: latest.gameplayElapsedMs, errors,
  }, null, 2), contentType: 'application/json' });
  await page.screenshot({ path: testInfo.outputPath('trial-result.png') });
  expect(errors).toEqual([]);
  expect(firstUpgradeMs).not.toBeNull();
  expect(firstUpgradeMs!).toBeLessThan(30000);
  expect(maximumOrbs).toBeGreaterThan(3);
  expect(recovered).toBe(true);
  const victory = await page.getByRole('heading', { name: 'SENTINEL 격파' }).isVisible();
  if (victory) expect(phases.has('core')).toBe(true);
  else await expect(page.getByRole('heading', { name: '기체 파괴' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('project-ricochet.meta'))).toBe(saved);
  await page.getByRole('button', { name: '같은 구슬로 재도전' }).click();
  await expect.poll(async () => (await snapshot(page))?.orbs.length).toBe(3);
  expect((await snapshot(page))?.encounter.lastFormationId).toBe('trial-aim');
});
