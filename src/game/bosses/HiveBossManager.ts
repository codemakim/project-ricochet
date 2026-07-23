import type Phaser from 'phaser';
import { GAME_TUNING } from '../config/gameTuning';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants';
import { normalize, type Vector } from '../math/vector';
import type { OrbManager, OrbSprite } from '../orbs/OrbManager';
import type { HitResult } from '../orbs/orbRules';
import type { TemporaryOrbManager, TemporaryOrbSprite } from '../orbs/TemporaryOrbManager';
import type {
  BossDirectHitEvent,
  BossEncounter,
  BossEncounterSnapshot,
} from './bossEncounter';
import { HIVE_BOSS_GEOMETRY, type HiveReflectorGeometry } from './hiveBossGeometry';
import {
  advanceHiveCycle,
  createHiveBossState,
  damageHivePart,
  exposedHiveParts,
  type HiveBossState,
  type HivePartId,
  type HivePhase,
} from './hiveBossRules';

const PART_DEPTH = -2;
const WARNING_DEPTH = 1;
const HIT_DEBOUNCE_MS = 80;
const SHIELDED_TINT = 0x5d72ff;
const TELEGRAPH_TINT = 0xffd36a;
const PART_HIT_IDS: Record<HivePartId, number> = {
  core: -10,
  leftShooter: -11,
  rightShooter: -12,
  leftReflector: -13,
  rightReflector: -14,
};
const PART_ORDER = [
  'core',
  'leftShooter',
  'rightShooter',
  'leftReflector',
  'rightReflector',
] as const satisfies readonly HivePartId[];

type BossSprite = Phaser.Physics.Arcade.Sprite;
type HiveProjectileKind = 'hiveShooter' | 'hiveCore';
type HiveProjectileSprite = BossSprite & { hiveProjectileKind: HiveProjectileKind };
type ShooterPartId = 'leftShooter' | 'rightShooter';
type HiveWarning =
  | {
    kind: 'shooter';
    moduleId: ShooterPartId;
    dueAt: number;
    target: Vector;
    marker: BossSprite;
  }
  | { kind: 'coreFan'; dueAt: number; marker: BossSprite };

interface PendingHit {
  result: HitResult;
  partId: HivePartId;
  source: BossDirectHitEvent['source'];
  sourceOrbId: number;
  direction: Vector;
}

interface ReflectorMotion {
  x: number;
  direction: -1 | 1;
}

export interface HiveBossManagerOptions {
  player: Phaser.Physics.Arcade.Sprite;
  orbManager: OrbManager;
  temporaryOrbManager: TemporaryOrbManager;
  getEnemyBulletCount(): number;
  getGameplayElapsedMs(): number;
  onPlayerHit(damage: number): void;
  onDirectHit(event: BossDirectHitEvent): void;
  onPhaseChanged?(phase: HivePhase): void;
  onDefeated(): void;
}

export interface HiveBossManagerSnapshot extends BossEncounterSnapshot {
  kind: 'hive';
  phase: HivePhase | null;
  parts: Record<HivePartId, number> | null;
  warnings: number;
  partPositions?: Record<HivePartId, Vector>;
}

