import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
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

function createManager(getDirectDamageBonus = () => 0) {
  const group = new FakeGroup();
  const scene = {
    time: { now: 0 },
    physics: { add: { group: () => group } },
  } as unknown as Phaser.Scene;
  return { manager: new TemporaryOrbManager(scene, { getDirectDamageBonus }), group, scene };
}

function angleDegrees(sprite: FakeSprite): number {
  return Math.round(Math.atan2(sprite.body.velocity.y, sprite.body.velocity.x) * 180 / Math.PI);
}

describe('TemporaryOrbManager', () => {
  it('uses exact split angles and speed for one, two, and three-orb spawns', () => {
    const { manager, group, scene } = createManager();

    expect(manager.spawn({ x: 10, y: 20 }, { x: 1, y: 0 }, 1)).toBe(1);
    expect(angleDegrees(group.children[0]!)).toBe(-25);
    expect(manager.spawn({ x: 10, y: 20 }, { x: 1, y: 0 }, 1)).toBe(1);
    expect(angleDegrees(group.children[1]!)).toBe(25);
    expect(manager.spawn({ x: 10, y: 20 }, { x: 1, y: 0 }, 2)).toBe(2);
    expect(group.children.slice(2, 4).map(angleDegrees)).toEqual([-25, 25]);
    expect(manager.spawn({ x: 10, y: 20 }, { x: 1, y: 0 }, 3)).toBe(3);
    expect(group.children.slice(4, 7).map(angleDegrees)).toEqual([-30, 0, 30]);

    expect(group.children.every((sprite) => Math.hypot(
      sprite.body.velocity.x,
      sprite.body.velocity.y,
    ) === 440)).toBe(true);
    expect(group.children.every((sprite) => (
      sprite.x === 10
      && sprite.y === 20
      && sprite.texture === 'orb-temporary'
      && sprite.circle === 6
      && sprite.bounce?.[0] === 1
      && sprite.bounce[1] === 1
      && sprite.collideWorldBounds
    ))).toBe(true);
    expect(manager.getSnapshot().every((orb) => orb.expiresAt === scene.time.now + 1500)).toBe(true);
  });

  it('caps at twelve without evicting active records and keeps IDs monotonic', () => {
    const { manager } = createManager();

    for (let index = 0; index < 4; index += 1) expect(manager.spawn({ x: index, y: 0 }, { x: 0, y: -1 }, 3)).toBe(3);
    const before = manager.getSnapshot();
    expect(manager.spawn({ x: 99, y: 99 }, { x: 0, y: -1 }, 3)).toBe(0);
    expect(manager.getSnapshot()).toEqual(before);

    manager.update(1500);
    expect(manager.spawn({ x: 1, y: 2 }, { x: 0, y: -1 }, 1)).toBe(1);
    expect(manager.getSnapshot()[0]!.id).toBe(12);
  });

  it('expires and destroys temporary orbs exactly at 1500ms', () => {
    const { manager, group } = createManager();
    manager.spawn({ x: 0, y: 0 }, { x: 0, y: -1 }, 2);

    manager.update(1499);
    expect(manager.getSnapshot()).toHaveLength(2);
    expect(group.children.every((sprite) => sprite.active)).toBe(true);
    manager.update(1500);
    expect(manager.getSnapshot()).toEqual([]);
    expect(group.children.every((sprite) => sprite.destroyed)).toBe(true);
  });

  it('applies temporary damage and rejects a repeated enemy hit newer than 80ms', () => {
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
    expect(manager.handleEnemyHit(orb as unknown as never, 4, 99, 179)).toBeNull();
    expect(manager.handleEnemyHit(orb as unknown as never, 4, 99, 180)).toMatchObject({ damage: 1.75 });
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
});
