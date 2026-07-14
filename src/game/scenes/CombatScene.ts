import Phaser from 'phaser';
import { traceFirstBounce } from '../aim/trajectory';
import { CombatPauseController, type PauseReason } from '../combat/CombatPauseController';
import {
  applyDamage,
  breachDamage,
  canTakeDamage,
  createHealth,
  type HealthState,
} from '../combat/health';
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  PLAYER_RADIUS,
  type ExperimentSettings,
} from '../constants';
import { EncounterDirector } from '../encounters/EncounterDirector';
import {
  EnemyManager,
  type DirectHitEvent,
  type EnemyManagerSnapshot,
} from '../enemies/EnemyManager';
import { PlayerInput } from '../input/PlayerInput';
import type { Vector } from '../math/vector';
import { OrbManager, ORB_RADIUS } from '../orbs/OrbManager';
import { TemporaryOrbManager } from '../orbs/TemporaryOrbManager';
import { movePlayer, resolveAim } from '../player/playerRules';
import { BuildState } from '../progression/BuildState';
import { ProgressionManager, type ProgressionSnapshot } from '../progression/ProgressionManager';
import type { AbilityId, AbilityRanks } from '../progression/progressionRules';
import { LevelUpOverlay } from '../ui/LevelUpOverlay';
import { progressionHudState } from '../ui/progressionHud';
import { parseExperimentSettings } from './experimentSettings';

const INVULNERABILITY_MS = 600;
const AIM_REFLECTION_LENGTH = 90;
const RUN_SEED = 0x5249434f;
const XP_BAR_WIDTH = 220;
const PAUSE_REASONS: readonly PauseReason[] = ['visibility', 'levelUp', 'defeated'];

export interface CombatDebugSnapshot {
  player: Vector;
  aim: Vector;
  health: HealthState;
  defeated: boolean;
  orbs: ReturnType<OrbManager['getSnapshot']>;
  enemies: EnemyManagerSnapshot['enemies'];
  activeShooters: number;
  bullets: number;
  experiment: ExperimentSettings;
  encounter: ReturnType<EncounterDirector['getSnapshot']>;
  progression: ProgressionSnapshot;
  buildRanks: AbilityRanks;
  pauseReasons: PauseReason[];
  levelUpVisible: boolean;
  temporaryOrbs: number;
  gameplayElapsedMs: number;
}

export class CombatScene extends Phaser.Scene {
  declare debugPlaceOrb?: (id: number, position: Vector) => boolean;
  declare debugFreezeEnemies?: () => void;
  declare debugSetHealth?: (value: number) => void;
  declare debugDamage?: (amount: number) => void;
  declare debugRemoveEnemies?: (ids: readonly number[]) => void;
  declare debugGrantXp?: (amount: number) => void;
  declare debugChooseAbility?: (id: AbilityId) => boolean;
  declare debugUpgradeAbility?: (id: AbilityId) => void;
  declare debugSetEnemy?: (id: number, position: Vector, hp: number) => boolean;

  private player!: Phaser.Physics.Arcade.Sprite;
  private playerInput?: PlayerInput;
  private orbManager?: OrbManager;
  private temporaryOrbManager?: TemporaryOrbManager;
  private enemyManager?: EnemyManager;
  private encounterDirector?: EncounterDirector;
  private aimGuide!: Phaser.GameObjects.Graphics;
  private healthText!: Phaser.GameObjects.Text;
  private progressionText!: Phaser.GameObjects.Text;
  private progressionBarFill!: Phaser.GameObjects.Rectangle;
  private build?: BuildState;
  private progression?: ProgressionManager;
  private levelUpOverlay?: LevelUpOverlay;
  private health: HealthState = createHealth();
  private experiment: ExperimentSettings = parseExperimentSettings('');
  private aim: Vector = { x: 0, y: -1 };
  private invulnerableUntil = 0;
  private aimQueueActivated = false;
  private defeated = false;
  private pause = new CombatPauseController();
  private gameplayElapsedMs = 0;

