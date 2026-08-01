import type Phaser from 'phaser';
import { GAME_TUNING } from '../config/gameTuning';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants';
import { normalize, type Vector } from '../math/vector';
import type {
  OrbManager,
  OrbSprite,
  PermanentHitResult,
} from '../orbs/OrbManager';
import type { HitResult } from '../orbs/orbRules';
import type { TemporaryOrbManager, TemporaryOrbSprite } from '../orbs/TemporaryOrbManager';
import type {
  BossDirectHitEvent,
  BossEncounter,
  BossEncounterSnapshot,
} from './bossEncounter';
import { HIVE_BOSS_GEOMETRY, type HiveReflectorGeometry } from './hiveBossGeometry';
import { aimedBurst, aimedShot, fanShots } from './bossAttackPatterns';
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
const SHIELDED_TINT = 0x5d72ff;
const TELEGRAPH_TINT = 0xffd36a;
const ENRAGE_TINT = 0xff4d5a;
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
type HiveProjectileKind = 'hiveShooter' | 'hiveCore' | 'hiveEnrageFan' | 'hiveEnrageAimedBurst';
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
  | { kind: 'coreFan'; dueAt: number; marker: BossSprite }
  | { kind: 'hiveEnrageFan'; dueAt: number; marker: BossSprite; offsetDegrees: number }
  | { kind: 'hiveEnrageAimedBurst'; dueAt: number; marker: BossSprite; target: Vector };

interface PendingHit {
  result: HitResult | PermanentHitResult;
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
  phaseElapsedMs: number;
  parts: Record<HivePartId, number> | null;
  warnings: number;
  partPositions?: Record<HivePartId, Vector>;
}

