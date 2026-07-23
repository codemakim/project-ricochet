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
  setVelocity(x: number, y: number): this {
    this.body.velocity = { x, y };
    return this;
  }
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
  return {
    damage,
    charged: true,
    charges: 2,
    killed: false,
    reflect,
    preserveChargedKinetics: false,
  };
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
  const enemyBullets = { count: 0 };
  const manager = new HiveBossManager(scene, {
    player: player as unknown as Phaser.Physics.Arcade.Sprite,
    orbManager,
    temporaryOrbManager,
    getEnemyBulletCount: () => enemyBullets.count,
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
    onPlayerHit, onDirectHit, onPhaseChanged, onDefeated, orbAddedListeners, permanentResult,
    temporaryResult, sprite, colliderFor, updateAt,
    setEnemyBulletCount: (count: number) => { enemyBullets.count = count; },
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
    expect(boundary.groups).toHaveLength(5);
  });

  it('recalls every module around the core until exposure, then deploys exact combat positions', () => {
    const boundary = createBoundary();
    const positions = () => boundary.manager.getSnapshot().partPositions;
    const recalled = {
      core: { x: 225, y: 140 },
      leftShooter: { x: 180, y: 140 },
      rightShooter: { x: 270, y: 140 },
      leftReflector: { x: 188, y: 216 },
      rightReflector: { x: 262, y: 216 },
    };

    expect(positions()).toEqual(recalled);
    expect(boundary.updateAt(4000).partPositions).toEqual(recalled);
    expect(boundary.updateAt(5500).partPositions).toEqual({
      core: { x: 225, y: 140 },
      leftShooter: { x: 180, y: 98 },
      rightShooter: { x: 270, y: 98 },
      leftReflector: { x: 132, y: 280 },
      rightReflector: { x: 318, y: 280 },
    });
    expect(boundary.updateAt(12_500).partPositions).toEqual(recalled);
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
      sourceOrbId: 0,
    }));
    expect(boundary.onDirectHit).toHaveBeenCalledWith(expect.objectContaining({
      targetId: 'rightShooter',
      source: 'temporary',
      sourceOrbId: 4,
    }));
  });

  it('uses a visual-only telegraph and exposes the core for exactly 7000 gameplay ms', () => {
    const boundary = createBoundary();
    const core = boundary.colliderFor('hive-core');
    const shieldTint = boundary.sprite('hive-core').tint;

    expect(boundary.updateAt(3999).phase).toBe('shielded');
    expect(boundary.updateAt(4000).phase).toBe('telegraph');
    expect(boundary.sprite('hive-core-warning').active).toBe(true);
    expect(boundary.sprite('hive-core').tint).not.toBe(shieldTint);
    expect(core.trigger(boundary.orb, core.second as FakeSprite)).toBe(true);
    expect(boundary.handleEnemyHit).not.toHaveBeenCalled();

    expect(boundary.updateAt(5499).phase).toBe('telegraph');
    expect(boundary.updateAt(5500).phase).toBe('exposed');
    expect(boundary.sprite('hive-core-warning').active).toBe(false);
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

    boundary.updateAt(4000);
    for (const now of [5500, 6500, 8500, 12_499]) {
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

  it('starts reflector motion after exposure entry instead of reusing telegraph delta', () => {
    const boundary = createBoundary();
    const left = boundary.sprite('hive-left-reflector');
    const right = boundary.sprite('hive-right-reflector');
    const leftStart = (
      GAME_TUNING.hiveBoss.reflector.leftTravel.minimum
      + GAME_TUNING.hiveBoss.reflector.leftTravel.maximum
    ) / 2;
    const rightStart = (
      GAME_TUNING.hiveBoss.reflector.rightTravel.minimum
      + GAME_TUNING.hiveBoss.reflector.rightTravel.maximum
    ) / 2;

    boundary.updateAt(4000);
    boundary.updateAt(5500);

    expect({ left: left.x, right: right.x }).toEqual({
      left: leftStart,
      right: rightStart,
    });

    boundary.updateAt(6500);
    expect(left.x).toBeCloseTo(leftStart + GAME_TUNING.hiveBoss.reflector.speed);
    expect(right.x).toBeCloseTo(rightStart - GAME_TUNING.hiveBoss.reflector.speed);
  });

  it('starts permanent-exposure motion from the gameplay time modules are destroyed', () => {
    const boundary = createBoundary();
    const left = boundary.sprite('hive-left-reflector');
    const right = boundary.sprite('hive-right-reflector');
    const start = { left: left.x, right: right.x };
    boundary.gameplay.now = 1000;

    for (const [texture, hp] of [
      ['hive-left-shooter', 12],
      ['hive-right-shooter', 12],
      ['hive-left-reflector', 14],
      ['hive-right-reflector', 14],
    ] as const) {
      const part = boundary.sprite(texture);
      boundary.manager.applyAreaDamage({ x: part.x, y: part.y }, 1, hp);
    }
    boundary.manager.update();

    expect(boundary.manager.getSnapshot().phase).toBe('permanentlyExposed');
    expect({ left: left.x, right: right.x }).toEqual(start);
  });

  it('damages recalled reflectors without wall reflection, then reflects only while deployed', () => {
    const boundary = createBoundary();
    const reflector = boundary.colliderFor('hive-left-reflector');
    const temporaryReflector = boundary.colliderFor(
      'hive-left-reflector',
      boundary.temporaryGroup,
    );
    const initialPermanentVelocity = { ...boundary.orb.body.velocity };
    const initialTemporaryVelocity = { ...boundary.temporaryOrb.body.velocity };

    expect(reflector.trigger(boundary.orb, reflector.second as FakeSprite)).toBe(false);
    expect(temporaryReflector.trigger(
      boundary.temporaryOrb,
      temporaryReflector.second as FakeSprite,
    )).toBe(false);
    expect(boundary.orb.body.velocity).toEqual(initialPermanentVelocity);
    expect(boundary.temporaryOrb.body.velocity).toEqual(initialTemporaryVelocity);
    expect(boundary.handleEnemyHit).toHaveBeenCalledOnce();
    expect(boundary.handleTemporaryHit).toHaveBeenCalledOnce();
    expect(boundary.manager.getSnapshot().parts?.leftReflector).toBe(10.5);

    boundary.updateAt(4000);
    expect(reflector.trigger(boundary.orb, reflector.second as FakeSprite)).toBe(false);
    expect(boundary.orb.body.velocity).toEqual(initialPermanentVelocity);
    expect(boundary.manager.getSnapshot().parts?.leftReflector).toBe(7.5);

    boundary.updateAt(5500);
    expect(reflector.trigger(boundary.orb, reflector.second as FakeSprite)).toBe(true);
    expect(boundary.orb.body.velocity.x).toBe(-initialPermanentVelocity.x);
    expect(boundary.synchronizeOrb).toHaveBeenCalledWith(boundary.orb);
    expect(boundary.manager.getSnapshot().parts?.leftReflector).toBe(4.5);
    expect(boundary.colliders.some((collider) => collider.first === boundary.player)).toBe(false);
    expect(boundary.overlaps.every((overlap) => overlap.first === boundary.player)).toBe(true);
    expect(boundary.sprites.filter((sprite) => sprite.texture.includes('reflector'))).toHaveLength(0);
  });

  it('keeps shooters silent while recalled, cancels deployment warnings, and restarts offsets', () => {
    const boundary = createBoundary();
    const tuning = GAME_TUNING.projectiles.hiveShooter;

    expect(boundary.updateAt(tuning.intervalMs).warnings).toBe(0);
    expect(boundary.updateAt(4000)).toMatchObject({ phase: 'telegraph', warnings: 1, bullets: 0 });
    expect(boundary.updateAt(5499)).toMatchObject({ phase: 'telegraph', warnings: 1, bullets: 0 });
    expect(boundary.updateAt(5500)).toMatchObject({ phase: 'exposed', warnings: 0, bullets: 5 });

    expect(boundary.updateAt(6900).warnings).toBe(1);
    expect(boundary.updateAt(7200).projectiles.filter(({ kind }) => kind === 'hiveShooter'))
      .toHaveLength(1);

    expect(boundary.updateAt(11_900).warnings).toBe(2);
    expect(boundary.updateAt(12_500)).toMatchObject({
      phase: 'shielded',
      warnings: 0,
      bullets: 0,
    });
    expect(boundary.updateAt(16_500)).toMatchObject({
      phase: 'telegraph', warnings: 1, bullets: 0,
    });
    expect(boundary.updateAt(18_000)).toMatchObject({ phase: 'exposed', warnings: 0 });
    expect(boundary.updateAt(19_399).warnings).toBe(0);
    expect(boundary.updateAt(19_400).warnings).toBe(1);
    expect(boundary.updateAt(19_700).projectiles.filter(({ kind }) => kind === 'hiveShooter'))
      .toHaveLength(1);
    expect(boundary.updateAt(20_100).warnings).toBe(1);
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
      phaseElapsedMs: 0,
      position: null,
      parts: null,
      bullets: 0,
      warnings: 0,
      projectiles: [],
    });
  });

  it('offsets 1400ms shooter warnings by 700ms and locks each 300ms target', () => {
    const boundary = createBoundary();
    const shooterTuning = GAME_TUNING.projectiles.hiveShooter;
    const exposureAt = 5500;
    boundary.updateAt(4000);
    boundary.updateAt(exposureAt);

    expect(boundary.updateAt(exposureAt + shooterTuning.intervalMs - 1).warnings).toBe(0);
    expect(boundary.updateAt(exposureAt + shooterTuning.intervalMs).warnings).toBe(1);
    const lockedTarget = { x: boundary.player.x, y: boundary.player.y };
    boundary.player.setPosition(400, 80);

    expect(boundary.updateAt(
      exposureAt + shooterTuning.intervalMs + shooterTuning.warningMs - 1,
    ).projectiles.filter(({ kind }) => kind === 'hiveShooter')).toHaveLength(0);
    const first = boundary.updateAt(
      exposureAt + shooterTuning.intervalMs + shooterTuning.warningMs,
    ).projectiles.filter(({ kind }) => kind === 'hiveShooter');
    expect(first).toHaveLength(1);
    const projectile = first[0]!;
    const distance = Math.hypot(
      lockedTarget.x - projectile.position.x,
      lockedTarget.y - projectile.position.y,
    );
    expect(projectile).toMatchObject({ kind: 'hiveShooter' });
    expect(projectile.velocity.x).toBeCloseTo(
      (lockedTarget.x - projectile.position.x) / distance * shooterTuning.speed,
    );
    expect(projectile.velocity.y).toBeCloseTo(
      (lockedTarget.y - projectile.position.y) / distance * shooterTuning.speed,
    );

    expect(boundary.updateAt(
      exposureAt + shooterTuning.intervalMs + shooterTuning.offsetMs,
    ).warnings).toBe(1);
    expect(boundary.updateAt(
      exposureAt + shooterTuning.intervalMs + shooterTuning.offsetMs
        + shooterTuning.warningMs,
    ).projectiles.filter(({ kind }) => kind === 'hiveShooter')).toHaveLength(2);
  });

  it('cancels a destroyed shooter warning and never schedules that module again', () => {
    const boundary = createBoundary();
    boundary.updateAt(4000);
    boundary.updateAt(5500);
    boundary.updateAt(6900);
    const left = boundary.sprite('hive-left-shooter');

    expect(boundary.manager.applyAreaDamage({ x: left.x, y: left.y }, 1, 12))
      .toBe('leftShooter');
    expect(boundary.manager.getSnapshot().warnings).toBe(0);

    boundary.updateAt(7600);
    boundary.updateAt(7900);
    const shooterProjectiles = boundary.manager.getSnapshot().projectiles
      .filter(({ kind }) => kind === 'hiveShooter');
    expect(shooterProjectiles).toHaveLength(1);
    expect(shooterProjectiles[0]).toMatchObject({
      kind: 'hiveShooter',
      position: {
        x: boundary.sprite('hive-right-shooter').x,
        y: boundary.sprite('hive-right-shooter').y,
      },
    });
  });

  it('does not catch up missed shooter attacks as a burst on a large update', () => {
    const boundary = createBoundary();

    expect(boundary.updateAt(100_000)).toMatchObject({
      bullets: 0,
      phase: 'telegraph',
      warnings: 1,
      projectiles: [],
    });
    boundary.updateAt(101_500);
    expect(boundary.updateAt(102_900).warnings).toBe(1);
    expect(boundary.updateAt(103_200).projectiles.filter(
      ({ kind }) => kind === 'hiveShooter',
    )).toHaveLength(1);
  });

  it('emits one configured five-shot core fan on each deployment', () => {
    const boundary = createBoundary();
    for (const texture of ['hive-left-shooter', 'hive-right-shooter']) {
      const shooter = boundary.sprite(texture);
      boundary.manager.applyAreaDamage({ x: shooter.x, y: shooter.y }, 1, 12);
    }

    boundary.updateAt(4000);
    let core = boundary.updateAt(5500).projectiles
      .filter(({ kind }) => kind === 'hiveCore');
    expect(core).toHaveLength(5);
    const firstDirections = core.map(({ velocity }) => (
      Math.round(Math.atan2(velocity.x, velocity.y) * 180 / Math.PI)
    ));
    expect(firstDirections).toEqual([...GAME_TUNING.projectiles.hiveCore.fanDegrees]);

    boundary.updateAt(12_500);
    boundary.updateAt(16_500);
    core = boundary.updateAt(18_000).projectiles
      .filter(({ kind }) => kind === 'hiveCore');
    expect(core).toHaveLength(5);
  });

  it('starts permanent core cadence at module destruction and fires at 6999/7000 boundary', () => {
    const boundary = createBoundary();
    boundary.gameplay.now = 1000;
    for (const [texture, hp] of [
      ['hive-left-shooter', 12],
      ['hive-right-shooter', 12],
      ['hive-left-reflector', 14],
      ['hive-right-reflector', 14],
    ] as const) {
      const part = boundary.sprite(texture);
      boundary.manager.applyAreaDamage({ x: part.x, y: part.y }, 1, hp);
    }

    expect(boundary.updateAt(7999).projectiles).toHaveLength(0);
    expect(boundary.updateAt(8000).projectiles).toHaveLength(5);
    expect(boundary.updateAt(14_999).projectiles).toHaveLength(5);
    expect(boundary.updateAt(15_000).projectiles).toHaveLength(10);
  });

  it('checks the shared hostile cap before warning and again before firing', () => {
    const boundary = createBoundary();
    const tuning = GAME_TUNING.projectiles.hiveShooter;
    boundary.updateAt(4000);
    boundary.updateAt(5500);
    boundary.setEnemyBulletCount(GAME_TUNING.projectiles.hostileCap);

    expect(boundary.updateAt(5500 + tuning.intervalMs).warnings).toBe(0);
    boundary.setEnemyBulletCount(0);
    boundary.updateAt(5500 + tuning.intervalMs + tuning.offsetMs);
    expect(boundary.manager.getSnapshot().warnings).toBe(1);
    boundary.setEnemyBulletCount(GAME_TUNING.projectiles.hostileCap);
    expect(boundary.updateAt(
      5500 + tuning.intervalMs + tuning.offsetMs + tuning.warningMs,
    ).projectiles.filter(({ kind }) => kind === 'hiveShooter')).toHaveLength(0);

    boundary.setEnemyBulletCount(0);
    boundary.updateAt(5500 + tuning.intervalMs * 2);
    expect(boundary.manager.getSnapshot().warnings).toBe(1);
  });

  it('limits a core fan to the slots left by enemy bullets', () => {
    const boundary = createBoundary();
    for (const texture of ['hive-left-shooter', 'hive-right-shooter']) {
      const shooter = boundary.sprite(texture);
      boundary.manager.applyAreaDamage({ x: shooter.x, y: shooter.y }, 1, 12);
    }
    boundary.setEnemyBulletCount(GAME_TUNING.projectiles.hostileCap - 3);

    boundary.updateAt(4000);
    const snapshot = boundary.updateAt(5500);

    expect(snapshot.projectiles.filter(({ kind }) => kind === 'hiveCore')).toHaveLength(3);
    expect(snapshot.bullets + GAME_TUNING.projectiles.hostileCap - 3)
      .toBe(GAME_TUNING.projectiles.hostileCap);
  });

  it('deals configured damage once and cleans hive bullets outside the playfield', () => {
    const boundary = createBoundary();
    boundary.updateAt(4000);
    boundary.updateAt(5500);
    boundary.updateAt(6900);
    boundary.updateAt(7200);
    const bullet = boundary.sprite('hive-shooter-bullet');
    const playerOverlap = boundary.overlaps.find(
      (overlap) => overlap.second === boundary.groups[4],
    )!;

    expect(playerOverlap.trigger(boundary.player, bullet)).toBe(true);
    expect(boundary.onPlayerHit).toHaveBeenCalledOnce();
    expect(boundary.onPlayerHit).toHaveBeenCalledWith(
      GAME_TUNING.projectiles.hiveShooter.damage,
    );
    playerOverlap.trigger(boundary.player, bullet);
    expect(boundary.onPlayerHit).toHaveBeenCalledOnce();

    boundary.updateAt(7600);
    boundary.updateAt(7900);
    const offscreen = boundary.groups[4]!.children.find((child) => child.active)!;
    offscreen.setPosition(-GAME_TUNING.projectiles.offscreenMargin - 1, offscreen.y);
    boundary.manager.update();
    expect(offscreen.destroyed).toBe(true);
  });

  it('does not advance pending warnings while gameplay time is paused', () => {
    const boundary = createBoundary();
    boundary.updateAt(4000);
    boundary.updateAt(5500);
    boundary.updateAt(6900);
    const paused = boundary.manager.getSnapshot();

    boundary.manager.update();
    boundary.manager.update();
    expect(boundary.manager.getSnapshot()).toEqual(paused);
    expect(boundary.updateAt(7199).warnings).toBe(1);
    expect(boundary.updateAt(7200).projectiles.filter(
      ({ kind }) => kind === 'hiveShooter',
    )).toHaveLength(1);
  });

  it('clears hive attacks on explicit cleanup, defeat, and destroy', () => {
    const boundary = createBoundary();
    boundary.updateAt(1400);
    boundary.updateAt(1700);
    boundary.manager.clearHostileActions();
    expect(boundary.manager.getSnapshot()).toMatchObject({
      warnings: 0, bullets: 0, projectiles: [],
    });

    boundary.gameplay.now = 2000;
    for (const [texture, hp] of [
      ['hive-left-shooter', 12],
      ['hive-right-shooter', 12],
      ['hive-left-reflector', 14],
      ['hive-right-reflector', 14],
    ] as const) {
      const part = boundary.sprite(texture);
      boundary.manager.applyAreaDamage({ x: part.x, y: part.y }, 1, hp);
    }
    boundary.updateAt(9000);
    expect(boundary.manager.getSnapshot().bullets).toBe(5);
    boundary.manager.applyAreaDamage(
      { x: boundary.sprite('hive-core').x, y: boundary.sprite('hive-core').y },
      1,
      72,
    );
    expect(boundary.manager.getSnapshot()).toMatchObject({
      phase: 'defeated', warnings: 0, bullets: 0, projectiles: [],
    });

    const destroyBoundary = createBoundary();
    destroyBoundary.updateAt(1400);
    destroyBoundary.manager.destroy();
    expect(destroyBoundary.manager.getSnapshot()).toMatchObject({
      active: false, warnings: 0, bullets: 0, projectiles: [],
    });
  });
});
