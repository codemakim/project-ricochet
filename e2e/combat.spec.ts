import { expect, test, type Page } from '@playwright/test';

interface Vector {
  x: number;
  y: number;
}

interface OrbSnapshot {
  id: number;
  state: string;
  charges: number;
  damageEnabled: boolean;
  collisionEnabled: boolean;
  position: Vector;
  velocity: Vector;
  lastRecoverySource: string | null;
}

interface BossProjectileSnapshot {
  kind: 'basic' | 'aimed';
  position: Vector;
  velocity: Vector;
}

interface CombatSnapshot {
  player: Vector;
  aim: Vector;
  health: { current: number; maximum: number; shield: number; defeated: boolean };
  defeated: boolean;
  orbs: OrbSnapshot[];
  enemies: Array<{
    id: number;
    kind: string;
    hp: number;
    position: Vector;
    warning: boolean;
    speed: number;
  }>;
  activeShooters: number;
  bullets: number;
  experiment: { passThroughOnKill: boolean; homeOnBottomHit: boolean; autoReturnAfterMs: number | null };
  encounter: {
    elapsedMs: number;
    elapsedSinceSpawnMs: number;
    phase: 0 | 1 | 2 | 3;
    spawnSequence: number;
    runSeed: number;
    lastFormationId: string | null;
    state: 'running' | 'bossWarning' | 'boss' | 'bossRewardPaused';
    section: number;
    sectionElapsedMs: number;
    bossScore: number;
    warningElapsedMs: number;
    pendingBossKind: 'sentinel' | 'hive' | null;
    bossesDefeated: number;
  };
  progression: {
    level: number;
    xp: number;
    xpRequired: number | null;
    pendingChoices: number;
    choices: AbilityId[];
  };
  buildRanks: Record<AbilityId, number>;
  pauseReasons: string[];
  levelUpVisible: boolean;
  boss: {
    kind?: 'sentinel' | 'hive';
    active: boolean;
    phase:
      | 'twoWeakpoints' | 'oneWeakpoint' | 'core'
      | 'shielded' | 'telegraph' | 'exposed' | 'permanentlyExposed'
      | 'defeated' | null;
    phaseElapsedMs?: number;
    position: Vector | null;
    parts: Record<string, number> | null;
    basicBullets: number;
    aimedBullets: number;
    fallingHazards: number;
    bullets?: number;
    warnings: number;
    projectiles: BossProjectileSnapshot[];
    partPositions?: Record<string, Vector>;
  };
  bossRewardTier: 'first' | 'second' | null;
  bossRewards: string[];
  bossRewardChoices: string[];
  bossRewardVisible: boolean;
  temporaryOrbs: number;
  temporaryOrbSnapshots: Array<{
    id: number;
    generation: 0 | 1;
    splitConsumed: boolean;
    position: Vector;
    velocity: Vector;
  }>;
  scheduledEffects: Array<{ dueAt: number }>;
  activePopulation: number;
  gameplayElapsedMs: number;
}

type AbilityId = 'firepower' | 'kinetic' | 'explosion' | 'split';

interface DevelopmentScene {
  children: {
    list: Array<{
      active?: boolean;
      x?: number;
      y?: number;
      displayWidth?: number;
      displayHeight?: number;
      texture?: { key?: string };
      setPosition?(x: number, y: number): void;
      body?: { velocity?: { x: number; y: number }; setVelocity?(x: number, y: number): void };
    }>;
  };
  player: { setPosition(x: number, y: number): void };
  update(time: number, delta: number): void;
  getDebugSnapshot(): CombatSnapshot;
  debugPlaceOrb(id: number, position: Vector): boolean;
  debugFreezeEnemies(): void;
  debugSetHealth(value: number): void;
  debugDamage(amount: number): void;
  debugRemoveEnemies(ids: readonly number[]): void;
  debugGrantXp(amount: number): void;
  debugChooseAbility(id: AbilityId): void;
  debugUpgradeAbility(id: AbilityId): void;
  debugSetEnemy(id: number, position: Vector, hp: number): boolean;
  debugAdvanceEncounter(deltaMs: number): void;
  debugRecordEnemyKill(kind: 'basic' | 'armored' | 'shooter' | 'splitter' | 'fragment'): void;
  debugDamageBossPart(
    partId:
      | 'leftWeakpoint' | 'rightWeakpoint' | 'core'
      | 'leftShooter' | 'rightShooter' | 'leftReflector' | 'rightReflector',
    damage: number,
  ): void;
  debugSetBossPosition(x: number): void;
  debugAdvanceHiveCycle(deltaMs: number): void;
  debugPlaceTemporaryOrb(id: number, position: Vector): boolean;
}

async function sceneCall<T, A = undefined>(
  page: Page,
  callback: (scene: DevelopmentScene, argument: A) => T,
  argument?: A,
): Promise<T> {
  return page.evaluate(({ source, argument }) => {
    const game = (window as unknown as {
      __RICHOCHET_GAME__: { scene: { getScene(key: string): DevelopmentScene } };
    }).__RICHOCHET_GAME__;
    const scene = game.scene.getScene('combat');
    return (0, eval)(`(${source})`)(scene, argument) as T;
  }, { source: callback.toString(), argument });
}

async function snapshot(page: Page): Promise<CombatSnapshot> {
  return sceneCall(page, (scene) => scene.getDebugSnapshot());
}

async function revealAndRunFirstFrame(page: Page, delta: number): Promise<CombatSnapshot> {
  return page.evaluate((resumeDelta) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
    const game = (window as unknown as {
      __RICHOCHET_GAME__: { scene: { getScene(key: string): DevelopmentScene } };
    }).__RICHOCHET_GAME__;
    const scene = game.scene.getScene('combat');
    scene.update(0, resumeDelta);
    return scene.getDebugSnapshot();
  }, delta);
}

async function bulletState(page: Page): Promise<Array<{ x: number; y: number; vx: number; vy: number }>> {
  return page.evaluate(() => {
    const game = (window as unknown as {
      __RICHOCHET_GAME__: {
        scene: {
          getScene(key: string): {
            children: {
              list: Array<{
                active?: boolean;
                x?: number;
                y?: number;
                texture?: { key?: string };
                body?: { velocity?: { x: number; y: number } };
              }>;
            };
          };
        };
      };
    }).__RICHOCHET_GAME__;
    return game.scene.getScene('combat').children.list
      .filter((child) => child.active && child.texture?.key === 'enemy-bullet')
      .map((child) => ({
        x: child.x!,
        y: child.y!,
        vx: child.body!.velocity!.x,
        vy: child.body!.velocity!.y,
      }));
  });
}

async function loadCanvas(page: Page, search = '') {
  await page.goto(`/${search}`);
  const canvas = page.locator('#game-root canvas');
  await expect(canvas).toBeVisible();
  await expect.poll(async () => (await snapshot(page)).enemies.length).toBe(26);
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  return { canvas, box: box! };
}

async function enterMidbossByScore(page: Page): Promise<CombatSnapshot> {
  await sceneCall(page, (scene) => {
    scene.debugAdvanceEncounter(120_000);
    for (let score = 0; score < 70; score += 1) scene.debugRecordEnemyKill('basic');
    scene.debugAdvanceEncounter(0);
  });
  await expect.poll(async () => (await snapshot(page)).encounter.state).toBe('bossWarning');
  await sceneCall(page, (scene) => scene.debugAdvanceEncounter(2_000));
  await expect.poll(async () => (await snapshot(page)).boss.active).toBe(true);
  return snapshot(page);
}

async function defeatMidboss(page: Page): Promise<CombatSnapshot> {
  await sceneCall(page, (scene) => {
    scene.debugDamageBossPart('leftWeakpoint', 14);
    scene.debugDamageBossPart('rightWeakpoint', 14);
    scene.debugDamageBossPart('core', 36);
    scene.update(0, 0);
  });
  await expect.poll(async () => (await snapshot(page)).bossRewardVisible).toBe(true);
  return snapshot(page);
}

async function resumeSectionOne(page: Page): Promise<CombatSnapshot> {
  await enterMidbossByScore(page);
  const reward = await defeatMidboss(page);
  await page.keyboard.press('Digit1');
  await expect.poll(async () => (await snapshot(page)).encounter.section).toBe(1);
  const resumed = await snapshot(page);
  expect(resumed.bossRewards).toEqual([reward.bossRewardChoices[0]]);
  return resumed;
}

async function enterHiveByScore(page: Page): Promise<CombatSnapshot> {
  await resumeSectionOne(page);
  await sceneCall(page, (scene) => {
    scene.debugFreezeEnemies();
    for (let score = 0; score < 110; score += 1) scene.debugRecordEnemyKill('basic');
    scene.debugAdvanceEncounter(150_000);
  });
  await expect.poll(async () => (await snapshot(page)).encounter.state).toBe('bossWarning');
  await sceneCall(page, (scene) => scene.debugAdvanceEncounter(2_000));
  await expect.poll(async () => (await snapshot(page)).boss.kind).toBe('hive');
  return snapshot(page);
}

function clientPoint(
  box: { x: number; y: number; width: number; height: number },
  world: Vector,
): Vector {
  return {
    x: box.x + world.x / 450 * box.width,
    y: box.y + world.y / 800 * box.height,
  };
}

function orbStateCounts(current: CombatSnapshot): { active: number; queued: number } {
  return {
    active: current.orbs.filter((orb) => orb.state === 'active').length,
    queued: current.orbs.filter((orb) => orb.state === 'queued').length,
  };
}

async function dispatchTouchPointers(
  page: Page,
  events: Array<{ type: 'pointerdown' | 'pointermove' | 'pointerup'; pointerId: number; point: Vector }>,
): Promise<void> {
  await page.evaluate((inputEvents) => {
    const canvas = document.querySelector<HTMLCanvasElement>('#game-root canvas')!;
    const stateWindow = window as typeof window & { __TEST_TOUCHES__?: Record<number, Vector> };
    const active = stateWindow.__TEST_TOUCHES__ ??= {};
    const makeTouch = (identifier: number, point: Vector) => new Touch({
      identifier,
      target: canvas,
      clientX: point.x,
      clientY: point.y,
      pageX: point.x,
      pageY: point.y,
      screenX: point.x,
      screenY: point.y,
      radiusX: 1,
      radiusY: 1,
      force: 0.5,
    });

    for (const input of inputEvents) {
      canvas.dispatchEvent(new PointerEvent(input.type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        pointerId: input.pointerId,
        pointerType: 'touch',
        isPrimary: input.pointerId === 41,
        button: 0,
        buttons: input.type === 'pointerup' ? 0 : 1,
        clientX: input.point.x,
        clientY: input.point.y,
        pressure: input.type === 'pointerup' ? 0 : 0.5,
      }));

      const changed = makeTouch(input.pointerId, input.point);
      if (input.type === 'pointerup') delete active[input.pointerId];
      else active[input.pointerId] = input.point;
      const touches = Object.entries(active).map(([id, point]) => makeTouch(Number(id), point));
      const touchType = input.type === 'pointerdown'
        ? 'touchstart'
        : input.type === 'pointermove' ? 'touchmove' : 'touchend';
      canvas.dispatchEvent(new TouchEvent(touchType, {
        bubbles: true,
        cancelable: true,
        composed: true,
        touches,
        targetTouches: touches,
        changedTouches: [changed],
      }));
    }
  }, events);
}

