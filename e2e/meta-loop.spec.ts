import { expect, test, type Page } from '@playwright/test';

async function combatSnapshot(page: Page) {
  return page.evaluate(() => {
    const game = (window as typeof window & { __RICHOCHET_GAME__?: {
      scene: { getScene(key: string): { getDebugSnapshot(): unknown } };
    } }).__RICHOCHET_GAME__;
    if (!game) throw new Error('game unavailable');
    return game.scene.getScene('combat').getDebugSnapshot() as {
      loadoutVisible: boolean;
      bossRewardVisible: boolean;
      runCompleteVisible: boolean;
      encounter: { state: string; stageId: string };
      boss: { kind: string; active: boolean };
    };
  });
}

async function combatSceneReady(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const game = (window as typeof window & { __RICHOCHET_GAME__?: {
      scene: { getScene(key: string): unknown };
    } }).__RICHOCHET_GAME__;
    return Boolean(game?.scene.getScene('combat'));
  });
}

async function enterBoss(page: Page, hardMaximumMs: number, kind: string) {
  await page.evaluate(({ hardMaximumMs }) => {
    const game = (window as typeof window & { __RICHOCHET_GAME__?: {
      scene: { getScene(key: string): {
        debugAdvanceEncounter(deltaMs: number): void;
      } };
    } }).__RICHOCHET_GAME__!;
    const scene = game.scene.getScene('combat');
    scene.debugAdvanceEncounter(hardMaximumMs);
    scene.debugAdvanceEncounter(2_000);
  }, { hardMaximumMs });
  await expect.poll(async () => {
    const boss = (await combatSnapshot(page)).boss;
    return boss.active ? boss.kind : null;
  }).toBe(kind);
}

async function defeatParts(page: Page, parts: string[]) {
  await page.evaluate(({ parts }) => {
    const game = (window as typeof window & { __RICHOCHET_GAME__?: {
      scene: { getScene(key: string): {
        debugDamageBossPart(partId: string, damage: number): void;
        update(time: number, delta: number): void;
      } };
    } }).__RICHOCHET_GAME__!;
    const scene = game.scene.getScene('combat');
    for (const part of parts) scene.debugDamageBossPart(part, 999);
    scene.update(0, 0);
  }, { parts });
}

test('@desktop completes all three bosses without a final combat reward', async ({ page }) => {
  await page.goto('/?combat=1');
  await expect.poll(async () => (await combatSnapshot(page)).loadoutVisible).toBe(true);
  await page.keyboard.press('Digit1');
  await page.keyboard.press('Enter');

  await enterBoss(page, 210_000, 'sentinel');
  await defeatParts(page, ['leftWeakpoint', 'rightWeakpoint', 'core']);
  await expect.poll(async () => (await combatSnapshot(page)).bossRewardVisible).toBe(true);
  await page.keyboard.press('Digit1');
  await expect.poll(async () => (await combatSnapshot(page)).encounter.stageId).toBe('default-2');

  await enterBoss(page, 210_000, 'hive');
  await defeatParts(page, ['leftShooter', 'rightShooter', 'leftReflector', 'rightReflector', 'core']);
  await expect.poll(async () => (await combatSnapshot(page)).bossRewardVisible).toBe(true);
  await page.keyboard.press('Digit1');
  await expect.poll(async () => (await combatSnapshot(page)).encounter.stageId).toBe('default-3');

  await enterBoss(page, 210_000, 'siege');
  await defeatParts(page, ['leftWeakpoint', 'rightWeakpoint', 'defenseModule', 'core']);
  await expect.poll(async () => (await combatSnapshot(page)).runCompleteVisible).toBe(true);
  const complete = await combatSnapshot(page);
  expect(complete.encounter.state).toBe('runComplete');
  expect(complete.bossRewardVisible).toBe(false);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await combatSnapshot(page)).loadoutVisible).toBe(true);
  expect((await combatSnapshot(page)).encounter.stageId).toBe('default-1');
});

test('@desktop settles, unlocks a core, and persists the redeploy loadout', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '출격 준비' })).toBeVisible();
  await page.getByRole('button', { name: '출격', exact: true }).click();
  await expect(page.locator('#game-root canvas')).toBeVisible();
  await expect.poll(() => combatSceneReady(page)).toBe(true);
  await expect.poll(async () => (await combatSnapshot(page)).loadoutVisible).toBe(false);

  await page.evaluate(() => {
    const game = (window as typeof window & { __RICHOCHET_GAME__?: {
      events: { emit(event: string, result: unknown): void };
    } }).__RICHOCHET_GAME__!;
    game.events.emit('ricochet:run-ended', {
      identity: { runId: 'meta-e2e-1', battlefieldId: 'default', threatId: 'normal', seed: 1 },
      loadout: ['echo'],
      unlockedCoreTypes: ['echo'],
      success: false,
      durationMs: 180_000,
      defeatedBossIds: [],
      buildRanks: {},
    });
  });
  await expect(page.getByText('획득 부품')).toBeVisible();
  await expect(page.getByText('+40')).toBeVisible();
  await page.getByRole('button', { name: '계속' }).click();
  await page.getByRole('button', { name: '코어 작업장' }).click();
  await page.locator('[data-buy-core="conduction"]').click();
  await expect(page.getByText('코어 해금 완료')).toBeVisible();
  await page.getByRole('button', { name: '돌아가기' }).click();

  const slots = page.locator('[data-loadout-slot]');
  await expect(slots).toHaveCount(1);
  await slots.selectOption('conduction');
  await page.getByRole('button', { name: '출격', exact: true }).click();
  await expect(page.locator('#game-root canvas')).toBeVisible();
  await expect.poll(() => combatSceneReady(page)).toBe(true);
  await expect.poll(async () => (await combatSnapshot(page)).loadoutVisible).toBe(false);

  await page.reload();
  await expect(page.locator('[data-loadout-slot]')).toHaveValue('conduction');
  await page.getByRole('button', { name: '코어 작업장' }).click();
  await expect(page.getByText('전도 구슬').locator('..')).toContainText('해금됨');
});

test('@desktop migrates a schema 1 loadout without losing parts or unlocks', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('project-ricochet.meta', JSON.stringify({
      schemaVersion: 1,
      parts: 40,
      unlockedCores: ['echo', 'inertia'],
      loadout: ['inertia', 'echo', 'echo'],
      claimedRunIds: [],
      firstBossKills: [],
      firstValidRunClaimed: true,
    }));
  });
  await page.goto('/');

  await expect(page.locator('[data-loadout-slot]')).toHaveCount(1);
  await expect(page.locator('[data-loadout-slot]')).toHaveValue('inertia');
  await expect(page.getByText('부품 40')).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(
    localStorage.getItem('project-ricochet.meta')!,
  ));
  expect(saved).toMatchObject({
    schemaVersion: 2,
    parts: 40,
    unlockedCores: ['echo', 'inertia'],
    loadout: ['inertia'],
  });
});
