import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import { GAME_TUNING } from '../config/gameTuning';
import { TemporaryOrbManager } from './TemporaryOrbManager';

class FakeBody {
  velocity = { x: 0, y: 0 };
  center = { x: 0, y: 0 };
  enable = true;

  constructor(readonly gameObject: FakeSprite) {}

  setVelocity(x: number, y: number): this {
    this.velocity = { x, y };
    return this;
  }

  reset(x: number, y: number): this {
    this.center = { x, y };
    return this;
  }
}

class FakeSprite {
  active = true;
  destroyed = false;
  circle?: number;
  bounce?: [number, number];
  collideWorldBounds = false;
  readonly body = new FakeBody(this);

  constructor(public x: number, public y: number, readonly texture: string) {
    this.body.center = { x, y };
  }

  setCircle(radius: number): this { this.circle = radius; return this; }
  setBounce(x: number, y: number): this { this.bounce = [x, y]; return this; }
  setCollideWorldBounds(value: boolean): this { this.collideWorldBounds = value; return this; }
  setVelocity(x: number, y: number): this { this.body.setVelocity(x, y); return this; }
  setPosition(x: number, y: number): this {
    this.x = x;
    this.y = y;
    this.body.center = { x, y };
    return this;
  }

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

  destroy(destroyChildren: boolean): void {
    this.destroyed = true;
    if (destroyChildren) this.children.forEach((child) => child.destroy());
  }
}

function createManager(
  getDirectDamageBonus = () => 0,
  getGameplayElapsedMs?: () => number,
) {
  const group = new FakeGroup();
  const scene = {
    time: { now: 0 },
    physics: { add: { group: () => group } },
  } as unknown as Phaser.Scene;
  return {
    manager: new TemporaryOrbManager(scene, {
      getDirectDamageBonus,
      getGameplayElapsedMs: getGameplayElapsedMs ?? (() => 0),
    }),
    group,
    scene,
  };
}

function angleDegrees(sprite: FakeSprite): number {
  return Math.round(Math.atan2(sprite.body.velocity.y, sprite.body.velocity.x) * 180 / Math.PI);
}

