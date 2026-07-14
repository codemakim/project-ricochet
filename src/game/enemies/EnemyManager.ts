import type Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, PLAYER_MIN_Y, PLAYER_RADIUS } from '../constants';
import { clamp, normalize, type Vector } from '../math/vector';
import type { OrbManager, OrbSprite } from '../orbs/OrbManager';
import type { HitResult } from '../orbs/orbRules';
import type { TemporaryOrbManager, TemporaryOrbSprite } from '../orbs/TemporaryOrbManager';
import { canFire, createPrototypeFormation, type EnemyKind, type EnemySpec } from './enemyRules';

const SHOOTER_INTERVAL_MS = 1300;
const SHOOTER_WARNING_MS = 350;
const BULLET_SPEED = 180;
const CONTACT_SEPARATION = 6;
const BULLET_MARGIN = 16;

type EnemySprite = Phaser.Physics.Arcade.Sprite & {
  enemyId: number;
  kind: EnemyKind;
  hp: number;
};

export interface EnemySnapshot {
  id: number;
  kind: EnemyKind;
  hp: number;
  position: Vector;
  warning: boolean;
}

export interface EnemyManagerSnapshot {
  enemies: EnemySnapshot[];
  topmostEnemyY: number;
  activeShooters: number;
  bullets: number;
}

export interface DirectHitEvent {
  source: 'permanent' | 'temporary';
  enemyId: number;
  position: Vector;
  charged: boolean;
  direction: Vector;
}

export interface EnemyKilledEvent {
  enemyId: number;
  kind: EnemyKind;
  position: Vector;
}