test('@desktop moves, retains mouse aim, and launches three permanent orbs', async ({ page }) => {
  const { box } = await loadCanvas(page);
  const before = await snapshot(page);
  const aimPoint = clientPoint(box, { x: before.player.x + 100, y: before.player.y - 100 });

  await page.mouse.move(aimPoint.x, aimPoint.y);
  await expect.poll(async () => orbStateCounts(await snapshot(page)), {
    intervals: [5],
    timeout: 90,
  }).toEqual({ active: 1, queued: 2 });
  const firstLaunch = await snapshot(page);
  expect(firstLaunch.orbs.every((orb) => orb.lastRecoverySource === null)).toBe(true);
  await expect.poll(async () => orbStateCounts(await snapshot(page)), {
    intervals: [5],
    timeout: 140,
  }).toEqual({ active: 2, queued: 1 });
  const secondLaunch = await snapshot(page);
  expect(secondLaunch.orbs.every((orb) => orb.lastRecoverySource === null)).toBe(true);
  await expect.poll(async () => orbStateCounts(await snapshot(page)), {
    intervals: [5],
    timeout: 140,
  }).toEqual({ active: 3, queued: 0 });
  const thirdLaunch = await snapshot(page);
  expect(thirdLaunch.orbs.every((orb) => orb.lastRecoverySource === null)).toBe(true);

  await page.keyboard.down('KeyW');
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(250);
  await page.keyboard.up('KeyW');
  await page.keyboard.up('KeyD');
  await page.mouse.move(box.x + box.width - 2, box.y + 2);
  await page.waitForTimeout(260);

  const after = await snapshot(page);
  expect(after.player.x).toBeGreaterThan(before.player.x);
  expect(after.player.y).toBeLessThan(before.player.y);
  expect(after.aim.x).toBeGreaterThan(0);
  expect(after.aim.y).toBeLessThan(0);
  expect(after.orbs).toHaveLength(3);
  expect(after.orbs.every((orb) => orb.state !== 'stored')).toBe(true);
  expect(box.height).toBeGreaterThan(box.width);
});

test('@mobile supports simultaneous touch movement and retained aim', async ({ page }) => {
  const { box } = await loadCanvas(page);
  const before = await snapshot(page);
  const touches = {
    moveStart: { x: box.x + box.width * 0.22, y: box.y + box.height * 0.78 },
    moveEnd: { x: box.x + box.width * 0.34, y: box.y + box.height * 0.66 },
    aimStart: { x: box.x + box.width * 0.78, y: box.y + box.height * 0.78 },
    aimEnd: { x: box.x + box.width * 0.66, y: box.y + box.height * 0.66 },
  };

  await dispatchTouchPointers(page, [
    { type: 'pointerdown', pointerId: 41, point: touches.moveStart },
    { type: 'pointerdown', pointerId: 77, point: touches.aimStart },
    { type: 'pointermove', pointerId: 41, point: touches.moveEnd },
    { type: 'pointermove', pointerId: 77, point: touches.aimEnd },
  ]);
  await page.waitForTimeout(250);
  await dispatchTouchPointers(page, [
    { type: 'pointerup', pointerId: 41, point: touches.moveEnd },
    { type: 'pointerup', pointerId: 77, point: touches.aimEnd },
  ]);
  await page.waitForTimeout(260);

  const after = await snapshot(page);
  expect(after.player.x).toBeGreaterThan(before.player.x);
  expect(after.player.y).toBeLessThan(before.player.y);
  expect(after.aim.x).toBeLessThan(0);
  expect(after.aim.y).toBeLessThan(0);
  expect(after.orbs).toHaveLength(3);
  expect(after.orbs.every((orb) => orb.state === 'active')).toBe(true);
});

test('@mobile taps a visible level-up card and resumes combat', async ({ page }) => {
  await page.clock.install();
  const { box } = await loadCanvas(page);
  await sceneCall(page, (scene) => scene.debugGrantXp(12));
  await expect.poll(async () => (await snapshot(page)).levelUpVisible).toBe(true);
  const paused = await snapshot(page);
  const selectedAbility = paused.progression.choices[0]!;
  expect(paused.pauseReasons).toContain('levelUp');

  const card = clientPoint(box, { x: 225, y: 270 });
  await page.touchscreen.tap(card.x, card.y);

  await expect.poll(async () => {
    const current = await snapshot(page);
    return {
      rank: current.buildRanks[selectedAbility],
      visible: current.levelUpVisible,
      paused: current.pauseReasons.includes('levelUp'),
    };
  }).toEqual({ rank: 1, visible: false, paused: false });

  await expect.poll(async () => {
    await page.clock.runFor(16);
    const current = await snapshot(page);
    return current.gameplayElapsedMs > paused.gameplayElapsedMs
      && current.enemies[0]!.position.y > paused.enemies[0]!.position.y;
  }, { intervals: [0], timeout: 1_000 }).toBe(true);
  const resumed = await snapshot(page);
  expect(resumed.gameplayElapsedMs - paused.gameplayElapsedMs).toBeLessThanOrEqual(50);
});

test('@desktop recovers active orbs through proximity and bottom worldbounds', async ({ page }) => {
  const { box } = await loadCanvas(page);
  const initial = await snapshot(page);
  const upward = clientPoint(box, { x: initial.player.x, y: initial.player.y - 100 });
  await page.mouse.move(upward.x, upward.y);
  await page.waitForTimeout(240);

  const launched = await snapshot(page);
  await sceneCall(page, (scene) => {
    const current = scene.getDebugSnapshot();
    const active = current.orbs.find((orb) => orb.state === 'active')!;
    scene.debugPlaceOrb(active.id, { x: current.player.x + 5, y: current.player.y });
  });
  await page.waitForTimeout(250);
  const proximitySnapshot = await snapshot(page);
  const proximity = proximitySnapshot.orbs.find((orb) => orb.lastRecoverySource === 'proximity')!;
  expect(proximity.lastRecoverySource).toBe('proximity');
  expect(proximity.charges).toBe(3);
  expect(['active', 'queued']).toContain(proximity.state);

  const floorId = await sceneCall(page, (scene) => {
    const active = scene.getDebugSnapshot().orbs.find(
      (orb) => orb.state === 'active' && orb.lastRecoverySource !== 'proximity',
    )!;
    if (!scene.debugPlaceOrb(active.id, { x: 225, y: 799 })) throw new Error('active floor orb required');
    return active.id;
  });
  await page.waitForTimeout(40);
  const returning = (await snapshot(page)).orbs[floorId]!;
  expect(returning.lastRecoverySource).toBe('floorRecall');
  expect(returning.collisionEnabled).toBe(false);
  expect(returning.damageEnabled).toBe(false);
  await expect.poll(async () => {
    const orb = (await snapshot(page)).orbs[floorId]!;
    return { state: orb.state, charges: orb.charges, source: orb.lastRecoverySource };
  }).toMatchObject({ state: 'active', charges: 3, source: 'floorRecall' });
  expect(launched.orbs).toHaveLength(3);
});

for (const passThroughOnKill of [false, true]) {
  test(`@desktop kills through Arcade collision with passThroughOnKill=${passThroughOnKill}`, async ({ page }) => {
    const { box } = await loadCanvas(page, `?passThroughOnKill=${passThroughOnKill}`);
    await sceneCall(page, (scene) => {
      scene.debugFreezeEnemies();
      const enemies = scene.getDebugSnapshot().enemies;
      const target = enemies.find((enemy) => enemy.kind === 'basic')!;
      enemies.filter((enemy) => enemy.id !== target.id).forEach((enemy, index) => {
        scene.debugSetEnemy(enemy.id, { x: 36, y: 80 + index % 5 * 24 }, enemy.hp);
      });
      scene.debugSetEnemy(target.id, { x: 225, y: 300 }, 1);
    });
    const before = await snapshot(page);
    const bottomY = Math.max(...before.enemies.filter((enemy) => enemy.kind === 'basic').map((enemy) => enemy.position.y));
    const target = before.enemies
      .filter((enemy) => enemy.kind === 'basic' && enemy.position.y === bottomY)
      .sort((left, right) => Math.abs(left.position.x - 225) - Math.abs(right.position.x - 225))[0]!;
    const aim = clientPoint(box, { x: before.player.x + 100, y: before.player.y - 100 });
    await page.mouse.move(aim.x, aim.y);
    await expect.poll(async () => orbStateCounts(await snapshot(page)), {
      intervals: [5],
      timeout: 90,
    }).toEqual({ active: 1, queued: 2 });
    const chargeBefore = (await snapshot(page)).orbs[0]!.charges;
    await sceneCall(page, (scene) => {
      const basics = scene.getDebugSnapshot().enemies.filter((candidate) => candidate.kind === 'basic');
      const bottomY = Math.max(...basics.map((candidate) => candidate.position.y));
      const enemy = basics
        .filter((candidate) => candidate.position.y === bottomY)
        .sort((left, right) => Math.abs(left.position.x - 225) - Math.abs(right.position.x - 225))[0]!;
      scene.debugPlaceOrb(0, { x: enemy.position.x, y: enemy.position.y + 24 });
    });

    await expect.poll(async () => (await snapshot(page)).enemies.some((enemy) => enemy.id === target.id), {
      intervals: [5],
      timeout: 90,
    }).toBe(false);
    const after = await snapshot(page);
    const orb = after.orbs[0]!;
    expect(after.enemies.length).toBe(before.enemies.length - 1);
    expect(after.enemies.some((enemy) => enemy.id === target.id)).toBe(false);
    expect(orb.charges).toBe(chargeBefore - 1);
    expect(orb.velocity.y < 0).toBe(passThroughOnKill);
    expect(after.progression.xp).toBe(before.progression.xp + 1);

    await page.waitForTimeout(120);
    const stable = await snapshot(page);
    expect(stable.enemies.length).toBe(before.enemies.length - 1);
    expect(stable.orbs[0]!.charges).toBe(chargeBefore - 1);
  });
}

test('@desktop applies explosion damage once around the direct-hit enemy', async ({ page }) => {
  const { box } = await loadCanvas(page);
  const enemyIds = await sceneCall(page, (scene) => {
    scene.debugFreezeEnemies();
    scene.debugUpgradeAbility('explosion');
    const [targetId, nearId, killedId, outsideId] = scene.getDebugSnapshot().enemies
      .filter((enemy) => enemy.kind === 'basic')
      .slice(0, 4)
      .map((enemy) => enemy.id);
    const keep = new Set([targetId, nearId, killedId, outsideId]);
    scene.debugRemoveEnemies(
      scene.getDebugSnapshot().enemies
        .filter((enemy) => !keep.has(enemy.id))
        .map((enemy) => enemy.id),
    );
    scene.debugSetEnemy(targetId!, { x: 225, y: 300 }, 2);
    scene.debugSetEnemy(nearId!, { x: 273, y: 300 }, 1);
    scene.debugSetEnemy(killedId!, { x: 225, y: 252 }, 0.5);
    scene.debugSetEnemy(outsideId!, { x: 225, y: 204 }, 1);
    return { targetId: targetId!, nearId: nearId!, killedId: killedId!, outsideId: outsideId! };
  });
  const before = await snapshot(page);
  const aim = clientPoint(box, { x: before.player.x, y: before.player.y - 100 });
  await page.mouse.move(aim.x, aim.y);
  await expect.poll(async () => orbStateCounts(await snapshot(page)), {
    intervals: [5],
    timeout: 90,
  }).toEqual({ active: 1, queued: 2 });

  await sceneCall(page, (scene) => {
    const active = scene.getDebugSnapshot().orbs.find((orb) => orb.state === 'active')!;
    if (!scene.debugPlaceOrb(active.id, { x: 225, y: 324 })) {
      throw new Error('active orb required');
    }
  });

  await expect.poll(async () => (await snapshot(page)).enemies.find((enemy) => enemy.id === enemyIds.nearId)?.hp, {
    intervals: [5],
    timeout: 90,
  }).toBe(0.5);
  const after = await snapshot(page);
  expect(after.enemies.find((enemy) => enemy.id === enemyIds.targetId)?.hp).toBe(0.5);
  expect(after.enemies.some((enemy) => enemy.id === enemyIds.killedId)).toBe(false);
  expect(after.enemies.find((enemy) => enemy.id === enemyIds.outsideId)?.hp).toBe(1);
  expect(after.progression.xp).toBe(before.progression.xp + 1);
});

