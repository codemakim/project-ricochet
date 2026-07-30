import type Phaser from 'phaser';
import { GAME_TUNING } from '../config/gameTuning';
import { GAME_HEIGHT, GAME_WIDTH, PLAYER_MIN_Y, PLAYER_RADIUS } from '../constants';
import { clamp, normalize, type Vector } from '../math/vector';
import type {
  OrbManager,
  OrbSprite,
  PermanentHitResult,
} from '../orbs/OrbManager';
import type { OrbCoreId } from '../orbs/orbCoreRules';
import type { HitResult } from '../orbs/orbRules';
import type { TemporaryOrbManager, TemporaryOrbSprite } from '../orbs/TemporaryOrbManager';
import { createInitialFormation } from '../encounters/formationRules';
import {
  canFire,
  type EnemyKind,
  type EnemySpec,
  type FragmentSide,
} from './enemyRules';
import { fragmentSpecsFor, populationCostForEnemy } from './splitterRules';

const CONTACT_SEPARATION = 6;
const BULLET_MARGIN = 16;

type EnemySprite = Phaser.Physics.Arcade.Sprite & {
  enemyId: number;
  kind: EnemyKind;
  hp: number;
  column: number;
  row: number;
  footprintWidth: number;
  footprintHeight: number;
  side?: FragmentSide;
};

export interface EnemySnapshot {
  id: number;
  kind: EnemyKind;
  hp: number;
  position: Vector;
  warning: boolean;
  speed: number;
  footprint?: {
    column: number;
    row: number;
    width: number;
    height: number;
  };
}

export interface EnemyManagerSnapshot {
  enemies: EnemySnapshot[];
  activePopulation: number;
  topmostEnemyY: number;
  activeShooters: number;
  bullets: number;
}

export interface DirectHitEvent {
  source: 'permanent' | 'temporary';
  sourceOrbId: number;
  enemyId: number;
  position: Vector;
  charged: boolean;
  direction: Vector;
  coreType?: OrbCoreId;
  conductionTriggered?: boolean;
  speedRatio?: number;
  firstHitAfterProximity?: boolean;
  echoStacks?: number;
  killed: boolean;
}

export interface EnemyKilledEvent {
  enemyId: number;
  kind: EnemyKind;
  position: Vector;
}

export interface EnemyAreaDamageEffect {
  center: Vector;
  radius: number;
  damage: number;
  excludedEnemyId: number;
}

export interface EnemyManagerOptions {
  player: Phaser.Physics.Arcade.Sprite;
  orbManager: OrbManager;
  temporaryOrbManager?: TemporaryOrbManager;
  getGameplayElapsedMs(): number;
  formation?: readonly EnemySpec[];
  onContact: (damage: number) => void;
  onBreach: (kind: EnemyKind) => void;
  onBulletHit: (damage: number) => void;
  onEnemyKilled?: (event: EnemyKilledEvent) => void;
  onDirectHit?: (event: DirectHitEvent) => void;
  getExternalBulletCount?: () => number;
  textureKeys?: Partial<Record<EnemyKind | 'fragmentLeft' | 'fragmentRight' | 'bullet', string>>;
}

export class EnemyManager {
  declare debugFreezeEnemies?: () => void;
  declare debugRemoveEnemies?: (ids: readonly number[]) => void;
  declare debugSetEnemy?: (id: number, position: Vector, hp: number) => boolean;

