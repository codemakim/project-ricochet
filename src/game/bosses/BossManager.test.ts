import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import type { EnemySnapshot } from '../enemies/EnemyManager';
import type { OrbManager } from '../orbs/OrbManager';
import type { HitResult } from '../orbs/orbRules';
import type { TemporaryOrbManager } from '../orbs/TemporaryOrbManager';
import { BossManager } from './BossManager';

type Callback = (...objects: FakeSprite[]) => void;
type Process = (...objects: FakeSprite[]) => boolean;

class FakeBody {
  velocity = { x: 0, y: 0 };
  center: { x: number; y: number };
  enable = true;

  constructor(readonly gameObject: FakeSprite) {
    this.center = { x: gameObject.x, y: gameObject.y };
  }

  setVelocity(x: number, y: number): this {
    this.velocity = { x, y };
    return this;
  }
}

class FakeSprite {
  active = true;
  destroyed = false;
  visible = true;
  tint?: number;
  readonly body = new FakeBody(this);

  constructor(public x: number, public y: number, readonly texture: string) {}

  setCircle(): this { return this; }
  setImmovable(): this { return this; }
  setDepth(): this { return this; }
  setSize(): this { return this; }
  setTint(tint: number): this { this.tint = tint; return this; }
  clearTint(): this { this.tint = undefined; return this; }
  setVisible(visible: boolean): this { this.visible = visible; return this; }
  setPosition(x: number, y: number): this {
    this.x = x;
    this.y = y;
    this.body.center = { x, y };
    return this;
  }
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

  getChildren(): FakeSprite[] { return this.children; }
  clear(_remove: boolean, destroy: boolean): void {
    if (destroy) this.children.forEach((child) => child.active && child.destroy());
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
    private readonly process?: Process,
  ) {}

  trigger(first: FakeSprite, second: FakeSprite): boolean {
    if (!(this.process?.(first, second) ?? true)) return false;
    first.body.velocity.x *= -1;
    this.callback?.(first, second);
    return true;
  }

  destroy(): void { this.destroyed = true; }
}

function hitResult(damage = 3, charged = true): HitResult {
  return { damage, charged, charges: charged ? 2 : 0, killed: false, reflect: true };
}

function createBoundary() {
  const sprites: FakeSprite[] = [];
  const groups: FakeGroup[] = [];
  const colliders: FakeCollider[] = [];
  const overlaps: FakeCollider[] = [];
  const gameplay = { now: 0 };
  const enemies: EnemySnapshot[] = [];
  let externalBullets = 0;
  const add = {
    sprite: (x: number, y: number, texture: string) => {
      const sprite = new FakeSprite(x, y, texture);
      sprites.push(sprite);
      return sprite;
    },
    group: () => {
      const group = new FakeGroup();
      groups.push(group);
      return group;
    },
    collider: (first: unknown, second: unknown, callback?: Callback, process?: Process) => {
      const collider = new FakeCollider(first, second, callback, process);
      colliders.push(collider);
      return collider;
    },
    overlap: (first: unknown, second: unknown, callback?: Callback) => {
      const overlap = new FakeCollider(first, second, callback);
      overlaps.push(overlap);
      return overlap;
    },
  };
  const scene = { physics: { add }, time: { now: 50_000 } } as unknown as Phaser.Scene;
  const player = new FakeSprite(225, 700, 'player');
  const orb = new FakeSprite(225, 120, 'orb') as FakeSprite & { orbId: number };
  orb.orbId = 0;
  orb.setVelocity(100, -200);
  const handleEnemyHit = vi.fn(() => hitResult());
  const synchronizeOrb = vi.fn();
  const orbManager = {
    getSprites: () => [orb],
    handleEnemyHit,
    synchronizeOrb,
  } as unknown as OrbManager;
  const temporaryOrb = new FakeSprite(225, 120, 'temporary') as FakeSprite & { temporaryOrbId: number };
  temporaryOrb.temporaryOrbId = 4;
  temporaryOrb.setVelocity(-120, -80);
  const temporaryGroup = new FakeGroup();
  temporaryGroup.children.push(temporaryOrb);
  const handleTemporaryHit = vi.fn(() => hitResult(0.5, false));
  const synchronizeTemporary = vi.fn();
  const temporaryOrbManager = {
    getGroup: () => temporaryGroup,
    handleEnemyHit: handleTemporaryHit,
    synchronizeOrb: synchronizeTemporary,
  } as unknown as TemporaryOrbManager;
  const onPlayerHit = vi.fn();
  const onDirectHit = vi.fn();
  const onDefeated = vi.fn();
  const manager = new BossManager(scene, {
    player: player as unknown as Phaser.Physics.Arcade.Sprite,
    orbManager,
    temporaryOrbManager,
    getEnemies: () => enemies,
    getEnemyBulletCount: () => externalBullets,
    getGameplayElapsedMs: () => gameplay.now,
    onPlayerHit,
    onDirectHit,
    onDefeated,
  });
  const colliderFor = (texture: string, first: unknown = orb) => colliders.find(
    (collider) => collider.first === first && (collider.second as FakeSprite).texture === texture,
  )!;
  return {
    manager, gameplay, enemies, player, orb, temporaryOrb, temporaryGroup, sprites, groups,
    colliders, overlaps, handleEnemyHit, handleTemporaryHit, synchronizeOrb,
    synchronizeTemporary, onPlayerHit, onDirectHit, onDefeated,
    setExternalBullets: (count: number) => { externalBullets = count; }, colliderFor,
  };
}