test('@desktop temporary split orbs stay capped, do not recursively split, pause lifetime, and clear on defeat', async ({ page }) => {
  const { box } = await loadCanvas(page);
  await sceneCall(page, (scene) => {
    scene.debugFreezeEnemies();
    for (let rank = 0; rank < 5; rank += 1) scene.debugUpgradeAbility('split');
    scene.debugUpgradeAbility('explosion');
    const keep = new Set([0, 1, 2]);
    scene.debugRemoveEnemies(
      scene.getDebugSnapshot().enemies.filter((enemy) => !keep.has(enemy.id)).map((enemy) => enemy.id),
    );
    scene.debugSetEnemy(0, { x: 100, y: 300 }, 99);
    scene.debugSetEnemy(1, { x: 100, y: 200 }, 99);
    scene.debugSetEnemy(2, { x: 140, y: 200 }, 2);
  });
  const before = await snapshot(page);
  const aim = clientPoint(box, { x: before.player.x, y: before.player.y - 100 });
  await page.mouse.move(aim.x, aim.y);
  await expect.poll(async () => orbStateCounts(await snapshot(page)), {
    intervals: [5],
    timeout: 90,
  }).toEqual({ active: 1, queued: 2 });
  await expect.poll(async () => orbStateCounts(await snapshot(page)), {
    intervals: [5],
    timeout: 240,
  }).toEqual({ active: 3, queued: 0 });

  const beforeSpawn = await snapshot(page);
  await sceneCall(page, (scene) => {
    const active = scene.getDebugSnapshot().orbs.find((orb) => orb.state === 'active')!;
    if (!scene.debugPlaceOrb(active.id, { x: 100, y: 324 })) throw new Error('active orb required');
  });
  await expect.poll(async () => (await snapshot(page)).temporaryOrbs, {
    intervals: [5],
    timeout: 100,
  }).toBe(3);
  const spawned = await snapshot(page);
  await expect.poll(async () => (await snapshot(page)).enemies.find((enemy) => enemy.id === 2)?.hp, {
    intervals: [10],
    timeout: 400,
  }).toBe(1.5);
  expect((await snapshot(page)).temporaryOrbs).toBe(3);

  await sceneCall(page, (scene) => scene.debugGrantXp(12));
  const paused = await snapshot(page);
  const minimumRemainingMs = 1500 - (paused.gameplayElapsedMs - beforeSpawn.gameplayElapsedMs);
  const maximumRemainingMs = 1500 - (paused.gameplayElapsedMs - spawned.gameplayElapsedMs);
  expect(paused.pauseReasons).toContain('levelUp');
  await page.waitForTimeout(1600);
  const afterLongPause = await snapshot(page);
  expect(afterLongPause.temporaryOrbs).toBe(3);
  expect(afterLongPause.gameplayElapsedMs).toBe(paused.gameplayElapsedMs);

  await sceneCall(page, (scene) => {
    const choice = scene.getDebugSnapshot().progression.choices[0]!;
    scene.debugChooseAbility(choice);
  });
  await page.waitForTimeout(50);
  expect((await snapshot(page)).temporaryOrbs).toBe(3);
  await expect.poll(async () => {
    const current = await snapshot(page);
    return current.gameplayElapsedMs - paused.gameplayElapsedMs >= minimumRemainingMs - 50
      ? current.temporaryOrbs
      : -1;
  }, { intervals: [5], timeout: maximumRemainingMs + 200 }).toBe(3);
  await expect.poll(async () => (await snapshot(page)).temporaryOrbs, {
    intervals: [5],
    timeout: 100,
  }).toBe(0);
  const expired = await snapshot(page);
  const resumedLifetimeMs = expired.gameplayElapsedMs - paused.gameplayElapsedMs;
  expect(resumedLifetimeMs).toBeGreaterThanOrEqual(minimumRemainingMs - 20);
  expect(resumedLifetimeMs).toBeLessThan(maximumRemainingMs + 50);

  await sceneCall(page, (scene) => {
    scene.debugSetEnemy(1, { x: 30, y: 80 }, 99);
    scene.debugSetEnemy(2, { x: 420, y: 80 }, 2);
  });
  for (const expectedCount of [3, 6, 9, 12]) {
    await page.waitForTimeout(85);
    await sceneCall(page, (scene) => {
      const active = scene.getDebugSnapshot().orbs.find(
        (orb) => orb.state === 'active' && orb.charges > 0,
      )!;
      const speed = Math.hypot(active.velocity.x, active.velocity.y);
      const position = {
        x: 100 - active.velocity.x / speed * 24,
        y: 300 - active.velocity.y / speed * 24,
      };
      if (!scene.debugPlaceOrb(active.id, position)) throw new Error('charged orb required');
    });
    await expect.poll(async () => (await snapshot(page)).temporaryOrbs, {
      intervals: [5],
      timeout: 100,
    }).toBe(expectedCount);
  }
  await page.waitForTimeout(85);
  await sceneCall(page, (scene) => {
    const active = scene.getDebugSnapshot().orbs.find(
      (orb) => orb.state === 'active' && orb.charges > 0,
    )!;
    const speed = Math.hypot(active.velocity.x, active.velocity.y);
    const position = {
      x: 100 - active.velocity.x / speed * 24,
      y: 300 - active.velocity.y / speed * 24,
    };
    if (!scene.debugPlaceOrb(active.id, position)) throw new Error('charged orb required');
  });
  await page.waitForTimeout(50);
  expect((await snapshot(page)).temporaryOrbs).toBe(12);

  await sceneCall(page, (scene) => {
    scene.debugSetHealth(1);
    scene.debugDamage(1);
  });
  const defeated = await snapshot(page);
  expect(defeated.defeated).toBe(true);
  expect(defeated.temporaryOrbs).toBe(0);
});

test('@desktop caps simultaneous shooters and bullets under accelerated clock', async ({ page }) => {
  await page.clock.install();
  await loadCanvas(page);
  const initial = await snapshot(page);
  let peakShooters = 0;
  let peakBullets = 0;
  for (let elapsed = 250; elapsed <= 5_000; elapsed += 250) {
    await page.clock.runFor(250);
    const sample = await snapshot(page);
    peakShooters = Math.max(peakShooters, sample.activeShooters);
    peakBullets = Math.max(peakBullets, sample.bullets);
  }
  const final = await snapshot(page);
  expect(final.enemies[0]!.position.y).toBeGreaterThan(initial.enemies[0]!.position.y);
  expect(Math.max(peakShooters, peakBullets)).toBeGreaterThan(0);
  expect(peakShooters).toBeLessThanOrEqual(2);
  expect(peakBullets).toBeLessThanOrEqual(12);
});

test('@desktop admits reinforcement while original enemies remain', async ({ page }) => {
  await page.clock.install();
  await loadCanvas(page);
  await sceneCall(page, (scene) => scene.debugRemoveEnemies([0, 3, 7, 11]));
  const before = await snapshot(page);
  expect(before.enemies).toHaveLength(22);

  await page.clock.runFor(8_100);

  const after = await snapshot(page);
  expect(after.enemies.some((enemy) => enemy.id < 26)).toBe(true);
  expect(after.enemies.some((enemy) => enemy.id >= 26)).toBe(true);
  expect(after.encounter.spawnSequence).toBe(1);
  expect(after.encounter.phase).toBe(0);
});

test('@desktop varies procedural enemy formations across spawns and restarts', async ({ page }) => {
  await page.clock.install();
  const { box } = await loadCanvas(page);
  const sortedPositions = (current: CombatSnapshot) => current.enemies
    .map((enemy) => enemy.position)
    .sort((left, right) => left.y - right.y || left.x - right.x);
  const formationStyle = (id: string) => id.split(':')[2];

  const initial = await snapshot(page);
  expect(initial.enemies).toHaveLength(26);
  const initialSeed = initial.encounter.runSeed;
  const initialPositions = sortedPositions(initial);

  await sceneCall(page, (scene) => {
    scene.debugRemoveEnemies(scene.getDebugSnapshot().enemies.map((enemy) => enemy.id));
  });
  await page.clock.runFor(8_100);

  const first = await snapshot(page);
  expect(first.enemies.length).toBeGreaterThanOrEqual(13);
  expect(first.enemies.length).toBeLessThanOrEqual(15);
  expect(first.encounter.lastFormationId).not.toBeNull();
  const firstId = first.encounter.lastFormationId!;
  const firstPositions = sortedPositions(first);
  expect(new Set(firstPositions.map(({ x, y }) => `${x}:${y}`)).size).toBe(first.enemies.length);

  await sceneCall(page, (scene) => {
    scene.debugRemoveEnemies(scene.getDebugSnapshot().enemies.map((enemy) => enemy.id));
  });
  await page.clock.runFor(8_100);

  const second = await snapshot(page);
  expect(second.enemies.length).toBeGreaterThanOrEqual(13);
  expect(second.enemies.length).toBeLessThanOrEqual(15);
  expect(second.encounter.lastFormationId).not.toBeNull();
  const secondId = second.encounter.lastFormationId!;
  const secondPositions = sortedPositions(second);
  expect(secondId).not.toBe(firstId);
  expect(formationStyle(secondId)).not.toBe(formationStyle(firstId));
  expect(secondPositions).not.toEqual(firstPositions);
  expect(new Set(secondPositions.map(({ x, y }) => `${x}:${y}`)).size).toBe(second.enemies.length);

  await sceneCall(page, (scene) => {
    scene.debugSetHealth(1);
    scene.debugDamage(1);
  });
  const restart = clientPoint(box, { x: 225, y: 436 });
  await expect.poll(async () => {
    await page.mouse.click(restart.x, restart.y);
    return (await snapshot(page)).defeated;
  }, { intervals: [16], timeout: 1_000 }).toBe(false);

  const restarted = await snapshot(page);
  expect(restarted.enemies).toHaveLength(26);
  expect(restarted.encounter.runSeed).not.toBe(initialSeed);
  expect(sortedPositions(restarted)).not.toEqual(initialPositions);
});

