import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import { GAME_TUNING } from '../config/gameTuning';
import type { EnemySnapshot } from '../enemies/EnemyManager';
import type { OrbManager } from '../orbs/OrbManager';
import type { HitResult } from '../orbs/orbRules';
import type { TemporaryOrbManager } from '../orbs/TemporaryOrbManager';
import { BossManager } from './BossManager';
import type { BossEncounter } from './bossEncounter';

type Callback = (...objects: FakeSprite[]) => void;
type Process = (...objects: FakeSprite[]) => boolean;

class FakeBody {
  velocity = { x: 0, y: 0 };
  center: { x: number; y: number };
  enable = true;
  isCircle = false;
  halfWidth = 0;
  halfHeight = 0;

  constructor(readonly gameObject: FakeSprite) {
    this.center = { x: gameObject.x, y: gameObject.y };
  }

  setVelocity(x: number, y: number): this {
    this.velocity = { x, y };
    return this;
  }

  get left(): number { return this.center.x - this.halfWidth; }
  get right(): number { return this.center.x + this.halfWidth; }
  get top(): number { return this.center.y - this.halfHeight; }
  get bottom(): number { return this.center.y + this.halfHeight; }
}

class FakeSprite {
  active = true;
  destroyed = false;
  visible = true;
  tint?: number;
  depth = 0;
  readonly body: FakeBody;

  constructor(public x: number, public y: number, readonly texture: string) {
    this.body = new FakeBody(this);
  }

  setCircle(radius: number): this {
    this.body.isCircle = true;
    this.body.halfWidth = radius;
    this.body.halfHeight = radius;
    return this;
  }
  setImmovable(): this { return this; }
  setDepth(depth: number): this { this.depth = depth; return this; }
  setSize(width: number, height: number): this {
    this.body.isCircle = false;
    this.body.halfWidth = width / 2;
    this.body.halfHeight = height / 2;
    return this;
  }
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
  orb.setCircle(8);
  orb.setVelocity(100, -200);
  const handleEnemyHit = vi.fn(() => hitResult());
  const synchronizeOrb = vi.fn();
  const orbAddedListeners = new Set<(orb: unknown) => void>();
  const orbManager = {
    getSprites: () => [orb],
    onOrbAdded: (listener: (added: unknown) => void) => {
      orbAddedListeners.add(listener);
      return () => orbAddedListeners.delete(listener);
    },
    handleEnemyHit,
    synchronizeOrb,
  } as unknown as OrbManager;
  const temporaryOrb = new FakeSprite(225, 120, 'temporary') as FakeSprite & { temporaryOrbId: number };
  temporaryOrb.temporaryOrbId = 4;
  temporaryOrb.setCircle(6);
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
    addRuntimeOrb: () => {
      const runtimeOrb = new FakeSprite(225, 120, 'orb-runtime') as FakeSprite & { orbId: number };
      runtimeOrb.orbId = 1;
      runtimeOrb.setCircle(8).setVelocity(100, -200);
      for (const listener of orbAddedListeners) listener(runtimeOrb);
      return runtimeOrb;
    },
    orbAddedListeners,
  };
}

function updateAt(boundary: ReturnType<typeof createBoundary>, now: number) {
  boundary.gameplay.now = now;
  boundary.manager.update();
  return boundary.manager.getSnapshot();
}