export class HiveBossManager implements BossEncounter {
  private readonly coreGroup: Phaser.Physics.Arcade.Group;
  private readonly moduleGroup: Phaser.Physics.Arcade.Group;
  private readonly warningGroup: Phaser.Physics.Arcade.Group;
  private readonly reflectorGroup: Phaser.Physics.Arcade.Group;
  private readonly bulletGroup: Phaser.Physics.Arcade.Group;
  private readonly parts: Record<HivePartId, BossSprite>;
  private readonly colliders: Phaser.Physics.Arcade.Collider[] = [];
  private readonly pendingHits = new Map<string, PendingHit>();
  private readonly acceptedAt = new Map<string, number>();
  private readonly reflectorMotion: Record<'leftReflector' | 'rightReflector', ReflectorMotion>;
  private state: HiveBossState = createHiveBossState();
  private lastGameplayElapsedMs: number;
  private destroyed = false;
  private defeatReported = false;
  private warnings: HiveWarning[] = [];
  private readonly nextShooterWarningAt: Record<ShooterPartId, number>;
  private nextCoreFanAt?: number;
  private readonly unsubscribeOrbAdded: () => void;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly options: HiveBossManagerOptions,
  ) {
    const now = options.getGameplayElapsedMs();
    this.lastGameplayElapsedMs = now;
    this.nextShooterWarningAt = {
      leftShooter: now + GAME_TUNING.projectiles.hiveShooter.intervalMs,
      rightShooter: now
        + GAME_TUNING.projectiles.hiveShooter.intervalMs
        + GAME_TUNING.projectiles.hiveShooter.offsetMs,
    };
    this.coreGroup = scene.physics.add.group({ allowGravity: false, immovable: true });
    this.moduleGroup = scene.physics.add.group({ allowGravity: false, immovable: true });
    this.warningGroup = scene.physics.add.group({ allowGravity: false, immovable: true });
    this.reflectorGroup = scene.physics.add.group({ allowGravity: false, immovable: true });
    this.bulletGroup = scene.physics.add.group({ allowGravity: false });

    const { core, shooters, reflectors } = HIVE_BOSS_GEOMETRY;
    const leftReflectorX = midpoint(reflectors.leftReflector.travel);
    const rightReflectorX = midpoint(reflectors.rightReflector.travel);
    this.parts = {
      core: this.createPart(this.coreGroup, core.x, core.y, 'hive-core', core.width, core.height),
      leftShooter: this.createPart(
        this.moduleGroup,
        shooters.leftShooter.x,
        shooters.leftShooter.y,
        'hive-left-shooter',
        shooters.leftShooter.width,
        shooters.leftShooter.height,
      ),
      rightShooter: this.createPart(
        this.moduleGroup,
        shooters.rightShooter.x,
        shooters.rightShooter.y,
        'hive-right-shooter',
        shooters.rightShooter.width,
        shooters.rightShooter.height,
      ),
      leftReflector: this.createPart(
        this.reflectorGroup,
        leftReflectorX,
        reflectors.leftReflector.y,
        'hive-left-reflector',
        reflectors.leftReflector.width,
        reflectors.leftReflector.height,
      ),
      rightReflector: this.createPart(
        this.reflectorGroup,
        rightReflectorX,
        reflectors.rightReflector.y,
        'hive-right-reflector',
        reflectors.rightReflector.width,
        reflectors.rightReflector.height,
      ),
    };
    this.reflectorMotion = {
      leftReflector: { x: leftReflectorX, direction: 1 },
      rightReflector: { x: rightReflectorX, direction: -1 },
    };

    this.synchronizeParts();
    for (const orb of options.orbManager.getSprites()) this.addPermanentOrbColliders(orb);
    this.unsubscribeOrbAdded = options.orbManager.onOrbAdded((orb) => {
      this.addPermanentOrbColliders(orb);
    });
    for (const partId of PART_ORDER) {
      this.addTemporaryCollider(options.temporaryOrbManager.getGroup(), partId);
    }
    this.colliders.push(scene.physics.add.overlap(
      options.player,
      this.bulletGroup,
      (_player, bullet) => this.consumeProjectile(bullet as HiveProjectileSprite),
    ));
  }

  update(): void {
    if (this.destroyed) return;
    const now = this.options.getGameplayElapsedMs();
    const deltaMs = Math.max(0, now - this.lastGameplayElapsedMs);
    this.lastGameplayElapsedMs = now;
    const previousPhase = this.state.phase;
    this.state = advanceHiveCycle(this.state, deltaMs);
    if (this.state.phase !== previousPhase) this.onPhaseTransition(previousPhase);
    if (
      this.state.phase === previousPhase
      && (this.state.phase === 'exposed' || this.state.phase === 'permanentlyExposed')
    ) {
      this.moveReflectors(deltaMs);
    }
    if (this.state.phase !== 'defeated') {
      this.scheduleAttacks(now);
      this.resolveWarnings(now);
    }
    this.cleanOffscreenBullets();
  }

  getSnapshot(): HiveBossManagerSnapshot {
    if (this.destroyed) {
      return {
        kind: 'hive',
        active: false,
        phase: null,
        position: null,
        parts: null,
        bullets: 0,
        warnings: 0,
        projectiles: [],
      };
    }
    return {
      kind: 'hive',
      active: true,
      phase: this.state.phase,
      position: {
        x: HIVE_BOSS_GEOMETRY.core.x,
        y: HIVE_BOSS_GEOMETRY.core.y,
      },
      parts: { ...this.state.parts },
      bullets: this.getBulletCount(),
      warnings: this.warnings.length,
      projectiles: this.activeProjectiles(),
      partPositions: Object.fromEntries(PART_ORDER.map((partId) => [
        partId,
        { x: this.parts[partId].x, y: this.parts[partId].y },
      ])) as Record<HivePartId, Vector>,
    };
  }

  getBulletCount(): number {
    return this.destroyed ? 0 : this.activeCount(this.bulletGroup);
  }

  applyAreaDamage(
    center: Vector,
    radius: number,
    damage: number,
    excludedTargetId?: string,
  ): HivePartId | null {
    if (this.destroyed || this.state.phase === 'defeated') return null;
    const eligible = new Set(exposedHiveParts(this.state));
    const target = PART_ORDER
      .filter((partId) => eligible.has(partId) && partId !== excludedTargetId)
      .map((partId) => ({
        partId,
        distance: Math.hypot(
          this.parts[partId].x - center.x,
          this.parts[partId].y - center.y,
        ),
      }))
      .filter(({ distance }) => distance <= radius)
      .sort((left, right) => (
        left.distance - right.distance
        || PART_ORDER.indexOf(left.partId) - PART_ORDER.indexOf(right.partId)
      ))[0];
    if (!target) return null;
    this.damagePart(target.partId, damage);
    return target.partId;
  }

  clearHostileActions(): void {
    if (this.destroyed) return;
    this.warningGroup.clear(true, true);
    this.bulletGroup.clear(true, true);
    this.warnings = [];
  }

  destroy(): void {
    if (this.destroyed) return;
    this.clearHostileActions();
    this.destroyed = true;
    this.unsubscribeOrbAdded();
    for (const collider of this.colliders) collider.destroy();
    this.colliders.length = 0;
    this.pendingHits.clear();
    this.acceptedAt.clear();
    this.coreGroup.destroy(true);
    this.moduleGroup.destroy(true);
    this.warningGroup.destroy(true);
    this.reflectorGroup.destroy(true);
    this.bulletGroup.destroy(true);
  }

  private createPart(
    group: Phaser.Physics.Arcade.Group,
    x: number,
    y: number,
    texture: string,
    width: number,
    height: number,
  ): BossSprite {
    return (group.create(x, y, texture) as BossSprite)
      .setImmovable(true)
      .setSize(width, height)
      .setDepth(PART_DEPTH);
  }

  private addPermanentOrbColliders(orb: OrbSprite): void {
    if (this.destroyed) return;
    for (const partId of PART_ORDER) {
      this.colliders.push(this.scene.physics.add.collider(
        orb,
        this.parts[partId],
        (orbObject) => this.finishPermanentHit(orbObject as OrbSprite, partId),
        (orbObject) => this.processPermanentHit(orbObject as OrbSprite, partId),
      ));
    }
  }

  private addTemporaryCollider(
    group: Phaser.Physics.Arcade.Group,
    partId: HivePartId,
  ): void {
    this.colliders.push(this.scene.physics.add.collider(
      group,
      this.parts[partId],
      (orbObject) => this.finishTemporaryHit(orbObject as TemporaryOrbSprite, partId),
      (orbObject) => this.processTemporaryHit(orbObject as TemporaryOrbSprite, partId),
    ));
  }

  private processPermanentHit(orb: OrbSprite, partId: HivePartId): boolean {
    if (!orb.active || !this.partCanCollide(partId)) return false;
    if (partId === 'core' && !this.coreIsExposed()) return true;
    const sourceKey = `permanent:${orb.orbId}`;
    if (!this.acceptHit(sourceKey, partId)) return false;
    const result = this.options.orbManager.handleEnemyHit(
      orb,
      PART_HIT_IDS[partId],
      this.state.parts[partId],
      this.options.getGameplayElapsedMs(),
      false,
    );
    if (!result) return false;
    const pending = this.createPending(result, partId, 'permanent', orb.orbId, orb);
    if (!result.reflect) {
      this.applyPendingHit(pending);
      return false;
    }
    this.pendingHits.set(`${sourceKey}:${partId}`, pending);
    return true;
  }

  private processTemporaryHit(orb: TemporaryOrbSprite, partId: HivePartId): boolean {
    if (!orb.active || !this.partCanCollide(partId)) return false;
    if (partId === 'core' && !this.coreIsExposed()) return true;
    const sourceKey = `temporary:${orb.temporaryOrbId}`;
    if (!this.acceptHit(sourceKey, partId)) return false;
    const result = this.options.temporaryOrbManager.handleEnemyHit(
      orb,
      PART_HIT_IDS[partId],
      this.state.parts[partId],
      this.options.getGameplayElapsedMs(),
    );
    if (!result) return false;
    const pending = this.createPending(result, partId, 'temporary', orb.temporaryOrbId, orb);
    if (!result.reflect) {
      this.applyPendingHit(pending);
      return false;
    }
    this.pendingHits.set(`${sourceKey}:${partId}`, pending);
    return true;
  }

  private finishPermanentHit(orb: OrbSprite, partId: HivePartId): void {
    if (partId === 'core' && !this.coreIsExposed()) {
      this.options.orbManager.synchronizeOrb(orb);
      return;
    }
    const key = `permanent:${orb.orbId}:${partId}`;
    const pending = this.pendingHits.get(key);
    if (!pending) return;
    this.pendingHits.delete(key);
    this.options.orbManager.synchronizeOrb(orb);
    this.applyPendingHit(pending);
  }

  private finishTemporaryHit(orb: TemporaryOrbSprite, partId: HivePartId): void {
    if (partId === 'core' && !this.coreIsExposed()) {
      this.options.temporaryOrbManager.synchronizeOrb(orb);
      return;
    }
    const key = `temporary:${orb.temporaryOrbId}:${partId}`;
    const pending = this.pendingHits.get(key);
    if (!pending) return;
    this.pendingHits.delete(key);
    this.options.temporaryOrbManager.synchronizeOrb(orb);
    this.applyPendingHit(pending);
  }

  private acceptHit(sourceKey: string, partId: HivePartId): boolean {
    const key = `${sourceKey}:${partId}`;
    const now = this.options.getGameplayElapsedMs();
    const lastAcceptedAt = this.acceptedAt.get(key);
    if (lastAcceptedAt !== undefined && now - lastAcceptedAt < HIT_DEBOUNCE_MS) return false;
    this.acceptedAt.set(key, now);
    return true;
  }

  private createPending(
    result: HitResult,
    partId: HivePartId,
    source: BossDirectHitEvent['source'],
    sourceOrbId: number,
    orb: Phaser.Physics.Arcade.Sprite,
  ): PendingHit {
    return {
      result,
      partId,
      source,
      sourceOrbId,
      direction: normalize((orb.body as Phaser.Physics.Arcade.Body).velocity),
    };
  }

  private applyPendingHit(pending: PendingHit): void {
    if (!exposedHiveParts(this.state).includes(pending.partId)) return;
    const part = this.parts[pending.partId];
    this.damagePart(pending.partId, pending.result.damage);
    this.options.onDirectHit({
      bossKind: 'hive',
      targetId: pending.partId,
      source: pending.source,
      sourceOrbId: pending.sourceOrbId,
      position: { x: part.x, y: part.y },
      charged: pending.result.charged,
      direction: pending.direction,
    });
  }

  private damagePart(partId: HivePartId, damage: number): void {
    const previousPhase = this.state.phase;
    this.state = damageHivePart(this.state, partId, damage);
    if (this.state.phase !== previousPhase) {
      this.lastGameplayElapsedMs = this.options.getGameplayElapsedMs();
    }
    this.synchronizeParts();
    if (this.state.parts[partId] === 0 && isShooter(partId)) {
      this.cancelShooterWarning(partId);
    }
    if (this.state.phase !== previousPhase) this.onPhaseTransition(previousPhase);
    if (this.state.phase === 'defeated') this.reportDefeat();
  }

  private reportDefeat(): void {
    if (this.defeatReported) return;
    this.defeatReported = true;
    this.clearHostileActions();
    this.options.onDefeated();
  }

  private partCanCollide(partId: HivePartId): boolean {
    return this.state.phase !== 'defeated'
      && this.state.parts[partId] > 0
      && (this.parts[partId].body as Phaser.Physics.Arcade.Body).enable;
  }

  private coreIsExposed(): boolean {
    return this.state.phase === 'exposed' || this.state.phase === 'permanentlyExposed';
  }

  private synchronizeParts(): void {
    for (const partId of PART_ORDER) {
      const alive = this.state.phase !== 'defeated' && this.state.parts[partId] > 0;
      const body = this.parts[partId].body as Phaser.Physics.Arcade.Body;
      body.enable = alive;
      this.parts[partId].setVisible(alive);
    }
    this.synchronizeCoreVisual();
  }

  private synchronizeCoreVisual(): void {
    if (this.state.phase === 'shielded') this.parts.core.setTint(SHIELDED_TINT);
    else if (this.state.phase === 'telegraph') this.parts.core.setTint(TELEGRAPH_TINT);
    else this.parts.core.clearTint();
  }

  private onPhaseTransition(previousPhase: HivePhase): void {
    const now = this.options.getGameplayElapsedMs();
    if (this.state.phase === 'telegraph') this.createCoreWarning(
      now + GAME_TUNING.hiveBoss.timing.telegraphMs,
    );
    if (this.state.phase === 'permanentlyExposed') {
      this.cancelCoreWarnings();
      this.nextCoreFanAt = now + GAME_TUNING.projectiles.hiveCore.intervalMs;
    }
    if (this.state.phase === 'shielded' && previousPhase === 'exposed') this.recallReflectors();
    this.synchronizeParts();
    this.options.onPhaseChanged?.(this.state.phase);
  }

  private recallReflectors(): void {
    for (const partId of ['leftReflector', 'rightReflector'] as const) {
      const geometry = HIVE_BOSS_GEOMETRY.reflectors[partId];
      const x = midpoint(geometry.travel);
      this.reflectorMotion[partId] = {
        x,
        direction: partId === 'leftReflector' ? 1 : -1,
      };
      this.parts[partId].setPosition(x, geometry.y);
    }
  }

  private moveReflectors(deltaMs: number): void {
    for (const partId of ['leftReflector', 'rightReflector'] as const) {
      if (this.state.parts[partId] === 0) continue;
      const geometry = HIVE_BOSS_GEOMETRY.reflectors[partId];
      const motion = moveWithinPath(
        this.reflectorMotion[partId],
        geometry,
        GAME_TUNING.hiveBoss.reflector.speed * deltaMs / 1000,
      );
      this.reflectorMotion[partId] = motion;
      this.parts[partId].setPosition(motion.x, geometry.y);
    }
  }

  private scheduleAttacks(now: number): void {
    for (const moduleId of ['leftShooter', 'rightShooter'] as const) {
      if (now < this.nextShooterWarningAt[moduleId]) continue;
      this.nextShooterWarningAt[moduleId] = now
        + GAME_TUNING.projectiles.hiveShooter.intervalMs;
      if (
        this.state.parts[moduleId] > 0
        && !this.warnings.some((warning) => (
          warning.kind === 'shooter' && warning.moduleId === moduleId
        ))
        && this.hasHostileCapacity()
      ) {
        this.createShooterWarning(moduleId, now);
      }
    }
    if (
      this.state.phase === 'permanentlyExposed'
      && this.nextCoreFanAt !== undefined
      && now >= this.nextCoreFanAt
    ) {
      this.nextCoreFanAt = now + GAME_TUNING.projectiles.hiveCore.intervalMs;
      this.createCoreWarning(now);
    }
  }

  private createShooterWarning(moduleId: ShooterPartId, now: number): void {
    const target = { x: this.options.player.x, y: this.options.player.y };
    const marker = (this.warningGroup.create(
      target.x,
      target.y,
      'hive-shooter-warning',
    ) as BossSprite).setDepth(WARNING_DEPTH);
    this.warnings.push({
      kind: 'shooter',
      moduleId,
      dueAt: now + GAME_TUNING.projectiles.hiveShooter.warningMs,
      target,
      marker,
    });
  }

  private createCoreWarning(dueAt: number): void {
    if (!this.hasHostileCapacity()) return;
    const marker = (this.warningGroup.create(
      HIVE_BOSS_GEOMETRY.core.x,
      HIVE_BOSS_GEOMETRY.core.y,
      'hive-core-warning',
    ) as BossSprite).setDepth(WARNING_DEPTH);
    this.warnings.push({ kind: 'coreFan', dueAt, marker });
  }

  private resolveWarnings(now: number): void {
    const pending: HiveWarning[] = [];
    for (const warning of this.warnings) {
      if (now < warning.dueAt) {
        pending.push(warning);
        continue;
      }
      warning.marker.destroy();
      if (!this.hasHostileCapacity()) continue;
      if (warning.kind === 'coreFan') this.fireCoreFan();
      else if (this.state.parts[warning.moduleId] > 0) {
        this.fireShooter(warning.moduleId, warning.target);
      }
    }
    this.warnings = pending;
  }

  private fireShooter(moduleId: ShooterPartId, target: Vector): void {
    const tuning = GAME_TUNING.projectiles.hiveShooter;
    const origin = this.parts[moduleId];
    const direction = normalize({ x: target.x - origin.x, y: target.y - origin.y });
    const bullet = this.bulletGroup.create(
      origin.x,
      origin.y,
      'hive-shooter-bullet',
    ) as HiveProjectileSprite;
    bullet.hiveProjectileKind = 'hiveShooter';
    bullet.setCircle(tuning.radius).setDepth(WARNING_DEPTH).setVelocity(
      direction.x * tuning.speed,
      direction.y * tuning.speed,
    );
  }

  private fireCoreFan(): void {
    const tuning = GAME_TUNING.projectiles.hiveCore;
    for (const degrees of tuning.fanDegrees) {
      if (!this.hasHostileCapacity()) break;
      const radians = degrees * Math.PI / 180;
      const bullet = this.bulletGroup.create(
        HIVE_BOSS_GEOMETRY.core.x,
        HIVE_BOSS_GEOMETRY.core.y,
        'hive-core-bullet',
      ) as HiveProjectileSprite;
      bullet.hiveProjectileKind = 'hiveCore';
      bullet.setCircle(tuning.radius).setDepth(WARNING_DEPTH).setVelocity(
        Math.sin(radians) * tuning.speed,
        Math.cos(radians) * tuning.speed,
      );
    }
  }

  private hasHostileCapacity(): boolean {
    return this.options.getEnemyBulletCount() + this.getBulletCount()
      < GAME_TUNING.projectiles.hostileCap;
  }

  private consumeProjectile(projectile: HiveProjectileSprite): void {
    if (!projectile.active) return;
    const damage = projectile.hiveProjectileKind === 'hiveShooter'
      ? GAME_TUNING.projectiles.hiveShooter.damage
      : GAME_TUNING.projectiles.hiveCore.damage;
    projectile.destroy();
    this.options.onPlayerHit(damage);
  }

  private cleanOffscreenBullets(): void {
    const margin = GAME_TUNING.projectiles.offscreenMargin;
    for (const bullet of this.bulletGroup.getChildren() as BossSprite[]) {
      if (bullet.active && (
        bullet.x < -margin
        || bullet.x > GAME_WIDTH + margin
        || bullet.y < -margin
        || bullet.y > GAME_HEIGHT + margin
      )) bullet.destroy();
    }
  }

  private cancelShooterWarning(moduleId: ShooterPartId): void {
    this.warnings = this.warnings.filter((warning) => {
      if (warning.kind !== 'shooter' || warning.moduleId !== moduleId) return true;
      warning.marker.destroy();
      return false;
    });
  }

  private cancelCoreWarnings(): void {
    this.warnings = this.warnings.filter((warning) => {
      if (warning.kind !== 'coreFan') return true;
      warning.marker.destroy();
      return false;
    });
  }

  private activeProjectiles(): BossEncounterSnapshot['projectiles'] {
    return (this.bulletGroup.getChildren() as HiveProjectileSprite[])
      .filter((projectile) => projectile.active)
      .map((projectile) => ({
        kind: projectile.hiveProjectileKind,
        position: { x: projectile.x, y: projectile.y },
        velocity: { ...(projectile.body as Phaser.Physics.Arcade.Body).velocity },
      }));
  }

  private activeCount(group: Phaser.Physics.Arcade.Group): number {
    return (group.getChildren() as BossSprite[]).filter((sprite) => sprite.active).length;
  }
}

function midpoint(range: { minimum: number; maximum: number }): number {
  return (range.minimum + range.maximum) / 2;
}

function isShooter(partId: HivePartId): partId is ShooterPartId {
  return partId === 'leftShooter' || partId === 'rightShooter';
}

function moveWithinPath(
  motion: ReflectorMotion,
  geometry: HiveReflectorGeometry,
  distance: number,
): ReflectorMotion {
  const span = geometry.travel.maximum - geometry.travel.minimum;
  if (span <= 0 || distance === 0) return motion;
  const initial = motion.direction === 1
    ? motion.x - geometry.travel.minimum
    : span + geometry.travel.maximum - motion.x;
  const cycle = (initial + distance) % (span * 2);
  if (cycle <= span) {
    return { x: geometry.travel.minimum + cycle, direction: 1 };
  }
  return { x: geometry.travel.maximum - (cycle - span), direction: -1 };
}