test('@desktop pauses while hidden and resumes when visible', async ({ page }) => {
  await page.clock.install();
  await loadCanvas(page);
  await sceneCall(page, (scene) => scene.debugRemoveEnemies([0, 3, 7, 11]));
  await page.clock.runFor(1_000);
  await page.keyboard.down('KeyD');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const before = await snapshot(page);
  await page.clock.runFor(8_100);
  const hidden = await snapshot(page);
  expect(hidden.encounter.elapsedMs).toBe(before.encounter.elapsedMs);
  expect(hidden.encounter.elapsedSinceSpawnMs).toBe(before.encounter.elapsedSinceSpawnMs);
  expect(hidden.encounter.spawnSequence).toBe(before.encounter.spawnSequence);
  expect(hidden.enemies).toHaveLength(before.enemies.length);
  expect(hidden.player).toEqual(before.player);
  expect(hidden.enemies[0]!.position.y - before.enemies[0]!.position.y).toBeLessThan(1);

  const firstResumedFrame = await revealAndRunFirstFrame(page, 8_100);
  expect(firstResumedFrame.encounter.elapsedMs - hidden.encounter.elapsedMs).toBeLessThanOrEqual(50);
  expect(firstResumedFrame.encounter.elapsedSinceSpawnMs - hidden.encounter.elapsedSinceSpawnMs)
    .toBeLessThanOrEqual(50);
  expect(firstResumedFrame.encounter.spawnSequence).toBe(hidden.encounter.spawnSequence);
  expect(firstResumedFrame.enemies).toHaveLength(hidden.enemies.length);
  expect(firstResumedFrame.player).toEqual(hidden.player);

  await expect.poll(async () => {
    await page.clock.runFor(16);
    const current = await snapshot(page);
    return current.enemies[0]!.position.y > hidden.enemies[0]!.position.y
      && current.player.x > firstResumedFrame.player.x;
  }, { intervals: [0], timeout: 1_000 }).toBe(true);
  const resumed = await snapshot(page);
  expect(resumed.encounter.elapsedMs - firstResumedFrame.encounter.elapsedMs).toBeLessThanOrEqual(50);
  expect(resumed.encounter.elapsedSinceSpawnMs - firstResumedFrame.encounter.elapsedSinceSpawnMs)
    .toBeLessThanOrEqual(50);
  expect(resumed.enemies[0]!.position.y).toBeGreaterThan(hidden.enemies[0]!.position.y);
  expect(resumed.player.x).toBeGreaterThan(firstResumedFrame.player.x);
  await page.keyboard.up('KeyD');
});

test('@desktop pauses for level-up until an ability is chosen', async ({ page }) => {
  await page.clock.install();
  const { box } = await loadCanvas(page);
  await sceneCall(page, (scene) => scene.debugRemoveEnemies([0, 4, 8, 12]));
  const movingStart = await snapshot(page);
  await page.clock.runFor(1_700);
  const current = await snapshot(page);
  expect(current.enemies[0]!.position.y).toBeGreaterThan(movingStart.enemies[0]!.position.y);
  expect(current.encounter.elapsedMs).toBeGreaterThan(movingStart.encounter.elapsedMs);
  const aim = clientPoint(box, { x: current.player.x + 100, y: current.player.y - 100 });
  await page.mouse.move(aim.x, aim.y);
  await page.clock.runFor(120);
  await page.keyboard.down('KeyD');
  await sceneCall(page, (scene) => scene.debugGrantXp(12));
  await expect.poll(async () => (await snapshot(page)).levelUpVisible).toBe(true);
  const paused = await snapshot(page);
  const pausedBullets = await bulletState(page);
  expect(paused.pauseReasons).toContain('levelUp');
  expect(paused.orbs.some((orb) => orb.state === 'active' && Math.hypot(orb.velocity.x, orb.velocity.y) > 0)).toBe(true);
  expect(pausedBullets.length).toBeGreaterThan(0);
  expect(pausedBullets.some((bullet) => Math.hypot(bullet.vx, bullet.vy) > 0)).toBe(true);

  await page.clock.runFor(2_000);

  const frozen = await snapshot(page);
  expect(frozen.player).toEqual(paused.player);
  expect(frozen.aim).toEqual(paused.aim);
  expect(frozen.enemies).toEqual(paused.enemies);
  expect(frozen.orbs).toEqual(paused.orbs);
  expect(frozen.bullets).toBe(paused.bullets);
  expect(await bulletState(page)).toEqual(pausedBullets);
  expect(frozen.encounter).toEqual(paused.encounter);

  await page.keyboard.press('Digit1');

  await expect.poll(async () => (await snapshot(page)).levelUpVisible).toBe(false);
  const selected = await snapshot(page);
  expect(selected.pauseReasons).not.toContain('levelUp');
  expect(Object.values(selected.buildRanks).reduce((total, rank) => total + rank, 0)).toBe(1);
  await page.keyboard.up('KeyD');
});

test('@desktop clicks a level-up card without changing aim and resumes gameplay', async ({ page }) => {
  await page.clock.install();
  const { box } = await loadCanvas(page);
  const aimPoint = clientPoint(box, { x: 340, y: 120 });
  await page.mouse.move(aimPoint.x, aimPoint.y);
  await page.clock.runFor(32);
  const aimed = await snapshot(page);
  await sceneCall(page, (scene) => scene.debugGrantXp(12));
  await expect.poll(async () => (await snapshot(page)).levelUpVisible).toBe(true);
  const paused = await snapshot(page);
  const selectedAbility = paused.progression.choices[0]!;

  const card = clientPoint(box, { x: 225, y: 270 });
  await page.mouse.click(card.x, card.y);

  await expect.poll(async () => {
    const current = await snapshot(page);
    return {
      rank: current.buildRanks[selectedAbility],
      visible: current.levelUpVisible,
      paused: current.pauseReasons.includes('levelUp'),
    };
  }).toEqual({ rank: 1, visible: false, paused: false });
  const selected = await snapshot(page);
  expect(selected.aim).toEqual(aimed.aim);
  await expect.poll(async () => {
    await page.clock.runFor(16);
    return (await snapshot(page)).gameplayElapsedMs > selected.gameplayElapsedMs;
  }, { intervals: [0], timeout: 1_000 }).toBe(true);
  expect((await snapshot(page)).aim).toEqual(aimed.aim);
});

test('@desktop keeps visibility pause after choosing a level-up while hidden', async ({ page }) => {
  await page.clock.install();
  await loadCanvas(page);
  await sceneCall(page, (scene) => scene.debugRemoveEnemies([0, 3, 7, 11]));
  await page.clock.runFor(1_000);
  await page.keyboard.down('KeyD');
  await sceneCall(page, (scene) => scene.debugGrantXp(12));
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const hidden = await snapshot(page);
  expect(hidden.pauseReasons).toEqual(['visibility', 'levelUp']);

  await sceneCall(page, (scene) => {
    const choice = scene.getDebugSnapshot().progression.choices[0]!;
    scene.debugChooseAbility(choice);
  });

  const selected = await snapshot(page);
  expect(selected.levelUpVisible).toBe(false);
  expect(selected.pauseReasons).toEqual(['visibility']);
  await page.clock.runFor(1_000);
  const stillHidden = await snapshot(page);
  expect(stillHidden.player).toEqual(selected.player);
  expect(stillHidden.enemies).toEqual(selected.enemies);
  expect(stillHidden.orbs).toEqual(selected.orbs);
  expect(stillHidden.encounter).toEqual(selected.encounter);

  const firstResumedFrame = await revealAndRunFirstFrame(page, 8_100);
  expect(firstResumedFrame.player).toEqual(stillHidden.player);
  expect(firstResumedFrame.encounter).toEqual(stillHidden.encounter);

  await expect.poll(async () => {
    await page.clock.runFor(16);
    const current = await snapshot(page);
    return current.player.x > firstResumedFrame.player.x
      && current.enemies[0]!.position.y > firstResumedFrame.enemies[0]!.position.y
      && current.encounter.elapsedMs > firstResumedFrame.encounter.elapsedMs;
  }, { intervals: [0], timeout: 1_000 }).toBe(true);
  const resumed = await snapshot(page);
  expect(resumed.player.x).toBeGreaterThan(firstResumedFrame.player.x);
  expect(resumed.enemies[0]!.position.y).toBeGreaterThan(firstResumedFrame.enemies[0]!.position.y);
  expect(resumed.encounter.elapsedMs).toBeGreaterThan(firstResumedFrame.encounter.elapsedMs);
  expect(resumed.encounter.elapsedMs - firstResumedFrame.encounter.elapsedMs).toBeLessThanOrEqual(50);
  await page.keyboard.up('KeyD');
});

test('@desktop keeps level-up paused across queued choices', async ({ page }) => {
  await loadCanvas(page);
  await sceneCall(page, (scene) => scene.debugGrantXp(30));
  await expect.poll(async () => (await snapshot(page)).progression.pendingChoices).toBe(2);

  await sceneCall(page, (scene) => {
    const choice = scene.getDebugSnapshot().progression.choices[0]!;
    scene.debugChooseAbility(choice);
  });

  const between = await snapshot(page);
  expect(between.progression.pendingChoices).toBe(1);
  expect(between.levelUpVisible).toBe(true);
  expect(between.pauseReasons).toContain('levelUp');

  await sceneCall(page, (scene) => {
    const choice = scene.getDebugSnapshot().progression.choices[0]!;
    scene.debugChooseAbility(choice);
  });

  await expect.poll(async () => (await snapshot(page)).levelUpVisible).toBe(false);
  const selected = await snapshot(page);
  expect(selected.progression).toMatchObject({ level: 2, xp: 1, pendingChoices: 0 });
  expect(Object.values(selected.buildRanks).reduce((total, rank) => total + rank, 0)).toBe(2);
  expect(selected.pauseReasons).not.toContain('levelUp');
});

test('@desktop stops XP and keeps level-up closed when all abilities are rank five', async ({ page }) => {
  await loadCanvas(page);
  await sceneCall(page, (scene) => {
    for (const ability of ['firepower', 'kinetic', 'explosion', 'split'] as const) {
      for (let rank = 0; rank < 5; rank += 1) scene.debugUpgradeAbility(ability);
    }
    scene.debugGrantXp(100);
  });

  const completed = await snapshot(page);
  expect(completed.buildRanks).toEqual({ firepower: 5, kinetic: 5, explosion: 5, split: 5 });
  expect(completed.progression).toMatchObject({ xp: 0, pendingChoices: 0, choices: [] });
  expect(completed.levelUpVisible).toBe(false);
  expect(completed.pauseReasons).not.toContain('levelUp');
});

