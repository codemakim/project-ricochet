import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import { GAME_TUNING } from '../config/gameTuning';
import type { OrbManager } from '../orbs/OrbManager';
import type { HitResult } from '../orbs/orbRules';
import type { TemporaryOrbManager } from '../orbs/TemporaryOrbManager';
import type { BossEncounter } from './bossEncounter';
import { HiveBossManager } from './HiveBossManager';

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

function result(damage = 3, reflect = true): HitResult {
  return { damage, charged: true, charges: 2, killed: false, reflect };
}

function createBoundary() {
  const sprites: FakeSprite[] = [];
  const groups: FakeGroup[] = [];
  const colliders: FakeCollider[] = [];
  const overlaps: FakeCollider[] = [];
  const gameplay = { now: 0 };
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
  const scene = { physics: { add } } as unknown as Phaser.Scene;
  const player = new FakeSprite(225, 700, 'player');
  const orb = new FakeSprite(225, 140, 'orb') as FakeSprite & { orbId: number };
  orb.orbId = 0;
  orb.setCircle(8);
  orb.body.velocity = { x: 100, y: -200 };
  const permanentResult = { current: result() };
  const handleEnemyHit = vi.fn(() => permanentResult.current);
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
  const temporaryOrb = new FakeSprite(225, 140, 'temporary') as FakeSprite & {
    temporaryOrbId: number;
  };
  temporaryOrb.temporaryOrbId = 4;
  temporaryOrb.setCircle(6);
  temporaryOrb.body.velocity = { x: -120, y: -80 };
  const temporaryGroup = new FakeGroup();
  temporaryGroup.children.push(temporaryOrb);
  const temporaryResult = { current: result(0.5) };
  const handleTemporaryHit = vi.fn(() => temporaryResult.current);
  const synchronizeTemporary = vi.fn();
  const temporaryOrbManager = {
    getGroup: () => temporaryGroup,
    handleEnemyHit: handleTemporaryHit,
    synchronizeOrb: synchronizeTemporary,
  } as unknown as TemporaryOrbManager;
  const onPlayerHit = vi.fn();
  const onDirectHit = vi.fn();
  const onPhaseChanged = vi.fn();
  const onDefeated = vi.fn();
  const manager = new HiveBossManager(scene, {
    player: player as unknown as Phaser.Physics.Arcade.Sprite,
    orbManager,
    temporaryOrbManager,
    getEnemyBulletCount: () => 0,
    getGameplayElapsedMs: () => gameplay.now,
    onPlayerHit,
    onDirectHit,
    onPhaseChanged,
    onDefeated,
  });
  const sprite = (texture: string) => (
    sprites.find((candidate) => candidate.texture === texture)
    ?? groups.flatMap((group) => group.children).find((candidate) => candidate.texture === texture)
  )!;
  const colliderFor = (texture: string, first: unknown = orb) => colliders.find(
    (collider) => collider.first === first && (collider.second as FakeSprite).texture === texture,
  )!;
  const updateAt = (now: number) => {
    gameplay.now = now;
    manager.update();
    return manager.getSnapshot();
  };
  return {
    manager, gameplay, player, orb, temporaryOrb, temporaryGroup, sprites, groups, colliders,
    overlaps, handleEnemyHit, handleTemporaryHit, synchronizeOrb, synchronizeTemporary,
    onDirectHit, onPhaseChanged, onDefeated, orbAddedListeners, permanentResult,
    temporaryResult, sprite, colliderFor, updateAt,
  };
}

