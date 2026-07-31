import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import { GAME_TUNING } from '../config/gameTuning';
import { EXPERIMENT_DEFAULTS, ORB_PICKUP_RADIUS, ORB_SPEED } from '../constants';
import { OrbManager, OrbStore } from './OrbManager';

const player = { x: 100, y: 200 };
const up = { x: 0, y: -1 };

type WorldBoundsListener = (body: FakeBody, up: boolean, down: boolean, left: boolean, right: boolean) => void;

class FakeWorld {
  private readonly listeners = new Set<WorldBoundsListener>();

  on(event: string, listener: WorldBoundsListener): void {
    if (event === 'worldbounds') this.listeners.add(listener);
  }

  off(event: string, listener: WorldBoundsListener): void {
    if (event === 'worldbounds') this.listeners.delete(listener);
  }

  emit(body: FakeBody, down: boolean): void {
    for (const listener of this.listeners) listener(body, false, down, false, false);
  }

  listenerCount(): number {
    return this.listeners.size;
  }
}

class FakeBody {
  enable = true;
  onWorldBounds = false;
  velocity = { x: 0, y: 0 };
  center = { x: 0, y: 0 };

  constructor(readonly gameObject: FakeSprite | object) {}

  setVelocity(x: number, y: number): this {
    this.velocity = { x, y };
    return this;
  }

  reset(x: number, y: number): void {
    this.center = { x, y };
  }
}

class FakeSprite {
  orbId = -1;
  x = 0;
  y = 0;
  visible = true;
  destroyed = false;
  setPositionCalls = 0;
  circle = 0;
  textureKey: string;
  readonly body = new FakeBody(this);

  constructor(textureKey = '') {
    this.textureKey = textureKey;
  }

  setCircle(radius: number): this { this.circle = radius; return this; }
  setBounce(): this { return this; }
  setCollideWorldBounds(): this { return this; }
  setVisible(visible: boolean): this { this.visible = visible; return this; }
  setPosition(x: number, y: number): this {
    this.setPositionCalls += 1;
    this.x = x;
    this.y = y;
    return this;
  }
  setTexture(textureKey: string): this { this.textureKey = textureKey; return this; }
  destroy(): void { this.destroyed = true; }
}

function createManager(
  homeOnBottomHit = true,
  hasFixedTerrainLineOfSight: () => boolean = () => false,
  autoReturnAfterMs: number | null = null,
  getDirectDamageBonus: () => number = () => 0,
  getChargedSpeed: () => number = () => ORB_SPEED,
  passThroughOnKill = false,
  getOrbLimit: () => number = () => GAME_TUNING.build.basicGrowth.maximumOrbs,
  getOrbRadius: () => number = () => 8,
  getRecoveryRadius: () => number = () => ORB_PICKUP_RADIUS,
) {
  const world = new FakeWorld();
  const sprites: FakeSprite[] = [];
  const scene = {
    physics: {
      world,
      add: {
        sprite: (_x: number, _y: number, textureKey: string) => {
          const sprite = new FakeSprite(textureKey);
          sprites.push(sprite);
          return sprite;
        },
      },
    },
  } as unknown as Phaser.Scene;
  const manager = new OrbManager(scene, {
    settings: { ...EXPERIMENT_DEFAULTS, homeOnBottomHit, autoReturnAfterMs, passThroughOnKill },
    hasFixedTerrainLineOfSight,
    getDirectDamageBonus,
    getChargedSpeed,
    getOrbLimit,
    getOrbRadius,
    getRecoveryRadius,
  });
  return { manager, sprites, world };
}