test('@desktop enforces 600ms invulnerability, presents defeat once, and restarts', async ({ page }) => {
  const { box } = await loadCanvas(page);
  await sceneCall(page, (scene) => {
    scene.debugSetHealth(2);
    scene.debugDamage(1);
  });
  expect((await snapshot(page)).health.current).toBe(1);

  await sceneCall(page, (scene) => scene.debugDamage(1));
  expect((await snapshot(page)).health.current).toBe(1);
  await page.waitForTimeout(250);
  await sceneCall(page, (scene) => scene.debugDamage(1));
  expect((await snapshot(page)).health.current).toBe(1);
  await page.waitForTimeout(370);
  await sceneCall(page, (scene) => {
    scene.debugFreezeEnemies();
    scene.debugUpgradeAbility('split');
    const enemies = scene.getDebugSnapshot().enemies;
    scene.debugRemoveEnemies(enemies.slice(1).map((enemy) => enemy.id));
    scene.debugSetEnemy(enemies[0]!.id, { x: 225, y: 300 }, 99);
  });
  const beforeLaunch = await snapshot(page);
  const aim = clientPoint(box, { x: beforeLaunch.player.x, y: beforeLaunch.player.y - 100 });
  await page.mouse.move(aim.x, aim.y);
  await expect.poll(async () => orbStateCounts(await snapshot(page)), {
    intervals: [5],
    timeout: 90,
  }).toEqual({ active: 1, queued: 2 });
  await sceneCall(page, (scene) => {
    const active = scene.getDebugSnapshot().orbs.find((orb) => orb.state === 'active')!;
    if (!scene.debugPlaceOrb(active.id, { x: 225, y: 324 })) throw new Error('active orb required');
  });
  await expect.poll(async () => (await snapshot(page)).temporaryOrbs).toBe(1);
  await sceneCall(page, (scene) => scene.debugGrantXp(13));
  const dirty = await snapshot(page);
  expect(dirty.progression).toMatchObject({ level: 1, xp: 1, pendingChoices: 1 });
  expect(dirty.buildRanks.split).toBe(1);
  expect(dirty.temporaryOrbs).toBe(1);
  expect(dirty.levelUpVisible).toBe(true);
  await sceneCall(page, (scene) => scene.debugDamage(1));

  const defeated = await snapshot(page);
  expect(defeated.health.current).toBe(0);
  expect(defeated.defeated).toBe(true);
  expect(defeated.levelUpVisible).toBe(false);
  expect(defeated.pauseReasons).toEqual(['defeated']);
  await sceneCall(page, (scene) => scene.debugDamage(1));
  const panelCount = await page.evaluate(() => {
    const game = (window as unknown as {
      __RICHOCHET_GAME__: { scene: { getScene(key: string): { children: { list: Array<{ text?: string }> } } } };
    }).__RICHOCHET_GAME__;
    return game.scene.getScene('combat').children.list.filter((child) => child.text === 'SYSTEM DOWN').length;
  });
  expect(panelCount).toBe(1);

  const restart = clientPoint(box, { x: 225, y: 436 });
  await expect.poll(async () => {
    await page.mouse.click(restart.x, restart.y);
    return (await snapshot(page)).defeated;
  }, { intervals: [16], timeout: 1_000 }).toBe(false);
  expect(await snapshot(page)).toMatchObject({
    health: { current: 10 },
    progression: { level: 0, xp: 0, pendingChoices: 0 },
    buildRanks: { firepower: 0, kinetic: 0, explosion: 0, split: 0 },
    pauseReasons: [],
    levelUpVisible: false,
    temporaryOrbs: 0,
  });
});

test('@desktop density uses shipped enemy stats and exact reinforcement release gate', async ({ page }) => {
  await loadCanvas(page);
  const initial = await snapshot(page);
  expect(initial.enemies).toHaveLength(26);
  expect(initial.enemies.every(({ speed }) => speed === 8)).toBe(true);
  expect(initial.enemies.every(({ kind, hp }) => (
    kind === 'armored' ? hp === 5 : hp === 2
  ))).toBe(true);

  const blocked = await sceneCall(page, (scene) => {
    scene.debugFreezeEnemies();
    for (const enemy of scene.getDebugSnapshot().enemies) {
      scene.debugSetEnemy(enemy.id, { x: enemy.position.x, y: 49 }, enemy.hp);
    }
    scene.debugAdvanceEncounter(8_000);
    return scene.getDebugSnapshot();
  });
  expect(Math.min(...blocked.enemies.map(({ position }) => position.y))).toBe(49);
  expect(blocked.encounter).toMatchObject({ phase: 0, spawnSequence: 0 });
  expect(blocked.enemies).toHaveLength(initial.enemies.length);

  const released = await sceneCall(page, (scene) => {
    for (const enemy of scene.getDebugSnapshot().enemies) {
      scene.debugSetEnemy(enemy.id, { x: enemy.position.x, y: 50 }, enemy.hp);
    }
    scene.debugAdvanceEncounter(0);
    return scene.getDebugSnapshot();
  });
  const reinforcementCount = released.enemies.length - blocked.enemies.length;
  expect(Math.min(...released.enemies
    .filter(({ id }) => id < initial.enemies.length)
    .map(({ position }) => position.y))).toBe(50);
  expect(released.encounter).toMatchObject({ phase: 0, spawnSequence: 1 });
  expect(reinforcementCount).toBeGreaterThanOrEqual(13);
  expect(reinforcementCount).toBeLessThanOrEqual(15);
  expect(released.enemies.length).toBeGreaterThan(20);
  expect(released.enemies.length).toBeLessThanOrEqual(48);
});

test('@desktop midboss enters from kill score and stops formations through warning and combat', async ({ page }) => {
  await loadCanvas(page);
  await sceneCall(page, (scene) => {
    scene.debugRemoveEnemies(scene.getDebugSnapshot().enemies.map((enemy) => enemy.id));
    scene.debugAdvanceEncounter(8_000);
  });
  const control = await snapshot(page);
  expect(control.encounter.spawnSequence).toBe(1);
  expect(control.enemies.length).toBeGreaterThan(0);

  await loadCanvas(page);
  const before = await sceneCall(page, (scene) => {
    scene.debugRemoveEnemies(scene.getDebugSnapshot().enemies.map((enemy) => enemy.id));
    for (let score = 0; score < 70; score += 1) scene.debugRecordEnemyKill('basic');
    return scene.getDebugSnapshot();
  });
  expect(before.enemies).toHaveLength(0);
  expect(before.encounter.spawnSequence).toBe(0);

  await sceneCall(page, (scene) => {
    scene.debugAdvanceEncounter(120_000 - scene.getDebugSnapshot().encounter.sectionElapsedMs);
  });
  const warning = await snapshot(page);
  expect(warning.encounter).toMatchObject({ state: 'bossWarning', bossScore: 70 });
  expect(warning.encounter.spawnSequence).toBe(before.encounter.spawnSequence);
  expect(warning.enemies).toHaveLength(before.enemies.length);

  await sceneCall(page, (scene) => scene.debugAdvanceEncounter(2_000));
  const boss = await snapshot(page);
  expect(boss.encounter.state).toBe('boss');
  expect(boss.boss).toMatchObject({ active: true, phase: 'twoWeakpoints' });
  expect(boss.encounter.spawnSequence).toBe(before.encounter.spawnSequence);
  expect(boss.enemies).toHaveLength(before.enemies.length);

  await sceneCall(page, (scene) => scene.debugAdvanceEncounter(60_000));
  const stable = await snapshot(page);
  expect(stable.encounter.state).toBe('boss');
  expect(stable.encounter.spawnSequence).toBe(before.encounter.spawnSequence);
  expect(stable.enemies).toHaveLength(before.enemies.length);
});

test('@desktop midboss hard-time entry does not require kill score', async ({ page }) => {
  await loadCanvas(page);
  const boundaries = await sceneCall(page, (scene) => {
    const initialElapsed = scene.getDebugSnapshot().encounter.sectionElapsedMs;
    scene.debugAdvanceEncounter(209_999 - initialElapsed);
    const before = scene.getDebugSnapshot();
    scene.debugAdvanceEncounter(1);
    return { initialElapsed, before, at: scene.getDebugSnapshot() };
  });
  expect(boundaries.initialElapsed).toBeLessThan(209_999);
  expect(boundaries.before.encounter).toMatchObject({ state: 'running', bossScore: 0 });
  expect(boundaries.at.encounter).toMatchObject({ state: 'bossWarning', bossScore: 0 });
  await sceneCall(page, (scene) => scene.debugAdvanceEncounter(2_000));
  expect((await snapshot(page)).boss.active).toBe(true);
});

test('@desktop midboss movement is constrained by enemies and expands after obstacle removal', async ({ page }) => {
  await loadCanvas(page);
  await enterMidbossByScore(page);
  const bodySize = await sceneCall(page, (scene) => {
    const body = scene.children.list.find(
      (child) => child.active && child.texture?.key === 'boss-body',
    );
    return { width: body?.displayWidth, height: body?.displayHeight };
  });
  expect(bodySize).toEqual({ width: 168, height: 96 });

  const movement = await sceneCall(page, (scene) => {
    const enemies = scene.getDebugSnapshot().enemies;
    const obstacle = enemies[0]!;
    scene.debugFreezeEnemies();
    scene.debugRemoveEnemies(enemies.slice(1).map((enemy) => enemy.id));
    scene.debugSetEnemy(obstacle.id, { x: 330, y: 120 }, 99);
    scene.debugSetBossPosition(225);
    const constrained: number[] = [];
    for (let sample = 0; sample < 6; sample += 1) {
      scene.update(0, 2_000);
      constrained.push(scene.getDebugSnapshot().boss.position!.x);
    }

    scene.debugRemoveEnemies(scene.getDebugSnapshot().enemies.map((enemy) => enemy.id));
    const speedSamples = [scene.getDebugSnapshot().boss.position!.x];
    for (let sample = 0; sample < 4; sample += 1) {
      scene.update(0, 500);
      speedSamples.push(scene.getDebugSnapshot().boss.position!.x);
    }
    const expanded = [...speedSamples];
    for (let sample = 0; sample < 5; sample += 1) {
      scene.update(0, 2_000);
      expanded.push(scene.getDebugSnapshot().boss.position!.x);
    }
    return { constrained, speedSamples, expanded };
  });
  expect(Math.max(...movement.constrained)).toBeLessThanOrEqual(236);
  expect(Math.min(...movement.constrained)).toBeGreaterThanOrEqual(60);
  const distances = movement.speedSamples.slice(1).map(
    (position, index) => Math.abs(position - movement.speedSamples[index]!),
  );
  expect(distances).toHaveLength(4);
  for (const distance of distances) expect(distance).toBeCloseTo(17.5, 5);
  expect(Math.max(...movement.expanded)).toBeGreaterThan(300);
});

