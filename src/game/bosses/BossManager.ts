import type Phaser from 'phaser';
import { GAME_TUNING } from '../config/gameTuning';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants';
import type { EnemySnapshot } from '../enemies/EnemyManager';
import { clamp, normalize, type Vector } from '../math/vector';
import type { OrbManager, OrbSprite } from '../orbs/OrbManager';
import type { HitResult } from '../orbs/orbRules';
import type { TemporaryOrbManager, TemporaryOrbSprite } from '../orbs/TemporaryOrbManager';
import type {
  BossDirectHitEvent,
  BossEncounter,
  BossEncounterSnapshot,
  BossProjectileSnapshot as CommonBossProjectileSnapshot,
} from './bossEncounter';
import { BOSS_GEOMETRY } from './bossGeometry';
import { updateBossMotion, type BossMotion, type HorizontalInterval } from './bossMovementRules';
import {
  bossPhase,
  createBossState,
  damageBossPart,
  exposedBossParts,
  nextBossAttack,
  type BossPartId,
  type BossPhase,
  type BossState,
} from './bossRules';

const BOSS_BODY_DEPTH = -3;
const BOSS_PART_DEPTH = -2;
const BOSS_ACTION_DEPTH = 1;

const PART_HIT_IDS: Record<BossPartId, number> = {
  leftWeakpoint: -1,
  rightWeakpoint: -2,
  core: -3,
};

type BossSprite = Phaser.Physics.Arcade.Sprite;
type BossProjectileKind = 'basic' | 'aimed';
type BossProjectileSprite = BossSprite & { bossProjectileKind: BossProjectileKind };
type Warning =
  | { kind: 'basicShot'; dueAt: number; marker: BossSprite }
  | { kind: 'aimedShot'; dueAt: number; marker: BossSprite; target: Vector }
  | { kind: 'supportDrop'; dueAt: number; marker: BossSprite; x: number };

interface PendingHit {
  result: HitResult;
  partId: BossPartId;
  source: BossDirectHitEvent['source'];
  direction: Vector;
}

export type { BossDirectHitEvent } from './bossEncounter';

export interface BossManagerOptions {
  player: Phaser.Physics.Arcade.Sprite;
  orbManager: OrbManager;
  temporaryOrbManager: TemporaryOrbManager;
  getEnemies(): readonly EnemySnapshot[];
  getEnemyBulletCount(): number;
  getGameplayElapsedMs(): number;
  onPlayerHit(damage: number): void;
  onDirectHit(event: BossDirectHitEvent): void;
  onDefeated(): void;
}

export interface BossManagerSnapshot extends BossEncounterSnapshot {
  kind: 'sentinel';
  active: boolean;
  phase: BossPhase | null;
  position: Vector | null;
  parts: Record<BossPartId, number> | null;
  bullets: number;
  basicBullets: number;
  aimedBullets: number;
  fallingHazards: number;
  warnings: number;
  projectiles: BossProjectileSnapshot[];
}

export interface BossProjectileSnapshot extends CommonBossProjectileSnapshot {
  kind: BossProjectileKind;
}

export class BossManager implements BossEncounter {
  declare debugSetPosition?: (x: number) => void;