export class HiveBossManager implements BossEncounter {
  declare debugAdvanceCycle?: (deltaMs: number) => void;
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
  private nextEnrageFanAt?: number;
  private nextEnrageAimedBurstAt?: number;
  private enrageFanCount = 0;
  private readonly unsubscribeOrbAdded: () => void;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly options: HiveBossManagerOptions,
  ) {
    const now = options.getGameplayElapsedMs();
    this.lastGameplayElapsedMs = now;
    this.nextShooterWarningAt = {
      leftShooter: Number.POSITIVE_INFINITY,
      rightShooter: Number.POSITIVE_INFINITY,
    };
    this.coreGroup = scene.physics.add.group({ allowGravity: false, immovable: true });
    this.moduleGroup = scene.physics.add.group({ allowGravity: false, immovable: true });
    this.warningGroup = scene.physics.add.group({ allowGravity: false, immovable: true });
    this.reflectorGroup = scene.physics.add.group({ allowGravity: false, immovable: true });
    this.bulletGroup = scene.physics.add.group({ allowGravity: false });

    const {
      core, shooters, reflectors, recalled,
    } = HIVE_BOSS_GEOMETRY;
    const leftReflectorX = midpoint(reflectors.leftReflector.travel);
    const rightReflectorX = midpoint(reflectors.rightReflector.travel);
    this.parts = {
      core: this.createPart(this.coreGroup, core.x, core.y, 'hive-core', core.width, core.height),
      leftShooter: this.createPart(
        this.moduleGroup,
        recalled.leftShooter.x,
        recalled.leftShooter.y,
        'hive-left-shooter',
        shooters.leftShooter.width,
        shooters.leftShooter.height,
      ),
      rightShooter: this.createPart(
        this.moduleGroup,
        recalled.rightShooter.x,
        recalled.rightShooter.y,
        'hive-right-shooter',
        shooters.rightShooter.width,
        shooters.rightShooter.height,
      ),
      leftReflector: this.createPart(
        this.reflectorGroup,
        recalled.leftReflector.x,
        recalled.leftReflector.y,
        'hive-left-reflector',
        reflectors.leftReflector.width,
        reflectors.leftReflector.height,
      ),
      rightReflector: this.createPart(
        this.reflectorGroup,
        recalled.rightReflector.x,
        recalled.rightReflector.y,
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
    if ((import.meta as ImportMeta & { env: { DEV: boolean } }).env.DEV) {
      this.debugAdvanceCycle = (deltaMs) => {
        if (!Number.isFinite(deltaMs) || deltaMs < 0) {
          throw new RangeError('hive cycle delta must be finite and non-negative');
        }
        const previousPhase = this.state.phase;
        this.state = advanceHiveCycle(this.state, deltaMs);
        if (this.state.phase !== previousPhase) this.onPhaseTransition(previousPhase);
        else if (this.state.phase === 'exposed' || this.state.phase === 'permanentlyExposed') {
          this.moveReflectors(deltaMs);
        }
        this.lastGameplayElapsedMs = this.options.getGameplayElapsedMs();
      };
    }
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
    this.synchronizeCoreVisual();
    this.cleanOffscreenBullets();
  }

  getSnapshot(): HiveBossManagerSnapshot {
    if (this.destroyed) {
      return {
        kind: 'hive',
        active: false,
        phase: null,
        phaseElapsedMs: 0,
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
      phaseElapsedMs: this.state.phaseElapsedMs,
      position: {
        x: HIVE_BOSS_GEOMETRY.core.x,
        y: HIVE_BOSS_GEOMETRY.core.y,
      },
      parts: { ...this.state.parts },
      bullets: this.getBulletCount(),
      warnings: this.warnings.length,
      warningKinds: this.warnings.map(({ kind }) => kind),
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
  ): HivePartId[] {
    if (this.destroyed || this.state.phase === 'defeated') return [];
    const eligible = new Set(exposedHiveParts(this.state));
    const targets = PART_ORDER
      .filter((partId) => eligible.has(partId) && partId !== excludedTargetId)
      .map((partId) => ({
        partId,
        distance: Math.hypot(
          this.parts[partId].x - center.x,
          this.parts[partId].y - center.y,
        ),
      }))
      .filter(({ distance }) => distance <= radius)
      .sort((left, right) => left.distance - right.distance || left.partId.localeCompare(right.partId))
      .slice(0, GAME_TUNING.bossAreaDamage.maxSecondaryTargets);
    for (const { partId } of targets) {
      this.damagePart(partId, damage * GAME_TUNING.bossAreaDamage.secondaryDamageScale);
    }
    return targets.map(({ partId }) => partId);
  }

  applyDirectDamage(targetId: string, damage: number): boolean {
    if (this.destroyed || this.state.phase === 'defeated') return false;
    const partId = exposedHiveParts(this.state).find((candidate) => candidate === targetId);
    if (!partId) return false;
    this.damagePart(partId, damage);
    return true;
  }

  applyLineDamage(
    axis: 'horizontal' | 'vertical',
    coordinate: number,
    thickness: number,
    damage: number,
    excludedTargetId?: string,
  ): HivePartId[] {
    const eligible = new Set(exposedHiveParts(this.state));
    const targets = PART_ORDER.filter((partId) => (
      eligible.has(partId)
      && partId !== excludedTargetId
      && Math.abs(
        (axis === 'horizontal' ? this.parts[partId].y : this.parts[partId].x) - coordinate,
      ) <= thickness / 2
    ));
    for (const partId of targets) this.damagePart(partId, damage);
    return targets;
  }

  getTargetPosition(targetId: string): Vector | null {
    const partId = exposedHiveParts(this.state).find((candidate) => candidate === targetId);
    const sprite = partId && this.parts[partId];
    return sprite ? { x: sprite.x, y: sprite.y } : null;
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
      this.isRecalledReflector(partId),
      Math.hypot(
        this.parts[partId].x - this.options.player.x,
        this.parts[partId].y - this.options.player.y,
      ),
    );
    if (!result) return false;
    const pending = this.createPending(result, partId, 'permanent', orb.orbId, orb);
    if (!result.reflect || this.isRecalledReflector(partId)) {
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
    if (!result.reflect || this.isRecalledReflector(partId)) {
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
    if (
      lastAcceptedAt !== undefined
      && now - lastAcceptedAt < GAME_TUNING.hiveBoss.reflector.hitCooldownMs
    ) return false;
    this.acceptedAt.set(key, now);
    return true;
  }

  private createPending(
    result: HitResult | PermanentHitResult,
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
    const previousHp = this.state.parts[pending.partId];
    this.damagePart(pending.partId, pending.result.damage);
    const core = pending.source === 'permanent'
      ? pending.result as PermanentHitResult
      : null;
    this.options.onDirectHit({
      bossKind: 'hive',
      targetId: pending.partId,
      source: pending.source,
      sourceOrbId: pending.sourceOrbId,
      position: { x: part.x, y: part.y },
      charged: pending.result.charged,
      direction: pending.direction,
      killed: previousHp > 0 && this.state.parts[pending.partId] === 0,
      ...(core ? {
        coreType: core.coreType,
        coreLevel: core.coreLevel,
        conductionTriggered: core.conductionTriggered,
        explosionFailures: core.explosionFailures,
        speedRatio: core.speedRatio,
        firstHitAfterProximity: core.firstHitAfterProximity,
        echoStacks: core.echoStacks,
      } : {}),
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
    else if (this.state.phase === 'permanentlyExposed') this.parts.core.setTint(ENRAGE_TINT);
    else this.parts.core.clearTint();
    const scale = this.state.phase === 'permanentlyExposed'
      ? 1 + Math.sin(this.state.phaseElapsedMs * Math.PI / 80) * 0.05
      : 1;
    this.parts.core.setScale(scale);
  }

  private onPhaseTransition(previousPhase: HivePhase): void {
    const now = this.options.getGameplayElapsedMs();
    if (this.state.phase === 'telegraph') this.createCoreWarning(
      now + GAME_TUNING.hiveBoss.timing.telegraphMs,
    );
    if (this.state.phase === 'permanentlyExposed') {
      this.cancelCoreWarnings();
      this.cancelAllShooterWarnings();
      this.stopShooterSchedules();
      this.nextEnrageFanAt = now + GAME_TUNING.projectiles.hiveEnrage.fan.intervalMs;
      this.nextEnrageAimedBurstAt = now + GAME_TUNING.projectiles.hiveEnrage.aimedBurst.intervalMs;
      this.enrageFanCount = 0;
    }
    if (this.state.phase === 'exposed') {
      this.deployModules();
      this.restartShooterSchedules(now);
    }
    if (this.state.phase === 'shielded' && previousPhase === 'exposed') {
      this.recallModules();
      this.cancelAllShooterWarnings();
      this.stopShooterSchedules();
      this.bulletGroup.clear(true, true);
    }
    this.synchronizeParts();
    this.options.onPhaseChanged?.(this.state.phase);
  }

  private recallModules(): void {
    for (const partId of [
      'leftShooter',
      'rightShooter',
      'leftReflector',
      'rightReflector',
    ] as const) {
      const position = HIVE_BOSS_GEOMETRY.recalled[partId];
      this.parts[partId].setPosition(position.x, position.y);
    }
  }

  private deployModules(): void {
    for (const partId of ['leftShooter', 'rightShooter'] as const) {
      const position = HIVE_BOSS_GEOMETRY.shooters[partId];
      this.parts[partId].setPosition(position.x, position.y);
    }
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
    if (this.state.phase !== 'exposed' && this.state.phase !== 'permanentlyExposed') return;
    if (this.state.phase === 'permanentlyExposed') {
      this.scheduleEnrageAttacks(now);
      return;
    }
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
  }

  private scheduleEnrageAttacks(now: number): void {
    const { fan, aimedBurst: burst } = GAME_TUNING.projectiles.hiveEnrage;
    if (this.nextEnrageFanAt !== undefined && now >= this.nextEnrageFanAt) {
      this.nextEnrageFanAt = nextFutureDeadline(this.nextEnrageFanAt, fan.intervalMs, now);
      if (
        this.hasHostileCapacity()
        && !this.warnings.some(({ kind }) => kind === 'hiveEnrageFan')
      ) {
        this.createEnrageFanWarning(
          now,
          (this.enrageFanCount % 2) * fan.alternatingOffsetDegrees,
        );
        this.enrageFanCount += 1;
      }
    }
    if (this.nextEnrageAimedBurstAt !== undefined && now >= this.nextEnrageAimedBurstAt) {
      this.nextEnrageAimedBurstAt = nextFutureDeadline(
        this.nextEnrageAimedBurstAt,
        burst.intervalMs,
        now,
      );
      if (
        this.hasHostileCapacity()
        && !this.warnings.some(({ kind }) => kind === 'hiveEnrageAimedBurst')
      ) this.createEnrageAimedBurstWarning(now);
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

  private createEnrageFanWarning(now: number, offsetDegrees: number): void {
    const marker = (this.warningGroup.create(
      HIVE_BOSS_GEOMETRY.core.x,
      HIVE_BOSS_GEOMETRY.core.y,
      'hive-core-warning',
    ) as BossSprite).setDepth(WARNING_DEPTH);
    this.warnings.push({
      kind: 'hiveEnrageFan',
      dueAt: now + GAME_TUNING.projectiles.hiveEnrage.fan.warningMs,
      offsetDegrees,
      marker,
    });
  }

  private createEnrageAimedBurstWarning(now: number): void {
    const marker = (this.warningGroup.create(
      HIVE_BOSS_GEOMETRY.core.x,
      HIVE_BOSS_GEOMETRY.core.y,
      'hive-core-warning',
    ) as BossSprite).setDepth(WARNING_DEPTH);
    this.warnings.push({
      kind: 'hiveEnrageAimedBurst',
      dueAt: now + GAME_TUNING.projectiles.hiveEnrage.aimedBurst.warningMs,
      target: { x: this.options.player.x, y: this.options.player.y },
      marker,
    });
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
      else if (warning.kind === 'hiveEnrageFan' && this.state.phase === 'permanentlyExposed') {
        this.fireEnrageFan(warning.offsetDegrees);
      } else if (warning.kind === 'hiveEnrageAimedBurst' && this.state.phase === 'permanentlyExposed') {
        this.fireEnrageAimedBurst(warning.target);
      }
      else if (
        warning.kind === 'shooter'
        && (this.state.phase === 'exposed' || this.state.phase === 'permanentlyExposed')
        && this.state.parts[warning.moduleId] > 0
      ) {
        this.fireShooter(warning.moduleId, warning.target);
      }
    }
    this.warnings = pending;
  }

  private fireShooter(moduleId: ShooterPartId, target: Vector): void {
    const tuning = GAME_TUNING.projectiles.hiveShooter;
    const origin = this.parts[moduleId];
    const shot = aimedShot(origin, target, tuning.speed, { x: 0, y: -1 });
    const bullet = this.bulletGroup.create(
      origin.x,
      origin.y,
      'hive-shooter-bullet',
    ) as HiveProjectileSprite;
    bullet.hiveProjectileKind = 'hiveShooter';
    bullet.setCircle(tuning.radius).setDepth(WARNING_DEPTH).setVelocity(
      shot.direction.x * shot.speed,
      shot.direction.y * shot.speed,
    );
  }

  private fireCoreFan(): void {
    const tuning = GAME_TUNING.projectiles.hiveCore;
    for (const shot of fanShots(
      { x: 0, y: 1 },
      tuning.speed,
      tuning.count,
      tuning.arcDegrees,
      tuning.offsetDegrees,
    )) {
      if (!this.hasHostileCapacity()) break;
      const bullet = this.bulletGroup.create(
        HIVE_BOSS_GEOMETRY.core.x,
        HIVE_BOSS_GEOMETRY.core.y,
        'hive-core-bullet',
      ) as HiveProjectileSprite;
      bullet.hiveProjectileKind = 'hiveCore';
      bullet.setCircle(tuning.radius).setDepth(WARNING_DEPTH).setVelocity(
        shot.direction.x * shot.speed,
        shot.direction.y * shot.speed,
      );
    }
  }

  private fireEnrageFan(offsetDegrees: number): void {
    const tuning = GAME_TUNING.projectiles.hiveEnrage.fan;
    for (const shot of fanShots({ x: 0, y: 1 }, tuning.speed, tuning.count, tuning.arcDegrees, offsetDegrees)) {
      if (!this.hasHostileCapacity()) break;
      this.createEnrageBullet('hiveEnrageFan', shot.direction, shot.speed, tuning.radius);
    }
  }

  private fireEnrageAimedBurst(target: Vector): void {
    const tuning = GAME_TUNING.projectiles.hiveEnrage.aimedBurst;
    for (const shot of aimedBurst(
      HIVE_BOSS_GEOMETRY.core,
      target,
      tuning.speed,
      tuning.count,
      tuning.spreadDegrees,
      { x: 0, y: 1 },
    )) {
      if (!this.hasHostileCapacity()) break;
      this.createEnrageBullet('hiveEnrageAimedBurst', shot.direction, shot.speed, tuning.radius);
    }
  }

  private createEnrageBullet(
    kind: Extract<HiveProjectileKind, 'hiveEnrageFan' | 'hiveEnrageAimedBurst'>,
    direction: Vector,
    speed: number,
    radius: number,
  ): void {
    const bullet = this.bulletGroup.create(
      HIVE_BOSS_GEOMETRY.core.x,
      HIVE_BOSS_GEOMETRY.core.y,
      'hive-core-bullet',
    ) as HiveProjectileSprite;
    bullet.hiveProjectileKind = kind;
    bullet.setCircle(radius).setDepth(WARNING_DEPTH).setVelocity(
      direction.x * speed,
      direction.y * speed,
    );
  }

  private hasHostileCapacity(): boolean {
    return this.options.getEnemyBulletCount() + this.getBulletCount()
      < GAME_TUNING.projectiles.hostileCap;
  }

  private consumeProjectile(projectile: HiveProjectileSprite): void {
    if (!projectile.active) return;
    const damage = projectile.hiveProjectileKind === 'hiveShooter'
      ? GAME_TUNING.projectiles.hiveShooter.damage
      : projectile.hiveProjectileKind === 'hiveEnrageFan'
        ? GAME_TUNING.projectiles.hiveEnrage.fan.damage
        : projectile.hiveProjectileKind === 'hiveEnrageAimedBurst'
          ? GAME_TUNING.projectiles.hiveEnrage.aimedBurst.damage
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

  private cancelAllShooterWarnings(): void {
    this.cancelShooterWarning('leftShooter');
    this.cancelShooterWarning('rightShooter');
  }

  private stopShooterSchedules(): void {
    this.nextShooterWarningAt.leftShooter = Number.POSITIVE_INFINITY;
    this.nextShooterWarningAt.rightShooter = Number.POSITIVE_INFINITY;
  }

  private restartShooterSchedules(now: number): void {
    const { intervalMs, offsetMs } = GAME_TUNING.projectiles.hiveShooter;
    this.nextShooterWarningAt.leftShooter = now + intervalMs;
    this.nextShooterWarningAt.rightShooter = now + intervalMs + offsetMs;
  }

  private isRecalledReflector(partId: HivePartId): boolean {
    return (partId === 'leftReflector' || partId === 'rightReflector')
      && this.state.phase !== 'exposed'
      && this.state.phase !== 'permanentlyExposed';
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

function nextFutureDeadline(deadline: number, intervalMs: number, now: number): number {
  return deadline + (Math.floor((now - deadline) / intervalMs) + 1) * intervalMs;
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
