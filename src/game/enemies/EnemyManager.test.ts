import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import { GAME_HEIGHT, PLAYER_MIN_Y, PLAYER_RADIUS } from '../constants';
import type { OrbManager } from '../orbs/OrbManager';
import type { TemporaryOrbManager } from '../orbs/TemporaryOrbManager';
import { EnemyManager } from './EnemyManager';
import type { EnemySpec } from './enemyRules';

type Callback = (...args: FakeSprite[]) => void;
type ProcessCallback = (...args: FakeSprite[]) => boolean;

class FakeTimer {
  removed = false;

  constructor(
    readonly delay: number,
    readonly loop: boolean,
    readonly callback: () => void,
    public dueAt: number,
  ) {}

  remove(): void {
    this.removed = true;
  }
}

class FakeTime {
  now = 0;
  readonly timers: FakeTimer[] = [];

  addEvent(config: { delay: number; loop: boolean; callback: () => void }): FakeTimer {
    const timer = new FakeTimer(config.delay, config.loop, config.callback, this.now + config.delay);
    this.timers.push(timer);
    return timer;
  }

  delayedCall(delay: number, callback: () => void): FakeTimer {
    const timer = new FakeTimer(delay, false, callback, this.now + delay);
    this.timers.push(timer);
    return timer;
  }

  advance(delta: number): void {
    const target = this.now + delta;
    while (true) {
      const next = this.timers
        .filter((timer) => !timer.removed && timer.dueAt <= target)
        .sort((left, right) => left.dueAt - right.dueAt)[0];
      if (!next) break;
      this.now = next.dueAt;
      if (next.loop) next.dueAt += next.delay;
      else next.removed = true;
      next.callback();
    }
    this.now = target;
  }

  activeCount(): number {
    return this.timers.filter((timer) => !timer.removed).length;
  }
}

class FakeBody {
  velocity = { x: 0, y: 0 };
  center = { x: 0, y: 0 };
  enable = true;

  constructor(readonly gameObject: FakeSprite) {}

  setVelocity(x: number, y: number): this {
    this.velocity = { x, y };
    return this;
  }

  reset(x: number, y: number): void {
    this.center = { x, y };
    this.velocity = { x: 0, y: 0 };
  }
}

class FakeSprite {
  x: number;
  y: number;
  active = true;
  destroyed = false;
  tint?: number;
  hp = 0;
  readonly body = new FakeBody(this);

  constructor(x: number, y: number, readonly texture: string) {
    this.x = x;
    this.y = y;
  }

  setVelocity(x: number, y: number): this {
    this.body.setVelocity(x, y);
    return this;
  }

  setVelocityY(y: number): this {
    this.body.velocity.y = y;
    return this;
  }

  setImmovable(): this { return this; }
  setCircle(): this { return this; }
  setTint(tint: number): this { this.tint = tint; return this; }
  clearTint(): this { this.tint = undefined; return this; }
  setPosition(x: number, y: number): this { this.x = x; this.y = y; return this; }

  destroy(): void {
    this.active = false;
    this.destroyed = true;
    this.body.enable = false;
  }
}

class FakeGroup {
  readonly children: FakeSprite[] = [];
  destroyed = false;

  create(x: number, y: number, texture: string): FakeSprite {
    const sprite = new FakeSprite(x, y, texture);
    this.children.push(sprite);
    return sprite;
  }

  getChildren(): FakeSprite[] {
    return this.children;
  }

  destroy(destroyChildren: boolean): void {
    this.destroyed = true;
    if (destroyChildren) this.children.forEach((child) => child.destroy());
  }
}

class FakeCollider {
  destroyed = false;

  constructor(
    readonly first: unknown,
    readonly second: unknown,
    private readonly callback?: Callback,
    private readonly process?: ProcessCallback,
  ) {}

  trigger(first: FakeSprite, second: FakeSprite): boolean {
    const accepted = this.process?.(first, second) ?? true;
    if (!accepted) return false;
    // Model a vertical face: reverse normal x, preserve tangential y.
    first.body.velocity.x *= -1;
    this.callback?.(first, second);
    return true;
  }

