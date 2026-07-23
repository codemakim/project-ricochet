import type Phaser from 'phaser';
import { GAME_TUNING } from '../config/gameTuning';
import { normalize, type Vector } from '../math/vector';
import type { HitResult } from './orbRules';

export type TemporaryOrbSprite = Phaser.Physics.Arcade.Sprite & {
  temporaryOrbId: number;
  expiresAt: number;
};

export interface TemporaryOrbSnapshot {
  id: number;
  expiresAt: number;
  position: Vector;
  velocity: Vector;
  generation: 0 | 1;
  splitConsumed: boolean;
}

interface TemporaryOrbRecord extends TemporaryOrbSnapshot {
  sprite: TemporaryOrbSprite;
  enemyHits: Map<number, number>;
}

export interface TemporaryOrbManagerOptions {
  getDirectDamageBonus(): number;
  getGameplayElapsedMs(): number;
  textureKey?: string;
}

function rotate(direction: Vector, angleDegrees: number): Vector {
  const radians = angleDegrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: direction.x * cosine - direction.y * sine,
    y: direction.x * sine + direction.y * cosine,
  };
}

export class TemporaryOrbManager {
  private readonly group: Phaser.Physics.Arcade.Group;
  private readonly records = new Map<TemporaryOrbSprite, TemporaryOrbRecord>();
  private nextId = 0;
  private singleAngle = 25;
  private destroyed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly options: TemporaryOrbManagerOptions,
  ) {
    this.group = scene.physics.add.group({ allowGravity: false });
  }

  spawn(position: Vector, direction: Vector, count: number): number {
    if (this.destroyed || count <= 0) return 0;
    const angles = this.spawnAngles(count);
    const available = GAME_TUNING.temporaryOrbs.cap - this.records.size;
    const spawnCount = Math.min(count, available);
    if (spawnCount <= 0) return 0;

    const incoming = normalize(direction);
    for (const angle of angles.slice(0, spawnCount)) {
      this.createOrb(position, rotate(incoming, angle), 0);
    }
    return spawnCount;
  }

  spawnChildren(parentId: number, position: Vector, direction: Vector): number {
    const parent = [...this.records.values()].find((record) => record.id === parentId);
    if (
      this.destroyed
      || !parent
      || !parent.sprite.active
      || parent.generation !== 0
      || parent.splitConsumed
    ) return 0;

    const { childCount, angles: configuredAngles } = GAME_TUNING.relics.secondBoss.chainSplit;
    if (
      !Number.isInteger(childCount)
      || childCount < 1
      || childCount > configuredAngles.length
    ) {
      throw new RangeError('chain split child count must fit configured angles');
    }
    parent.splitConsumed = true;
    const available = GAME_TUNING.temporaryOrbs.cap - this.records.size;
    const angles = configuredAngles.slice(0, Math.min(childCount, available));
    const incoming = normalize(direction);
    for (const angle of angles) {
      this.createOrb(position, rotate(incoming, angle), 1);
    }
    return angles.length;
  }

  getGroup(): Phaser.Physics.Arcade.Group {
    return this.group;
  }

  handleEnemyHit(
    orb: TemporaryOrbSprite,
    enemyId: number,
    enemyHp: number,
    nowMs: number,
  ): HitResult | null {
    const record = this.records.get(orb);
    if (!record || !orb.active) return null;
    const lastHitMs = record.enemyHits.get(enemyId);
    if (lastHitMs !== undefined && nowMs - lastHitMs < GAME_TUNING.temporaryOrbs.hitCooldownMs) return null;
    record.enemyHits.set(enemyId, nowMs);
    const damage = 0.5 + this.options.getDirectDamageBonus();
    return {
      charged: false,
      charges: 0,
      damage,
      killed: enemyHp <= damage,
      reflect: true,
    };
  }

  synchronizeOrb(orb: TemporaryOrbSprite): boolean {
    const record = this.records.get(orb);
    if (!record || !orb.active) return false;
    const body = orb.body as Phaser.Physics.Arcade.Body;
    if (body.gameObject !== orb) return false;
    record.position = { x: body.center.x, y: body.center.y };
    record.velocity = { x: body.velocity.x, y: body.velocity.y };
    return true;
  }

  update(nowMs: number): void {
    if (this.destroyed) return;
    for (const [sprite, record] of this.records) {
      if (!sprite.active || nowMs >= record.expiresAt) {
        sprite.destroy();
        this.records.delete(sprite);
      }
    }
  }

  getSnapshot(): TemporaryOrbSnapshot[] {
    return [...this.records.values()].map((record) => ({
      id: record.id,
      expiresAt: record.expiresAt,
      position: { ...record.position },
      velocity: { ...record.velocity },
      generation: record.generation,
      splitConsumed: record.splitConsumed,
    }));
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.group.destroy(true);
    this.records.clear();
  }

  private spawnAngles(count: number): number[] {
    if (count === 1) {
      const angle = this.singleAngle;
      this.singleAngle *= -1;
      return [angle];
    }
    if (count === 2) return [-25, 25];
    if (count === 3) return [-30, 0, 30];
    throw new RangeError('temporary orb count must be from 1 through 3');
  }

  private createOrb(position: Vector, direction: Vector, generation: 0 | 1): void {
    const expiresAt = this.options.getGameplayElapsedMs() + GAME_TUNING.temporaryOrbs.lifetimeMs;
    const velocity = {
      x: direction.x * GAME_TUNING.temporaryOrbs.speed,
      y: direction.y * GAME_TUNING.temporaryOrbs.speed,
    };
    const sprite = this.group.create(
      position.x,
      position.y,
      this.options.textureKey ?? 'orb-temporary',
    ) as TemporaryOrbSprite;
    sprite.temporaryOrbId = this.nextId;
    sprite.expiresAt = expiresAt;
    this.nextId += 1;
    sprite
      .setCircle(GAME_TUNING.temporaryOrbs.radius)
      .setBounce(1, 1)
      .setCollideWorldBounds(true)
      .setVelocity(velocity.x, velocity.y);
    this.records.set(sprite, {
      id: sprite.temporaryOrbId,
      expiresAt,
      position: { ...position },
      velocity,
      generation,
      splitConsumed: false,
      sprite,
      enemyHits: new Map(),
    });
  }
}