describe('TemporaryOrbManager', () => {
  it('positions an active temporary orb through the validated development helper', () => {
    const { manager, group } = createManager();
    manager.spawn({ x: 10, y: 20 }, { x: 1, y: 0 }, 1);
    const orb = manager.getSnapshot()[0]!;
    const velocity = { ...group.children[0]!.body.velocity };

    expect(manager.debugPlaceOrb?.(orb.id, { x: 70, y: 80 })).toBe(true);
    expect(manager.getSnapshot()[0]).toMatchObject({
      position: { x: 70, y: 80 },
      velocity,
    });
    expect(group.children[0]).toMatchObject({
      x: 70,
      y: 80,
      body: { center: { x: 70, y: 80 }, velocity },
    });
    expect(manager.debugPlaceOrb?.(999, { x: 0, y: 0 })).toBe(false);
    expect(() => manager.debugPlaceOrb?.(-1, { x: 0, y: 0 })).toThrow(
      new RangeError('temporary orb ID must be a non-negative integer'),
    );
    expect(() => manager.debugPlaceOrb?.(orb.id, { x: Number.NaN, y: 0 })).toThrow(
      new RangeError('temporary orb position must be finite'),
    );
  });

  it('uses exact split angles and speed for one, two, and three-orb spawns', () => {
    const { manager, group, scene } = createManager();

    expect(manager.spawn({ x: 10, y: 20 }, { x: 1, y: 0 }, 1)).toBe(1);
    expect(angleDegrees(group.children[0]!)).toBe(25);
    expect(manager.spawn({ x: 10, y: 20 }, { x: 1, y: 0 }, 1)).toBe(1);
    expect(angleDegrees(group.children[1]!)).toBe(-25);
    expect(manager.spawn({ x: 10, y: 20 }, { x: 1, y: 0 }, 2)).toBe(2);
    expect(group.children.slice(2, 4).map(angleDegrees)).toEqual([-25, 25]);
    expect(manager.spawn({ x: 10, y: 20 }, { x: 1, y: 0 }, 3)).toBe(3);
    expect(group.children.slice(4, 7).map(angleDegrees)).toEqual([-30, 0, 30]);

    expect(group.children.every((sprite) => Math.hypot(
      sprite.body.velocity.x,
      sprite.body.velocity.y,
    ) === GAME_TUNING.temporaryOrbs.speed)).toBe(true);
    expect(group.children.every((sprite) => (
      sprite.x === 10
      && sprite.y === 20
      && sprite.texture === 'orb-temporary'
      && sprite.circle === GAME_TUNING.temporaryOrbs.radius
      && sprite.bounce?.[0] === 1
      && sprite.bounce[1] === 1
      && sprite.collideWorldBounds
    ))).toBe(true);
    expect(manager.getSnapshot().every((orb) => (
      orb.expiresAt === scene.time.now + GAME_TUNING.temporaryOrbs.lifetimeMs
    ))).toBe(true);
  });

  it('caps at its tuning without evicting active records and keeps IDs monotonic', () => {
    const { manager } = createManager();

    for (let index = 0; index < 4; index += 1) expect(manager.spawn({ x: index, y: 0 }, { x: 0, y: -1 }, 3)).toBe(3);
    const before = manager.getSnapshot();
    expect(manager.spawn({ x: 99, y: 99 }, { x: 0, y: -1 }, 3)).toBe(0);
    expect(manager.getSnapshot()).toEqual(before);

    manager.update(GAME_TUNING.temporaryOrbs.lifetimeMs);
    expect(manager.spawn({ x: 1, y: 2 }, { x: 0, y: -1 }, 1)).toBe(1);
    expect(manager.getSnapshot()[0]!.id).toBe(12);
  });

  it('advances the rank-one angle trigger when a full cap blocks spawning', () => {
    const { manager, group } = createManager();
    for (let index = 0; index < 4; index += 1) {
      manager.spawn({ x: index, y: 0 }, { x: 1, y: 0 }, 3);
    }

    expect(manager.spawn({ x: 99, y: 99 }, { x: 1, y: 0 }, 1)).toBe(0);
    manager.update(GAME_TUNING.temporaryOrbs.lifetimeMs);
    expect(manager.spawn({ x: 0, y: 0 }, { x: 1, y: 0 }, 1)).toBe(1);
    expect(angleDegrees(group.children.at(-1)!)).toBe(-25);
  });

  it('expires and destroys temporary orbs exactly at its configured lifetime', () => {
    const { manager, group } = createManager();
    manager.spawn({ x: 0, y: 0 }, { x: 0, y: -1 }, 2);

    manager.update(GAME_TUNING.temporaryOrbs.lifetimeMs - 1);
    expect(manager.getSnapshot()).toHaveLength(2);
    expect(group.children.every((sprite) => sprite.active)).toBe(true);
    manager.update(GAME_TUNING.temporaryOrbs.lifetimeMs);
    expect(manager.getSnapshot()).toEqual([]);
    expect(group.children.every((sprite) => sprite.destroyed)).toBe(true);
  });

  it('bases spawn lifetime on gameplay elapsed time instead of Phaser clock time', () => {
    let gameplayElapsedMs = 100;
    const { manager, scene } = createManager(() => 0, () => gameplayElapsedMs);
    scene.time.now = 10_000;

    manager.spawn({ x: 0, y: 0 }, { x: 0, y: -1 }, 1);
    expect(manager.getSnapshot()[0]!.expiresAt).toBe(1600);
    gameplayElapsedMs = 1599;
    manager.update(gameplayElapsedMs);
    expect(manager.getSnapshot()).toHaveLength(1);
    gameplayElapsedMs = 1600;
    manager.update(gameplayElapsedMs);
    expect(manager.getSnapshot()).toEqual([]);
  });

  it('applies temporary damage and rejects a repeated enemy hit before its configured cooldown', () => {
    const { manager, group } = createManager(() => 1.25);
    manager.spawn({ x: 0, y: 0 }, { x: 0, y: -1 }, 1);
    const orb = group.children[0]!;

    expect(manager.handleEnemyHit(orb as unknown as never, 4, 1.5, 100)).toEqual({
      charged: false,
      charges: 0,
      damage: 1.75,
      killed: true,
      reflect: true,
    });
    expect(manager.handleEnemyHit(
      orb as unknown as never,
      4,
      99,
      100 + GAME_TUNING.temporaryOrbs.hitCooldownMs - 1,
    )).toBeNull();
    expect(manager.handleEnemyHit(
      orb as unknown as never,
      4,
      99,
      100 + GAME_TUNING.temporaryOrbs.hitCooldownMs,
    )).toMatchObject({ damage: 1.75 });
  });

  it('synchronizes reflected velocity and destroys owned group and records', () => {
    const { manager, group } = createManager();
    manager.spawn({ x: 0, y: 0 }, { x: 0, y: -1 }, 1);
    const orb = group.children[0]!;
    orb.body.velocity = { x: 12, y: 34 };
    orb.body.center = { x: 56, y: 78 };

    expect(manager.synchronizeOrb(orb as unknown as never)).toBe(true);
    expect(manager.getSnapshot()[0]).toMatchObject({
      position: { x: 56, y: 78 },
      velocity: { x: 12, y: 34 },
    });

    manager.destroy();
    expect(group.destroyed).toBe(true);
    expect(orb.destroyed).toBe(true);
    expect(manager.getSnapshot()).toEqual([]);
    expect(manager.spawn({ x: 0, y: 0 }, { x: 0, y: -1 }, 1)).toBe(0);
  });

  it('splits an active root once into generation-one children at -25 and 25 degrees', () => {
    const { manager, group } = createManager();
    manager.spawn({ x: 0, y: 0 }, { x: 1, y: 0 }, 1);
    const root = manager.getSnapshot()[0]!;

    expect(root).toMatchObject({ generation: 0, splitConsumed: false });
    expect(manager.spawnChildren(root.id, { x: 20, y: 30 }, { x: 1, y: 0 })).toBe(2);
    expect(group.children.slice(1).map(angleDegrees)).toEqual([-25, 25]);
    expect(manager.getSnapshot()).toMatchObject([
      { id: root.id, generation: 0, splitConsumed: true },
      { generation: 1, splitConsumed: false },
      { generation: 1, splitConsumed: false },
    ]);
    expect(manager.spawnChildren(root.id, { x: 20, y: 30 }, { x: 1, y: 0 })).toBe(0);
  });

  it('rejects unknown, inactive, child, and consumed split parents', () => {
    const { manager, group } = createManager();
    manager.spawn({ x: 0, y: 0 }, { x: 1, y: 0 }, 1);
    const rootId = manager.getSnapshot()[0]!.id;
    expect(manager.spawnChildren(rootId, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(2);
    const childId = manager.getSnapshot()[1]!.id;

    expect(manager.spawnChildren(999, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(0);
    expect(manager.spawnChildren(childId, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(0);
    expect(manager.spawnChildren(rootId, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(0);

    manager.spawn({ x: 0, y: 0 }, { x: 1, y: 0 }, 1);
    const inactiveId = manager.getSnapshot().at(-1)!.id;
    group.children.at(-1)!.active = false;
    expect(manager.spawnChildren(inactiveId, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(0);
  });

  it('truncates children deterministically at the cap and uses configured lifetime', () => {
    let gameplayElapsedMs = 700;
    const { manager, group } = createManager(() => 0, () => gameplayElapsedMs);
    manager.spawn({ x: 0, y: 0 }, { x: 1, y: 0 }, 1);
    const rootId = manager.getSnapshot()[0]!.id;
    for (let index = 0; index < 3; index += 1) {
      manager.spawn({ x: index, y: 0 }, { x: 1, y: 0 }, 3);
    }
    manager.spawn({ x: 0, y: 0 }, { x: 1, y: 0 }, 1);

    expect(manager.getSnapshot()).toHaveLength(11);
    expect(manager.spawnChildren(rootId, { x: 5, y: 6 }, { x: 1, y: 0 })).toBe(1);
    expect(angleDegrees(group.children.at(-1)!)).toBe(-25);
    expect(manager.getSnapshot().at(-1)).toMatchObject({
      generation: 1,
      splitConsumed: false,
      expiresAt: gameplayElapsedMs + GAME_TUNING.temporaryOrbs.lifetimeMs,
    });
    gameplayElapsedMs += GAME_TUNING.temporaryOrbs.lifetimeMs;
    manager.update(gameplayElapsedMs);
    expect(manager.getSnapshot()).toEqual([]);
  });

  it('honors configured child count and rejects a count larger than configured angles', () => {
    const chainSplit = GAME_TUNING.relics.secondBoss.chainSplit as {
      childCount: number;
      angles: readonly [number, number];
    };
    const originalCount = chainSplit.childCount;
    try {
      const { manager, group } = createManager();
      manager.spawn({ x: 0, y: 0 }, { x: 1, y: 0 }, 1);
      const firstRoot = manager.getSnapshot()[0]!.id;

      chainSplit.childCount = 1;
      expect(manager.spawnChildren(firstRoot, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(1);
      expect(angleDegrees(group.children.at(-1)!)).toBe(-25);

      manager.spawn({ x: 0, y: 0 }, { x: 1, y: 0 }, 1);
      const secondRoot = manager.getSnapshot().at(-1)!.id;
      chainSplit.childCount = 3;
      expect(() => manager.spawnChildren(
        secondRoot,
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      )).toThrow(new RangeError('chain split child count must fit configured angles'));
      expect(manager.getSnapshot().find(({ id }) => id === secondRoot)).toMatchObject({
        splitConsumed: false,
      });
    } finally {
      chainSplit.childCount = originalCount;
    }
  });
});