  destroy(): void {
    this.destroyed = true;
  }
}

function createBoundary(formation?: readonly EnemySpec[], withTemporaryOrbs = false) {
  const groups: FakeGroup[] = [];
  const colliders: FakeCollider[] = [];
  const overlaps: FakeCollider[] = [];
  const time = new FakeTime();
  const gameplayClock = { now: 0 };
  const physics = {
    add: {
      group: () => {
        const group = new FakeGroup();
        groups.push(group);
        return group;
      },
      collider: (first: unknown, second: unknown, callback?: Callback, process?: ProcessCallback) => {
        const collider = new FakeCollider(first, second, callback, process);
        colliders.push(collider);
        return collider;
      },
      overlap: (first: unknown, second: unknown, callback?: Callback) => {
        const overlap = new FakeCollider(first, second, callback);
        overlaps.push(overlap);
        return overlap;
      },
    },
  };
  const scene = { physics, time } as unknown as Phaser.Scene;
  const player = new FakeSprite(225, 690, 'player');
  const orb = new FakeSprite(120, 120, 'orb');
  (orb as FakeSprite & { orbId: number }).orbId = 0;
  const handleEnemyHit = vi.fn();
  const orbManager = {
    getSprites: () => [orb],
    handleEnemyHit,
    synchronizeOrb: vi.fn(),
  } as unknown as OrbManager;
  const temporaryOrb = new FakeSprite(140, 140, 'orb-temporary');
  (temporaryOrb as FakeSprite & { temporaryOrbId: number }).temporaryOrbId = 7;
  const temporaryGroup = new FakeGroup();
  temporaryGroup.children.push(temporaryOrb);
  const handleTemporaryEnemyHit = vi.fn();
  const temporaryOrbManager = withTemporaryOrbs ? {
    getGroup: () => temporaryGroup,
    handleEnemyHit: handleTemporaryEnemyHit,
    synchronizeOrb: vi.fn(),
  } as unknown as TemporaryOrbManager : undefined;
  const onContact = vi.fn();
  const onBreach = vi.fn();
  const onBulletHit = vi.fn();
  const onEnemyKilled = vi.fn();
  const onDirectHit = vi.fn();
  const manager = new EnemyManager(scene, {
    player: player as unknown as Phaser.Physics.Arcade.Sprite,
    orbManager,
    temporaryOrbManager,
    getGameplayElapsedMs: () => gameplayClock.now,
    onContact,
    onBreach,
    onBulletHit,
    onEnemyKilled,
    onDirectHit,
    formation,
  });
  return {
    manager,
    player,
    orb,
    handleEnemyHit,
    handleTemporaryEnemyHit,
    temporaryOrbManager,
    temporaryOrb,
    onContact,
    onBreach,
    onBulletHit,
    onEnemyKilled,
    onDirectHit,
    groups,
    colliders,
    overlaps,
    time,
    gameplayClock,
  };
}