test('@desktop midboss basic shots aim, damage once, pause for major warning, and resume at 900ms', async ({ page }) => {
  await loadCanvas(page);
  await enterMidbossByScore(page);
  await sceneCall(page, (scene) => {
    const enemies = scene.getDebugSnapshot().enemies;
    const obstacle = enemies[0]!;
    scene.debugFreezeEnemies();
    scene.debugRemoveEnemies(enemies.slice(1).map((enemy) => enemy.id));
    scene.debugSetEnemy(obstacle.id, { x: 225, y: 120 }, 99);
    scene.debugSetBossPosition(225);
    scene.debugSetHealth(10);
  });

  await expect.poll(async () => {
    const current = await snapshot(page);
    if (current.boss.warnings === 0) {
      await sceneCall(page, (scene) => scene.update(0, 25));
    }
    return (await snapshot(page)).boss.warnings;
  }, { intervals: [1], timeout: 1_000 }).toBe(1);
  const immediatelyBeforeFire = await snapshot(page);
  expect(immediatelyBeforeFire.boss.basicBullets).toBe(0);

  await expect.poll(async () => {
    const current = await snapshot(page);
    if (current.boss.basicBullets === 0) {
      await sceneCall(page, (scene) => scene.update(0, 1));
    }
    return (await snapshot(page)).boss.basicBullets;
  }, { intervals: [1], timeout: 1_000 }).toBe(1);
  const firstFire = await snapshot(page);
  const firstBasic = firstFire.boss.projectiles.find(({ kind }) => kind === 'basic')!;
  const bossOrigin = firstFire.boss.position!;
  const expectedLength = Math.hypot(
    immediatelyBeforeFire.player.x - bossOrigin.x,
    immediatelyBeforeFire.player.y - bossOrigin.y,
  );
  const expectedDirection = {
    x: (immediatelyBeforeFire.player.x - bossOrigin.x) / expectedLength,
    y: (immediatelyBeforeFire.player.y - bossOrigin.y) / expectedLength,
  };
  const actualSpeed = Math.hypot(firstBasic.velocity.x, firstBasic.velocity.y);
  expect(actualSpeed).toBeCloseTo(150, 5);
  expect(firstBasic.velocity.x / actualSpeed).toBeCloseTo(expectedDirection.x, 2);
  expect(firstBasic.velocity.y / actualSpeed).toBeCloseTo(expectedDirection.y, 2);

  const healthBeforeHit = firstFire.health.current;
  await sceneCall(page, (scene, pathPoint: Vector) => {
    scene.player.setPosition(pathPoint.x, pathPoint.y);
  }, {
    x: firstBasic.position.x + expectedDirection.x * 100,
    y: firstBasic.position.y + expectedDirection.y * 100,
  });
  await expect.poll(async () => (await snapshot(page)).health.current, {
    intervals: [16],
    timeout: 1_500,
  }).toBe(healthBeforeHit - 1);
  await sceneCall(page, (scene) => scene.debugDamage(1));
  expect((await snapshot(page)).health.current).toBe(healthBeforeHit - 1);

  await expect.poll(async () => {
    const current = await snapshot(page);
    if (current.boss.basicBullets === 0) {
      await sceneCall(page, (scene) => scene.update(0, 25));
    }
    return (await snapshot(page)).boss.projectiles.filter(({ kind }) => kind === 'basic').length;
  }, { intervals: [1], timeout: 1_000 }).toBeGreaterThanOrEqual(1);
  const secondFire = await snapshot(page);
  expect(secondFire.boss.projectiles.find(({ kind }) => kind === 'basic')).toBeDefined();

  const majorCycle = await sceneCall(page, (scene) => {
    scene.update(0, 1_000);
    const atWarning = scene.getDebugSnapshot();
    const basicDuringWarning: number[] = [];
    for (let step = 0; step < 1_000 && scene.getDebugSnapshot().boss.warnings > 0; step += 1) {
      basicDuringWarning.push(scene.getDebugSnapshot().boss.basicBullets);
      scene.update(0, 1);
    }
    const resolved = scene.getDebugSnapshot();
    scene.update(0, 899);
    const beforeReset = scene.getDebugSnapshot();
    scene.update(0, 1);
    const atReset = scene.getDebugSnapshot();
    return { atWarning, basicDuringWarning, resolved, beforeReset, atReset };
  });
  expect(majorCycle.atWarning.boss.warnings).toBeGreaterThan(0);
  expect(majorCycle.basicDuringWarning.length).toBeGreaterThan(0);
  expect(new Set(majorCycle.basicDuringWarning)).toEqual(
    new Set([majorCycle.atWarning.boss.basicBullets]),
  );
  expect(majorCycle.resolved.boss.warnings).toBe(0);
  expect(majorCycle.beforeReset.boss.basicBullets).toBe(majorCycle.resolved.boss.basicBullets);
  expect(majorCycle.atReset.boss.basicBullets).toBe(majorCycle.resolved.boss.basicBullets + 1);
});

test('@desktop midboss real orb collisions reflect body, respect locked core, and split on forgiving weakpoints', async ({ page }) => {
  const { box } = await loadCanvas(page);
  await sceneCall(page, (scene) => scene.debugUpgradeAbility('split'));
  await enterMidbossByScore(page);
  await sceneCall(page, (scene) => {
    scene.debugFreezeEnemies();
    scene.debugRemoveEnemies(scene.getDebugSnapshot().enemies.map((enemy) => enemy.id));
    scene.debugSetBossPosition(225);
  });

  const initial = await snapshot(page);
  const aim = clientPoint(box, { x: initial.player.x, y: initial.player.y - 100 });
  await page.mouse.move(aim.x, aim.y);
  await expect.poll(async () => orbStateCounts(await snapshot(page)), {
    intervals: [5],
    timeout: 100,
  }).toEqual({ active: 1, queued: 2 });
  const launched = await snapshot(page);
  const orb = launched.orbs.find((candidate) => candidate.state === 'active')!;
  const initialCharges = orb.charges;

  await sceneCall(page, (scene) => {
    scene.debugSetBossPosition(225);
    if (!scene.debugPlaceOrb(0, { x: 225, y: 178 })) throw new Error('active orb required');
  });
  await expect.poll(async () => (
    await snapshot(page)
  ).orbs.find((candidate) => candidate.id === orb.id)?.velocity.y, { timeout: 500 }).toBeGreaterThan(0);
  const bodyHit = await snapshot(page);
  expect(bodyHit.boss.parts).toEqual({ leftWeakpoint: 14, rightWeakpoint: 14, core: 36 });
  expect(bodyHit.orbs.find((candidate) => candidate.id === orb.id)?.charges).toBe(initialCharges);
  expect(bodyHit.temporaryOrbs).toBe(0);

  await sceneCall(page, (scene) => {
    scene.debugSetBossPosition(225);
    if (!scene.debugPlaceOrb(0, { x: 225, y: 62 })) throw new Error('active orb required');
  });
  await expect.poll(async () => (
    await snapshot(page)
  ).orbs.find((candidate) => candidate.id === orb.id)?.velocity.y, { timeout: 500 }).toBeLessThan(0);
  const lockedCore = await snapshot(page);
  expect(lockedCore.boss.parts?.core).toBe(36);
  expect(lockedCore.orbs.find((candidate) => candidate.id === orb.id)?.charges).toBe(initialCharges);

  await sceneCall(page, (scene) => {
    scene.debugSetBossPosition(225);
    if (!scene.debugPlaceOrb(0, { x: 130, y: 156 })) throw new Error('active orb required');
  });
  await expect.poll(async () => {
    const current = await snapshot(page);
    return {
      weakpointDamaged: (current.boss.parts?.leftWeakpoint ?? 14) < 14,
      temporaryOrbs: current.temporaryOrbs,
    };
  }, { timeout: 600 }).toEqual({ weakpointDamaged: true, temporaryOrbs: 1 });
  const weakpointHit = await snapshot(page);
  expect(weakpointHit.boss.parts!.leftWeakpoint).toBeLessThan(14);
  expect(weakpointHit.orbs.find((candidate) => candidate.id === orb.id)?.charges).toBe(initialCharges - 1);

  await sceneCall(page, (scene) => {
    scene.debugDamageBossPart('leftWeakpoint', 14);
    scene.debugDamageBossPart('rightWeakpoint', 14);
  });
  expect((await snapshot(page)).boss.phase).toBe('core');
  const coreBefore = (await snapshot(page)).boss.parts!.core!;
  await sceneCall(page, (scene) => {
    scene.debugSetBossPosition(225);
    const orb = scene.getDebugSnapshot().orbs.find((candidate) => candidate.id === 0)!;
    const approachY = orb.velocity.y > 0 ? 90 : 150;
    if (!scene.debugPlaceOrb(0, { x: 225, y: approachY })) throw new Error('active orb required');
  });
  await expect.poll(async () => (await snapshot(page)).boss.parts?.core, { timeout: 600 })
    .toBeLessThan(coreBefore);
});

test('@desktop midboss enforces weakpoint order, pauses reward, and resumes stronger section one', async ({ page }) => {
  await loadCanvas(page);
  await enterMidbossByScore(page);

  await sceneCall(page, (scene) => scene.debugDamageBossPart('core', 36));
  expect((await snapshot(page)).boss).toMatchObject({
    phase: 'twoWeakpoints',
    parts: { leftWeakpoint: 14, rightWeakpoint: 14, core: 36 },
  });
  await sceneCall(page, (scene) => scene.debugDamageBossPart('leftWeakpoint', 14));
  expect((await snapshot(page)).boss).toMatchObject({
    phase: 'oneWeakpoint',
    parts: { leftWeakpoint: 0, rightWeakpoint: 14, core: 36 },
  });
  await sceneCall(page, (scene) => scene.debugDamageBossPart('core', 36));
  expect((await snapshot(page)).boss.parts!.core).toBe(36);
  await sceneCall(page, (scene) => scene.debugDamageBossPart('rightWeakpoint', 14));
  expect((await snapshot(page)).boss.phase).toBe('core');
  await sceneCall(page, (scene) => {
    scene.debugDamageBossPart('core', 36);
    scene.update(0, 0);
  });

  await expect.poll(async () => (await snapshot(page)).bossRewardVisible).toBe(true);
  const reward = await snapshot(page);
  expect(reward.encounter).toMatchObject({ state: 'bossRewardPaused', bossesDefeated: 1 });
  expect(reward.pauseReasons).toContain('bossReward');
  expect(reward.bossRewardChoices).toHaveLength(3);
  const elapsedAtReward = reward.gameplayElapsedMs;
  await page.waitForTimeout(100);
  expect((await snapshot(page)).gameplayElapsedMs).toBe(elapsedAtReward);

  const selected = reward.bossRewardChoices[0]!;
  await page.keyboard.press('Digit1');
  await expect.poll(async () => (await snapshot(page)).bossRewardVisible).toBe(false);
  const resumed = await snapshot(page);
  expect(resumed.bossRewards).toEqual([selected]);
  expect(resumed.encounter).toMatchObject({ state: 'running', section: 1, phase: 2 });
  expect(resumed.pauseReasons).not.toContain('bossReward');
  expect(resumed.boss.active).toBe(false);
});

test('@desktop chain warhead enables temporary-orb explosions only after reward acquisition', async ({ page }) => {
  const { box } = await loadCanvas(page);
  await sceneCall(page, (scene) => {
    scene.debugFreezeEnemies();
    scene.debugUpgradeAbility('split');
    scene.debugUpgradeAbility('explosion');
    const enemies = scene.getDebugSnapshot().enemies;
    scene.debugRemoveEnemies(enemies.slice(3).map((enemy) => enemy.id));
    scene.debugSetEnemy(enemies[0]!.id, { x: 100, y: 300 }, 99);
    scene.debugSetEnemy(enemies[1]!.id, { x: 137, y: 220 }, 2);
    scene.debugSetEnemy(enemies[2]!.id, { x: 175, y: 220 }, 2);
  });
  const initial = await snapshot(page);
  const [, directBeforeId, splashBeforeId] = initial.enemies.map((enemy) => enemy.id);
  const aim = clientPoint(box, { x: initial.player.x, y: initial.player.y - 100 });
  await page.mouse.move(aim.x, aim.y);
  await expect.poll(async () => orbStateCounts(await snapshot(page)), {
    intervals: [5],
    timeout: 100,
  }).toEqual({ active: 1, queued: 2 });
  await sceneCall(page, (scene) => {
    const active = scene.getDebugSnapshot().orbs.find((orb) => orb.state === 'active')!;
    if (!scene.debugPlaceOrb(active.id, { x: 100, y: 324 })) throw new Error('active orb required');
  });
  await expect.poll(async () => (
    await snapshot(page)
  ).enemies.find((enemy) => enemy.id === directBeforeId)?.hp, { timeout: 600 }).toBe(1.5);
  expect((await snapshot(page)).enemies.find((enemy) => enemy.id === splashBeforeId)?.hp).toBe(2);
  await expect.poll(async () => (await snapshot(page)).temporaryOrbs, { timeout: 2_000 }).toBe(0);

  await enterMidbossByScore(page);
  const reward = await defeatMidboss(page);
  const chainIndex = reward.bossRewardChoices.indexOf('chain-warhead');
  expect(chainIndex).toBeGreaterThanOrEqual(0);
  await page.keyboard.press(`Digit${chainIndex + 1}`);
  await expect.poll(async () => (await snapshot(page)).bossRewards).toContain('chain-warhead');

  await sceneCall(page, (scene) => {
    const enemies = scene.getDebugSnapshot().enemies;
    const [anchor, direct, splash] = enemies;
    scene.debugSetEnemy(anchor!.id, { x: 100, y: 300 }, 99);
    scene.debugSetEnemy(direct!.id, { x: 63, y: 220 }, 2);
    scene.debugSetEnemy(splash!.id, { x: 25, y: 220 }, 2);
    const active = scene.getDebugSnapshot().orbs.find((orb) => orb.state === 'active' && orb.charges > 0)!;
    if (!scene.debugPlaceOrb(active.id, { x: 100, y: 324 })) throw new Error('charged orb required');
  });
  await expect.poll(async () => (
    await snapshot(page)
  ).enemies.find((enemy) => enemy.id === directBeforeId)?.hp, { timeout: 600 }).toBe(1.5);
  expect((await snapshot(page)).enemies.find((enemy) => enemy.id === splashBeforeId)?.hp).toBe(1.5);
});