describe('OrbStore', () => {
  it('stores an independent level on every permanent orb', () => {
    const store = new OrbStore(EXPERIMENT_DEFAULTS);

    expect(store.getSnapshot()).toMatchObject([
      { id: 0, coreType: 'echo', level: 1 },
    ]);

    expect(store.addOrb('conduction')).toBe(true);
    expect(store.addOrb('conduction')).toBe(true);
    expect(store.getSnapshot()).toMatchObject([
      { id: 0, coreType: 'echo', level: 1 },
      { id: 1, coreType: 'conduction', level: 1 },
      { id: 2, coreType: 'conduction', level: 1 },
    ]);
  });

  it('configures one starting core exactly once before aim', () => {
    const store = new OrbStore(EXPERIMENT_DEFAULTS);

    expect(store.getSnapshot()).toHaveLength(1);
    expect(store.configureStartingCores(['inertia'])).toBe(true);
    expect(store.getSnapshot().map((orb) => orb.coreType)).toEqual(['inertia']);
    expect(store.configureStartingCores(['echo'])).toBe(false);

    store.activateAim();
    expect(store.configureStartingCores(['echo'])).toBe(false);
  });

  it('adds and queues one permanent orb at runtime, capped globally at six', () => {
    const store = new OrbStore(EXPERIMENT_DEFAULTS);
    store.activateAim();
    store.update(0, 0, player, up);

    expect(store.addOrb('conduction')).toBe(true);
    expect(store.getSnapshot()[1]).toMatchObject({
      id: 1,
      state: 'queued',
      coreType: 'conduction',
    });
    store.update(100, 100, player, up);
    store.update(200, 100, player, up);
    store.update(300, 100, player, up);
    expect(store.getSnapshot()[1]).toMatchObject({ state: 'active', charges: 3 });

    expect(store.addOrb()).toBe(true);
    expect(store.addOrb()).toBe(true);
    expect(store.addOrb()).toBe(true);
    expect(store.addOrb()).toBe(true);
    expect(store.addOrb()).toBe(false);
    expect(store.getSnapshot()).toHaveLength(
      GAME_TUNING.build.basicGrowth.maximumOrbs,
    );
  });

  it('spends echo wall resonance as direct damage on the next hit', () => {
    const store = new OrbStore(EXPERIMENT_DEFAULTS);
    store.configureStartingCores(['echo']);
    store.activateAim();
    store.update(0, 0, player, up);
    for (let bounce = 0; bounce < 7; bounce += 1) store.handleWallBounce(0);

    expect(store.handleEnemyHit(0, 7, 99, 1_000, false)).toMatchObject({
      damage: expect.closeTo(2.1),
      coreType: 'echo',
      conductionTriggered: false,
    });
    expect(store.getSnapshot()[0]).toMatchObject({
      coreState: { echoStacks: 0 },
    });
  });

  it('reports every fourth conduction hit', () => {
    const store = new OrbStore(EXPERIMENT_DEFAULTS);
    store.configureStartingCores(['conduction']);
    store.activateAim();
    store.update(0, 0, player, up);

    for (let hit = 0; hit < 3; hit += 1) {
      expect(store.handleEnemyHit(0, hit, 99, 1_000, false))
        .toMatchObject({ conductionTriggered: false });
    }
    expect(store.handleEnemyHit(0, 4, 99, 1_000, false))
      .toMatchObject({ coreType: 'conduction', conductionTriggered: true });
  });

  it('passes flight context into permanent direct-hit damage', () => {
    let context = { distanceFromPlayer: 0, wallHits: 0, speed: 0 };
    const store = new OrbStore(
      EXPERIMENT_DEFAULTS,
      {},
      () => false,
      () => 0,
      () => 480,
      () => GAME_TUNING.build.basicGrowth.maximumOrbs,
      (next) => {
        context = next;
        return 0.2;
      },
    );
    store.configureStartingCores(['conduction']);
    store.activateAim();
    store.update(0, 0, player, up);
    store.synchronizeActive(0, { x: 100, y: 500 }, { x: 0, y: -480 });
    store.handleWallBounce(0);

    expect(store.handleEnemyHit(0, 7, 99, 1_000, false, 140)?.damage).toBeCloseTo(1.8);
    expect(context).toEqual({
      distanceFromPlayer: 140,
      wallHits: 1,
      speed: 480,
      firstHitAfterProximity: false,
      consecutiveHits: 0,
      killOverclockActive: false,
    });
  });

  it('accelerates immediately for five wall stacks and resets on the next flight', () => {
    const store = new OrbStore(
      EXPERIMENT_DEFAULTS,
      {},
      () => false,
      () => 0,
      () => ORB_SPEED,
      () => GAME_TUNING.build.basicGrowth.maximumOrbs,
      () => 0,
      (wallHits) => 1 + wallHits * 0.04,
    );
    store.activateAim();
    store.update(0, 0, player, up);
    for (let bounce = 0; bounce < 7; bounce += 1) store.handleWallBounce(0);

    expect(store.getSnapshot()[0]).toMatchObject({ wallHits: 5 });
    expect(Math.hypot(
      store.getSnapshot()[0]!.velocity.x,
      store.getSnapshot()[0]!.velocity.y,
    )).toBeCloseTo(ORB_SPEED * 1.2);

    store.beginProximityRecovery(0);
    store.update(100, 100, player, up);
    store.update(200, 100, player, up);
    store.update(300, 100, player, up);
    expect(store.getSnapshot()[0]).toMatchObject({ wallHits: 0 });
    expect(Math.hypot(
      store.getSnapshot()[0]!.velocity.x,
      store.getSnapshot()[0]!.velocity.y,
    )).toBeCloseTo(ORB_SPEED);
  });

  it('uses proximity-built inertia for one launch and clears it on the first hit', () => {
    const store = new OrbStore(EXPERIMENT_DEFAULTS);
    store.configureStartingCores(['inertia']);
    store.activateAim();
    store.update(0, 0, player, up);
    for (let hit = 0; hit < 3; hit += 1) {
      store.handleEnemyHit(0, hit, 99, 1_000, false);
    }
    store.beginProximityRecovery(0);
    store.update(100, 100, player, up);
    store.update(200, 100, player, up);
    store.update(300, 100, player, up);

    expect(Math.hypot(
      store.getSnapshot()[0]!.velocity.x,
      store.getSnapshot()[0]!.velocity.y,
    )).toBeCloseTo(ORB_SPEED * 1.3);

    store.handleEnemyHit(0, 9, 99, 2_000, false);
    expect(Math.hypot(
      store.getSnapshot()[0]!.velocity.x,
      store.getSnapshot()[0]!.velocity.y,
    )).toBeCloseTo(ORB_SPEED);
  });

  it('honors a runtime build orb-limit provider up to the central cap', () => {
    let orbLimit = 1;
    const store = new OrbStore(
      EXPERIMENT_DEFAULTS,
      {},
      () => false,
      () => 0,
      () => ORB_SPEED,
      () => orbLimit,
    );

    expect(store.addOrb()).toBe(false);
    orbLimit = 2;
    expect(store.addOrb()).toBe(true);
    expect(store.addOrb()).toBe(false);
    orbLimit = 99;
    expect(store.addOrb()).toBe(true);
    expect(store.addOrb()).toBe(true);
    expect(store.addOrb()).toBe(true);
    expect(store.addOrb()).toBe(true);
    expect(store.addOrb()).toBe(false);
    expect(store.getSnapshot()).toHaveLength(
      GAME_TUNING.build.basicGrowth.maximumOrbs,
    );
  });

  it('queues the starting permanent orb once', () => {
    const store = new OrbStore(EXPERIMENT_DEFAULTS);

    expect(store.getSnapshot().map(({ id, state }) => ({ id, state }))).toEqual([
      { id: 0, state: 'stored' },
    ]);

    store.activateAim();
    store.activateAim();
    expect(store.getSnapshot().map((orb) => orb.state)).toEqual(['queued']);

    store.update(0, 0, player, up);
    expect(store.getSnapshot().map((orb) => orb.state)).toEqual(['active']);
    expect(store.getSnapshot()[0]).toMatchObject({
      position: { x: 100, y: player.y - ORB_PICKUP_RADIUS - 1 },
      velocity: { x: 0, y: -ORB_SPEED },
    });

  });

  it('uses build-provided orb and recovery radii', () => {
    const store = new OrbStore(
      EXPERIMENT_DEFAULTS,
      undefined,
      () => true,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      () => 74,
    );
    store.activateAim();
    store.update(0, 0, player, up);
    store.synchronizeActive(0, { x: player.x + 70, y: player.y }, { x: 0, y: -400 });
    store.update(1, 1, player, up);
    expect(store.getSnapshot()[0]?.state).toBe('attracting');

    const { sprites } = createManager(
      true,
      () => false,
      null,
      () => 0,
      () => ORB_SPEED,
      false,
      () => 6,
      () => 9.28,
    );
    expect(sprites.every(({ circle }) => circle === 9.28)).toBe(true);
  });

  it('disables collision and damage when proximity recovery begins', () => {
    const store = new OrbStore(EXPERIMENT_DEFAULTS);
    store.activateAim();
    store.update(0, 0, player, up);

    expect(store.beginProximityRecovery(0)).toBe(true);
    expect(store.getSnapshot()[0]).toMatchObject({
      state: 'attracting',
      collisionEnabled: false,
      damageEnabled: false,
      lastRecoverySource: 'proximity',
    });
    expect(store.beginFloorRecall(0)).toBe(false);
  });

  it('ignores floor recall when the experiment is disabled', () => {
    const store = new OrbStore({ ...EXPERIMENT_DEFAULTS, homeOnBottomHit: false });
    store.activateAim();
    store.update(0, 0, player, up);

    expect(store.beginFloorRecall(0)).toBe(false);
    expect(store.getSnapshot()[0]).toMatchObject({
      state: 'active',
      collisionEnabled: true,
      damageEnabled: true,
    });
  });

  it('starts proximity attraction only inside 50px with fixed-terrain line of sight', () => {
    const blocked = new OrbStore(EXPERIMENT_DEFAULTS, undefined, () => false);
    blocked.activateAim();
    blocked.update(0, 0, player, { x: 1, y: 0 });
    blocked.synchronizeActive(0, { x: player.x + 50, y: player.y }, { x: 12, y: 34 });
    blocked.update(1, 1, player, up);
    expect(blocked.getSnapshot()[0]?.state).toBe('active');

    const visible = new OrbStore(EXPERIMENT_DEFAULTS, undefined, () => true);
    visible.activateAim();
    visible.update(0, 0, player, { x: 1, y: 0 });
    visible.synchronizeActive(0, { x: player.x + 50, y: player.y }, { x: 12, y: 34 });
    visible.update(1, 1, player, up);
    expect(visible.getSnapshot()[0]?.state).toBe('attracting');
  });

  it('finishes attraction after 100ms, restores charges, and relaunches using latest aim', () => {
    const onRecovery = vi.fn();
    const store = new OrbStore(EXPERIMENT_DEFAULTS, { onRecovery });
    store.activateAim();
    store.update(0, 0, player, up);
    store.update(100, 100, player, up);
    store.update(200, 100, player, up);
    store.beginProximityRecovery(0);

    store.update(250, 50, player, up);
    expect(store.getSnapshot()[0]?.state).toBe('attracting');
    store.update(300, 50, player, { x: 1, y: 0 });

    expect(onRecovery).toHaveBeenCalledOnce();
    expect(onRecovery).toHaveBeenCalledWith(0, 'proximity');
    expect(store.getSnapshot()[0]).toMatchObject({
      state: 'active',
      charges: 3,
      position: { x: player.x + ORB_PICKUP_RADIUS + 1, y: player.y },
      velocity: { x: ORB_SPEED, y: 0 },
    });
  });

  it('homes from any distance after floor recall', () => {
    const store = new OrbStore(EXPERIMENT_DEFAULTS);
    store.activateAim();
    store.update(0, 0, player, up);
    store.synchronizeActive(0, { x: 100, y: 700 }, { x: 0, y: ORB_SPEED });

    expect(store.beginFloorRecall(0)).toBe(true);
    store.update(1, 100, player, up);

    expect(store.getSnapshot()[0]).toMatchObject({
      state: 'floor-returning',
      collisionEnabled: false,
      damageEnabled: false,
    });
    expect(store.getSnapshot()[0]!.position.y).toBeLessThan(700);
  });

  it('enforces an 80ms per-orb/per-enemy hit cooldown and emits damage decisions', () => {
    const onEnemyDamage = vi.fn();
    const store = new OrbStore(EXPERIMENT_DEFAULTS, { onEnemyDamage });
    store.activateAim();
    store.update(0, 0, player, up);

    const first = store.handleEnemyHit(0, 7, 3, 1000, false);
    expect(first).toMatchObject({ damage: 1.5, reflect: true });
    expect(store.handleEnemyHit(0, 7, 3, 1079, false)).toBeNull();
    expect(store.handleEnemyHit(0, 8, 1, 1079, false)).not.toBeNull();
    expect(store.handleEnemyHit(0, 7, 1, 1080, true)).toMatchObject({ reflect: false });
    expect(onEnemyDamage).toHaveBeenCalledTimes(3);
  });

  it('uses current firepower and permanent-speed providers after the last charge', () => {
    const store = new OrbStore(
      { ...EXPERIMENT_DEFAULTS, passThroughOnKill: true },
      {},
      () => false,
      () => 0.25,
      () => 480,
    );
    store.activateAim();
    store.update(0, 0, player, { x: 3, y: 4 });

    expect(Math.hypot(
      store.getSnapshot()[0]!.velocity.x,
      store.getSnapshot()[0]!.velocity.y,
    )).toBeCloseTo(480);
    store.handleEnemyHit(0, 1, 1, 1_000, false);
    store.handleEnemyHit(0, 2, 1, 1_000, false);
    const result = store.handleEnemyHit(0, 3, 2, 1_000, false);

    expect(result).toMatchObject({ charged: true, damage: 1.875, charges: 0 });
    const after = store.getSnapshot()[0]!;
    expect(Math.hypot(after.velocity.x, after.velocity.y)).toBeCloseTo(480);
    expect(store.handleEnemyHit(0, 4, 2, 1_000, false)).toMatchObject({
      charged: false,
      damage: 1.25,
      charges: 0,
    });
  });

  it('tracks direct-hit streak, timed speed, and first-hit recovery radius per orb', () => {
    const contexts: Array<{
      consecutiveHits?: number;
      killOverclockActive?: boolean;
    }> = [];
    const store = new OrbStore(
      EXPERIMENT_DEFAULTS,
      {},
      () => true,
      () => 0,
      () => ORB_SPEED,
      () => 6,
      (context) => {
        contexts.push(context);
        return (context.consecutiveHits ?? 0) * 0.1
          + (context.killOverclockActive ? 0.2 : 0);
      },
      () => 1,
      () => 8,
      () => 50,
      (killActive, collisionActive) => 1 + Number(killActive) * 0.1
        + Number(collisionActive) * 0.1,
      (active) => Number(active) * 20,
    );
    store.activateAim();
    store.update(0, 0, player, up);

    expect(store.handleEnemyHit(0, 1, 1, 100, false)?.speedRatio).toBe(1);
    expect(Math.hypot(...Object.values(store.getSnapshot()[0]!.velocity) as [number, number]))
      .toBeCloseTo(480);
    expect(store.handleEnemyHit(0, 2, 99, 200, false)?.damage).toBeCloseTo(1.95);
    expect(contexts.at(-1)).toMatchObject({ consecutiveHits: 1, killOverclockActive: true });

    store.handleWallBounce(0);
    store.handleEnemyHit(0, 3, 99, 300, false);
    expect(contexts.at(-1)).toMatchObject({ consecutiveHits: 0 });

    store.synchronizeActive(0, { x: player.x + 65, y: player.y }, { x: 0, y: -400 });
    store.update(301, 1, player, up);
    expect(store.getSnapshot()[0]?.state).toBe('attracting');
  });

  it('keeps permanent speed when a non-reward pass-through consumes the final charge', () => {
    const store = new OrbStore(
      { ...EXPERIMENT_DEFAULTS, passThroughOnKill: true },
      {},
      () => false,
      () => 0,
      () => 480,
    );
    store.activateAim();
    store.update(0, 0, player, { x: 3, y: 4 });
    store.handleEnemyHit(0, 1, 99, 900, false);
    store.handleEnemyHit(0, 2, 99, 900, false);

    expect(store.handleEnemyHit(0, 3, 1, 1_000, false)).toMatchObject({
      charges: 0,
      reflect: false,
      preserveChargedKinetics: false,
    });
    expect(Math.hypot(
      store.getSnapshot()[0]!.velocity.x,
      store.getSnapshot()[0]!.velocity.y,
    )).toBeCloseTo(480);
  });

  it('reports each recovery once so only proximity recovery produces a two-orb salvo', () => {
    const reports: number[] = [];
    const create = (autoReturnAfterMs: number | null = null) => new OrbStore(
      { ...EXPERIMENT_DEFAULTS, autoReturnAfterMs },
      { onRecovery: (_orbId, source) => reports.push(source === 'proximity' ? 2 : 0) },
    );
    const proximity = create();
    proximity.activateAim();
    proximity.update(0, 0, player, up);
    proximity.beginProximityRecovery(0);
    proximity.update(100, 100, player, up);

    const floor = create();
    floor.activateAim();
    floor.update(0, 0, player, up);
    floor.beginFloorRecall(0);
    floor.update(1_000, 1_000, player, up);

    const timeout = create(1);
    timeout.activateAim();
    timeout.update(0, 0, player, up);
    timeout.update(1, 1, player, up);
    timeout.update(1_001, 1_000, player, up);

    expect(reports).toEqual([2, 0, 0]);
  });

  it('accepts Phaser position and reflected velocity as active-orb state', () => {
    const store = new OrbStore(EXPERIMENT_DEFAULTS);
    store.activateAim();
    store.update(0, 0, player, up);

    store.synchronizeActive(0, { x: 42, y: 84 }, { x: -300, y: 200 });

    expect(store.getSnapshot()[0]).toMatchObject({
      position: { x: 42, y: 84 },
      velocity: { x: -300, y: 200 },
    });
  });
});