describe('BossManager', () => {
  it('conforms to the common sentinel encounter contract', () => {
    const boundary = createBoundary();
    const encounter: BossEncounter = boundary.manager;
    expect(encounter.getSnapshot()).toMatchObject({
      kind: 'sentinel',
      active: true,
      bullets: 0,
    });
    encounter.destroy();
  });

  it('registers all boss colliders for a runtime permanent orb and unsubscribes on destroy', () => {
    const boundary = createBoundary();
    expect(boundary.colliders.filter((collider) => collider.first === boundary.orb)).toHaveLength(4);

    const runtimeOrb = boundary.addRuntimeOrb();
    const runtimeColliders = boundary.colliders.filter((collider) => collider.first === runtimeOrb);
    expect(runtimeColliders).toHaveLength(4);
    const weakpoint = runtimeColliders.find(
      (collider) => (collider.second as FakeSprite).texture === 'boss-left-weakpoint',
    )!;
    expect(weakpoint.trigger(runtimeOrb, weakpoint.second as FakeSprite)).toBe(true);
    expect(boundary.handleEnemyHit).toHaveBeenCalledWith(runtimeOrb, -1, 14, 0, false);
    expect(boundary.onDirectHit).toHaveBeenCalledWith(expect.objectContaining({
      bossKind: 'sentinel',
      targetId: 'leftWeakpoint',
    }));

    boundary.manager.destroy();
    expect(boundary.orbAddedListeners.size).toBe(0);
    boundary.addRuntimeOrb();
    expect(boundary.colliders.filter((collider) => collider.first !== boundary.orb && collider.first !== boundary.temporaryGroup)).toHaveLength(4);
  });

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
    expect(boundary.manager.getSnapshot()).toEqual({
      kind: 'sentinel',
      active: false,
      phase: null,
      position: null,
      parts: null,
      bullets: 0,
      basicBullets: 0,
      aimedBullets: 0,
      fallingHazards: 0,
      warnings: 0,
      projectiles: [],
    });
  });

  it('uses forgiving weakpoint hitboxes and keeps enemies/actions visually ahead of boss parts', () => {
    const boundary = createBoundary();
    const { sprites, groups } = boundary;
    const body = sprites.find((sprite) => sprite.texture === 'boss-body')!;
    const left = sprites.find((sprite) => sprite.texture === 'boss-left-weakpoint')!;
    const right = sprites.find((sprite) => sprite.texture === 'boss-right-weakpoint')!;
    const core = sprites.find((sprite) => sprite.texture === 'boss-core')!;

    expect({ width: body.body.halfWidth * 2, height: body.body.halfHeight * 2 }).toEqual({
      width: 168,
      height: 96,
    });
    expect({
      width: left.body.halfWidth * 2,
      height: left.body.halfHeight * 2,
      leftCenterX: left.x,
      rightCenterX: right.x,
    }).toEqual({
      width: 22,
      height: 52,
      leftCenterX: 137,
      rightCenterX: 313,
    });
    expect(right.body.halfWidth).toBe(left.body.halfWidth);
    expect(body.depth).toBeLessThan(0);
    expect(left.depth).toBeLessThan(0);
    expect(left.depth).toBeGreaterThan(body.depth);
    expect(right.depth).toBe(left.depth);
    expect(core.depth).toBe(left.depth);

    boundary.gameplay.now = 3_400;
    boundary.manager.update();
    const aimed = groups[0]!.children.find((sprite) => sprite.active)!;
    boundary.gameplay.now = 6_400;
    boundary.manager.update();
    const hazard = groups[1]!.children.find((sprite) => sprite.active)!;
    expect(aimed.depth).toBeGreaterThan(left.depth);
    expect(hazard.depth).toBeGreaterThan(left.depth);
  });

  it('sets a deterministic boss position through its DEV-only debug hook', () => {
    const { manager } = createBoundary();

    manager.debugSetPosition!(120);

    expect(manager.getSnapshot().position).toEqual({ x: 120, y: 120 });
    expect(() => manager.debugSetPosition!(98)).toThrow(RangeError);
    expect(() => manager.debugSetPosition!(352)).toThrow(RangeError);
    expect(() => manager.debugSetPosition!(Number.NaN)).toThrow(RangeError);
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
    boundary.orb.setPosition(137, 120);

    expect(body.trigger(boundary.orb, body.second as FakeSprite)).toBe(false);
    expect(weakpoint.trigger(boundary.orb, weakpoint.second as FakeSprite)).toBe(true);
    expect(boundary.manager.getSnapshot().parts?.leftWeakpoint).toBe(11);
  });

  it('rejects body reflection when a permanent radius-8 orb clips a weakpoint seam corner', () => {
    const boundary = createBoundary();
    const body = boundary.colliderFor('boss-body');
    const weakpoint = boundary.colliderFor('boss-left-weakpoint');
    boundary.orb.setPosition(145, 153);

    expect(body.trigger(boundary.orb, body.second as FakeSprite)).toBe(false);
    expect(boundary.handleEnemyHit).not.toHaveBeenCalled();
    expect(weakpoint.trigger(boundary.orb, weakpoint.second as FakeSprite)).toBe(true);
    expect(boundary.manager.getSnapshot().parts?.leftWeakpoint).toBe(11);
  });

  it('rejects body reflection when a temporary radius-6 orb clips a weakpoint seam corner', () => {
    const boundary = createBoundary();
    const body = boundary.colliderFor('boss-body', boundary.temporaryGroup);
    const weakpoint = boundary.colliderFor('boss-left-weakpoint', boundary.temporaryGroup);
    boundary.temporaryOrb.setPosition(145, 151);

    expect(body.trigger(boundary.temporaryOrb, body.second as FakeSprite)).toBe(false);
    expect(boundary.handleTemporaryHit).not.toHaveBeenCalled();
    expect(weakpoint.trigger(boundary.temporaryOrb, weakpoint.second as FakeSprite)).toBe(true);
    expect(boundary.manager.getSnapshot().parts?.leftWeakpoint).toBe(13.5);
  });

  it('hits only one exposed weakpoint per orb in one gameplay frame and reports permanent hits', () => {
    const boundary = createBoundary();
    const left = boundary.colliderFor('boss-left-weakpoint');
    const right = boundary.colliderFor('boss-right-weakpoint');

    expect(left.trigger(boundary.orb, left.second as FakeSprite)).toBe(true);
    expect(right.trigger(boundary.orb, right.second as FakeSprite)).toBe(false);
    expect(boundary.manager.getSnapshot().parts).toMatchObject({ leftWeakpoint: 11, rightWeakpoint: 14 });
    expect(boundary.onDirectHit).toHaveBeenCalledWith(expect.objectContaining({
      bossKind: 'sentinel', targetId: 'leftWeakpoint', source: 'permanent', charged: true,
      direction: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
    }));
  });

  it('rejects hidden-core collisions and enables core only after both weakpoints die', () => {
    const boundary = createBoundary();
    const core = boundary.colliderFor('boss-core');
    expect(core.trigger(boundary.orb, core.second as FakeSprite)).toBe(false);

    boundary.manager.applyAreaDamage({ x: 137, y: 120 }, 1, 14);
    boundary.manager.applyAreaDamage({ x: 313, y: 120 }, 1, 14);

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
      { id: 1, kind: 'basic', hp: 1, position: { x: 360, y: 120 }, warning: false, speed: 8 },
      { id: 2, kind: 'basic', hp: 1, position: { x: 100, y: 300 }, warning: false, speed: 8 },
    );

    boundary.gameplay.now = 1000;
    boundary.manager.update();

    expect(boundary.manager.getSnapshot().position?.x).toBe(227);
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

  it('flashes at 750ms and fires one aimed basic bullet at 900ms', () => {
    const boundary = createBoundary();
    expect(updateAt(boundary, 749)).toMatchObject({ warnings: 0, basicBullets: 0 });

    expect(updateAt(boundary, 750).warnings).toBe(1);

    boundary.player.setPosition(300, 600);
    const shot = updateAt(boundary, 900).projectiles[0]!;
    expect(shot.kind).toBe('basic');
    expect(Math.hypot(shot.velocity.x, shot.velocity.y)).toBeCloseTo(150);
  });

  it('samples the player aim when a basic shot fires', () => {
    const boundary = createBoundary();
    updateAt(boundary, 750);
    boundary.player.setPosition(325, 120);

    const shot = updateAt(boundary, 900).projectiles[0]!;

    expect(shot.velocity).toEqual({ x: 150, y: 0 });
  });

  it('fires the second basic shot at 1800ms without early catch-up', () => {
    const boundary = createBoundary();
    updateAt(boundary, 900);
    expect(updateAt(boundary, 1799).basicBullets).toBe(1);
    expect(updateAt(boundary, 1800).basicBullets).toBe(2);
  });

  it('cancels a late pending basic flash when a major warning starts', () => {
    const boundary = createBoundary();
    updateAt(boundary, 900);
    updateAt(boundary, 1800);
    updateAt(boundary, 2600);
    expect(boundary.manager.getSnapshot().warnings).toBe(1);
    const muzzle = boundary.groups[2]!.children.find((child) => child.active)!;

    const major = updateAt(boundary, 2800);
    expect(major.basicBullets).toBe(2);
    expect(major.warnings).toBe(1);
    expect(muzzle.destroyed).toBe(true);
  });

  it('waits a full basic interval after the major action resolves', () => {
    const boundary = createBoundary();
    updateAt(boundary, 2800);
    updateAt(boundary, 3400);
    expect(updateAt(boundary, 4149).warnings).toBe(0);
    expect(updateAt(boundary, 4150).warnings).toBe(1);
    expect(updateAt(boundary, 4299).basicBullets).toBe(0);
    expect(updateAt(boundary, 4300).basicBullets).toBe(1);
  });

  it('waits a full basic interval after a delayed-frame major resolution', () => {
    const boundary = createBoundary();

    expect(updateAt(boundary, 5000)).toMatchObject({ aimedBullets: 3, basicBullets: 0 });
    boundary.manager.applyAreaDamage(boundary.manager.getSnapshot().position!, 200, 14);
    expect(updateAt(boundary, 5016).basicBullets).toBe(0);
    expect(updateAt(boundary, 5749)).toMatchObject({ warnings: 0, basicBullets: 0 });
    expect(updateAt(boundary, 5750)).toMatchObject({ warnings: 1, basicBullets: 0 });
    expect(updateAt(boundary, 5899).basicBullets).toBe(0);
    expect(updateAt(boundary, 5900).basicBullets).toBe(1);
  });

  it('skips a capped shot and never releases it as a burst', () => {
    const boundary = createBoundary();
    boundary.setExternalBullets(12);
    expect(updateAt(boundary, 900).basicBullets).toBe(0);
    boundary.setExternalBullets(0);
    expect(updateAt(boundary, 901).basicBullets).toBe(0);
    expect(updateAt(boundary, 1800).basicBullets).toBe(1);
  });

  it('does not advance the basic-shot clock while gameplay time is paused', () => {
    const boundary = createBoundary();
    updateAt(boundary, 750);
    const paused = boundary.manager.getSnapshot();

    boundary.manager.update();
    boundary.manager.update();

    expect(boundary.manager.getSnapshot()).toEqual(paused);
  });

  it('fires the aimed fan at the warned target after the player moves', () => {
    const boundary = createBoundary();
    const warnedTarget = { x: boundary.player.x, y: boundary.player.y };
    boundary.gameplay.now = 2800;
    boundary.manager.update();

    boundary.player.setPosition(400, 80);
    boundary.gameplay.now = 3400;
    boundary.manager.update();

    const centerBullet = boundary.groups[0]!.children.filter((child) => child.active)[1]!;
    const distance = Math.hypot(
      warnedTarget.x - centerBullet.x,
      warnedTarget.y - centerBullet.y,
    );
    expect(centerBullet.body.velocity.x).toBeCloseTo(
      (warnedTarget.x - centerBullet.x) / distance * 220,
    );
    expect(centerBullet.body.velocity.y).toBeCloseTo(
      (warnedTarget.y - centerBullet.y) / distance * 220,
    );
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

  it('uses per-kind damage and consumes each hostile action', () => {
    const boundary = createBoundary();
    updateAt(boundary, 900);
    const basic = boundary.groups[0]!.children.find((child) => child.active)!;
    boundary.overlaps[0]!.trigger(boundary.player, basic);
    expect(boundary.onPlayerHit).toHaveBeenLastCalledWith(1);
    expect(basic.destroyed).toBe(true);

    boundary.gameplay.now = 3400;
    boundary.manager.update();
    const aimed = boundary.groups[0]!.children.find((child) => child.active)!;
    boundary.overlaps[0]!.trigger(boundary.player, aimed);
    expect(boundary.onPlayerHit).toHaveBeenLastCalledWith(1);
    expect(aimed.destroyed).toBe(true);

    boundary.gameplay.now = 6400;
    boundary.manager.update();
    const hazard = boundary.groups[1]!.children.find((child) => child.active)!;
    const supportTuning = GAME_TUNING.projectiles.bossSupport as { damage: number };
    const configuredDamage = supportTuning.damage;
    supportTuning.damage = configuredDamage + 5;
    try {
      boundary.overlaps[1]!.trigger(boundary.player, hazard);
      expect(boundary.onPlayerHit).toHaveBeenLastCalledWith(supportTuning.damage);
    } finally {
      supportTuning.damage = configuredDamage;
    }
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
      basicBullets: 0, aimedBullets: 0, fallingHazards: 0, warnings: 0,
      projectiles: [],
    });
  });

  it('clears basic bullets, muzzle flashes, and reservations', () => {
    const boundary = createBoundary();
    updateAt(boundary, 900);
    updateAt(boundary, 1650);

    boundary.manager.clearHostileActions();

    expect(boundary.manager.getSnapshot()).toMatchObject({
      basicBullets: 0,
      aimedBullets: 0,
      warnings: 0,
      projectiles: [],
    });
  });

  it('defeats once when the exposed core reaches zero', () => {
    const boundary = createBoundary();
    boundary.manager.applyAreaDamage({ x: 137, y: 120 }, 1, 14);
    boundary.manager.applyAreaDamage({ x: 313, y: 120 }, 1, 14);
    boundary.manager.applyAreaDamage({ x: 225, y: 120 }, 1, 36);

    expect(boundary.onDefeated).toHaveBeenCalledOnce();
    expect(boundary.manager.getSnapshot()).toMatchObject({
      phase: 'defeated',
      basicBullets: 0,
      aimedBullets: 0,
      fallingHazards: 0,
      warnings: 0,
      projectiles: [],
    });
    boundary.manager.applyAreaDamage({ x: 225, y: 120 }, 999, 1);
    expect(boundary.onDefeated).toHaveBeenCalledOnce();
  });

  it('settles the killing direct-hit event before reporting defeat', () => {
    const boundary = createBoundary();
    boundary.manager.applyAreaDamage({ x: 137, y: 120 }, 1, 14);
    boundary.manager.applyAreaDamage({ x: 313, y: 120 }, 1, 14);
    boundary.manager.applyAreaDamage({ x: 225, y: 120 }, 1, 33);
    boundary.gameplay.now = 1;
    const core = boundary.colliderFor('boss-core');

    core.trigger(boundary.orb, core.second as FakeSprite);

    expect(boundary.onDirectHit.mock.invocationCallOrder[0]).toBeLessThan(
      boundary.onDefeated.mock.invocationCallOrder[0]!,
    );
  });
});
