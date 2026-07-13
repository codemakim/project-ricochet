import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import { GAME_HEIGHT, PLAYER_RADIUS } from '../constants';
import type { OrbManager } from '../orbs/OrbManager';
import { EnemyManager } from './EnemyManager';

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
  enable = true;

  constructor(readonly gameObject: FakeSprite) {}

  setVelocity(x: number, y: number): this {
    this.velocity = { x, y };
    return this;
  }
}

class FakeSprite {
  x: number;
  y: number;
  active = true;
  destroyed = false;
  tint?: number;
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
    first.body.velocity.x *= -1;
    first.body.velocity.y *= -1;
    this.callback?.(first, second);
    return true;
  }

  destroy(): void {
    this.destroyed = true;
  }
}

function createBoundary() {
  const groups: FakeGroup[] = [];
  const colliders: FakeCollider[] = [];
  const overlaps: FakeCollider[] = [];
  const time = new FakeTime();
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
  } as unknown as OrbManager;
  const onContact = vi.fn();
  const onBreach = vi.fn();
  const onBulletHit = vi.fn();
  const manager = new EnemyManager(scene, {
    player: player as unknown as Phaser.Physics.Arcade.Sprite,
    orbManager,
    onContact,
    onBreach,
    onBulletHit,
  });
  return { manager, player, orb, handleEnemyHit, onContact, onBreach, onBulletHit, groups, colliders, overlaps, time };
}

describe('EnemyManager', () => {
  it('creates the fixed formation with stable IDs and descent velocities', () => {
    const { manager, groups } = createBoundary();
    const snapshot = manager.getSnapshot();

    expect(snapshot.enemies).toHaveLength(20);
    expect(snapshot.enemies.map((enemy) => enemy.id)).toEqual([...Array(20).keys()]);
    expect(groups[0]!.children.every((enemy) => enemy.body.velocity.y === 26)).toBe(true);
  });

  it('removes breaches and reports their kind once', () => {
    const { manager, groups, onBreach } = createBoundary();
    const armored = groups[0]!.children[1]!;
    armored.y = GAME_HEIGHT - PLAYER_RADIUS;

    manager.update();
    manager.update();

    expect(armored.destroyed).toBe(true);
    expect(onBreach).toHaveBeenCalledOnce();
    expect(onBreach).toHaveBeenCalledWith('armored');
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
    handleEnemyHit.mockReturnValueOnce({ charges: 2, damage: 1.5, reflect: false });

    expect(orbCollider.trigger(orb, enemy)).toBe(false);
    expect(handleEnemyHit).toHaveBeenCalledOnce();
    expect(orb.body.velocity).toEqual({ x: 50, y: -100 });
    expect(enemy.destroyed).toBe(true);

    const reflectedEnemy = groups[0]!.children[2]!;
    handleEnemyHit.mockReturnValueOnce({ charges: 1, damage: 1, reflect: true });
    expect(orbCollider.trigger(orb, reflectedEnemy)).toBe(true);
    expect(handleEnemyHit).toHaveBeenCalledTimes(2);
    expect(orb.body.velocity).toEqual({ x: -50, y: 100 });
    expect(reflectedEnemy.destroyed).toBe(true);
  });

  it('clears warning state if a shooter dies before firing', () => {
    const { manager, handleEnemyHit, groups, colliders, time } = createBoundary();
    time.advance(1300);
    const warningShooter = groups[0]!.children.find((enemy) => enemy.tint !== undefined)!;
    handleEnemyHit.mockReturnValueOnce({ charges: 2, damage: 1.5, reflect: false });

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

  it('destroys owned objects, colliders, listeners, and timers', () => {
    const { manager, groups, colliders, overlaps, time } = createBoundary();
    time.advance(1300);

    manager.destroy();

    expect(groups.every((group) => group.destroyed)).toBe(true);
    expect([...colliders, ...overlaps].every((collider) => collider.destroyed)).toBe(true);
    expect(time.activeCount()).toBe(0);
    expect(manager.getSnapshot()).toEqual({ enemies: [], activeShooters: 0, bullets: 0 });
  });
});
