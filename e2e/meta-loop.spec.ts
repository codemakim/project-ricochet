import { expect, test, type Page } from '@playwright/test';
import { ORB_CORE_DEFINITIONS, type OrbCoreId } from '../src/game/orbs/orbCoreRules';

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
      encounter: { state: string; stageId: string; runSeed: number };
      orbs: unknown[];
      boss: { kind: string; active: boolean };
      progression: {
        choices: Array<
          | { kind: 'ability'; id: string }
          | { kind: 'orb-add'; coreType: OrbCoreId }
          | { kind: 'orb-upgrade'; coreType: string }
          | { kind: 'orb-fusion'; fusionType: string }
        >;
      };
      levelUpVisible: boolean;
      discoveredCoreTypes: OrbCoreId[];
      discoveredFusionTypes: string[];
      developmentBalance?: {
        normalEnemyHpMultiplier: number;
        specialEnemyHpMultiplier: number;
        descentSpeedMultiplier: number;
        reinforcementIntervalMultiplier: number;
        playerDamageMultiplier: number;
        orbSpeedMultiplier: number;
        startingOrbCount: number;
        seed: number;
      };
    };
  });
}

test('@desktop configures and repeats an isolated development balance run', async ({ page }) => {
  await page.goto('/');
  const metaBefore = await page.evaluate(() => localStorage.getItem('project-ricochet.meta'));
  await page.getByRole('button', { name: '밸런스 테스트' }).click();
  await page.getByLabel('일반 적 HP').fill('2');
  await page.getByLabel('특수 적 HP').fill('3');
  await page.getByLabel('적 하강 속도').fill('0.5');
  await page.getByLabel('증원 간격').fill('0.5');
  await page.getByLabel('플레이어 피해').fill('2');
  await page.getByLabel('구슬 속도').fill('1.5');
  await page.getByLabel('시작 구슬 수').fill('4');
  await page.getByLabel('시드').fill('77');
  await page.getByRole('button', { name: '테스트 시작' }).click();
  await expect.poll(() => combatSceneReady(page)).toBe(true);
  await expect.poll(async () => (await combatSnapshot(page)).orbs.length).toBe(4);

  const first = await combatSnapshot(page);
  expect(first.developmentBalance).toMatchObject({
    normalEnemyHpMultiplier: 2,
    specialEnemyHpMultiplier: 3,
    descentSpeedMultiplier: 0.5,
    reinforcementIntervalMultiplier: 0.5,
    playerDamageMultiplier: 2,
    orbSpeedMultiplier: 1.5,
    startingOrbCount: 4,
    seed: 77,
  });
  expect(first.orbs).toHaveLength(4);
  expect(first.encounter.runSeed).toBe(77);

  await page.evaluate(() => {
    const game = (window as typeof window & { __RICHOCHET_GAME__?: {
      events: { emit(event: string, result: unknown): void };
    } }).__RICHOCHET_GAME__!;
    game.events.emit('ricochet:run-ended', {
      identity: { runId: 'dev-e2e-1', battlefieldId: 'default', threatId: 'normal', seed: 77 },
      loadout: ['echo'], unlockedCoreTypes: ['echo'], discoveredCoreTypes: ['echo'],
      discoveredFusionTypes: [], developmentBalance: firstBalance(), success: false,
      durationMs: 1_000, defeatedBossIds: [], buildRanks: {},
    });
    function firstBalance() {
      return {
        normalEnemyHpMultiplier: 2, specialEnemyHpMultiplier: 3,
        descentSpeedMultiplier: 0.5,
        reinforcementIntervalMultiplier: 0.5, playerDamageMultiplier: 2,
        orbSpeedMultiplier: 1.5,
        startingOrbCount: 4, seed: 77,
      };
    }
  });
  await expect(page.getByRole('heading', { name: '테스트 런 종료' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('project-ricochet.meta'))).toBe(metaBefore);

  await page.getByRole('button', { name: '같은 설정 재시작' }).click();
  await expect.poll(() => combatSceneReady(page)).toBe(true);
  await expect.poll(async () => (await combatSnapshot(page)).encounter.runSeed).toBe(77);
});

test('@mobile development balance form stays scrollable and validates ranges', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: '밸런스 테스트' }).click();
  await page.getByLabel('시작 구슬 수').fill('9');
  await expect(page.getByRole('button', { name: '테스트 시작' })).toBeDisabled();
  await page.getByLabel('시작 구슬 수').fill('6');
  await expect(page.getByRole('button', { name: '테스트 시작' })).toBeEnabled();
  await expect(page.getByRole('button', { name: '취소' })).toBeVisible();
});