  constructor() {
    super('combat');
  }

  create(): void {
    this.health = createHealth();
    this.experiment = parseExperimentSettings(window.location.search);
    this.aim = { x: 0, y: -1 };
    this.invulnerableUntil = 0;
    this.aimQueueActivated = false;
    this.defeated = false;
    this.pause = new CombatPauseController();
    this.gameplayElapsedMs = 0;
    const build = new BuildState();
    this.build = build;
    this.progression = new ProgressionManager(RUN_SEED, build);
    this.levelUpOverlay = new LevelUpOverlay(this);
    this.createTextures();
    this.physics.world.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.player = this.physics.add.sprite(GAME_WIDTH / 2, 690, 'player');
    this.player.setCircle(PLAYER_RADIUS).setCollideWorldBounds(true);
    this.playerInput = new PlayerInput(this, () => ({ x: this.player.x, y: this.player.y }));
    this.orbManager = new OrbManager(this, {
      settings: this.experiment,
      textureKey: 'orb-charged',
      hasFixedTerrainLineOfSight: () => true,
      getDirectDamageBonus: () => build.directDamageBonus(),
      getChargedSpeed: () => build.chargedSpeed(),
    });
    this.temporaryOrbManager = new TemporaryOrbManager(this, {
      getDirectDamageBonus: () => build.directDamageBonus(),
      getGameplayElapsedMs: () => this.gameplayElapsedMs,
    });
    this.encounterDirector = new EncounterDirector();
    this.enemyManager = new EnemyManager(this, {
      player: this.player,
      orbManager: this.orbManager,
      temporaryOrbManager: this.temporaryOrbManager,
      getGameplayElapsedMs: () => this.gameplayElapsedMs,
      onContact: (damage) => this.damagePlayer(damage),
      onBreach: (kind) => this.damagePlayer(breachDamage(kind)),
      onBulletHit: (damage) => this.damagePlayer(damage),
      onEnemyKilled: ({ kind }) => this.handleEnemyKilled(kind),
      onDirectHit: (event) => this.handleDirectHit(event),
    });

    if ((import.meta as ImportMeta & { env: { DEV: boolean } }).env.DEV) {
      this.debugPlaceOrb = (id, position) => {
        return this.orbManager?.debugPlaceOrb?.(id, position) ?? false;
      };
      this.debugFreezeEnemies = () => {
        this.enemyManager?.debugFreezeEnemies?.();
      };
      this.debugSetHealth = (value) => {
        if (!Number.isFinite(value)) throw new RangeError('health must be finite');
        const current = Math.max(0, Math.min(this.health.maximum, value));
        this.health = { ...this.health, current, defeated: current === 0 };
        this.defeated = false;
        this.invulnerableUntil = 0;
        this.updateHealthText();
      };
      this.debugDamage = (amount) => this.damagePlayer(amount);
      this.debugRemoveEnemies = (ids) => this.enemyManager?.debugRemoveEnemies?.(ids);
      this.debugGrantXp = (amount) => {
        this.progression?.gainExperience(amount);
        this.updateProgressionText();
        this.openNextLevelUp();
      };
      this.debugChooseAbility = (id) => this.chooseAbility(id);
      this.debugUpgradeAbility = (id) => {
        this.build?.upgrade(id);
        this.refreshCombatModifiers();
      };
      this.debugSetEnemy = (id, position, hp) => {
        return this.enemyManager?.debugSetEnemy?.(id, position, hp) ?? false;
      };
    }

    this.aimGuide = this.add.graphics().setDepth(5);
    this.healthText = this.add.text(16, 16, '', { color: '#dff7ff', fontSize: '20px' }).setDepth(10);
    this.progressionText = this.add.text(16, 44, '', { color: '#65f6ff', fontSize: '16px' }).setDepth(10);
    this.add.rectangle(16, 70, XP_BAR_WIDTH, 8, 0x17314a, 0.95)
      .setOrigin(0, 0.5)
      .setDepth(10);
    this.progressionBarFill = this.add.rectangle(16, 70, XP_BAR_WIDTH, 8, 0x65f6ff, 1)
      .setOrigin(0, 0.5)
      .setDepth(11);
    this.add.text(GAME_WIDTH - 16, 16, 'WASD / MOUSE · TWO TOUCH STICKS', {
      color: '#6f8aa8',
      fontSize: '12px',
    }).setOrigin(1, 0);
    this.updateHealthText();
    this.updateProgressionText();
    this.drawAimGuide();

    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown);
    this.handleVisibilityChange();
  }

  update(_time: number, delta: number): void {
    if (
      this.defeated
      || !this.playerInput
      || !this.orbManager
      || !this.enemyManager
      || !this.encounterDirector
    ) return;

    if (this.pause.isPaused()) return;

    const gameplayDelta = this.pause.consumeGameplayDelta(delta);
    this.gameplayElapsedMs += gameplayDelta;
    const next = movePlayer(this.player, this.playerInput.movement, gameplayDelta);
    this.player.setPosition(next.x, next.y);
    this.aim = resolveAim(this.aim, this.playerInput.aimCandidate);
    if (!this.aimQueueActivated && this.playerInput.aimActivated) {
      this.aimQueueActivated = true;
      this.orbManager.activateAim();
    }
    this.drawAimGuide();
    this.orbManager.update(this.time.now, gameplayDelta, next, this.aim);
    this.temporaryOrbManager?.update(this.gameplayElapsedMs);
    this.enemyManager.update();
    const enemies = this.enemyManager.getSnapshot();
    const formation = this.encounterDirector.update(gameplayDelta, {
      activeEnemies: enemies.enemies.length,
      topmostEnemyY: enemies.topmostEnemyY,
    });
    if (formation) this.enemyManager.spawnFormation(formation);
  }

  getDebugSnapshot(): CombatDebugSnapshot {
    const enemySnapshot = this.enemyManager?.getSnapshot() ?? {
      enemies: [],
      topmostEnemyY: Number.POSITIVE_INFINITY,
      activeShooters: 0,
      bullets: 0,
    };
    return {
      player: { x: this.player?.x ?? 0, y: this.player?.y ?? 0 },
      aim: { ...this.aim },
      health: { ...this.health },
      defeated: this.defeated,
      orbs: (this.orbManager?.getSnapshot() ?? []).map((orb) => ({
        id: orb.id,
        state: orb.state,
        charges: orb.charges,
        damageEnabled: orb.damageEnabled,
        collisionEnabled: orb.collisionEnabled,
        position: { ...orb.position },
        velocity: { ...orb.velocity },
        lastRecoverySource: orb.lastRecoverySource,
      })),
      enemies: enemySnapshot.enemies.map((enemy) => ({
        id: enemy.id,
        kind: enemy.kind,
        hp: enemy.hp,
        position: { ...enemy.position },
        warning: enemy.warning,
      })),
      activeShooters: enemySnapshot.activeShooters,
      bullets: enemySnapshot.bullets,
      experiment: { ...this.experiment },
      encounter: this.encounterDirector?.getSnapshot() ?? {
        elapsedMs: 0,
        elapsedSinceSpawnMs: 0,
        phase: 0,
        spawnSequence: 0,
      },
      progression: this.progression?.getSnapshot() ?? {
        level: 0,
        xp: 0,
        xpRequired: 8,
        pendingChoices: 0,
        choices: [],
      },
      buildRanks: this.build?.getRanks() ?? {
        firepower: 0,
        kinetic: 0,
        explosion: 0,
        split: 0,
      },
      pauseReasons: PAUSE_REASONS.filter((reason) => this.pause.has(reason)),
      levelUpVisible: this.levelUpOverlay?.isVisible() ?? false,
      temporaryOrbs: this.temporaryOrbManager?.getSnapshot().length ?? 0,
      gameplayElapsedMs: this.gameplayElapsedMs,
    };
  }

  private handleEnemyKilled(kind: Parameters<ProgressionManager['gainEnemyKill']>[0]): void {
    if (this.defeated) return;
    this.progression?.gainEnemyKill(kind);
    this.updateProgressionText();
    this.openNextLevelUp();
  }

  private handleDirectHit(event: DirectHitEvent): void {
    const explosion = this.build?.explosion();
    if (explosion) {
      this.enemyManager?.applyAreaDamage(
        event.position,
        explosion.radius,
        explosion.damage,
        event.enemyId,
      );
      const ring = this.add.graphics()
        .lineStyle(2, 0xffb45c, 0.85)
        .strokeCircle(event.position.x, event.position.y, explosion.radius)
        .setDepth(4);
      this.time.delayedCall(120, () => ring.destroy());
    }

    if (event.source === 'permanent' && event.charged) {
      const count = this.build?.splitCount() ?? 0;
      if (count > 0) this.temporaryOrbManager?.spawn(event.position, event.direction, count);
    }
  }

  private openNextLevelUp(): void {
    if (this.defeated || !this.build || !this.progression || !this.levelUpOverlay) return;
    const snapshot = this.progression.getSnapshot();
    if (snapshot.pendingChoices === 0 || snapshot.choices.length === 0) return;

    this.pause.add('levelUp');
    this.syncPauseState();
    this.levelUpOverlay.show(snapshot.choices, this.build, (id) => this.chooseAbility(id));
  }

  private chooseAbility(id: AbilityId): boolean {
    if (this.defeated || !this.progression || !this.levelUpOverlay?.isVisible()) return false;
    if (!this.progression.choose(id)) return false;

    this.refreshCombatModifiers();
    this.updateProgressionText();
    if (this.progression.getSnapshot().pendingChoices > 0) {
      this.openNextLevelUp();
    } else {
      this.levelUpOverlay.hide();
      this.pause.remove('levelUp');
      this.syncPauseState();
    }
    return true;
  }

  private refreshCombatModifiers(): void {
    this.orbManager?.refreshCombatModifiers();
  }

  private damagePlayer(amount: number): void {
    if (this.defeated || !canTakeDamage(this.time.now, this.invulnerableUntil)) return;
    this.invulnerableUntil = this.time.now + INVULNERABILITY_MS;
    this.health = applyDamage(this.health, amount);
    this.updateHealthText();
    this.cameras.main.flash(80, 170, 35, 60);
    if (this.health.defeated) this.showDefeat();
  }

  private updateHealthText(): void {
    this.healthText.setText(`HP ${this.health.current}/${this.health.maximum}`);
  }

  private updateProgressionText(): void {
    if (!this.progressionText || !this.progressionBarFill || !this.progression) return;
    const { level, xp, xpRequired } = this.progression.getSnapshot();
    const hud = progressionHudState(level, xp, xpRequired);
    this.progressionText.setText(hud.label);
    this.progressionBarFill.setScale(hud.fillRatio, 1);
  }

  private showDefeat(): void {
    if (this.defeated) return;
    this.defeated = true;
    this.levelUpOverlay?.hide();
    this.pause.remove('levelUp');
    this.pause.add('defeated');
    this.syncPauseState();
    this.temporaryOrbManager?.destroy();
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 330, 160, 0x091225, 0.94)
      .setDepth(20)
      .setInteractive();
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 24, 'SYSTEM DOWN', {
      color: '#ff7085',
      fontSize: '28px',
    }).setOrigin(0.5).setDepth(21);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 36, '다시 시작', {
      color: '#dff7ff',
      fontSize: '20px',
    })
      .setOrigin(0.5)
      .setDepth(21)
      .setInteractive({ useHandCursor: true })
      .once('pointerup', () => this.scene.restart());
  }

  private drawAimGuide(): void {
    const points = traceFirstBounce(this.player, this.aim, ORB_RADIUS, AIM_REFLECTION_LENGTH);
    this.aimGuide.clear().lineStyle(2, 0x65f6ff, 0.55);
    this.drawDashedSegment(points[0], points[1]);
    this.drawDashedSegment(points[1], points[2]);
  }

  private drawDashedSegment(start: Vector, end: Vector): void {
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    const direction = { x: (end.x - start.x) / length, y: (end.y - start.y) / length };
    const dash = 8;
    const gap = 6;
    for (let distance = 0; distance < length; distance += dash + gap) {
      const dashEnd = Math.min(length, distance + dash);
      this.aimGuide.beginPath();
      this.aimGuide.moveTo(start.x + direction.x * distance, start.y + direction.y * distance);
      this.aimGuide.lineTo(start.x + direction.x * dashEnd, start.y + direction.y * dashEnd);
      this.aimGuide.strokePath();
    }
  }

  private readonly handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.pause.add('visibility');
    } else {
      this.pause.remove('visibility');
    }
    this.syncPauseState();
  };

  private syncPauseState(): void {
    this.playerInput?.setGameplayPointerEnabled(!this.pause.has('levelUp'));
    if (this.pause.isPaused()) {
      this.physics.pause();
      this.time.paused = true;
      return;
    }
    this.physics.resume();
    this.time.paused = false;
  }

  private readonly handleShutdown = (): void => {
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.enemyManager?.destroy();
    this.temporaryOrbManager?.destroy();
    this.orbManager?.destroy();
    this.playerInput?.destroy();
    this.levelUpOverlay?.destroy();
    this.enemyManager = undefined;
    this.encounterDirector = undefined;
    this.orbManager = undefined;
    this.temporaryOrbManager = undefined;
    this.playerInput = undefined;
    this.levelUpOverlay = undefined;
    this.progression = undefined;
    this.build = undefined;
  };

  private createTextures(): void {
    if (this.textures.exists('player')) return;
    const graphics = this.add.graphics();
    graphics.fillStyle(0x4ddcff).fillCircle(18, 18, 18);
    graphics.fillStyle(0x061225).fillCircle(12, 15, 2).fillCircle(24, 15, 2);
    graphics.lineStyle(2, 0x061225).beginPath().moveTo(12, 24).lineTo(18, 27).lineTo(24, 24).strokePath();
    graphics.generateTexture('player', 36, 36);
    graphics.clear().fillStyle(0xffffff).fillCircle(8, 8, 7);
    graphics.lineStyle(2, 0x4ddcff).strokeCircle(8, 8, 7).generateTexture('orb-charged', 16, 16);
    graphics.clear().fillStyle(0xfff4a3).fillCircle(6, 6, 5);
    graphics.lineStyle(2, 0xff9f43).strokeCircle(6, 6, 5).generateTexture('orb-temporary', 12, 12);
    graphics.clear().fillStyle(0xff5c70).fillRoundedRect(0, 0, 36, 28, 5)
      .generateTexture('enemy-basic', 36, 28);
    graphics.clear().fillStyle(0x9b6dff).fillRoundedRect(0, 0, 40, 32, 5);
    graphics.lineStyle(3, 0xd8c8ff).strokeRoundedRect(2, 2, 36, 28, 4)
      .generateTexture('enemy-armored', 40, 32);
    graphics.clear().fillStyle(0xffa23a).fillRoundedRect(0, 0, 38, 30, 5);
    graphics.fillStyle(0x4c2400).fillCircle(19, 15, 5).generateTexture('enemy-shooter', 38, 30);
    graphics.clear().fillStyle(0xffe45c).fillCircle(5, 5, 5).generateTexture('enemy-bullet', 10, 10);
    graphics.destroy();
  }
}