describe('BossManager', () => {
  it('spawns body, weakpoints, hidden core, then tears down every owned object', () => {
    const boundary = createBoundary();

    expect(boundary.manager.getSnapshot()).toMatchObject({
      active: true,
      phase: 'twoWeakpoints',
      position: { x: 225, y: 120 },
      parts: { leftWeakpoint: 14, rightWeakpoint: 14, core: 36 },
    });
    expect(boundary.sprites.find((sprite) => sprite.texture === 'boss-core')?.visible).toBe(false);

    boundary.manager.destroy();
    expect(boundary.sprites.every((sprite) => sprite.destroyed)).toBe(true);
    expect(boundary.groups.every((group) => group.destroyed)).toBe(true);
    expect(boundary.colliders.every((collider) => collider.destroyed)).toBe(true);
    expect(boundary.manager.getSnapshot().active).toBe(false);
  });

  it('reflects from the body without consuming charge, opening bonus, or hit cooldown', () => {
    const { colliderFor, orb, handleEnemyHit, synchronizeOrb, manager } = createBoundary();

    expect(colliderFor('boss-body').trigger(orb, colliderFor('boss-body').second as FakeSprite)).toBe(true);
    expect(handleEnemyHit).not.toHaveBeenCalled();
    expect(synchronizeOrb).toHaveBeenCalledWith(orb);
    expect(manager.getSnapshot().parts).toMatchObject({ leftWeakpoint: 14, rightWeakpoint: 14 });

    colliderFor('boss-left-weakpoint').trigger(
      orb,
      colliderFor('boss-left-weakpoint').second as FakeSprite,
    );
    expect(handleEnemyHit).toHaveBeenCalledOnce();
  });

  it('gives an exposed weakpoint priority over the solid body', () => {
    const boundary = createBoundary();
    const body = boundary.colliderFor('boss-body');
    const weakpoint = boundary.colliderFor('boss-left-weakpoint');
    boundary.orb.setPosition(161, 120);

    expect(body.trigger(boundary.orb, body.second as FakeSprite)).toBe(false);
    expect(weakpoint.trigger(boundary.orb, weakpoint.second as FakeSprite)).toBe(true);
    expect(boundary.manager.getSnapshot().parts?.leftWeakpoint).toBe(11);
  });

  it('hits only one exposed weakpoint per orb in one gameplay frame and reports permanent hits', () => {
    const boundary = createBoundary();
    const left = boundary.colliderFor('boss-left-weakpoint');
    const right = boundary.colliderFor('boss-right-weakpoint');

    expect(left.trigger(boundary.orb, left.second as FakeSprite)).toBe(true);
    expect(right.trigger(boundary.orb, right.second as FakeSprite)).toBe(false);
    expect(boundary.manager.getSnapshot().parts).toMatchObject({ leftWeakpoint: 11, rightWeakpoint: 14 });
    expect(boundary.onDirectHit).toHaveBeenCalledWith(expect.objectContaining({
      partId: 'leftWeakpoint', source: 'permanent', charged: true,
      direction: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
    }));
  });

  it('rejects hidden-core collisions and enables core only after both weakpoints die', () => {
    const boundary = createBoundary();
    const core = boundary.colliderFor('boss-core');
    expect(core.trigger(boundary.orb, core.second as FakeSprite)).toBe(false);

    boundary.manager.applyAreaDamage({ x: 161, y: 120 }, 1, 14);
    boundary.manager.applyAreaDamage({ x: 289, y: 120 }, 1, 14);

    expect(boundary.manager.getSnapshot().phase).toBe('core');
    expect((core.second as FakeSprite).visible).toBe(true);
    boundary.gameplay.now += 1;
    expect(core.trigger(boundary.orb, core.second as FakeSprite)).toBe(true);
  });

  it('applies temporary-orb damage through a distinct negative hit ID', () => {
    const boundary = createBoundary();
    const collider = boundary.colliderFor('boss-left-weakpoint', boundary.temporaryGroup);

    collider.trigger(boundary.temporaryOrb, collider.second as FakeSprite);

    expect(boundary.handleTemporaryHit).toHaveBeenCalledWith(
      boundary.temporaryOrb, -1, 14, 0,
    );
    expect(boundary.synchronizeTemporary).toHaveBeenCalledWith(boundary.temporaryOrb);
    expect(boundary.manager.getSnapshot().parts?.leftWeakpoint).toBe(13.5);
  });

  it('damages only the nearest eligible exposed part and can exclude the direct part', () => {
    const { manager } = createBoundary();

    expect(manager.applyAreaDamage({ x: 220, y: 120 }, 100, 4, 'leftWeakpoint')).toBe('rightWeakpoint');
    expect(manager.getSnapshot().parts).toMatchObject({ leftWeakpoint: 14, rightWeakpoint: 10 });

    expect(manager.applyAreaDamage({ x: 225, y: 120 }, 200, 2)).toBe('leftWeakpoint');
    expect(manager.getSnapshot().parts).toMatchObject({ leftWeakpoint: 12, rightWeakpoint: 10 });
  });

  it('maps only vertically overlapping enemies to exact padded forbidden intervals', () => {
    const boundary = createBoundary();
    boundary.enemies.push(
      { id: 1, kind: 'basic', hp: 1, position: { x: 330, y: 120 }, warning: false },
      { id: 2, kind: 'basic', hp: 1, position: { x: 100, y: 300 }, warning: false },
    );

    boundary.gameplay.now = 1000;
    boundary.manager.update();

    expect(boundary.manager.getSnapshot().position?.x).toBe(192);
  });

  it('uses gameplay delta for the 600ms aimed telegraph and three-shot fan', () => {
    const boundary = createBoundary();
    boundary.gameplay.now = 2800;
    boundary.manager.update();
    expect(boundary.manager.getSnapshot()).toMatchObject({ warnings: 1, aimedBullets: 0 });

    boundary.gameplay.now = 3399;
    boundary.manager.update();
    expect(boundary.manager.getSnapshot().aimedBullets).toBe(0);
    boundary.gameplay.now = 3400;
    boundary.manager.update();
    expect(boundary.manager.getSnapshot()).toMatchObject({ warnings: 0, aimedBullets: 3 });
  });

  it('shares cap twelve with normal bullets and spawns only available aimed bullets', () => {
    const boundary = createBoundary();
    boundary.setExternalBullets(11);
    boundary.gameplay.now = 2800;
    boundary.manager.update();
    boundary.gameplay.now = 3400;
    boundary.manager.update();

    expect(boundary.manager.getSnapshot().aimedBullets).toBe(1);
  });

  it('keeps support markers for 800ms then creates two vertical hazards', () => {
    const boundary = createBoundary();
    boundary.gameplay.now = 2800;
    boundary.manager.update();
    boundary.gameplay.now = 3400;
    boundary.manager.update();
    boundary.gameplay.now = 5600;
    boundary.manager.update();
    expect(boundary.manager.getSnapshot()).toMatchObject({ warnings: 2, fallingHazards: 0 });

    boundary.gameplay.now = 6399;
    boundary.manager.update();
    expect(boundary.manager.getSnapshot().fallingHazards).toBe(0);
    boundary.gameplay.now = 6400;
    boundary.manager.update();
    expect(boundary.manager.getSnapshot()).toMatchObject({ warnings: 0, fallingHazards: 2 });
  });

  it('deals one from aimed bullets, two from hazards, and consumes each hostile action', () => {
    const boundary = createBoundary();
    boundary.gameplay.now = 3400;
    boundary.manager.update();
    const aimed = boundary.groups[0]!.children.find((child) => child.active)!;
    boundary.overlaps[0]!.trigger(boundary.player, aimed);
    expect(boundary.onPlayerHit).toHaveBeenLastCalledWith(1);
    expect(aimed.destroyed).toBe(true);

    boundary.gameplay.now = 6400;
    boundary.manager.update();
    const hazard = boundary.groups[1]!.children.find((child) => child.active)!;
    boundary.overlaps[1]!.trigger(boundary.player, hazard);
    expect(boundary.onPlayerHit).toHaveBeenLastCalledWith(2);
    expect(hazard.destroyed).toBe(true);
  });

  it('clears bullets, hazards, markers, and pending telegraphs', () => {
    const boundary = createBoundary();
    boundary.gameplay.now = 2800;
    boundary.manager.update();
    boundary.manager.clearHostileActions();
    boundary.gameplay.now = 3400;
    boundary.manager.update();

    expect(boundary.manager.getSnapshot()).toMatchObject({
      aimedBullets: 0, fallingHazards: 0, warnings: 0,
    });
  });

  it('defeats once when the exposed core reaches zero', () => {
    const boundary = createBoundary();
    boundary.manager.applyAreaDamage({ x: 161, y: 120 }, 1, 14);
    boundary.manager.applyAreaDamage({ x: 289, y: 120 }, 1, 14);
    boundary.manager.applyAreaDamage({ x: 225, y: 120 }, 1, 36);

    expect(boundary.onDefeated).toHaveBeenCalledOnce();
    expect(boundary.manager.getSnapshot().phase).toBe('defeated');
    boundary.manager.applyAreaDamage({ x: 225, y: 120 }, 999, 1);
    expect(boundary.onDefeated).toHaveBeenCalledOnce();
  });

  it('settles the killing direct-hit event before reporting defeat', () => {
    const boundary = createBoundary();
    boundary.manager.applyAreaDamage({ x: 161, y: 120 }, 1, 14);
    boundary.manager.applyAreaDamage({ x: 289, y: 120 }, 1, 14);
    boundary.manager.applyAreaDamage({ x: 225, y: 120 }, 1, 33);
    boundary.gameplay.now = 1;
    const core = boundary.colliderFor('boss-core');

    core.trigger(boundary.orb, core.second as FakeSprite);

    expect(boundary.onDirectHit.mock.invocationCallOrder[0]).toBeLessThan(
      boundary.onDefeated.mock.invocationCallOrder[0]!,
    );
  });
});
