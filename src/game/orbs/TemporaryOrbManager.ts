import type Phaser from 'phaser';
import { normalize, type Vector } from '../math/vector';
import type { HitResult } from './orbRules';

const TEMPORARY_ORB_RADIUS = 6;
const TEMPORARY_ORB_SPEED = 440;
const TEMPORARY_ORB_CAP = 12;
const TEMPORARY_ORB_LIFETIME_MS = 1500;
const HIT_COOLDOWN_MS = 80;

export type TemporaryOrbSprite = Phaser.Physics.Arcade.Sprite & {
  temporaryOrbId: number;
  expiresAt: number;
};

export interface TemporaryOrbSnapshot {
  id: number;
  expiresAt: number;
  position: Vector;
  velocity: Vector;
}

interface TemporaryOrbRecord extends TemporaryOrbSnapshot {
  sprite: TemporaryOrbSprite;
  enemyHits: Map<number, number>;
}

export interface TemporaryOrbManagerOptions {
  getDirectDamageBonus(): number;
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
  private singleAngle = -25;
  private destroyed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly options: TemporaryOrbManagerOptions,
  ) {
    this.group = scene.physics.add.group({ allowGravity: false });
  }

  spawn(position: Vector, direction: Vector, count: number): number {
    if (this.destroyed || count <= 0) return 0;
    const available = TEMPORARY_ORB_CAP - this.records.size;
    const spawnCount = Math.min(count, available);
    if (spawnCount <= 0) return 0;

    const angles = this.spawnAngles(count).slice(0, spawnCount);
    const incoming = normalize(direction);
    for (const angle of angles) {
      const launch = rotate(incoming, angle);
      const expiresAt = this.scene.time.now + TEMPORARY_ORB_LIFETIME_MS;
      const sprite = this.group.create(
        position.x,
        position.y,
        this.options.textureKey ?? 'orb-temporary',
      ) as TemporaryOrbSprite;
      sprite.temporaryOrbId = this.nextId;
      sprite.expiresAt = expiresAt;
      this.nextId += 1;
      sprite
        .setCircle(TEMPORARY_ORB_RADIUS)
        .setBounce(1, 1)
        .setCollideWorldBounds(true)
        .setVelocity(launch.x * TEMPORARY_ORB_SPEED, launch.y * TEMPORARY_ORB_SPEED);
      this.records.set(sprite, {
        id: sprite.temporaryOrbId,
        expiresAt,
        position: { ...position },
        velocity: {
          x: launch.x * TEMPORARY_ORB_SPEED,
          y: launch.y * TEMPORARY_ORB_SPEED,
        },
        sprite,
        enemyHits: new Map(),
      });
    }
    return spawnCount;
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
    if (lastHitMs !== undefined && nowMs - lastHitMs < HIT_COOLDOWN_MS) return null;
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
}