  private readonly body: BossSprite;
  private readonly partSprites: Record<BossPartId, BossSprite>;
  private readonly aimedBulletGroup: Phaser.Physics.Arcade.Group;
  private readonly fallingHazardGroup: Phaser.Physics.Arcade.Group;
  private readonly warningGroup: Phaser.Physics.Arcade.Group;
  private readonly colliders: Phaser.Physics.Arcade.Collider[] = [];
  private readonly pendingHits = new Map<string, PendingHit>();
  private readonly acceptedAt = new Map<string, number>();
  private warnings: Warning[] = [];
  private state: BossState = createBossState();
  private motion: BossMotion = { x: GAME_WIDTH / 2, direction: 1 };
  private lastGameplayElapsedMs: number;
  private nextAttackAt: number;
  private nextBasicShotAt: number;
  private destroyed = false;
  private defeatReported = false;
  private readonly unsubscribeOrbAdded: () => void;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly options: BossManagerOptions,
  ) {
    const now = options.getGameplayElapsedMs();
    this.lastGameplayElapsedMs = now;
    this.nextAttackAt = now + nextBossAttack(this.state).intervalMs;
    this.nextBasicShotAt = now + GAME_TUNING.projectiles.bossBasic.intervalMs;

    this.body = scene.physics.add.sprite(this.motion.x, GAME_TUNING.boss.y, 'boss-body');
    this.body
      .setImmovable(true)
      .setSize(GAME_TUNING.boss.body.width, GAME_TUNING.boss.body.height)
      .setDepth(BOSS_BODY_DEPTH);
    this.partSprites = {
      leftWeakpoint: scene.physics.add.sprite(
        this.motion.x - BOSS_GEOMETRY.weakpointOffsetX,
        GAME_TUNING.boss.y,
        'boss-left-weakpoint',
      ),
      rightWeakpoint: scene.physics.add.sprite(
        this.motion.x + BOSS_GEOMETRY.weakpointOffsetX,
        GAME_TUNING.boss.y,
        'boss-right-weakpoint',
      ),
      core: scene.physics.add.sprite(this.motion.x, GAME_TUNING.boss.y, 'boss-core'),
    };
    this.partSprites.leftWeakpoint
      .setImmovable(true)
      .setSize(
        GAME_TUNING.boss.weakpoint.hitbox.width,
        GAME_TUNING.boss.weakpoint.hitbox.height,
      )
      .setDepth(BOSS_PART_DEPTH);
    this.partSprites.rightWeakpoint
      .setImmovable(true)
      .setSize(
        GAME_TUNING.boss.weakpoint.hitbox.width,
        GAME_TUNING.boss.weakpoint.hitbox.height,
      )
      .setDepth(BOSS_PART_DEPTH);
    this.partSprites.core
      .setImmovable(true)
      .setSize(GAME_TUNING.boss.core.hitboxSize, GAME_TUNING.boss.core.hitboxSize)
      .setDepth(BOSS_PART_DEPTH)
      .setVisible(false);
    (this.partSprites.core.body as Phaser.Physics.Arcade.Body).enable = false;

    this.aimedBulletGroup = scene.physics.add.group({ allowGravity: false });
    this.fallingHazardGroup = scene.physics.add.group({ allowGravity: false });
    this.warningGroup = scene.physics.add.group({ allowGravity: false, immovable: true });

    for (const orb of options.orbManager.getSprites()) {
      this.addPermanentOrbColliders(orb);
    }
    this.unsubscribeOrbAdded = options.orbManager.onOrbAdded((orb) => this.addPermanentOrbColliders(orb));
    this.addTemporaryCollider(options.temporaryOrbManager.getGroup(), this.body, null);
    for (const partId of this.partIds()) {
      this.addTemporaryCollider(options.temporaryOrbManager.getGroup(), this.partSprites[partId], partId);
    }
    this.colliders.push(scene.physics.add.overlap(
      options.player,
      this.aimedBulletGroup,
      (_player, bullet) => this.consumeBossProjectile(bullet as BossProjectileSprite),
    ));
    this.colliders.push(scene.physics.add.overlap(
      options.player,
      this.fallingHazardGroup,
      (_player, hazard) => this.consumeHostile(
        hazard as BossSprite,
        GAME_TUNING.projectiles.bossSupport.damage,
      ),
    ));
    if ((import.meta as ImportMeta & { env: { DEV: boolean } }).env.DEV) {
      this.debugSetPosition = (x) => {
        if (
          !Number.isFinite(x)
          || x < BOSS_GEOMETRY.movementBounds.minimum
          || x > BOSS_GEOMETRY.movementBounds.maximum
        ) {
          throw new RangeError('boss x must be finite and within movement bounds');
        }
        this.motion = { x, direction: 1 };
        this.positionBossSprites();
      };
    }
  }

  update(): void {
    if (this.destroyed) return;
    const now = this.options.getGameplayElapsedMs();
    const deltaMs = Math.max(0, now - this.lastGameplayElapsedMs);
    this.lastGameplayElapsedMs = now;

    if (bossPhase(this.state) !== 'defeated') {
      this.motion = updateBossMotion(this.motion, deltaMs, this.enemyObstacles());
      this.positionBossSprites();
      this.scheduleAttacks(now);
      this.resolveWarnings(now);
    }
    this.cleanOffscreenHostiles();
  }

  getSnapshot(): BossManagerSnapshot {
    if (this.destroyed) {
      return {
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
      };
    }
    const projectiles = this.activeProjectiles();
    return {
      kind: 'sentinel',
      active: true,
      phase: bossPhase(this.state),
      position: { x: this.motion.x, y: GAME_TUNING.boss.y },
      parts: {
        leftWeakpoint: this.state.leftWeakpointHp,
        rightWeakpoint: this.state.rightWeakpointHp,
        core: this.state.coreHp,
      },
      bullets: this.getBulletCount(),
      basicBullets: projectiles.filter(({ kind }) => kind === 'basic').length,
      aimedBullets: projectiles.filter(({ kind }) => kind === 'aimed').length,
      fallingHazards: this.activeCount(this.fallingHazardGroup),
      warnings: this.warnings.length,
      projectiles,
    };
  }

  getBulletCount(): number {
    return this.destroyed ? 0 : this.activeCount(this.aimedBulletGroup);
  }

  applyAreaDamage(
    center: Vector,
    radius: number,
    damage: number,
    excludedTargetId?: string,
  ): BossPartId | null {
    if (this.destroyed || bossPhase(this.state) === 'defeated') return null;
    const target = exposedBossParts(this.state)
      .filter((partId) => partId !== excludedTargetId)
      .map((partId) => ({
        partId,
        distance: Math.hypot(
          this.partSprites[partId].x - center.x,
          this.partSprites[partId].y - center.y,
        ),
      }))
      .filter(({ distance }) => distance <= radius)
      .sort((left, right) => left.distance - right.distance || this.partOrder(left.partId) - this.partOrder(right.partId))[0];
    if (!target) return null;
    this.damagePart(target.partId, damage);
    return target.partId;
  }

  clearHostileActions(): void {
    if (this.destroyed) return;
    this.clearGroup(this.aimedBulletGroup);
    this.clearGroup(this.fallingHazardGroup);
    this.clearGroup(this.warningGroup);
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
    this.body.destroy();
    for (const sprite of Object.values(this.partSprites)) sprite.destroy();
    this.aimedBulletGroup.destroy(true);
    this.fallingHazardGroup.destroy(true);
    this.warningGroup.destroy(true);
    this.debugSetPosition = undefined;
  }

  private addPermanentCollider(orb: OrbSprite, target: BossSprite, partId: BossPartId | null): void {
    this.colliders.push(this.scene.physics.add.collider(
      orb,
      target,
      (orbObject, targetObject) => this.finishPermanentHit(
        orbObject as OrbSprite,
        targetObject as BossSprite,
        partId,
      ),
      (orbObject) => this.processPermanentHit(orbObject as OrbSprite, partId),
    ));
  }

  private addPermanentOrbColliders(orb: OrbSprite): void {
    if (this.destroyed) return;
    this.addPermanentCollider(orb, this.body, null);
    for (const partId of this.partIds()) {
      this.addPermanentCollider(orb, this.partSprites[partId], partId);
    }
  }

  private addTemporaryCollider(
    group: Phaser.Physics.Arcade.Group,
    target: BossSprite,
    partId: BossPartId | null,
  ): void {
    this.colliders.push(this.scene.physics.add.collider(
      group,
      target,
      (orbObject, targetObject) => this.finishTemporaryHit(
        orbObject as TemporaryOrbSprite,
        targetObject as BossSprite,
        partId,
      ),
      (orbObject) => this.processTemporaryHit(orbObject as TemporaryOrbSprite, partId),
    ));
  }

  private processPermanentHit(orb: OrbSprite, partId: BossPartId | null): boolean {
    if (!orb.active) return false;
    if (partId === null) return this.processBodyReflection(orb);
    if (!this.canHitPart(orb, `permanent:${orb.orbId}`, partId)) return false;
    const result = this.options.orbManager.handleEnemyHit(
      orb,
      PART_HIT_IDS[partId],
      this.partHp(partId),
      this.options.getGameplayElapsedMs(),
      false,
    );
    if (!result) return false;
    const pending = this.createPending(result, partId, 'permanent', orb);
    if (!result.reflect) {
      this.applyPendingHit(pending);
      return false;
    }
    this.pendingHits.set(`permanent:${orb.orbId}:${partId}`, pending);
    return true;
  }

  private processTemporaryHit(orb: TemporaryOrbSprite, partId: BossPartId | null): boolean {
    if (!orb.active) return false;
    if (partId === null) return this.processBodyReflection(orb);
    if (!this.canHitPart(orb, `temporary:${orb.temporaryOrbId}`, partId)) return false;
    const result = this.options.temporaryOrbManager.handleEnemyHit(
      orb,
      PART_HIT_IDS[partId],
      this.partHp(partId),
      this.options.getGameplayElapsedMs(),
    );
    if (!result) return false;
    const pending = this.createPending(result, partId, 'temporary', orb);
    if (!result.reflect) {
      this.applyPendingHit(pending);
      return false;
    }
    this.pendingHits.set(`temporary:${orb.temporaryOrbId}:${partId}`, pending);
    return true;
  }

  private processBodyReflection(orb: Phaser.Physics.Arcade.Sprite): boolean {
    if (!(this.body.body as Phaser.Physics.Arcade.Body).enable) return false;
    return orb.active && !exposedBossParts(this.state).some((partId) => (
      this.arcadeBodiesIntersect(orb, this.partSprites[partId])
    ));
  }

  private arcadeBodiesIntersect(
    firstSprite: Phaser.Physics.Arcade.Sprite,
    secondSprite: Phaser.Physics.Arcade.Sprite,
  ): boolean {
    const first = firstSprite.body as Phaser.Physics.Arcade.Body;
    const second = secondSprite.body as Phaser.Physics.Arcade.Body;
    if (!first.enable || !second.enable) return false;
    if (first.isCircle && second.isCircle) {
      return Math.hypot(
        first.center.x - second.center.x,
        first.center.y - second.center.y,
      ) <= first.halfWidth + second.halfWidth;
    }
    if (first.isCircle) return this.circleIntersectsBody(first, second);
    if (second.isCircle) return this.circleIntersectsBody(second, first);
    return first.left <= second.right && first.right >= second.left
      && first.top <= second.bottom && first.bottom >= second.top;
  }

  private circleIntersectsBody(
    circle: Phaser.Physics.Arcade.Body,
    body: Phaser.Physics.Arcade.Body,
  ): boolean {
    const closestX = clamp(circle.center.x, body.left, body.right);
    const closestY = clamp(circle.center.y, body.top, body.bottom);
    return Math.hypot(
      circle.center.x - closestX,
      circle.center.y - closestY,
    ) <= circle.halfWidth;
  }

  private finishPermanentHit(orb: OrbSprite, _target: BossSprite, partId: BossPartId | null): void {
    if (partId === null) {
      this.options.orbManager.synchronizeOrb(orb);
      return;
    }
    const pending = this.pendingHits.get(`permanent:${orb.orbId}:${partId}`);
    if (!pending) return;
    this.pendingHits.delete(`permanent:${orb.orbId}:${partId}`);
    this.options.orbManager.synchronizeOrb(orb);
    this.applyPendingHit(pending);
  }

  private finishTemporaryHit(
    orb: TemporaryOrbSprite,
    _target: BossSprite,
    partId: BossPartId | null,
  ): void {
    if (partId === null) {
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

  private canHitPart(
    orb: Phaser.Physics.Arcade.Sprite,
    sourceKey: string,
    partId: BossPartId,
  ): boolean {
    if (!exposedBossParts(this.state).includes(partId)) return false;
    if (!(this.partSprites[partId].body as Phaser.Physics.Arcade.Body).enable) return false;
    const now = this.options.getGameplayElapsedMs();
    if (this.acceptedAt.get(sourceKey) === now) return false;
    this.acceptedAt.set(sourceKey, now);
    return orb.active;
  }

  private createPending(
    result: HitResult,
    partId: BossPartId,
    source: BossDirectHitEvent['source'],
    orb: Phaser.Physics.Arcade.Sprite,
  ): PendingHit {
    const body = orb.body as Phaser.Physics.Arcade.Body;
    return { result, partId, source, direction: normalize(body.velocity) };
  }

  private applyPendingHit(pending: PendingHit): void {
    if (!exposedBossParts(this.state).includes(pending.partId)) return;
    const part = this.partSprites[pending.partId];
    const defeated = this.damagePart(pending.partId, pending.result.damage, false);
    this.options.onDirectHit({
      bossKind: 'sentinel',
      targetId: pending.partId,
      source: pending.source,
      position: { x: part.x, y: part.y },
      charged: pending.result.charged,
      direction: pending.direction,
    });
    if (defeated) this.reportDefeat();
  }

  private damagePart(partId: BossPartId, damage: number, reportDefeat = true): boolean {
    const previousPhase = bossPhase(this.state);
    this.state = damageBossPart(this.state, partId, damage);
    const phase = bossPhase(this.state);
    this.synchronizePartBodies();
    if (phase !== previousPhase && phase !== 'defeated') {
      this.nextAttackAt = this.options.getGameplayElapsedMs() + nextBossAttack(this.state).intervalMs;
    }
    const defeated = phase === 'defeated';
    if (defeated && reportDefeat) this.reportDefeat();
    return defeated;
  }

  private reportDefeat(): void {
    if (this.defeatReported) return;
    this.defeatReported = true;
    this.clearHostileActions();
    this.options.onDefeated();
  }

  private synchronizePartBodies(): void {
    const exposed = new Set(exposedBossParts(this.state));
    for (const partId of this.partIds()) {
      const enabled = exposed.has(partId);
      const sprite = this.partSprites[partId];
      (sprite.body as Phaser.Physics.Arcade.Body).enable = enabled;
      sprite.setVisible(enabled);
    }
    const coreExposed = bossPhase(this.state) === 'core';
    (this.body.body as Phaser.Physics.Arcade.Body).enable = !coreExposed && bossPhase(this.state) !== 'defeated';
  }

  private scheduleAttacks(now: number): void {
    while (now >= this.nextAttackAt && bossPhase(this.state) !== 'defeated') {
      const startsAt = this.nextAttackAt;
      const attack = nextBossAttack(this.state);
      this.state = attack.state;
      let lastMajorDueAt = startsAt;
      for (const pattern of attack.patterns) {
        const dueAt = pattern === 'aimedShot'
          ? this.beginAimedWarning(startsAt)
          : this.beginSupportWarnings(startsAt, this.state.attackIndex);
        lastMajorDueAt = Math.max(lastMajorDueAt, dueAt);
      }
      this.deferBasicUntil(lastMajorDueAt);
      this.nextAttackAt = startsAt + nextBossAttack(this.state).intervalMs;
    }
    this.scheduleBasicAttack(now);
  }

  private scheduleBasicAttack(now: number): void {
    const tuning = GAME_TUNING.projectiles.bossBasic;
    const basicPending = this.warnings.some(({ kind }) => kind === 'basicShot');
    if (basicPending || this.hasMajorWarnings() || this.nextBasicShotAt >= this.nextAttackAt) return;
    if (now >= this.nextBasicShotAt - tuning.warningMs) {
      this.beginBasicWarning(this.nextBasicShotAt);
    }
  }

  private beginBasicWarning(dueAt: number): void {
    const marker = this.warningGroup.create(
      this.motion.x,
      GAME_TUNING.boss.y,
      'boss-muzzle-flash',
    ) as BossSprite;
    marker.setDepth(BOSS_ACTION_DEPTH);
    this.warnings.push({ kind: 'basicShot', dueAt, marker });
  }

  private cancelPendingBasicAttack(): void {
    this.warnings = this.warnings.filter((warning) => {
      if (warning.kind !== 'basicShot') return true;
      warning.marker.destroy();
      return false;
    });
  }

  private deferBasicUntil(lastMajorDueAt: number): void {
    this.cancelPendingBasicAttack();
    this.nextBasicShotAt = lastMajorDueAt + GAME_TUNING.projectiles.bossBasic.intervalMs;
  }

  private hasMajorWarnings(): boolean {
    return this.warnings.some(({ kind }) => kind !== 'basicShot');
  }

  private beginAimedWarning(startsAt: number): number {
    const dueAt = startsAt + GAME_TUNING.projectiles.bossAimed.warningMs;
    const target = { x: this.options.player.x, y: this.options.player.y };
    const marker = this.warningGroup.create(
      target.x,
      target.y,
      'boss-aim-marker',
    ) as BossSprite;
    marker.setDepth(BOSS_ACTION_DEPTH);
    this.warnings.push({
      kind: 'aimedShot',
      dueAt,
      marker,
      target,
    });
    return dueAt;
  }

  private beginSupportWarnings(startsAt: number, attackIndex: number): number {
    const dueAt = startsAt + GAME_TUNING.projectiles.bossSupport.warningMs;
    const playerX = clamp(this.options.player.x, 24, GAME_WIDTH - 24);
    const secondX = clamp(playerX + (attackIndex % 2 === 0 ? 90 : -90), 24, GAME_WIDTH - 24);
    for (const x of [playerX, secondX]) {
      const marker = this.warningGroup.create(x, GAME_HEIGHT - 16, 'boss-drop-marker') as BossSprite;
      marker.setDepth(BOSS_ACTION_DEPTH);
      this.warnings.push({ kind: 'supportDrop', dueAt, marker, x });
    }
    return dueAt;
  }

  private resolveWarnings(now: number): void {
    const pending: Warning[] = [];
    let majorResolved = false;
    for (const warning of this.warnings) {
      if (now < warning.dueAt) {
        pending.push(warning);
        continue;
      }
      warning.marker.destroy();
      if (warning.kind === 'basicShot') this.fireBasicShot(now);
      else {
        majorResolved = true;
        if (warning.kind === 'aimedShot') this.fireAimedFan(warning.target);
        else this.spawnFallingHazard(warning.x);
      }
    }
    this.warnings = pending;
    if (majorResolved) {
      this.nextBasicShotAt = now + GAME_TUNING.projectiles.bossBasic.intervalMs;
    }
  }

  private fireBasicShot(now: number): void {
    const tuning = GAME_TUNING.projectiles.bossBasic;
    this.nextBasicShotAt = now + tuning.intervalMs;
    if (this.options.getEnemyBulletCount() + this.getBulletCount()
      >= GAME_TUNING.projectiles.hostileCap) return;
    const origin = { x: this.motion.x, y: GAME_TUNING.boss.y };
    const direction = normalize({
      x: this.options.player.x - origin.x,
      y: this.options.player.y - origin.y,
    });
    const bullet = this.aimedBulletGroup.create(
      origin.x,
      origin.y,
      'boss-basic-bullet',
    ) as BossProjectileSprite;
    bullet.bossProjectileKind = 'basic';
    bullet.setCircle(tuning.radius).setDepth(BOSS_ACTION_DEPTH).setVelocity(
      direction.x * tuning.speed,
      direction.y * tuning.speed,
    );
  }

  private fireAimedFan(target: Vector): void {
    const tuning = GAME_TUNING.projectiles.bossAimed;
    const origin = { x: this.motion.x, y: GAME_TUNING.boss.y };
    const aimed = normalize({
      x: target.x - origin.x,
      y: target.y - origin.y,
    });
    for (const angle of tuning.fanDegrees) {
      if (this.options.getEnemyBulletCount() + this.getBulletCount()
        >= GAME_TUNING.projectiles.hostileCap) break;
      const direction = this.rotate(aimed, angle);
      const bullet = this.aimedBulletGroup.create(
        origin.x,
        origin.y,
        'boss-aimed-bullet',
      ) as BossProjectileSprite;
      bullet.bossProjectileKind = 'aimed';
      bullet.setCircle(tuning.radius).setDepth(BOSS_ACTION_DEPTH).setVelocity(
        direction.x * tuning.speed,
        direction.y * tuning.speed,
      );
    }
  }

  private spawnFallingHazard(x: number): void {
    const tuning = GAME_TUNING.projectiles.bossSupport;
    const hazard = this.fallingHazardGroup.create(x, -8, 'boss-falling-hazard') as BossSprite;
    hazard.setSize(tuning.width, tuning.height)
      .setDepth(BOSS_ACTION_DEPTH)
      .setVelocity(0, tuning.speed);
  }

  private consumeBossProjectile(projectile: BossProjectileSprite): void {
    const damage = projectile.bossProjectileKind === 'basic'
      ? GAME_TUNING.projectiles.bossBasic.damage
      : GAME_TUNING.projectiles.bossAimed.damage;
    this.consumeHostile(projectile, damage);
  }

  private consumeHostile(hostile: BossSprite, damage: number): void {
    if (!hostile.active) return;
    hostile.destroy();
    this.options.onPlayerHit(damage);
  }

  private cleanOffscreenHostiles(): void {
    const margin = GAME_TUNING.projectiles.offscreenMargin;
    for (const hostile of this.aimedBulletGroup.getChildren() as BossSprite[]) {
      if (hostile.active && (
        hostile.x < -margin || hostile.x > GAME_WIDTH + margin
        || hostile.y < -margin || hostile.y > GAME_HEIGHT + margin
      )) hostile.destroy();
    }
    for (const hazard of this.fallingHazardGroup.getChildren() as BossSprite[]) {
      if (hazard.active && hazard.y > GAME_HEIGHT + margin) hazard.destroy();
    }
  }

  private enemyObstacles(): HorizontalInterval[] {
    const { enemyHalfSize, obstaclePadding } = GAME_TUNING.boss.movement;
    const bandMinimum = GAME_TUNING.boss.y - BOSS_GEOMETRY.collisionHalfHeight;
    const bandMaximum = GAME_TUNING.boss.y + BOSS_GEOMETRY.collisionHalfHeight;
    const horizontalMargin = BOSS_GEOMETRY.collisionHalfWidth
      + enemyHalfSize
      + obstaclePadding;
    return this.options.getEnemies()
      .filter(({ position }) => (
        position.y + enemyHalfSize >= bandMinimum
        && position.y - enemyHalfSize <= bandMaximum
      ))
      .map(({ position }) => ({
        minimum: position.x - horizontalMargin,
        maximum: position.x + horizontalMargin,
      }));
  }

  private positionBossSprites(): void {
    this.body.setPosition(this.motion.x, GAME_TUNING.boss.y);
    this.partSprites.leftWeakpoint.setPosition(
      this.motion.x - BOSS_GEOMETRY.weakpointOffsetX,
      GAME_TUNING.boss.y,
    );
    this.partSprites.rightWeakpoint.setPosition(
      this.motion.x + BOSS_GEOMETRY.weakpointOffsetX,
      GAME_TUNING.boss.y,
    );
    this.partSprites.core.setPosition(this.motion.x, GAME_TUNING.boss.y);
    for (const warning of this.warnings) {
      if (warning.kind === 'basicShot') {
        warning.marker.setPosition(this.motion.x, GAME_TUNING.boss.y);
      }
    }
  }

  private activeProjectiles(): BossProjectileSnapshot[] {
    return (this.aimedBulletGroup.getChildren() as BossProjectileSprite[])
      .filter((projectile) => projectile.active)
      .map((projectile) => ({
        kind: projectile.bossProjectileKind,
        position: { x: projectile.x, y: projectile.y },
        velocity: { ...(projectile.body as Phaser.Physics.Arcade.Body).velocity },
      }));
  }

  private activeCount(group: Phaser.Physics.Arcade.Group): number {
    return (group.getChildren() as BossSprite[]).filter((sprite) => sprite.active).length;
  }

  private clearGroup(group: Phaser.Physics.Arcade.Group): void {
    for (const child of group.getChildren() as BossSprite[]) {
      if (child.active) child.destroy();
    }
  }

  private partHp(partId: BossPartId): number {
    if (partId === 'leftWeakpoint') return this.state.leftWeakpointHp;
    if (partId === 'rightWeakpoint') return this.state.rightWeakpointHp;
    return this.state.coreHp;
  }

  private partIds(): BossPartId[] {
    return ['leftWeakpoint', 'rightWeakpoint', 'core'];
  }

  private partOrder(partId: BossPartId): number {
    return this.partIds().indexOf(partId);
  }

  private rotate(direction: Vector, degrees: number): Vector {
    const radians = degrees * Math.PI / 180;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    return {
      x: direction.x * cosine - direction.y * sine,
      y: direction.x * sine + direction.y * cosine,
    };
  }
}