  private readonly enemyGroup: Phaser.Physics.Arcade.Group;
  private readonly bulletGroup: Phaser.Physics.Arcade.Group;
  private readonly colliders: Phaser.Physics.Arcade.Collider[] = [];
  private readonly enemies = new Map<number, EnemySprite>();
  private readonly activeShooters = new Set<number>();
  private readonly warningTimers = new Map<number, Phaser.Time.TimerEvent>();
  private readonly pendingReflections = new Map<string, {
    result: HitResult | PermanentHitResult;
    direction: Vector;
    source: DirectHitEvent['source'];
    sourceOrbId: number;
  }>();
  private readonly shooterTimer: Phaser.Time.TimerEvent;
  private readonly textureKeys: Record<EnemyKind | 'fragmentLeft' | 'fragmentRight' | 'bullet', string>;
  private readonly bulletTextureKey: string;
  private readonly unsubscribeOrbAdded: () => void;
  private nextEnemyId = 0;
  private destroyed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly options: EnemyManagerOptions,
  ) {
    this.enemyGroup = scene.physics.add.group({ allowGravity: false, immovable: true });
    this.bulletGroup = scene.physics.add.group({ allowGravity: false });
    this.textureKeys = {
      basic: 'enemy-basic',
      armored: 'enemy-armored',
      shooter: 'enemy-shooter',
      splitter: 'enemy-basic',
      fragment: 'enemy-basic',
      fragmentLeft: 'enemy-fragment-left',
      fragmentRight: 'enemy-fragment-right',
      bullet: 'enemy-bullet',
      ...options.textureKeys,
    };
    this.bulletTextureKey = this.textureKeys.bullet;

    this.spawnFormation(options.formation ?? createInitialFormation(0).enemies);

    for (const orb of options.orbManager.getSprites()) {
      this.addPermanentOrbCollider(orb);
    }
    this.unsubscribeOrbAdded = options.orbManager.onOrbAdded((orb) => this.addPermanentOrbCollider(orb));
    if (options.temporaryOrbManager) {
      this.colliders.push(scene.physics.add.collider(
        options.temporaryOrbManager.getGroup(),
        this.enemyGroup,
        (orbObject, enemyObject) => this.completeTemporaryReflectedHit(
          orbObject as TemporaryOrbSprite,
          enemyObject as EnemySprite,
        ),
        (orbObject, enemyObject) => this.processTemporaryOrbHit(
          orbObject as TemporaryOrbSprite,
          enemyObject as EnemySprite,
        ),
      ));
    }
    this.colliders.push(scene.physics.add.overlap(
      options.player,
      this.enemyGroup,
      (playerObject, enemyObject) => this.handleContact(
        playerObject as Phaser.Physics.Arcade.Sprite,
        enemyObject as EnemySprite,
      ),
    ));
    this.colliders.push(scene.physics.add.overlap(
      options.player,
      this.bulletGroup,
      (_playerObject, bulletObject) => this.handleBulletHit(bulletObject as Phaser.Physics.Arcade.Sprite),
    ));

    this.shooterTimer = scene.time.addEvent({
      delay: GAME_TUNING.enemies.shooter.intervalMs,
      loop: true,
      callback: () => this.beginShooterWarnings(),
    });
    if ((import.meta as ImportMeta & { env: { DEV: boolean } }).env.DEV) {
      this.debugFreezeEnemies = () => {
        if (this.destroyed) return;
        for (const enemy of this.enemies.values()) enemy.setVelocityY(0);
      };
      this.debugRemoveEnemies = (ids) => {
        if (ids.some((id) => !Number.isInteger(id) || id < 0)) {
          throw new RangeError('enemy IDs must be non-negative integers');
        }
        for (const id of new Set(ids)) {
          const enemy = this.enemies.get(id);
          if (enemy?.active) this.destroyEnemy(enemy);
        }
      };
      this.debugSetEnemy = (id, position, hp) => {
        if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
          throw new RangeError('enemy position must be finite');
        }
        if (!Number.isFinite(hp) || hp <= 0) {
          throw new RangeError('enemy HP must be finite and positive');
        }
        const enemy = this.enemies.get(id);
        if (!enemy?.active) return false;
        const body = enemy.body as Phaser.Physics.Arcade.Body;
        const velocity = { x: body.velocity.x, y: body.velocity.y };
        enemy.setPosition(position.x, position.y);
        body.reset(position.x, position.y);
        body.setVelocity(velocity.x, velocity.y);
        enemy.hp = hp;
        return true;
      };
    }
  }

  spawnFormation(formation: readonly EnemySpec[]): void {
    if (this.destroyed) return;
    for (const spec of formation) {
      const textureKey = spec.kind === 'fragment' && spec.side
        ? this.textureKeys[spec.side === 'left' ? 'fragmentLeft' : 'fragmentRight']
        : this.textureKeys[spec.kind];
      const enemy = this.enemyGroup.create(spec.x, spec.y, textureKey) as EnemySprite;
      enemy.enemyId = this.nextEnemyId;
      this.nextEnemyId += 1;
      enemy.kind = spec.kind;
      enemy.side = spec.side;
      enemy.hp = spec.hp;
      enemy.column = spec.column;
      enemy.row = spec.row ?? -1;
      enemy.footprintWidth = spec.width ?? 1;
      enemy.footprintHeight = spec.height ?? 1;
      const pixelWidth = enemy.footprintWidth * GAME_TUNING.encounter.grid.cellWidth
        - GAME_TUNING.encounter.grid.gap;
      const pixelHeight = enemy.footprintHeight * GAME_TUNING.encounter.grid.cellHeight
        - GAME_TUNING.encounter.grid.gap;
      enemy.setDisplaySize(pixelWidth, pixelHeight);
      const body = enemy.body as Phaser.Physics.Arcade.Body;
      body.setSize(enemy.width, enemy.height, false);
      body.reset(spec.x, spec.y);
      enemy.setImmovable(true).setVelocityY(spec.speed);
      this.enemies.set(enemy.enemyId, enemy);
    }
  }

  update(): void {
    if (this.destroyed) return;
    for (const enemy of this.enemies.values()) {
      if (enemy.active && enemy.y >= GAME_HEIGHT - PLAYER_RADIUS) {
        const kind = enemy.kind;
        this.destroyEnemy(enemy);
        this.options.onBreach(kind);
      }
    }
    for (const bullet of this.bulletGroup.getChildren() as Phaser.Physics.Arcade.Sprite[]) {
      if (
        bullet.active
        && (bullet.x < -BULLET_MARGIN || bullet.x > GAME_WIDTH + BULLET_MARGIN
          || bullet.y < -BULLET_MARGIN || bullet.y > GAME_HEIGHT + BULLET_MARGIN)
      ) {
        bullet.destroy();
      }
    }
  }

  getSnapshot(): EnemyManagerSnapshot {
    if (this.destroyed) {
      return {
        enemies: [],
        activePopulation: 0,
        topmostEnemyY: Number.POSITIVE_INFINITY,
        activeShooters: 0,
        bullets: 0,
      };
    }
    const enemies = [...this.enemies.values()].filter((enemy) => enemy.active);
    const topmostEnemyY = enemies.reduce(
      (topmost, enemy) => Math.min(topmost, enemy.y),
      Number.POSITIVE_INFINITY,
    );
    return {
      enemies: enemies.map((enemy) => ({
        id: enemy.enemyId,
        kind: enemy.kind,
        hp: enemy.hp,
        position: { x: enemy.x, y: enemy.y },
        warning: this.activeShooters.has(enemy.enemyId),
        speed: (enemy.body as Phaser.Physics.Arcade.Body).velocity.y,
        footprint: {
          column: enemy.column,
          row: enemy.row,
          width: enemy.footprintWidth,
          height: enemy.footprintHeight,
        },
      })),
      activePopulation: enemies.reduce(
        (population, enemy) => (
          population + (
            enemy.row < 0
              ? populationCostForEnemy(enemy.kind)
              : enemy.footprintWidth * enemy.footprintHeight
          )
        ),
        0,
      ),
      topmostEnemyY,
      activeShooters: this.activeShooters.size,
      bullets: (this.bulletGroup.getChildren() as Phaser.Physics.Arcade.Sprite[])
        .filter((bullet) => bullet.active).length,
    };
  }

  getBulletCount(): number {
    if (this.destroyed) return 0;
    return (this.bulletGroup.getChildren() as Phaser.Physics.Arcade.Sprite[])
      .filter((bullet) => bullet.active).length;
  }

  clearBullets(): void {
    if (this.destroyed) return;
    for (const bullet of this.bulletGroup.getChildren() as Phaser.Physics.Arcade.Sprite[]) {
      if (bullet.active) bullet.destroy();
    }
  }

  clearHostileActions(): void {
    if (this.destroyed) return;
    this.clearBullets();
    for (const timer of this.warningTimers.values()) timer.remove(false);
    for (const enemyId of this.activeShooters) this.enemies.get(enemyId)?.clearTint();
    this.warningTimers.clear();
    this.activeShooters.clear();
  }

  clearEnemies(): Vector[] {
    if (this.destroyed) return [];
    this.clearHostileActions();
    return this.removeMatchingEnemies(() => true);
  }

  clearCorridor(corridor: {
    left: number;
    right: number;
    bottom: number;
  }): Vector[] {
    return this.removeMatchingEnemies((enemy) => {
      const body = enemy.body as Phaser.Physics.Arcade.Body;
      return body.left < corridor.right
        && body.right > corridor.left
        && body.top < corridor.bottom;
    });
  }

  applyAreaDamage(center: Vector, radius: number, damage: number, excludedEnemyId: number): number[] {
    return this.applyAreaDamageBatch([{ center, radius, damage, excludedEnemyId }]);
  }

  applyAreaDamageBatch(effects: readonly EnemyAreaDamageEffect[]): number[] {
    const enemies = [...this.enemies.values()];
    const lethal: Array<{ enemy: EnemySprite; event: EnemyKilledEvent }> = [];
    for (const enemy of enemies) {
      if (!enemy.active) continue;
      const killEvent = this.createKillEvent(enemy);
      for (const effect of effects) {
        if (
          enemy.enemyId !== effect.excludedEnemyId
          && Math.hypot(enemy.x - effect.center.x, enemy.y - effect.center.y) <= effect.radius
        ) {
          enemy.hp -= effect.damage;
        }
      }
      if (enemy.hp <= 0) lethal.push({ enemy, event: killEvent });
    }
    for (const { enemy, event } of lethal) this.killEnemy(enemy, event);
    return lethal.map(({ event }) => event.enemyId);
  }

  applyNearestSecondaryDamage(
    origin: Vector,
    excludedEnemyId: number,
    radius: number,
    maximumTargets: number,
    damage: number,
  ): number[] {
    const targetIds = new Set(
      this.nearestSecondaryTargets(origin, excludedEnemyId, radius, maximumTargets)
        .map(({ id }) => id),
    );
    const targets = [...this.enemies.values()].filter((enemy) => targetIds.has(enemy.enemyId));
    const lethal: Array<{ enemy: EnemySprite; event: EnemyKilledEvent }> = [];
    for (const enemy of targets) {
      const event = this.createKillEvent(enemy);
      enemy.hp -= damage;
      if (enemy.hp <= 0) lethal.push({ enemy, event });
    }
    for (const { enemy, event } of lethal) this.killEnemy(enemy, event);
    return targets.map((enemy) => enemy.enemyId);
  }

  nearestSecondaryTargets(
    origin: Vector,
    excludedEnemyId: number,
    radius: number,
    maximumTargets: number,
  ): EnemySnapshot[] {
    return [...this.enemies.values()]
      .filter((enemy) => (
        enemy.active
        && enemy.enemyId !== excludedEnemyId
        && Math.hypot(enemy.x - origin.x, enemy.y - origin.y) <= radius
      ))
      .sort((left, right) => (
        Math.hypot(left.x - origin.x, left.y - origin.y)
        - Math.hypot(right.x - origin.x, right.y - origin.y)
        || left.enemyId - right.enemyId
      ))
      .slice(0, maximumTargets)
      .map((enemy) => ({
        id: enemy.enemyId,
        kind: enemy.kind,
        hp: enemy.hp,
        position: { x: enemy.x, y: enemy.y },
        warning: this.activeShooters.has(enemy.enemyId),
        speed: (enemy.body as Phaser.Physics.Arcade.Body).velocity.y,
      }));
  }

  applyLineDamage(
    axis: 'horizontal' | 'vertical',
    coordinate: number,
    thickness: number,
    damage: number,
    excludedEnemyId = -1,
  ): number[] {
    const targets = [...this.enemies.values()].filter((enemy) => (
      enemy.active
      && enemy.enemyId !== excludedEnemyId
      && Math.abs((axis === 'horizontal' ? enemy.y : enemy.x) - coordinate) <= thickness / 2
    ));
    const lethal: Array<{ enemy: EnemySprite; event: EnemyKilledEvent }> = [];
    for (const enemy of targets) {
      const event = this.createKillEvent(enemy);
      enemy.hp -= damage;
      if (enemy.hp <= 0) lethal.push({ enemy, event });
    }
    for (const { enemy, event } of lethal) this.killEnemy(enemy, event);
    return targets.map((enemy) => enemy.enemyId);
  }

  applyDirectDamage(enemyId: number, damage: number): boolean {
    const enemy = this.enemies.get(enemyId);
    if (!enemy?.active) return false;
    const event = this.createKillEvent(enemy);
    enemy.hp -= damage;
    if (enemy.hp <= 0) this.killEnemy(enemy, event);
    return true;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.unsubscribeOrbAdded();
    this.shooterTimer.remove(false);
    for (const timer of this.warningTimers.values()) timer.remove(false);
    for (const collider of this.colliders) collider.destroy();
    this.warningTimers.clear();
    this.activeShooters.clear();
    this.pendingReflections.clear();
    this.enemies.clear();
    this.enemyGroup.destroy(true);
    this.bulletGroup.destroy(true);
    this.colliders.length = 0;
  }

  private addPermanentOrbCollider(orb: OrbSprite): void {
    if (this.destroyed) return;
    this.colliders.push(this.scene.physics.add.collider(
      orb,
      this.enemyGroup,
      (orbObject, enemyObject) => this.completeReflectedHit(orbObject as OrbSprite, enemyObject as EnemySprite),
      (orbObject, enemyObject) => this.processOrbHit(orbObject as OrbSprite, enemyObject as EnemySprite),
    ));
  }

  private processOrbHit(orb: OrbSprite, enemy: EnemySprite): boolean {
    if (!enemy.active || !orb.active) return false;
    const result = this.options.orbManager.handleEnemyHit(
      orb,
      enemy.enemyId,
      enemy.hp,
      this.scene.time.now,
      false,
      Math.hypot(enemy.x - this.options.player.x, enemy.y - this.options.player.y),
    );
    if (!result) return false;
    const direction = this.orbDirection(orb);
    if (!result.reflect) {
      this.applyHit(enemy, result, 'permanent', orb.orbId, direction);
      return false;
    }
    this.pendingReflections.set(this.hitKey(orb, enemy), {
      result,
      direction,
      source: 'permanent',
      sourceOrbId: orb.orbId,
    });
    return true;
  }

  private completeReflectedHit(orb: OrbSprite, enemy: EnemySprite): void {
    const key = this.hitKey(orb, enemy);
    const pending = this.pendingReflections.get(key);
    if (!pending) return;
    this.pendingReflections.delete(key);
    this.options.orbManager.synchronizeOrb(orb);
    this.applyHit(enemy, pending.result, pending.source, pending.sourceOrbId, pending.direction);
  }

  private processTemporaryOrbHit(orb: TemporaryOrbSprite, enemy: EnemySprite): boolean {
    const manager = this.options.temporaryOrbManager;
    if (!manager || !enemy.active || !orb.active) return false;
    const result = manager.handleEnemyHit(
      orb,
      enemy.enemyId,
      enemy.hp,
      this.options.getGameplayElapsedMs(),
    );
    if (!result) return false;
    const direction = this.orbDirection(orb);
    const key = this.temporaryHitKey(orb, enemy);
    this.pendingReflections.set(key, {
      result,
      direction,
      source: 'temporary',
      sourceOrbId: orb.temporaryOrbId,
    });
    return true;
  }

  private completeTemporaryReflectedHit(orb: TemporaryOrbSprite, enemy: EnemySprite): void {
    const key = this.temporaryHitKey(orb, enemy);
    const pending = this.pendingReflections.get(key);
    if (!pending) return;
    this.pendingReflections.delete(key);
    this.options.temporaryOrbManager?.synchronizeOrb(orb);
    this.applyHit(enemy, pending.result, pending.source, pending.sourceOrbId, pending.direction);
  }

  private applyHit(
    enemy: EnemySprite,
    result: HitResult | PermanentHitResult,
    source: DirectHitEvent['source'],
    sourceOrbId: number,
    direction: Vector,
  ): void {
    if (!enemy.active) return;
    const killEvent = this.createKillEvent(enemy);
    enemy.hp -= result.damage;
    const core = source === 'permanent'
      ? result as PermanentHitResult
      : null;
    this.options.onDirectHit?.({
      source,
      sourceOrbId,
      enemyId: enemy.enemyId,
      position: { ...killEvent.position },
      charged: result.charged,
      direction,
      killed: enemy.hp <= 0,
      ...(core ? {
        coreType: core.coreType,
        conductionTriggered: core.conductionTriggered,
        speedRatio: core.speedRatio,
        firstHitAfterProximity: core.firstHitAfterProximity,
        echoStacks: core.echoStacks,
      } : {}),
    });
    if (enemy.active && enemy.hp <= 0) this.killEnemy(enemy, killEvent);
  }

  private hitKey(orb: OrbSprite, enemy: EnemySprite): string {
    return `${orb.orbId}:${enemy.enemyId}`;
  }

  private temporaryHitKey(orb: TemporaryOrbSprite, enemy: EnemySprite): string {
    return `temporary:${orb.temporaryOrbId}:${enemy.enemyId}`;
  }

  private orbDirection(orb: Phaser.Physics.Arcade.Sprite): Vector {
    const body = orb.body as Phaser.Physics.Arcade.Body;
    return normalize(body.velocity);
  }

  private handleContact(player: Phaser.Physics.Arcade.Sprite, enemy: EnemySprite): void {
    if (!enemy.active) return;
    const direction = normalize(
      { x: player.x - enemy.x, y: player.y - enemy.y },
      { x: 0, y: 1 },
    );
    player.setPosition(
      clamp(player.x + direction.x * CONTACT_SEPARATION, PLAYER_RADIUS, GAME_WIDTH - PLAYER_RADIUS),
      clamp(player.y + direction.y * CONTACT_SEPARATION, PLAYER_MIN_Y, GAME_HEIGHT - PLAYER_RADIUS),
    );
    this.options.onContact(1);
  }

  private handleBulletHit(bullet: Phaser.Physics.Arcade.Sprite): void {
    if (!bullet.active) return;
    bullet.destroy();
    this.options.onBulletHit(GAME_TUNING.enemies.shooter.damage);
  }

  private beginShooterWarnings(): void {
    if (this.destroyed) return;
    const bulletCount = this.getBulletCount() + (this.options.getExternalBulletCount?.() ?? 0);
    const candidates = [...this.enemies.values()].filter(
      (enemy) => enemy.active && enemy.kind === 'shooter' && !this.activeShooters.has(enemy.enemyId),
    );
    for (const shooter of candidates) {
      if (!canFire(this.activeShooters.size, bulletCount)) break;
      this.activeShooters.add(shooter.enemyId);
      shooter.setTint(0xffff66);
      const timer = this.scene.time.delayedCall(
        GAME_TUNING.enemies.shooter.warningMs,
        () => this.finishShooterAttack(shooter),
      );
      this.warningTimers.set(shooter.enemyId, timer);
    }
  }

  private finishShooterAttack(shooter: EnemySprite): void {
    this.warningTimers.delete(shooter.enemyId);
    const wasActive = this.activeShooters.delete(shooter.enemyId);
    shooter.clearTint();
    if (!wasActive || this.destroyed || !shooter.active) return;
    const activeOthers = this.activeShooters.size;
    const activeBullets = this.getBulletCount() + (this.options.getExternalBulletCount?.() ?? 0);
    if (!canFire(activeOthers, activeBullets)) return;

    const bullet = this.bulletGroup.create(shooter.x, shooter.y, this.bulletTextureKey) as Phaser.Physics.Arcade.Sprite;
    const direction = normalize({
      x: this.options.player.x - shooter.x,
      y: this.options.player.y - shooter.y,
    });
    bullet.setCircle(5).setVelocity(
      direction.x * GAME_TUNING.enemies.shooter.bulletSpeed,
      direction.y * GAME_TUNING.enemies.shooter.bulletSpeed,
    );
  }

  private destroyEnemy(enemy: EnemySprite): void {
    const timer = this.warningTimers.get(enemy.enemyId);
    timer?.remove(false);
    this.warningTimers.delete(enemy.enemyId);
    this.activeShooters.delete(enemy.enemyId);
    for (const key of this.pendingReflections.keys()) {
      if (key.endsWith(`:${enemy.enemyId}`)) this.pendingReflections.delete(key);
    }
    enemy.clearTint();
    enemy.destroy();
    this.enemies.delete(enemy.enemyId);
  }

  private removeMatchingEnemies(
    matches: (enemy: EnemySprite) => boolean,
  ): Vector[] {
    if (this.destroyed) return [];
    const removed = [...this.enemies.values()]
      .filter((enemy) => enemy.active && matches(enemy))
      .map((enemy) => ({ enemy, position: { x: enemy.x, y: enemy.y } }));
    for (const { enemy } of removed) this.destroyEnemy(enemy);
    return removed.map(({ position }) => position);
  }

  private createKillEvent(enemy: EnemySprite): EnemyKilledEvent {
    return {
      enemyId: enemy.enemyId,
      kind: enemy.kind,
      position: { x: enemy.x, y: enemy.y },
    };
  }

  private killEnemy(enemy: EnemySprite, event: EnemyKilledEvent): void {
    const fragments = enemy.kind === 'splitter'
      ? fragmentSpecsFor({
        x: enemy.x,
        y: enemy.y,
        column: enemy.column,
        row: enemy.row,
        speed: (enemy.body as Phaser.Physics.Arcade.Body).velocity.y,
      })
      : [];
    this.destroyEnemy(enemy);
    this.options.onEnemyKilled?.(event);
    if (!this.destroyed) this.spawnFormation(fragments);
  }
}