describe('EnemyManager', () => {
  it('freezes enemy descent without pausing shooter timers', () => {
    const { manager, groups, time } = createBoundary();

    manager.debugFreezeEnemies!();

    expect(groups[0]!.children.every((enemy) => enemy.body.velocity.y === 0)).toBe(true);
    time.advance(1300);
    expect(manager.getSnapshot().activeShooters).toBe(2);
  });

  it('creates the fixed formation with stable IDs and descent velocities', () => {
    const { manager, groups } = createBoundary();
    const snapshot = manager.getSnapshot();

    expect(snapshot.enemies).toHaveLength(20);
    expect(snapshot.enemies.map((enemy) => enemy.id)).toEqual([...Array(20).keys()]);
    expect(groups[0]!.children.every((enemy) => enemy.body.velocity.y === 18)).toBe(true);
  });

  it('appends formations with monotonic IDs and reports topmost position', () => {
    const { manager, colliders } = createBoundary();
    const colliderCount = colliders.length;
    manager.spawnFormation([
      { kind: 'basic', hp: 1, x: 90, y: -28, column: 1, speed: 22 },
      { kind: 'shooter', hp: 1, x: 144, y: 14, column: 2, speed: 22 },
    ]);

    const snapshot = manager.getSnapshot();
    expect(snapshot.enemies).toHaveLength(22);
    expect(snapshot.enemies.slice(-2).map((enemy) => enemy.id)).toEqual([20, 21]);
    expect(snapshot.topmostEnemyY).toBe(-28);
    expect(colliders).toHaveLength(colliderCount);
  });

  it('debug-removes selected enemies without reusing IDs', () => {
    const { manager } = createBoundary();
    manager.debugRemoveEnemies!([0, 3, 7, 11]);
    expect(manager.getSnapshot().enemies).toHaveLength(16);

    manager.spawnFormation([
      { kind: 'basic', hp: 1, x: 90, y: -28, column: 1, speed: 22 },
    ]);
    expect(manager.getSnapshot().enemies.at(-1)?.id).toBe(20);
  });

  it('debug-sets exactly one active enemy with valid position and HP', () => {
    const { manager, groups } = createBoundary();
    const before = manager.getSnapshot().enemies[1];
    const target = groups[0]!.children[0]!;
    const velocity = { ...target.body.velocity };

    expect(manager.debugSetEnemy!(0, { x: 100, y: 110 }, 2.5)).toBe(true);
    expect(manager.getSnapshot().enemies[0]).toMatchObject({
      id: 0,
      hp: 2.5,
      position: { x: 100, y: 110 },
    });
    expect(manager.getSnapshot().enemies[1]).toEqual(before);
    expect(target.body.center).toEqual({ x: 100, y: 110 });
    expect(target.body.velocity).toEqual(velocity);
    expect(manager.debugSetEnemy!(999, { x: 0, y: 0 }, 1)).toBe(false);
    expect(() => manager.debugSetEnemy!(0, { x: Number.NaN, y: 0 }, 1)).toThrow(RangeError);
    expect(() => manager.debugSetEnemy!(0, { x: 0, y: Number.POSITIVE_INFINITY }, 1)).toThrow(RangeError);
    expect(() => manager.debugSetEnemy!(0, { x: 0, y: 0 }, 0)).toThrow(RangeError);
    expect(() => manager.debugSetEnemy!(0, { x: 0, y: 0 }, -1)).toThrow(RangeError);
    expect(() => manager.debugSetEnemy!(0, { x: 0, y: 0 }, Number.NaN)).toThrow(RangeError);
    expect(() => manager.debugSetEnemy!(0, { x: 0, y: 0 }, Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it('reports an infinite topmost position after debug-removing every enemy', () => {
    const { manager } = createBoundary();
    manager.debugRemoveEnemies!(manager.getSnapshot().enemies.map((enemy) => enemy.id));

    expect(manager.getSnapshot()).toMatchObject({
      enemies: [],
      topmostEnemyY: Number.POSITIVE_INFINITY,
    });
    expect((manager as unknown as { enemies: Map<number, unknown> }).enemies.size).toBe(0);
  });

  it('removes breaches and reports their kind once without reporting a kill', () => {
    const { manager, groups, onBreach, onEnemyKilled } = createBoundary();
    const armored = groups[0]!.children[1]!;
    armored.y = GAME_HEIGHT - PLAYER_RADIUS;

    manager.update();
    manager.update();

    expect(armored.destroyed).toBe(true);
    expect(onBreach).toHaveBeenCalledOnce();
    expect(onBreach).toHaveBeenCalledWith('armored');
    expect(onEnemyKilled).not.toHaveBeenCalled();
  });

  it('warns at most two shooters, aims after 350ms, and caps bullets at twelve', () => {
    const { manager, player, groups, time } = createBoundary();

    time.advance(1300);
    expect(manager.getSnapshot().activeShooters).toBe(2);
    expect(groups[0]!.children.filter((enemy) => enemy.tint !== undefined)).toHaveLength(2);
    time.advance(349);
    expect(manager.getSnapshot().bullets).toBe(0);
    player.setPosition(300, 700);
    time.advance(1);
    expect(manager.getSnapshot()).toMatchObject({ activeShooters: 0, bullets: 2 });
    const firstBullet = groups[1]!.children[0]!;
    const firstShooter = groups[0]!.children.find(
      (enemy) => enemy.x === firstBullet.x && enemy.y === firstBullet.y,
    )!;
    expect(Math.sign(firstBullet.body.velocity.x)).toBe(Math.sign(player.x - firstShooter.x));
    expect(Math.hypot(
      groups[1]!.children[0]!.body.velocity.x,
      groups[1]!.children[0]!.body.velocity.y,
    )).toBeCloseTo(180);

    for (let cycle = 0; cycle < 6; cycle += 1) time.advance(1650);
    expect(manager.getSnapshot().bullets).toBe(12);
  });

  it('cleans bullets outside bounds', () => {
    const { manager, groups, time } = createBoundary();
    time.advance(1650);
    const bullet = groups[1]!.children[0]!;
    bullet.y = GAME_HEIGHT + 17;

    manager.update();

    expect(bullet.destroyed).toBe(true);
    expect(manager.getSnapshot().bullets).toBe(1);
  });

  it('applies each accepted orb hit once and honors pass-through versus reflection', () => {
    const { manager, orb, handleEnemyHit, groups, colliders } = createBoundary();
    const enemy = groups[0]!.children[0]!;
    const orbCollider = colliders[0]!;
    orb.setVelocity(50, -100);
    handleEnemyHit.mockReturnValueOnce({ charged: true, charges: 2, damage: 1.5, reflect: false });

    expect(orbCollider.trigger(orb, enemy)).toBe(false);
    expect(handleEnemyHit).toHaveBeenCalledOnce();
    expect(orb.body.velocity).toEqual({ x: 50, y: -100 });
    expect(enemy.destroyed).toBe(true);

    const reflectedEnemy = groups[0]!.children[2]!;
    handleEnemyHit.mockReturnValueOnce({ charged: true, charges: 1, damage: 1, reflect: true });
    expect(orbCollider.trigger(orb, reflectedEnemy)).toBe(true);
    expect(handleEnemyHit).toHaveBeenCalledTimes(2);
    expect(orb.body.velocity).toEqual({ x: -50, y: -100 });
    expect(reflectedEnemy.destroyed).toBe(true);
  });

  it('reports one direct hit and one kill with captured enemy data', () => {
    const { orb, handleEnemyHit, groups, colliders, onDirectHit, onEnemyKilled } = createBoundary();
    const enemy = groups[0]!.children[0]!;
    handleEnemyHit.mockReturnValueOnce({ charged: true, charges: 0, damage: 1.5, reflect: false });

    colliders[0]!.trigger(orb, enemy);

    expect(onDirectHit).toHaveBeenCalledOnce();
    expect(onDirectHit).toHaveBeenCalledWith(expect.objectContaining({
      source: 'permanent',
      enemyId: 0,
      charged: true,
      position: { x: 36, y: 80 },
      direction: { x: 0, y: -1 },
    }));
    expect(onEnemyKilled).toHaveBeenCalledOnce();
    expect(onEnemyKilled).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'basic',
      enemyId: 0,
      position: { x: 36, y: 80 },
    }));
  });

  it('applies reflected temporary hits once with a prefixed pending key and uncharged event', () => {
    const {
      manager,
      groups,
      colliders,
      temporaryOrb,
      handleTemporaryEnemyHit,
      temporaryOrbManager,
      onDirectHit,
      time,
      gameplayClock,
    } = createBoundary(undefined, true);
    const enemy = groups[0]!.children[0]!;
    temporaryOrb.setVelocity(30, -40);
    time.now = 10_000;
    gameplayClock.now = 123;
    handleTemporaryEnemyHit.mockReturnValueOnce({
      charged: false,
      charges: 0,
      damage: 0.5,
      killed: false,
      reflect: true,
    });

    expect(colliders[1]!.trigger(temporaryOrb, enemy)).toBe(true);

    expect(handleTemporaryEnemyHit).toHaveBeenCalledWith(temporaryOrb, 0, 1, 123);
    expect(temporaryOrbManager!.synchronizeOrb).toHaveBeenCalledWith(temporaryOrb);
    expect(enemy.hp).toBe(0.5);
    expect(onDirectHit).toHaveBeenCalledWith({
      source: 'temporary',
      enemyId: 0,
      position: { x: 36, y: 80 },
      charged: false,
      direction: { x: 0.6, y: -0.8 },
    });
    expect((manager as unknown as { pendingReflections: Map<string, unknown> }).pendingReflections.size).toBe(0);
  });

  it('applies area damage once to nearby non-primary enemies and reports each kill without direct hits', () => {
    const formation: EnemySpec[] = [
      { kind: 'basic', hp: 2, x: 100, y: 100, column: 0, speed: 0 },
      { kind: 'basic', hp: 1, x: 130, y: 100, column: 1, speed: 0 },
      { kind: 'armored', hp: 0.5, x: 140, y: 100, column: 2, speed: 0 },
      { kind: 'basic', hp: 3, x: 100, y: 150, column: 3, speed: 0 },
      { kind: 'basic', hp: 3, x: 151, y: 100, column: 4, speed: 0 },
    ];
    const { manager, onDirectHit, onEnemyKilled } = createBoundary(formation);

    expect(manager.applyAreaDamage({ x: 100, y: 100 }, 50, 1, 0)).toEqual([1, 2]);

    expect(manager.getSnapshot().enemies).toEqual([
      expect.objectContaining({ id: 0, hp: 2 }),
      expect.objectContaining({ id: 3, hp: 2 }),
      expect.objectContaining({ id: 4, hp: 3 }),
    ]);
    expect(onDirectHit).not.toHaveBeenCalled();
    expect(onEnemyKilled).toHaveBeenCalledTimes(2);
    expect(onEnemyKilled).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ enemyId: 1, kind: 'basic' }),
    );
    expect(onEnemyKilled).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ enemyId: 2, kind: 'armored' }),
    );
  });

  it('clears warning state if a shooter dies before firing', () => {
    const { manager, handleEnemyHit, groups, colliders, time } = createBoundary();
    time.advance(1300);
    const warningShooter = groups[0]!.children.find((enemy) => enemy.tint !== undefined)!;
    handleEnemyHit.mockReturnValueOnce({ charged: true, charges: 2, damage: 1.5, reflect: false });

    colliders[0]!.trigger(new FakeSprite(0, 0, 'orb'), warningShooter);
    time.advance(350);

    expect(manager.getSnapshot().activeShooters).toBe(0);
    expect(manager.getSnapshot().bullets).toBe(1);
  });

  it('reports contact and bullet hits while separating contact safely', () => {
    const { player, groups, overlaps, onContact, onBulletHit, time } = createBoundary();
    const enemy = groups[0]!.children[0]!;
    enemy.setPosition(player.x, player.y - 1);
    overlaps[0]!.trigger(player, enemy);
    expect(onContact).toHaveBeenCalledWith(1);
    expect(player.y).toBeGreaterThan(690);

    time.advance(1650);
    const bullet = groups[1]!.children[0]!;
    overlaps[1]!.trigger(player, bullet);
    expect(bullet.destroyed).toBe(true);
    expect(onBulletHit).toHaveBeenCalledWith(1);
  });

  it('never separates contact above the player movement area', () => {
    const { player, groups, overlaps } = createBoundary();
    player.setPosition(225, PLAYER_MIN_Y + 1);
    groups[0]!.children[0]!.setPosition(225, PLAYER_MIN_Y + 2);

    overlaps[0]!.trigger(player, groups[0]!.children[0]!);

    expect(player.y).toBe(PLAYER_MIN_Y);
  });

  it('destroys owned objects, colliders, listeners, and timers', () => {
    const { manager, groups, colliders, overlaps, time } = createBoundary();
    time.advance(1300);

    manager.destroy();

    expect(groups.every((group) => group.destroyed)).toBe(true);
    expect([...colliders, ...overlaps].every((collider) => collider.destroyed)).toBe(true);
    expect(time.activeCount()).toBe(0);
    expect(manager.getSnapshot()).toEqual({
      enemies: [],
      topmostEnemyY: Number.POSITIVE_INFINITY,
      activeShooters: 0,
      bullets: 0,
    });
  });
});