async function activeSceneTexts(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const game = (window as typeof window & { __RICHOCHET_GAME__?: {
      scene: { getScene(key: string): {
        children: { list: Array<{ active?: boolean; text?: string }> };
      } };
    } }).__RICHOCHET_GAME__!;
    return game.scene.getScene('combat').children.list
      .filter((child) => child.active && child.text)
      .map((child) => child.text!);
  });
}

async function combatSceneReady(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const game = (window as typeof window & { __RICHOCHET_GAME__?: {
      scene: { getScene(key: string): { debugGrantXp?: unknown } };
    } }).__RICHOCHET_GAME__;
    return typeof game?.scene.getScene('combat').debugGrantXp === 'function';
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

test('@desktop settles, unlocks a core in the workshop, and persists the redeploy loadout', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '출격 준비' })).toBeVisible();
  await page.getByRole('button', { name: '출격', exact: true }).click();
  await expect(page.locator('#game-root canvas')).toBeVisible();
  await expect.poll(() => combatSceneReady(page)).toBe(true);
  await expect.poll(async () => (await combatSnapshot(page)).loadoutVisible).toBe(false);

  await page.evaluate(() => {
    const game = (window as typeof window & { __RICHOCHET_GAME__?: {
      scene: { getScene(key: string): { debugGrantXp(amount: number): void } };
    } }).__RICHOCHET_GAME__!;
    game.scene.getScene('combat').debugGrantXp(5);
  });
  await expect.poll(async () => (await combatSnapshot(page)).levelUpVisible).toBe(true);
  const reward = (await combatSnapshot(page)).progression.choices[0]!;
  expect(reward.kind).toBe('orb-add');
  const acquiredCoreType = (reward as { kind: 'orb-add'; coreType: OrbCoreId }).coreType;
  await expect.poll(async () => (await activeSceneTexts(page)).some((text) => (
    text.includes(`1. ${ORB_CORE_DEFINITIONS[acquiredCoreType].label} Lv1`)
  ))).toBe(true);
  await page.keyboard.press('Digit1');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await combatSnapshot(page)).levelUpVisible).toBe(false);
  await expect.poll(async () => (
    await combatSnapshot(page)
  ).discoveredCoreTypes).toEqual(['echo', acquiredCoreType]);

  await page.evaluate(({ acquiredCoreType }) => {
    const game = (window as typeof window & { __RICHOCHET_GAME__?: {
      events: { emit(event: string, result: unknown): void };
    } }).__RICHOCHET_GAME__!;
    game.events.emit('ricochet:run-ended', {
      identity: { runId: 'meta-e2e-1', battlefieldId: 'default', threatId: 'normal', seed: 1 },
      loadout: ['echo'],
      unlockedCoreTypes: ['echo'],
      discoveredCoreTypes: ['echo', acquiredCoreType],
      discoveredFusionTypes: ['photon-orbit', 'mass-collapse', 'mirror-circuit'],
      success: false,
      durationMs: 180_000,
      defeatedBossIds: [],
      buildRanks: {},
    });
  }, { acquiredCoreType });
  await expect(page.getByText('획득 부품')).toBeVisible();
  await expect(page.getByText('+40')).toBeVisible();
  await page.getByRole('button', { name: '계속' }).click();
  await page.getByRole('button', { name: '코어 작업장' }).click();
  await expect(page.getByText(
    ORB_CORE_DEFINITIONS[acquiredCoreType].label,
    { exact: true },
  )).toBeVisible();
  await page.locator(
    `[data-workshop-card][data-workshop-id="${acquiredCoreType}"]`,
  ).click();
  await expect(page.locator(
    `[data-workshop-detail] [data-buy-core="${acquiredCoreType}"]`,
  )).toBeEnabled();
  await page.getByRole('tab', { name: '융합 기록' }).click();
  await expect(page.getByText('광자 궤도')).toBeVisible();
  await expect(page.getByText('질량 붕괴탄')).toBeVisible();
  await expect(page.getByText('거울 회로')).toBeVisible();
  await expect(page.getByText('공명 군체')).toHaveCount(0);
  await expect(page.getByText('반응로 구슬')).toHaveCount(0);
  await page.getByRole('tab', { name: '기본 구슬' }).click();
  await page.locator(
    `[data-workshop-card][data-workshop-id="${acquiredCoreType}"]`,
  ).click();
  await page.locator(
    `[data-workshop-detail] [data-buy-core="${acquiredCoreType}"]`,
  ).click();
  await expect(page.getByText('코어 해금 완료')).toBeVisible();
  await page.getByRole('button', { name: '돌아가기' }).click();

  const slots = page.locator('[data-loadout-slot]');
  await expect(slots).toHaveCount(1);
  await slots.selectOption(acquiredCoreType);
  await page.getByRole('button', { name: '출격', exact: true }).click();
  await expect(page.locator('#game-root canvas')).toBeVisible();
  await expect.poll(() => combatSceneReady(page)).toBe(true);
  await expect.poll(async () => (await combatSnapshot(page)).loadoutVisible).toBe(false);

  await page.reload();
  await expect(page.locator('[data-loadout-slot]')).toHaveValue(acquiredCoreType);
  await page.getByRole('button', { name: '코어 작업장' }).click();
  await expect(page.getByText(
    ORB_CORE_DEFINITIONS[acquiredCoreType].label,
    { exact: true },
  ).locator('..'))
    .toContainText('해금됨');
});