describe('OrbManager Phaser adapter', () => {
  it('switches each permanent orb sprite to its configured core texture', () => {
    const { manager, sprites } = createManager();

    expect(manager.configureStartingCores(['inertia'])).toBe(true);
    expect(sprites.map((sprite) => sprite.textureKey)).toEqual(['orb-inertia']);
  });

  it('creates a runtime sprite for a newly added queued orb', () => {
    const { manager, sprites } = createManager();
    manager.activateAim();
    manager.update(0, 0, player, up);

    expect(manager.addOrb('conduction')).toBe(true);
    expect(sprites).toHaveLength(2);
    expect(manager.getSprites()).toHaveLength(2);
    expect(manager.getSnapshot()[1]).toMatchObject({ id: 1, state: 'queued' });
    expect(sprites[1]?.textureKey).toBe('orb-conduction');
  });

  it('notifies subscribers once per runtime sprite and supports unsubscribe', () => {
    const { manager, sprites } = createManager();
    const listener = vi.fn();
    const unsubscribe = manager.onOrbAdded(listener);

    expect(listener).not.toHaveBeenCalled();
    expect(manager.addOrb()).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(sprites[1]);

    unsubscribe();
    expect(manager.addOrb()).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
  });

  it('rejects addOrb after destroy without creating a sprite', () => {
    const { manager, sprites } = createManager();
    manager.destroy();

    expect(manager.addOrb()).toBe(false);
    expect(sprites).toHaveLength(1);
  });

  it('honors the live build limit before creating a runtime orb sprite', () => {
    let limit = 1;
    const { manager, sprites } = createManager(
      true,
      () => false,
      null,
      () => 0,
      () => ORB_SPEED,
      false,
      () => limit,
    );

    expect(manager.addOrb()).toBe(false);
    expect(sprites).toHaveLength(1);
    limit = 2;
    expect(manager.addOrb()).toBe(true);
    expect(sprites).toHaveLength(2);
  });

  it('launches with injected charged speed', () => {
    const { manager, sprites } = createManager(true, () => false, null, () => 0, () => 480);
    manager.activateAim();
    manager.update(0, 0, player, { x: 3, y: 4 });

    expect(Math.hypot(sprites[0]!.body.velocity.x, sprites[0]!.body.velocity.y)).toBeCloseTo(480);
  });

  it('keeps permanent build speed when a pass-through hit consumes the last charge', () => {
    const { manager, sprites } = createManager(true, () => false, null, () => 0.25, () => 480, true);
    manager.activateAim();
    manager.update(0, 0, player, { x: 3, y: 4 });

    manager.handleEnemyHit(0, 1, 1, 1_000, false);
    manager.handleEnemyHit(0, 2, 1, 1_000, false);
    const result = manager.handleEnemyHit(0, 3, 1.5, 1_000, false);

    expect(result).toMatchObject({ charged: true, damage: 1.875, charges: 0, reflect: false });
    const after = manager.getSnapshot()[0]!;
    expect(Math.hypot(after.velocity.x, after.velocity.y)).toBeCloseTo(480);
    expect(Math.hypot(sprites[0]!.body.velocity.x, sprites[0]!.body.velocity.y)).toBeCloseTo(480);
  });

  it('normalizes a reflected body to permanent build speed after the last charge', () => {
    const { manager, sprites } = createManager(true, () => false, null, () => 0, () => 480, true);
    manager.activateAim();
    manager.update(0, 0, player, up);
    manager.handleEnemyHit(0, 1, 1, 1_000, false);
    manager.handleEnemyHit(0, 2, 1, 1_000, false);

    const result = manager.handleEnemyHit(0, 3, 3, 1_000, false);
    expect(result).toMatchObject({ charged: true, charges: 0, reflect: true });
    sprites[0]!.body.setVelocity(-288, 384);
    expect(manager.synchronizeOrb(sprites[0] as unknown as Phaser.Physics.Arcade.Sprite & { orbId: number })).toBe(true);

    const after = manager.getSnapshot()[0]!;
    expect(Math.hypot(after.velocity.x, after.velocity.y)).toBeCloseTo(480);
    expect(after.velocity.x).toBeLessThan(0);
    expect(after.velocity.y).toBeGreaterThan(0);
    expect(Math.hypot(sprites[0]!.body.velocity.x, sprites[0]!.body.velocity.y)).toBeCloseTo(480);
  });

  it('refreshes active charged bodies to the current speed without changing direction', () => {
    let chargedSpeed = 400;
    const { manager, sprites } = createManager(true, () => false, null, () => 0, () => chargedSpeed);
    manager.activateAim();
    manager.update(0, 0, player, { x: 3, y: 4 });
    const before = { ...sprites[0]!.body.velocity };

    chargedSpeed = 480;
    manager.refreshCombatModifiers();

    const after = manager.getSnapshot()[0]!;
    expect(Math.hypot(after.velocity.x, after.velocity.y)).toBeCloseTo(480);
    expect(after.velocity.x / after.velocity.y).toBeCloseTo(before.x / before.y);
    expect(sprites[0]!.body.velocity).toEqual(after.velocity);
  });

  it('places only an active owned orb while retaining its velocity', () => {
    const { manager, sprites } = createManager();
    manager.activateAim();
    manager.update(0, 0, player, up);
    const sprite = sprites[0]!;
    sprite.body.setVelocity(40, -300);

    expect(manager.debugPlaceOrb!(0, { x: 42, y: 84 })).toBe(true);
    expect(manager.getSnapshot()[0]).toMatchObject({
      state: 'active',
      position: { x: 42, y: 84 },
      velocity: { x: 40, y: -300 },
    });
    expect(sprite.body.center).toEqual({ x: 42, y: 84 });
    expect(manager.debugPlaceOrb!(1, { x: 1, y: 2 })).toBe(false);
  });

  it('positions a launch once but leaves an enabled active sprite for Body.postUpdate', () => {
    const { manager, sprites } = createManager();
    manager.activateAim();
    manager.update(0, 0, player, up);
    const sprite = sprites[0]!;
    const callsAfterLaunch = sprite.setPositionCalls;

    expect({ x: sprite.x, y: sprite.y }).toEqual({ x: 100, y: player.y - ORB_PICKUP_RADIUS - 1 });
    expect(sprite.body.enable).toBe(true);

    // World.update has advanced the authoritative body, while the sprite still
    // awaits Body.postUpdate. Writing the body center into the sprite here would
    // make Body.postUpdate add the same movement a second time.
    sprite.body.center = { x: 112, y: 146 };
    sprite.body.setVelocity(40, -300);
    manager.update(1, 1, player, up);

    expect(manager.getSnapshot()[0]).toMatchObject({
      position: { x: 112, y: 146 },
      velocity: { x: 40, y: -300 },
    });
    expect(sprite.setPositionCalls).toBe(callsAfterLaunch);
    expect({ x: sprite.x, y: sprite.y }).toEqual({ x: 100, y: player.y - ORB_PICKUP_RADIUS - 1 });
  });

  it('owns bottom world-bound recall and disables the body immediately from the exact contact position', () => {
    const { manager, sprites, world } = createManager();
    manager.activateAim();
    manager.update(0, 0, player, up);
    const sprite = sprites[0]!;
    expect(sprite.body.onWorldBounds).toBe(true);
    sprite.setPosition(47, 700);
    sprite.body.center = { x: 47, y: 798 };
    sprite.body.setVelocity(20, 400);

    world.emit(sprite.body, true);

    expect(manager.getSnapshot()[0]).toMatchObject({
      state: 'floor-returning',
      position: { x: 47, y: 798 },
      damageEnabled: false,
      collisionEnabled: false,
    });
    expect(sprite.body.enable).toBe(false);
  });

  it('retains bottom bounce when floor recall is disabled', () => {
    const { manager, sprites, world } = createManager(false);
    manager.activateAim();
    manager.update(0, 0, player, up);
    const sprite = sprites[0]!;

    world.emit(sprite.body, true);

    expect(manager.getSnapshot()[0]?.state).toBe('active');
    expect(sprite.body.enable).toBe(true);
  });

  it('synchronizes public recovery starts and applies body state immediately', () => {
    const { manager, sprites } = createManager();
    manager.addOrb();
    manager.activateAim();
    manager.update(0, 0, player, up);
    manager.update(100, 100, player, up);
    const sprite = sprites[0]!;
    sprite.setPosition(61, 222);
    sprite.body.setVelocity(-30, 90);

    expect(manager.beginProximityRecovery(sprite as unknown as Phaser.Physics.Arcade.Sprite & { orbId: number })).toBe(true);

    expect(manager.getSnapshot()[0]).toMatchObject({ state: 'attracting', position: { x: 61, y: 222 } });
    expect(sprite.body.enable).toBe(false);

    const second = sprites[1]!;
    second.setPosition(77, 798);
    expect(manager.beginFloorRecall(1)).toBe(true);
    expect(manager.getSnapshot()[1]).toMatchObject({ state: 'floor-returning', position: { x: 77, y: 798 } });
    expect(second.body.enable).toBe(false);
  });

  it('preserves reflected Phaser velocity during update', () => {
    const { manager, sprites } = createManager();
    manager.activateAim();
    manager.update(0, 0, player, up);
    const sprite = sprites[0]!;
    sprite.setPosition(88, 99);
    sprite.body.center = { x: 88, y: 99 };
    sprite.body.setVelocity(-222, 123);

    manager.update(1, 1, player, up);

    expect(manager.getSnapshot()[0]).toMatchObject({
      position: { x: 88, y: 99 },
      velocity: { x: -222, y: 123 },
    });
  });

  it('synchronizes reflected body velocity immediately after an Arcade collision', () => {
    const { manager, sprites } = createManager();
    manager.activateAim();
    manager.update(0, 0, player, up);
    const sprite = sprites[0]!;
    sprite.body.center = { x: 88, y: 99 };
    sprite.body.setVelocity(20, 300);

    expect(manager.synchronizeOrb(sprite as unknown as Phaser.Physics.Arcade.Sprite & { orbId: number })).toBe(true);
    const after = manager.getSnapshot()[0]!;
    expect(after.position).toEqual({ x: 88, y: 99 });
    expect(Math.hypot(after.velocity.x, after.velocity.y)).toBeCloseTo(400);
    expect(after.velocity.x / after.velocity.y).toBeCloseTo(20 / 300);
  });

  it('uses private sprite identity instead of mutable orbId during update ingestion', () => {
    const { manager, sprites } = createManager();
    manager.addOrb();
    manager.activateAim();
    manager.update(0, 0, player, up);
    manager.update(100, 100, player, up);
    const first = sprites[0]!;
    const second = sprites[1]!;
    first.setPosition(11, 22);
    first.body.center = { x: 11, y: 22 };
    first.body.setVelocity(33, 44);
    second.setPosition(55, 66);
    second.body.center = { x: 55, y: 66 };
    second.body.setVelocity(77, 88);
    second.orbId = 0;

    manager.update(101, 1, player, up);

    expect(manager.getSnapshot()[0]).toMatchObject({ position: { x: 11, y: 22 }, velocity: { x: 33, y: 44 } });
    expect(manager.getSnapshot()[1]).toMatchObject({ position: { x: 55, y: 66 }, velocity: { x: 77, y: 88 } });
  });

  it('uses current body center so stale sprite coordinates do not trigger proximity recovery', () => {
    const { manager, sprites } = createManager(true, () => true);
    manager.activateAim();
    manager.update(0, 0, player, up);
    const sprite = sprites[0]!;
    sprite.setPosition(100, 170);
    sprite.body.center = { x: 300, y: 400 };
    sprite.body.setVelocity(-222, 123);
    sprite.orbId = 2;

    manager.update(1, 1, player, up);

    expect(manager.getSnapshot()[0]).toMatchObject({
      state: 'active',
      position: { x: 300, y: 400 },
      velocity: { x: -222, y: 123 },
    });
  });

  it('starts timeout return from current body center instead of stale sprite coordinates', () => {
    const { manager, sprites } = createManager(true, () => false, 1);
    manager.activateAim();
    manager.update(0, 0, player, up);
    const sprite = sprites[0]!;
    sprite.setPosition(100, 170);
    sprite.body.center = { x: 320, y: 500 };
    sprite.body.setVelocity(40, -300);
    sprite.orbId = 2;

    manager.update(1, 1, player, up);

    expect(manager.getSnapshot()[0]).toMatchObject({
      state: 'timeout-returning',
      position: { x: 320, y: 500 },
      lastRecoverySource: 'timeoutRecall',
    });
  });

  it('ignores foreign and malformed physics objects without mutation or exceptions', () => {
    const { manager, sprites, world } = createManager();
    manager.activateAim();
    manager.update(0, 0, player, up);
    const before = manager.getSnapshot();
    const foreign = new FakeSprite();
    foreign.orbId = 0;

    expect(() => world.emit(foreign.body, true)).not.toThrow();
    expect(() => world.emit(new FakeBody({ orbId: 0 }), true)).not.toThrow();
    expect(manager.beginFloorRecall(foreign as unknown as Phaser.Physics.Arcade.Sprite & { orbId: number })).toBe(false);
    expect(manager.beginFloorRecall(999)).toBe(false);
    expect(manager.handleEnemyHit(foreign as unknown as Phaser.Physics.Arcade.Sprite & { orbId: number }, 1, 3, 1, false)).toBeNull();
    expect(manager.getSnapshot()).toEqual(before);
    expect(sprites[0]!.body.enable).toBe(true);
  });

  it('removes the worldbounds listener and destroys owned sprites', () => {
    const { manager, sprites, world } = createManager();
    expect(world.listenerCount()).toBe(1);

    manager.destroy();

    expect(world.listenerCount()).toBe(0);
    expect(sprites.every((sprite) => sprite.destroyed)).toBe(true);
  });
});