test('@desktop midboss rewards and encounter state reset on restart', async ({ page }) => {
  const { box } = await loadCanvas(page);
  await enterMidbossByScore(page);
  const reward = await defeatMidboss(page);
  await page.keyboard.press('Digit1');
  await expect.poll(async () => (await snapshot(page)).bossRewards).toEqual([reward.bossRewardChoices[0]]);
  await sceneCall(page, (scene) => {
    scene.debugSetHealth(1);
    scene.debugDamage(1);
  });
  expect((await snapshot(page)).defeated).toBe(true);
  const restart = clientPoint(box, { x: 225, y: 436 });
  await expect.poll(async () => {
    try {
      await page.mouse.click(restart.x, restart.y);
      return (await snapshot(page)).defeated;
    } catch {
      return true;
    }
  }, { intervals: [16], timeout: 1_000 }).toBe(false);

  const reset = await snapshot(page);
  expect(reset.encounter).toMatchObject({
    state: 'running', section: 0, spawnSequence: 0, bossScore: 0, bossesDefeated: 0,
  });
  expect(reset.encounter.elapsedMs).toBeLessThan(1_000);
  expect(reset.encounter.sectionElapsedMs).toBeLessThan(1_000);
  expect(reset.bossRewards).toEqual([]);
  expect(reset.bossRewardChoices).toEqual([]);
  expect(reset.bossRewardVisible).toBe(false);
  expect(reset.boss.active).toBe(false);
});

test('@desktop splitter reserves population, clamps fragments, and settles rewards', async ({ page }) => {
  const { box } = await loadCanvas(page);
  await resumeSectionOne(page);
  await sceneCall(page, (scene) => {
    scene.debugRemoveEnemies(scene.getDebugSnapshot().enemies.map((enemy) => enemy.id));
    scene.debugAdvanceEncounter(60_000);
    scene.debugAdvanceEncounter(5_500);
    scene.debugFreezeEnemies();
  });
  const phaseThree = await snapshot(page);
  expect(phaseThree.encounter.phase).toBe(3);
  const parent = phaseThree.enemies.find(({ kind }) => kind === 'splitter')!;
  expect(parent).toBeDefined();
  const populationBefore = phaseThree.activePopulation;
  const xpBefore = phaseThree.progression.xp;
  const scoreBefore = phaseThree.encounter.bossScore;
  await sceneCall(page, (scene, id) => {
    scene.debugSetEnemy(id, { x: 0, y: 300 }, 1);
  }, parent.id);
  const aim = clientPoint(box, { x: phaseThree.player.x, y: phaseThree.player.y - 100 });
  await page.mouse.move(aim.x, aim.y);
  await expect.poll(async () => orbStateCounts(await snapshot(page))).toEqual({ active: 3, queued: 0 });
  await sceneCall(page, (scene) => {
    const orb = scene.getDebugSnapshot().orbs.find(({ state }) => state === 'active')!;
    scene.debugPlaceOrb(orb.id, { x: 11, y: 324 });
  });
  await expect.poll(async () => (await snapshot(page)).enemies.filter(({ kind }) => kind === 'fragment').length)
    .toBe(2);
  const split = await snapshot(page);
  const fragments = split.enemies.filter(({ kind }) => kind === 'fragment');
  expect(fragments.every(({ position }) => position.x >= 11)).toBe(true);
  expect(split.activePopulation).toBe(populationBefore);
  expect(split.progression.xp).toBe(xpBefore + 1);
  expect(split.encounter.bossScore).toBe(scoreBefore + 2);
  for (const [index, fragment] of fragments.entries()) {
    const arranged = await sceneCall(page, (scene, target) => {
      const orb = scene.getDebugSnapshot().orbs.filter(
        ({ state, collisionEnabled, damageEnabled }) => (
          state === 'active' && collisionEnabled && damageEnabled
        ),
      )[target.orb]!;
      const position = { x: 150 + target.orb * 150, y: 300 };
      scene.debugSetEnemy(target.id, position, 1);
      const approachY = position.y + (orb.velocity.y < 0 ? 18 : -18);
      return {
        placed: scene.debugPlaceOrb(orb.id, { x: position.x, y: approachY }),
        orbId: orb.id,
      };
    }, { id: fragment.id, orb: index });
    expect(arranged.placed).toBe(true);
    await expect.poll(async () => (
      await snapshot(page)
    ).enemies.some(({ id }) => id === fragment.id)).toBe(false);
  }
  const settled = await snapshot(page);
  expect(settled.progression.xp).toBe(xpBefore + 3);
  expect(settled.encounter.bossScore).toBe(scoreBefore + 2);
  expect(settled.activePopulation).toBe(populationBefore - 2);
});

test('@desktop enters hive from section-local score and hard time', async ({ page }) => {
  await loadCanvas(page);
  await resumeSectionOne(page);
  const scoreBoundaries = await sceneCall(page, (scene) => {
    for (let score = 0; score < 110; score += 1) scene.debugRecordEnemyKill('basic');
    const elapsed = scene.getDebugSnapshot().encounter.sectionElapsedMs;
    scene.debugAdvanceEncounter(149_999 - elapsed);
    const before = scene.getDebugSnapshot();
    scene.debugAdvanceEncounter(1);
    const warning = scene.getDebugSnapshot();
    scene.debugAdvanceEncounter(1_999);
    const beforeBoss = scene.getDebugSnapshot();
    scene.debugAdvanceEncounter(1);
    const boss = scene.getDebugSnapshot();
    return { before, warning, beforeBoss, boss };
  });
  const beforeScoreBoundary = scoreBoundaries.before;
  expect(beforeScoreBoundary.encounter).toMatchObject({
    state: 'running', section: 1, sectionElapsedMs: 149_999, bossScore: 110,
  });
  const scoreEnemies = beforeScoreBoundary.enemies.map(({ id }) => id);
  const scoreSpawnSequence = beforeScoreBoundary.encounter.spawnSequence;
  const scoreWarning = scoreBoundaries.warning;
  expect(scoreWarning.encounter).toMatchObject({
    state: 'bossWarning', pendingBossKind: 'hive', sectionElapsedMs: 150_000,
  });
  expect(scoreWarning.enemies.map(({ id }) => id)).toEqual(scoreEnemies);
  expect(scoreBoundaries.beforeBoss.encounter.state).toBe('bossWarning');
  expect(scoreBoundaries.boss.boss.kind).toBe('hive');
  expect(scoreBoundaries.boss.encounter.spawnSequence).toBe(scoreSpawnSequence);
  expect(scoreBoundaries.boss.enemies.length).toBeGreaterThan(0);
  const activeHive = await sceneCall(page, (scene) => {
    scene.debugAdvanceEncounter(7_000);
    scene.debugAdvanceHiveCycle(7_000);
    return scene.getDebugSnapshot();
  });
  expect(activeHive.encounter.state).toBe('boss');
  expect(activeHive.encounter.spawnSequence).toBe(scoreSpawnSequence);
  expect(activeHive.enemies.map(({ id }) => id)).toEqual(scoreEnemies);

  await loadCanvas(page);
  await resumeSectionOne(page);
  const hardBoundaries = await sceneCall(page, (scene) => {
    const elapsed = scene.getDebugSnapshot().encounter.sectionElapsedMs;
    scene.debugAdvanceEncounter(209_999 - elapsed);
    const before = scene.getDebugSnapshot();
    scene.debugAdvanceEncounter(1);
    return { before, at: scene.getDebugSnapshot() };
  });
  expect(hardBoundaries.before.encounter).toMatchObject({ state: 'running', bossScore: 0 });
  expect(hardBoundaries.at.encounter).toMatchObject({
    state: 'bossWarning', pendingBossKind: 'hive', sectionElapsedMs: 210_000,
  });
});

test('@desktop hive cycles shield, telegraph, exposure, and permanent exposure', async ({ page }) => {
  await loadCanvas(page);
  await resumeSectionOne(page);
  const phases = await sceneCall(page, (scene) => {
    for (let score = 0; score < 110; score += 1) scene.debugRecordEnemyKill('basic');
    scene.debugAdvanceEncounter(
      150_000 - scene.getDebugSnapshot().encounter.sectionElapsedMs,
    );
    scene.debugAdvanceEncounter(2_000);
    const initial = scene.getDebugSnapshot().boss.phase;
    scene.debugAdvanceHiveCycle(3_999);
    const beforeTelegraph = scene.getDebugSnapshot().boss.phase;
    scene.debugAdvanceHiveCycle(1);
    const telegraph = scene.getDebugSnapshot().boss.phase;
    scene.debugAdvanceHiveCycle(1_499);
    const beforeExposure = scene.getDebugSnapshot().boss.phase;
    scene.debugAdvanceHiveCycle(1);
    const exposed = scene.getDebugSnapshot().boss.phase;
    scene.debugAdvanceHiveCycle(6_999);
    const beforeShield = scene.getDebugSnapshot().boss.phase;
    scene.debugAdvanceHiveCycle(1);
    const shielded = scene.getDebugSnapshot().boss.phase;
    scene.debugDamageBossPart('leftShooter', 12);
    scene.debugDamageBossPart('rightShooter', 12);
    scene.debugDamageBossPart('leftReflector', 14);
    scene.debugDamageBossPart('rightReflector', 14);
    const permanent = scene.getDebugSnapshot().boss.phase;
    return {
      initial, beforeTelegraph, telegraph, beforeExposure, exposed, beforeShield, shielded, permanent,
    };
  });
  expect(phases).toEqual({
    initial: 'shielded',
    beforeTelegraph: 'shielded',
    telegraph: 'telegraph',
    beforeExposure: 'telegraph',
    exposed: 'exposed',
    beforeShield: 'exposed',
    shielded: 'shielded',
    permanent: 'permanentlyExposed',
  });
});