test('@desktop workshop uses a card grid and side detail', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '코어 작업장' }).click();
  await expect(page.locator('[data-workshop-card]')).toHaveCount(6);
  await page.locator('[data-workshop-card]').first().click();
  await expect(page.locator('[data-workshop-detail]')).toBeVisible();
  await expect(page.locator('[data-workshop-sheet][open]')).toHaveCount(0);
  await page.getByRole('tab', { name: '융합 기록' }).click();
  await expect(page.locator('[data-workshop-card]')).toHaveCount(9);
});

test('@desktop workshop tabs expose a complete keyboard tab pattern', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '코어 작업장' }).click();
  const core = page.getByRole('tab', { name: '기본 구슬' });
  const fusion = page.getByRole('tab', { name: '융합 기록' });
  const corePanel = page.locator('#workshop-panel-core');
  const fusionPanel = page.locator('#workshop-panel-fusion');

  await expect(core).toHaveAttribute('aria-controls', 'workshop-panel-core');
  await expect(fusion).toHaveAttribute('aria-controls', 'workshop-panel-fusion');
  await expect(core).toHaveAttribute('tabindex', '0');
  await expect(fusion).toHaveAttribute('tabindex', '-1');
  await expect(corePanel).toHaveAttribute('role', 'tabpanel');
  await expect(corePanel).toHaveAttribute('aria-labelledby', 'workshop-tab-core');
  await expect(fusionPanel).toHaveAttribute('role', 'tabpanel');
  await expect(fusionPanel).toHaveAttribute('aria-labelledby', 'workshop-tab-fusion');
  await expect(corePanel).toBeVisible();
  await expect(fusionPanel).toBeHidden();

  await core.focus();
  await page.keyboard.press('ArrowRight');
  await expect(fusion).toBeFocused();
  await expect(fusion).toHaveAttribute('aria-selected', 'true');
  await expect(core).toHaveAttribute('aria-selected', 'false');
  await expect(fusion).toHaveAttribute('tabindex', '0');
  await expect(core).toHaveAttribute('tabindex', '-1');
  await expect(corePanel).toBeHidden();
  await expect(fusionPanel).toBeVisible();
  await expect(page.locator('[data-workshop-card]')).toHaveCount(9);

  await page.keyboard.press('ArrowLeft');
  await expect(core).toBeFocused();
  await page.keyboard.press('End');
  await expect(fusion).toBeFocused();
  await page.keyboard.press('Home');
  await expect(core).toBeFocused();
  await expect(page.locator('[data-workshop-card]')).toHaveCount(6);
});