export interface EnemyManagerOptions {
  player: Phaser.Physics.Arcade.Sprite;
  orbManager: OrbManager;
  temporaryOrbManager?: TemporaryOrbManager;
  formation?: readonly EnemySpec[];
  onContact: (damage: number) => void;
  onBreach: (kind: EnemyKind) => void;
  onBulletHit: (damage: number) => void;
  onEnemyKilled?: (event: EnemyKilledEvent) => void;
  onDirectHit?: (event: DirectHitEvent) => void;
  textureKeys?: Partial<Record<EnemyKind | 'bullet', string>>;
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
    result: HitResult;
    direction: Vector;
    source: DirectHitEvent['source'];
  }>();
  private readonly shooterTimer: Phaser.Time.TimerEvent;
  private readonly textureKeys: Record<EnemyKind | 'bullet', string>;
  private readonly bulletTextureKey: string;
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
      bullet: 'enemy-bullet',
      ...options.textureKeys,
    };
    this.bulletTextureKey = this.textureKeys.bullet;

    this.spawnFormation(options.formation ?? createPrototypeFormation());

    for (const orb of options.orbManager.getSprites()) {
      this.colliders.push(scene.physics.add.collider(
        orb,
        this.enemyGroup,
        (orbObject, enemyObject) => this.completeReflectedHit(orbObject as OrbSprite, enemyObject as EnemySprite),
        (orbObject, enemyObject) => this.processOrbHit(orbObject as OrbSprite, enemyObject as EnemySprite),
      ));
    }
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
      delay: SHOOTER_INTERVAL_MS,
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
      const enemy = this.enemyGroup.create(spec.x, spec.y, this.textureKeys[spec.kind]) as EnemySprite;
      enemy.enemyId = this.nextEnemyId;
      this.nextEnemyId += 1;
      enemy.kind = spec.kind;
      enemy.hp = spec.hp;
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
      })),
      topmostEnemyY,
      activeShooters: this.activeShooters.size,
      bullets: (this.bulletGroup.getChildren() as Phaser.Physics.Arcade.Sprite[])
        .filter((bullet) => bullet.active).length,
    };
  }

  applyAreaDamage(center: Vector, radius: number, damage: number, excludedEnemyId: number): number[] {
    const killedIds: number[] = [];
    const enemies = [...this.enemies.values()];
    for (const enemy of enemies) {
      if (
        !enemy.active
        || enemy.enemyId === excludedEnemyId
        || Math.hypot(enemy.x - center.x, enemy.y - center.y) > radius
      ) continue;
      const killEvent = this.createKillEvent(enemy);
      enemy.hp -= damage;
      if (enemy.hp <= 0) {
        killedIds.push(enemy.enemyId);
        this.killEnemy(enemy, killEvent);
      }
    }
    return killedIds;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
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

  private processOrbHit(orb: OrbSprite, enemy: EnemySprite): boolean {
    if (!enemy.active || !orb.active) return false;
    const result = this.options.orbManager.handleEnemyHit(
      orb,
      enemy.enemyId,
      enemy.hp,
      this.scene.time.now,
      false,
    );
    if (!result) return false;
    const direction = this.orbDirection(orb);
    if (!result.reflect) {
      this.applyHit(enemy, result, 'permanent', direction);
      return false;
    }
    this.pendingReflections.set(this.hitKey(orb, enemy), { result, direction, source: 'permanent' });
    return true;
  }

  private completeReflectedHit(orb: OrbSprite, enemy: EnemySprite): void {
    const key = this.hitKey(orb, enemy);
    const pending = this.pendingReflections.get(key);
    if (!pending) return;
    this.pendingReflections.delete(key);
    this.options.orbManager.synchronizeOrb(orb);
    this.applyHit(enemy, pending.result, pending.source, pending.direction);
  }

  private processTemporaryOrbHit(orb: TemporaryOrbSprite, enemy: EnemySprite): boolean {
    const manager = this.options.temporaryOrbManager;
    if (!manager || !enemy.active || !orb.active) return false;
    const result = manager.handleEnemyHit(orb, enemy.enemyId, enemy.hp, this.scene.time.now);
    if (!result) return false;
    const direction = this.orbDirection(orb);
    const key = this.temporaryHitKey(orb, enemy);
    this.pendingReflections.set(key, { result, direction, source: 'temporary' });
    return true;
  }

  private completeTemporaryReflectedHit(orb: TemporaryOrbSprite, enemy: EnemySprite): void {
    const key = this.temporaryHitKey(orb, enemy);
    const pending = this.pendingReflections.get(key);
    if (!pending) return;
    this.pendingReflections.delete(key);
    this.options.temporaryOrbManager?.synchronizeOrb(orb);
    this.applyHit(enemy, pending.result, pending.source, pending.direction);
  }

  private applyHit(
    enemy: EnemySprite,
    result: HitResult,
    source: DirectHitEvent['source'],
    direction: Vector,
  ): void {
    if (!enemy.active) return;
    const killEvent = this.createKillEvent(enemy);
    enemy.hp -= result.damage;
    this.options.onDirectHit?.({
      source,
      enemyId: enemy.enemyId,
      position: { ...killEvent.position },
      charged: result.charged,
      direction,
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
    this.options.onBulletHit(1);
  }

  private beginShooterWarnings(): void {
    if (this.destroyed) return;
    const bulletCount = this.getSnapshot().bullets;
    const candidates = [...this.enemies.values()].filter(
      (enemy) => enemy.active && enemy.kind === 'shooter' && !this.activeShooters.has(enemy.enemyId),
    );
    for (const shooter of candidates) {
      if (!canFire(this.activeShooters.size, bulletCount)) break;
      this.activeShooters.add(shooter.enemyId);
      shooter.setTint(0xffff66);
      const timer = this.scene.time.delayedCall(SHOOTER_WARNING_MS, () => this.finishShooterAttack(shooter));
      this.warningTimers.set(shooter.enemyId, timer);
    }
  }

  private finishShooterAttack(shooter: EnemySprite): void {
    this.warningTimers.delete(shooter.enemyId);
    const wasActive = this.activeShooters.delete(shooter.enemyId);
    shooter.clearTint();
    if (!wasActive || this.destroyed || !shooter.active) return;
    const activeOthers = this.activeShooters.size;
    const activeBullets = this.getSnapshot().bullets;
    if (!canFire(activeOthers, activeBullets)) return;

    const bullet = this.bulletGroup.create(shooter.x, shooter.y, this.bulletTextureKey) as Phaser.Physics.Arcade.Sprite;
    const direction = normalize({
      x: this.options.player.x - shooter.x,
      y: this.options.player.y - shooter.y,
    });
    bullet.setCircle(5).setVelocity(direction.x * BULLET_SPEED, direction.y * BULLET_SPEED);
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

  private createKillEvent(enemy: EnemySprite): EnemyKilledEvent {
    return {
      enemyId: enemy.enemyId,
      kind: enemy.kind,
      position: { x: enemy.x, y: enemy.y },
    };
  }

  private killEnemy(enemy: EnemySprite, event: EnemyKilledEvent): void {
    this.destroyEnemy(enemy);
    this.options.onEnemyKilled?.(event);
  }
}
