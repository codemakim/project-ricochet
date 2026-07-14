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

interface CombatSnapshot {
  player: Vector;
  aim: Vector;
  health: { current: number; maximum: number; shield: number; defeated: boolean };
  defeated: boolean;
  orbs: OrbSnapshot[];
  enemies: Array<{ id: number; kind: string; hp: number; position: Vector; warning: boolean }>;
  activeShooters: number;
  bullets: number;
  experiment: { passThroughOnKill: boolean; homeOnBottomHit: boolean; autoReturnAfterMs: number | null };
  encounter: {
    elapsedMs: number;
    elapsedSinceSpawnMs: number;
    phase: 0 | 1 | 2;
    spawnSequence: number;
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
}

type AbilityId = 'firepower' | 'kinetic' | 'explosion' | 'split';

interface DevelopmentScene {
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
}

async function sceneCall<T>(page: Page, callback: (scene: DevelopmentScene) => T): Promise<T> {
  return page.evaluate((source) => {
    const game = (window as unknown as {
      __RICHOCHET_GAME__: { scene: { getScene(key: string): DevelopmentScene } };
    }).__RICHOCHET_GAME__;
    const scene = game.scene.getScene('combat');
    return (0, eval)(`(${source})`)(scene) as T;
  }, callback.toString());
}

async function snapshot(page: Page): Promise<CombatSnapshot> {
  return sceneCall(page, (scene) => scene.getDebugSnapshot());
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
  await expect.poll(async () => (await snapshot(page)).enemies.length).toBe(20);
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  return { canvas, box: box! };
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
    await sceneCall(page, (scene) => scene.debugFreezeEnemies());
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
  await sceneCall(page, (scene) => {
    scene.debugFreezeEnemies();
    scene.debugUpgradeAbility('explosion');
    const keep = new Set([0, 1, 2, 3]);
    scene.debugRemoveEnemies(
      scene.getDebugSnapshot().enemies
        .filter((enemy) => !keep.has(enemy.id))
        .map((enemy) => enemy.id),
    );
    scene.debugSetEnemy(0, { x: 225, y: 300 }, 2);
    scene.debugSetEnemy(1, { x: 273, y: 300 }, 1);
    scene.debugSetEnemy(2, { x: 225, y: 252 }, 0.5);
    scene.debugSetEnemy(3, { x: 225, y: 204 }, 1);
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

  await expect.poll(async () => (await snapshot(page)).enemies.find((enemy) => enemy.id === 1)?.hp, {
    intervals: [5],
    timeout: 90,
  }).toBe(0.5);
  const after = await snapshot(page);
  expect(after.enemies.find((enemy) => enemy.id === 0)?.hp).toBe(0.5);
  expect(after.enemies.some((enemy) => enemy.id === 2)).toBe(false);
  expect(after.enemies.find((enemy) => enemy.id === 3)?.hp).toBe(1);
  expect(after.progression.xp).toBe(before.progression.xp + 1);
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
  expect(before.enemies).toHaveLength(16);

  await page.clock.runFor(8_100);

  const after = await snapshot(page);
  expect(after.enemies.some((enemy) => enemy.id < 20)).toBe(true);
  expect(after.enemies.some((enemy) => enemy.id >= 20)).toBe(true);
  expect(after.encounter.spawnSequence).toBe(1);
  expect(after.encounter.phase).toBe(0);
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

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await sceneCall(page, (scene) => scene.update(0, 8_100));
  const firstResumedFrame = await snapshot(page);
  expect(firstResumedFrame.encounter.elapsedMs - hidden.encounter.elapsedMs).toBeLessThanOrEqual(50);
  expect(firstResumedFrame.encounter.elapsedSinceSpawnMs - hidden.encounter.elapsedSinceSpawnMs)
    .toBeLessThanOrEqual(50);
  expect(firstResumedFrame.encounter.spawnSequence).toBe(hidden.encounter.spawnSequence);
  expect(firstResumedFrame.enemies).toHaveLength(hidden.enemies.length);
  expect(firstResumedFrame.player).toEqual(hidden.player);

  await page.clock.runFor(16);
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
  await sceneCall(page, (scene) => scene.debugGrantXp(8));
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

test('@desktop keeps visibility pause after choosing a level-up while hidden', async ({ page }) => {
  await page.clock.install();
  await loadCanvas(page);
  await sceneCall(page, (scene) => scene.debugRemoveEnemies([0, 3, 7, 11]));
  await page.clock.runFor(1_000);
  await page.keyboard.down('KeyD');
  await sceneCall(page, (scene) => scene.debugGrantXp(8));
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

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await sceneCall(page, (scene) => scene.update(0, 8_100));
  const firstResumedFrame = await snapshot(page);
  expect(firstResumedFrame.player).toEqual(stillHidden.player);
  expect(firstResumedFrame.encounter).toEqual(stillHidden.encounter);

  await page.clock.runFor(32);
  const resumed = await snapshot(page);
  expect(resumed.player.x).toBeGreaterThan(firstResumedFrame.player.x);
  expect(resumed.enemies[0]!.position.y).toBeGreaterThan(firstResumedFrame.enemies[0]!.position.y);
  expect(resumed.encounter.elapsedMs).toBeGreaterThan(firstResumedFrame.encounter.elapsedMs);
  await page.keyboard.up('KeyD');
});

test('@desktop keeps level-up paused across queued choices', async ({ page }) => {
  await loadCanvas(page);
  await sceneCall(page, (scene) => scene.debugGrantXp(21));
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
    scene.debugGrantXp(8);
    scene.debugDamage(1);
  });

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
  await page.mouse.click(restart.x, restart.y);
  await expect.poll(async () => (await snapshot(page)).defeated).toBe(false);
  expect(await snapshot(page)).toMatchObject({
    health: { current: 10 },
    progression: { level: 0, xp: 0, pendingChoices: 0 },
    buildRanks: { firepower: 0, kinetic: 0, explosion: 0, split: 0 },
    pauseReasons: [],
    levelUpVisible: false,
  });
});