test('@desktop hive reflector changes a real orb trajectory without blocking player bullets', async ({ page }) => {
  const { box } = await loadCanvas(page);
  await enterHiveByScore(page);
  await sceneCall(page, (scene) => {
    scene.debugAdvanceHiveCycle(4_000);
    scene.debugAdvanceHiveCycle(1_500);
  });
  const exposed = await snapshot(page);
  expect(exposed.boss.phase).toBe('exposed');
  const aim = clientPoint(box, { x: exposed.player.x, y: exposed.player.y - 100 });
  await page.mouse.move(aim.x, aim.y);
  await expect.poll(async () => orbStateCounts(await snapshot(page))).toEqual({ active: 3, queued: 0 });
  const reflector = (await snapshot(page)).boss.partPositions!.leftReflector!;
  await sceneCall(page, (scene, position) => {
    scene.debugPlaceOrb(0, { x: position.x, y: position.y + 60 });
  }, reflector);
  await expect.poll(async () => (
    await snapshot(page)
  ).orbs[0]!.velocity.y).toBeGreaterThan(0);
  const afterReflection = await snapshot(page);
  expect(afterReflection.boss.parts!.leftReflector).toBeLessThan(14);
  await expect.poll(async () => sceneCall(page, (scene) => scene.children.list.some(
    (child) => child.active && child.texture?.key === 'hive-shooter-bullet',
  ))).toBe(true);
  const projectileStart = await sceneCall(page, (scene, wall) => {
    const projectile = scene.children.list.find(
      (child) => child.active && child.texture?.key === 'hive-shooter-bullet',
    )!;
    projectile.setPosition!(wall.x - 30, wall.y);
    projectile.body!.setVelocity!(200, 0);
    return projectile.x!;
  }, reflector);
  await page.waitForTimeout(250);
  const projectileEnd = await sceneCall(page, (scene) => {
    const projectile = scene.children.list.find(
      (child) => child.active && child.texture?.key === 'hive-shooter-bullet',
    );
    return projectile?.x ?? Number.POSITIVE_INFINITY;
  });
  expect(projectileStart).toBeLessThan(reflector.x);
  expect(projectileEnd).toBeGreaterThan(reflector.x);
});

test('@desktop hive attacks share hostile cap and clean up on defeat', async ({ page }) => {
  await loadCanvas(page);
  await enterHiveByScore(page);
  await sceneCall(page, (scene) => {
    scene.debugFreezeEnemies();
    scene.player.setPosition(225, 730);
    scene.debugAdvanceHiveCycle(4_000);
    scene.debugAdvanceHiveCycle(1_500);
  });
  await expect.poll(async () => {
    const current = await snapshot(page);
    return current.bullets > 0 && (current.boss.bullets ?? 0) > 0;
  }, { timeout: 4_000 }).toBe(true);
  const attacking = await snapshot(page);
  expect(attacking.bullets).toBeGreaterThan(0);
  expect(attacking.boss.bullets ?? 0).toBeGreaterThan(0);
  expect(attacking.bullets + (attacking.boss.bullets ?? 0)).toBeLessThanOrEqual(12);
  await sceneCall(page, (scene) => {
    scene.debugDamageBossPart('leftShooter', 12);
    scene.debugDamageBossPart('rightShooter', 12);
    scene.debugDamageBossPart('leftReflector', 14);
    scene.debugDamageBossPart('rightReflector', 14);
    scene.debugDamageBossPart('core', 72);
    scene.update(0, 0);
  });
  await expect.poll(async () => (await snapshot(page)).bossRewardVisible).toBe(true);
  const defeated = await snapshot(page);
  expect(defeated.bullets).toBe(0);
  expect(defeated.boss.bullets ?? 0).toBe(0);
  expect(defeated.boss.warnings).toBe(0);
});

test('@desktop second relics apply once without recursive temporary growth', async ({ page }) => {
  const { box } = await loadCanvas(page);
  await sceneCall(page, (scene) => scene.debugUpgradeAbility('split'));
  await enterHiveByScore(page);
  await sceneCall(page, (scene) => {
    scene.debugDamageBossPart('leftShooter', 12);
    scene.debugDamageBossPart('rightShooter', 12);
    scene.debugDamageBossPart('leftReflector', 14);
    scene.debugDamageBossPart('rightReflector', 14);
    scene.debugDamageBossPart('core', 72);
    scene.update(0, 0);
  });
  await expect.poll(async () => (await snapshot(page)).bossRewardVisible).toBe(true);
  const reward = await snapshot(page);
  expect(reward.bossRewardTier).toBe('second');
  expect(reward.bossRewardChoices).toHaveLength(3);
  expect(new Set(reward.bossRewardChoices).size).toBe(3);
  const chainSplit = reward.bossRewardChoices.indexOf('chain-split');
  expect(chainSplit).toBeGreaterThanOrEqual(0);
  await page.keyboard.press(`Digit${chainSplit + 1}`);
  await expect.poll(async () => (await snapshot(page)).bossRewards).toContain('chain-split');
  const resumed = await snapshot(page);
  const aim = clientPoint(box, { x: resumed.player.x, y: resumed.player.y - 100 });
  await page.mouse.move(aim.x, aim.y);
  await expect.poll(async () => orbStateCounts(await snapshot(page))).toEqual({ active: 3, queued: 0 });
  const chargedOrbId = await sceneCall(page, (scene) => (
    scene.getDebugSnapshot().orbs.find(
      ({ state, charges, damageEnabled }) => state === 'active' && charges > 0 && damageEnabled,
    )!.id
  ));
  expect((await snapshot(page)).orbs.find(({ id }) => id === chargedOrbId)!.charges)
    .toBeGreaterThan(0);
  const targets = await sceneCall(page, (scene, orbId) => {
    scene.debugFreezeEnemies();
    const enemies = scene.getDebugSnapshot().enemies.slice(0, 3);
    scene.debugRemoveEnemies(
      scene.getDebugSnapshot().enemies.slice(3).map(({ id }) => id),
    );
    const [anchor, rootTarget, childTarget] = enemies;
    scene.debugSetEnemy(anchor!.id, { x: 100, y: 300 }, 99);
    scene.debugSetEnemy(rootTarget!.id, { x: 250, y: 220 }, 99);
    scene.debugSetEnemy(childTarget!.id, { x: 350, y: 220 }, 99);
    const orb = scene.getDebugSnapshot().orbs.find(({ id }) => id === orbId)!;
    if (!scene.debugPlaceOrb(orb.id, { x: 100, y: 324 })) {
      throw new Error('charged permanent orb required');
    }
    return {
      anchorId: anchor!.id,
      childTargetId: childTarget!.id,
    };
  }, chargedOrbId);
  await expect.poll(async () => (
    await snapshot(page)
  ).enemies.find(({ id }) => id === targets.anchorId)?.hp).toBeLessThan(99);
  await expect.poll(async () => (await snapshot(page)).temporaryOrbSnapshots)
    .toHaveLength(3);
  const split = (await snapshot(page)).temporaryOrbSnapshots;
  const root = split.find(({ generation }) => generation === 0)!;
  expect(root).toMatchObject({
    generation: 0,
    splitConsumed: true,
  });
  expect(split.filter(({ generation }) => generation === 1)).toHaveLength(2);
  const idsAfterRootHit = split.map(({ id }) => id).sort((left, right) => left - right);
  const child = split.find(({ generation }) => generation === 1)!;
  const childHpBefore = (await snapshot(page)).enemies.find(
    ({ id }) => id === targets.childTargetId,
  )!.hp;
  await sceneCall(page, (scene, childId) => {
    scene.debugPlaceTemporaryOrb(childId, { x: 350, y: 238 });
  }, child.id);
  await expect.poll(async () => (
    await snapshot(page)
  ).enemies.find(({ id }) => id === targets.childTargetId)?.hp).toBeLessThan(childHpBefore);
  const afterChildHit = (await snapshot(page)).temporaryOrbSnapshots;
  expect(afterChildHit.map(({ id }) => id).sort((left, right) => left - right))
    .toEqual(idsAfterRootHit);
  expect(afterChildHit.filter(({ generation }) => generation === 1)).toHaveLength(2);
  expect((await snapshot(page)).bossRewards.filter((id) => id === 'chain-split')).toHaveLength(1);
  expect(afterChildHit).toHaveLength(3);
});

test('@desktop completes first boss through second reward and resumes section two', async ({ page }) => {
  const { box } = await loadCanvas(page);
  await enterHiveByScore(page);
  await sceneCall(page, (scene) => {
    scene.debugDamageBossPart('leftShooter', 12);
    scene.debugDamageBossPart('rightShooter', 12);
    scene.debugDamageBossPart('leftReflector', 14);
    scene.debugDamageBossPart('rightReflector', 14);
    scene.debugDamageBossPart('core', 71);
  });
  expect((await snapshot(page)).boss.phase).toBe('permanentlyExposed');
  const before = await snapshot(page);
  const aim = clientPoint(box, { x: before.player.x, y: before.player.y - 100 });
  await page.mouse.move(aim.x, aim.y);
  await expect.poll(async () => orbStateCounts(await snapshot(page))).toEqual({ active: 3, queued: 0 });
  await sceneCall(page, (scene) => {
    scene.debugPlaceOrb(0, { x: 225, y: 172 });
  });
  await expect.poll(async () => (await snapshot(page)).bossRewardVisible).toBe(true);
  const secondReward = await snapshot(page);
  expect(secondReward.encounter).toMatchObject({
    state: 'bossRewardPaused', section: 1, bossesDefeated: 2,
  });
  expect(secondReward.bossRewardTier).toBe('second');
  await page.keyboard.press('Digit1');
  await expect.poll(async () => (await snapshot(page)).encounter.section).toBe(2);
  const sectionTwo = await snapshot(page);
  expect(sectionTwo.encounter).toMatchObject({
    state: 'running', section: 2, bossScore: 0, phase: 3,
  });
  expect(sectionTwo.encounter.sectionElapsedMs).toBeLessThan(100);
  expect(sectionTwo.boss.active).toBe(false);
  expect(sectionTwo.bossRewards).toHaveLength(2);
});

test('@mobile keeps movement and retained aim during phase-three density and hive combat', async ({ page }) => {
  const { box } = await loadCanvas(page);
  await resumeSectionOne(page);
  await sceneCall(page, (scene) => {
    scene.debugRemoveEnemies(scene.getDebugSnapshot().enemies.map(({ id }) => id));
    scene.debugAdvanceEncounter(60_000);
    scene.debugAdvanceEncounter(5_500);
  });
  const dense = await snapshot(page);
  expect(dense.encounter.phase).toBe(3);
  expect(dense.enemies.length).toBeGreaterThanOrEqual(21);
  await sceneCall(page, (scene) => {
    for (let score = scene.getDebugSnapshot().encounter.bossScore; score < 110; score += 1) {
      scene.debugRecordEnemyKill('basic');
    }
    scene.debugAdvanceEncounter(90_000);
    scene.debugAdvanceEncounter(2_000);
  });
  await expect.poll(async () => (await snapshot(page)).boss.kind).toBe('hive');
  const before = await snapshot(page);
  const touches = {
    moveStart: { x: box.x + box.width * 0.22, y: box.y + box.height * 0.78 },
    moveEnd: { x: box.x + box.width * 0.34, y: box.y + box.height * 0.66 },
    aimStart: { x: box.x + box.width * 0.78, y: box.y + box.height * 0.78 },
    aimEnd: { x: box.x + box.width * 0.66, y: box.y + box.height * 0.66 },
  };
  await dispatchTouchPointers(page, [
    { type: 'pointerdown', pointerId: 41, point: touches.moveStart },
    { type: 'pointerdown', pointerId: 77, point: touches.aimStart },
    { type: 'pointermove', pointerId: 41, point: touches.moveEnd },
    { type: 'pointermove', pointerId: 77, point: touches.aimEnd },
  ]);
  await page.waitForTimeout(250);
  await dispatchTouchPointers(page, [
    { type: 'pointerup', pointerId: 41, point: touches.moveEnd },
    { type: 'pointerup', pointerId: 77, point: touches.aimEnd },
  ]);
  await page.waitForTimeout(100);
  const after = await snapshot(page);
  expect(after.player.x).toBeGreaterThan(before.player.x);
  expect(after.player.y).toBeLessThan(before.player.y);
  expect(after.aim.x).toBeLessThan(0);
  expect(after.aim.y).toBeLessThan(0);
  expect(after.boss.kind).toBe('hive');
  expect(after.enemies.length).toBe(dense.enemies.length);
});