test('@mobile workshop opens a visible bottom sheet without scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: '코어 작업장' }).click();
  const card = page.locator('[data-workshop-card]').first();
  await card.click();
  const sheet = page.locator('[data-workshop-sheet][open]');
  await expect(sheet).toBeVisible();
  expect((await sheet.boundingBox())!.y).toBeLessThan(844);
  await page.mouse.click(10, 10);
  await expect(sheet).toHaveCount(0);
  await expect(card).toBeFocused();
  await card.click();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator('[data-workshop-detail]')).toContainText('반향 구슬');
  await expect(card).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await card.click();
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(card).toBeFocused();
});

test('@desktop removes the workshop media listener across rerenders and exit', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('project-ricochet.meta', JSON.stringify({
      schemaVersion: 3,
      parts: 100,
      unlockedCores: ['echo'],
      discoveredCores: ['echo', 'inertia'],
      discoveredFusions: [],
      loadout: ['echo'],
      claimedRunIds: [],
      firstBossKills: [],
      firstValidRunClaimed: false,
    }));
    const nativeMatchMedia = window.matchMedia.bind(window);
    const changeListeners = new Set<EventListenerOrEventListenerObject>();
    window.matchMedia = (query: string) => {
      const media = nativeMatchMedia(query);
      return {
        get matches() { return media.matches; },
        media: media.media,
        onchange: null,
        addListener: media.addListener.bind(media),
        removeListener: media.removeListener.bind(media),
        dispatchEvent: media.dispatchEvent.bind(media),
        addEventListener(
          type: string,
          listener: EventListenerOrEventListenerObject,
          options?: boolean | AddEventListenerOptions,
        ) {
          if (type === 'change') changeListeners.add(listener);
          media.addEventListener(type, listener, options);
        },
        removeEventListener(
          type: string,
          listener: EventListenerOrEventListenerObject,
          options?: boolean | EventListenerOptions,
        ) {
          if (type === 'change') changeListeners.delete(listener);
          media.removeEventListener(type, listener, options);
        },
      } as MediaQueryList;
    };
    (window as typeof window & { workshopMediaListenerCount(): number })
      .workshopMediaListenerCount = () => changeListeners.size;
  });
  const listenerCount = () => page.evaluate(() => (
    window as typeof window & { workshopMediaListenerCount(): number }
  ).workshopMediaListenerCount());

  await page.goto('/');
  expect(await listenerCount()).toBe(0);
  await page.getByRole('button', { name: '코어 작업장' }).click();
  expect(await listenerCount()).toBe(1);
  await page.locator('[data-workshop-card][data-workshop-id="inertia"]').click();
  await page.locator('[data-workshop-detail] [data-buy-core="inertia"]').click();
  await expect(page.getByText('코어 해금 완료')).toBeVisible();
  expect(await listenerCount()).toBe(1);
  await page.getByRole('button', { name: '돌아가기' }).click();
  expect(await listenerCount()).toBe(0);
  await page.getByRole('button', { name: '출격', exact: true }).click();
  expect(await listenerCount()).toBe(0);
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
    schemaVersion: 3,
    parts: 40,
    unlockedCores: ['echo', 'inertia'],
    discoveredCores: ['echo', 'inertia'],
    discoveredFusions: [],
    loadout: ['inertia'],
  });
});