describe('HiveBossManager', () => {
  it('creates the configured core and four module bodies under the common contract', () => {
    const boundary = createBoundary();
    const encounter: BossEncounter = boundary.manager;

    expect(encounter.getSnapshot()).toMatchObject({
      kind: 'hive',
      active: true,
      phase: 'shielded',
      parts: {
        core: 72,
        leftShooter: 12,
        rightShooter: 12,
        leftReflector: 14,
        rightReflector: 14,
      },
      bullets: 0,
      warnings: 0,
    });
    expect(boundary.groups).toHaveLength(4);
  });

  it('reflects both orb kinds from the shielded core without consuming or reporting hits', () => {
    const boundary = createBoundary();
    const permanent = boundary.colliderFor('hive-core');
    const temporary = boundary.colliderFor('hive-core', boundary.temporaryGroup);

    expect(permanent.trigger(boundary.orb, permanent.second as FakeSprite)).toBe(true);
    expect(temporary.trigger(boundary.temporaryOrb, temporary.second as FakeSprite)).toBe(true);

    expect(boundary.handleEnemyHit).not.toHaveBeenCalled();
    expect(boundary.handleTemporaryHit).not.toHaveBeenCalled();
    expect(boundary.synchronizeOrb).toHaveBeenCalledWith(boundary.orb);
    expect(boundary.synchronizeTemporary).toHaveBeenCalledWith(boundary.temporaryOrb);
    expect(boundary.onDirectHit).not.toHaveBeenCalled();
  });

  it('accepts permanent and temporary direct hits on modules throughout all hittable phases', () => {
    const boundary = createBoundary();
    const permanent = boundary.colliderFor('hive-left-shooter');
    const temporary = boundary.colliderFor('hive-right-shooter', boundary.temporaryGroup);

    permanent.trigger(boundary.orb, permanent.second as FakeSprite);
    boundary.updateAt(4000);
    temporary.trigger(boundary.temporaryOrb, temporary.second as FakeSprite);
    boundary.updateAt(5500);
    permanent.trigger(boundary.orb, permanent.second as FakeSprite);

    expect(boundary.manager.getSnapshot().parts).toMatchObject({
      leftShooter: 6,
      rightShooter: 11.5,
    });
    expect(boundary.onDirectHit).toHaveBeenCalledWith(expect.objectContaining({
      bossKind: 'hive',
      targetId: 'leftShooter',
      source: 'permanent',
    }));
    expect(boundary.onDirectHit).toHaveBeenCalledWith(expect.objectContaining({
      targetId: 'rightShooter',
      source: 'temporary',
    }));
  });

  it('uses a visual-only telegraph and exposes the core for exactly 7000 gameplay ms', () => {
    const boundary = createBoundary();
    const core = boundary.colliderFor('hive-core');
    const shieldTint = boundary.sprite('hive-core').tint;

    expect(boundary.updateAt(3999).phase).toBe('shielded');
    expect(boundary.updateAt(4000)).toMatchObject({ phase: 'telegraph', warnings: 1 });
    expect(boundary.sprite('hive-core').tint).not.toBe(shieldTint);
    expect(core.trigger(boundary.orb, core.second as FakeSprite)).toBe(true);
    expect(boundary.handleEnemyHit).not.toHaveBeenCalled();

    expect(boundary.updateAt(5499).phase).toBe('telegraph');
    expect(boundary.updateAt(5500)).toMatchObject({ phase: 'exposed', warnings: 0 });
    boundary.gameplay.now = 5501;
    expect(core.trigger(boundary.orb, core.second as FakeSprite)).toBe(true);
    expect(boundary.manager.getSnapshot().parts?.core).toBe(69);

    expect(boundary.updateAt(12_499).phase).toBe('exposed');
    expect(boundary.updateAt(12_500).phase).toBe('shielded');
    expect(core.trigger(boundary.orb, core.second as FakeSprite)).toBe(true);
    expect(boundary.manager.getSnapshot().parts?.core).toBe(69);
  });

  it('does not recover orbs or extend exposure based on their state', () => {
    const boundary = createBoundary();
    boundary.updateAt(4000);
    boundary.updateAt(5500);
    boundary.orb.active = false;

    expect(boundary.updateAt(12_500).phase).toBe('shielded');
    expect(boundary.synchronizeOrb).not.toHaveBeenCalled();
    expect(boundary.synchronizeTemporary).not.toHaveBeenCalled();
  });

  it('keeps destroyed modules gone across recall and permanently exposes after all four die', () => {
    const boundary = createBoundary();
    const ids = [
      ['leftShooter', 'hive-left-shooter', 12],
      ['rightShooter', 'hive-right-shooter', 12],
      ['leftReflector', 'hive-left-reflector', 14],
      ['rightReflector', 'hive-right-reflector', 14],
    ] as const;

    boundary.manager.applyAreaDamage(
      { x: boundary.sprite('hive-left-shooter').x, y: boundary.sprite('hive-left-shooter').y },
      1,
      12,
    );
    expect(boundary.sprite('hive-left-shooter')).toMatchObject({ visible: false });
    expect(boundary.sprite('hive-left-shooter').body.enable).toBe(false);

    boundary.updateAt(4000);
    boundary.updateAt(5500);
    boundary.updateAt(12_500);
    expect(boundary.sprite('hive-left-shooter')).toMatchObject({ visible: false });
    expect(boundary.sprite('hive-left-shooter').body.enable).toBe(false);

    for (const [id, texture, hp] of ids.slice(1)) {
      const part = boundary.sprite(texture);
      expect(boundary.manager.applyAreaDamage({ x: part.x, y: part.y }, 1, hp)).toBe(id);
    }
    expect(boundary.manager.getSnapshot().phase).toBe('permanentlyExposed');
    expect(boundary.sprite('hive-core').body.enable).toBe(true);
    boundary.updateAt(100_000);
    expect(boundary.manager.getSnapshot().phase).toBe('permanentlyExposed');
  });

  it('moves reflector module bodies only inside their paths while preserving the corridor', () => {
    const boundary = createBoundary();
    const left = boundary.sprite('hive-left-reflector');
    const right = boundary.sprite('hive-right-reflector');

    for (const now of [1000, 4000, 5500, 8500, 12_500, 20_000]) {
      boundary.updateAt(now);
      expect(left.x).toBeGreaterThanOrEqual(GAME_TUNING.hiveBoss.reflector.leftTravel.minimum);
      expect(left.x).toBeLessThanOrEqual(GAME_TUNING.hiveBoss.reflector.leftTravel.maximum);
      expect(right.x).toBeGreaterThanOrEqual(GAME_TUNING.hiveBoss.reflector.rightTravel.minimum);
      expect(right.x).toBeLessThanOrEqual(GAME_TUNING.hiveBoss.reflector.rightTravel.maximum);
      expect(right.x - left.x - GAME_TUNING.hiveBoss.reflector.width).toBeGreaterThanOrEqual(
        GAME_TUNING.hiveBoss.reflector.minimumCorridorWidth,
      );
    }
  });

  it('uses the destructible reflector sprite itself as the orb wall and no player/bullet wall', () => {
    const boundary = createBoundary();
    const reflector = boundary.colliderFor('hive-left-reflector');
    const temporaryReflector = boundary.colliderFor(
      'hive-left-reflector',
      boundary.temporaryGroup,
    );

    expect(reflector.trigger(boundary.orb, reflector.second as FakeSprite)).toBe(true);
    expect(temporaryReflector.trigger(
      boundary.temporaryOrb,
      temporaryReflector.second as FakeSprite,
    )).toBe(true);
    expect(boundary.handleEnemyHit).toHaveBeenCalledOnce();
    expect(boundary.handleTemporaryHit).toHaveBeenCalledOnce();
    expect(boundary.synchronizeOrb).toHaveBeenCalledWith(boundary.orb);
    expect(boundary.synchronizeTemporary).toHaveBeenCalledWith(boundary.temporaryOrb);
    expect(boundary.manager.getSnapshot().parts?.leftReflector).toBe(10.5);
    expect(boundary.colliders.some((collider) => collider.first === boundary.player)).toBe(false);
    expect(boundary.overlaps).toHaveLength(0);
    expect(boundary.sprites.filter((sprite) => sprite.texture.includes('reflector'))).toHaveLength(0);
  });

  it('debounces only the same orb/module pair for 80ms', () => {
    const boundary = createBoundary();
    const left = boundary.colliderFor('hive-left-shooter');
    const right = boundary.colliderFor('hive-right-shooter');

    expect(left.trigger(boundary.orb, left.second as FakeSprite)).toBe(true);
    expect(left.trigger(boundary.orb, left.second as FakeSprite)).toBe(false);
    expect(right.trigger(boundary.orb, right.second as FakeSprite)).toBe(true);
    boundary.gameplay.now = 79;
    expect(left.trigger(boundary.orb, left.second as FakeSprite)).toBe(false);
    boundary.gameplay.now = 80;
    expect(left.trigger(boundary.orb, left.second as FakeSprite)).toBe(true);
  });

  it('applies area damage to the nearest eligible part once and supports exclusion', () => {
    const boundary = createBoundary();
    const left = boundary.sprite('hive-left-shooter');
    const right = boundary.sprite('hive-right-shooter');
    const center = { x: (left.x + right.x) / 2, y: left.y };

    expect(boundary.manager.applyAreaDamage(center, 100, 2, 'leftShooter')).toBe('rightShooter');
    expect(boundary.manager.getSnapshot().parts).toMatchObject({
      leftShooter: 12,
      rightShooter: 10,
      core: 72,
    });
  });

  it('registers future permanent orbs and one temporary collider per target, then fully cleans up', () => {
    const boundary = createBoundary();
    expect(boundary.colliders.filter((item) => item.first === boundary.temporaryGroup)).toHaveLength(5);
    const runtime = new FakeSprite(225, 140, 'runtime') as FakeSprite & { orbId: number };
    runtime.orbId = 9;
    for (const listener of boundary.orbAddedListeners) listener(runtime);
    expect(boundary.colliders.filter((item) => item.first === runtime)).toHaveLength(5);

    boundary.updateAt(4000);
    boundary.manager.clearHostileActions();
    expect(boundary.manager.getSnapshot()).toMatchObject({ active: true, warnings: 0 });
    expect(boundary.sprite('hive-core').destroyed).toBe(false);

    boundary.manager.destroy();
    expect(boundary.orbAddedListeners.size).toBe(0);
    expect(boundary.groups.every((group) => group.destroyed)).toBe(true);
    expect(boundary.colliders.every((collider) => collider.destroyed)).toBe(true);
    expect(boundary.manager.getSnapshot()).toEqual({
      kind: 'hive',
      active: false,
      phase: null,
      position: null,
      parts: null,
      bullets: 0,
      warnings: 0,
      projectiles: [],
    });
  });
});
