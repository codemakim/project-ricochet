import Phaser from 'phaser';
import { traceFirstBounce } from '../aim/trajectory';
import { BOSS_GEOMETRY } from '../bosses/bossGeometry';
import { BossManager, type BossDirectHitEvent } from '../bosses/BossManager';
import type { BossPartId } from '../bosses/bossRules';
import { CombatPauseController, type PauseReason } from '../combat/CombatPauseController';
import { GAME_TUNING } from '../config/gameTuning';
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
import { createInitialFormation } from '../encounters/formationRules';
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
import { BossBuild } from '../progression/BossBuild';
import { ProgressionManager, type ProgressionSnapshot } from '../progression/ProgressionManager';
import type { AbilityId, AbilityRanks } from '../progression/progressionRules';
import { selectBossRewardOptions, type BossRewardId } from '../progression/bossRewardRules';
import { BossRewardOverlay } from '../ui/BossRewardOverlay';
import { LevelUpOverlay } from '../ui/LevelUpOverlay';
import { progressionHudState } from '../ui/progressionHud';
import { shouldFinalizeBossReward } from './combatSceneRules';
import { parseExperimentSettings } from './experimentSettings';

const INVULNERABILITY_MS = 600;
const AIM_REFLECTION_LENGTH = 90;
const PROGRESSION_SEED = 0x5249434f;
const BOSS_REWARD_SEED = 0x424f5353;
let formationRunSeed = (Date.now() ^ 0x5249434f) >>> 0;
const XP_BAR_WIDTH = 220;
const PAUSE_REASONS: readonly PauseReason[] = ['visibility', 'levelUp', 'bossReward', 'defeated'];

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
  boss: ReturnType<BossManager['getSnapshot']>;
  bossRewards: BossRewardId[];
  bossRewardChoices: BossRewardId[];
  bossRewardVisible: boolean;
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
  declare debugAdvanceEncounter?: (deltaMs: number) => void;
  declare debugRecordEnemyKill?: (kind: Parameters<EncounterDirector['recordEnemyKill']>[0]) => void;
  declare debugDamageBossPart?: (partId: BossPartId, damage: number) => void;
  declare debugSetBossPosition?: (x: number) => void;

  private player!: Phaser.Physics.Arcade.Sprite;
  private playerInput?: PlayerInput;
  private orbManager?: OrbManager;
  private temporaryOrbManager?: TemporaryOrbManager;
  private enemyManager?: EnemyManager;
  private encounterDirector?: EncounterDirector;
  private bossManager?: BossManager;
  private aimGuide!: Phaser.GameObjects.Graphics;
  private healthText!: Phaser.GameObjects.Text;
  private progressionText!: Phaser.GameObjects.Text;
  private progressionBarFill!: Phaser.GameObjects.Rectangle;
  private build?: BuildState;
  private progression?: ProgressionManager;
  private levelUpOverlay?: LevelUpOverlay;
  private bossBuild?: BossBuild;
  private bossRewardOverlay?: BossRewardOverlay;
  private bossWarning?: Phaser.GameObjects.Text;
  private bossRewardChoices: BossRewardId[] = [];
  private bossDefeatPending = false;
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
    const runSeed = formationRunSeed;
    formationRunSeed = (formationRunSeed + 1) >>> 0;
    this.health = createHealth();
    this.experiment = parseExperimentSettings(window.location.search);
    this.aim = { x: 0, y: -1 };
    this.invulnerableUntil = 0;
    this.aimQueueActivated = false;
    this.defeated = false;
    this.bossDefeatPending = false;
    this.bossRewardChoices = [];
    this.pause = new CombatPauseController();
    this.gameplayElapsedMs = 0;
    const build = new BuildState();
    this.build = build;
    this.bossBuild = new BossBuild();
    this.progression = new ProgressionManager(PROGRESSION_SEED, build);
    this.levelUpOverlay = new LevelUpOverlay(this);
    this.bossRewardOverlay = new BossRewardOverlay(this);
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
      getRestoredCharges: (source) => this.bossBuild?.restoredCharges(source) ?? 3,
      getOpeningHitBonus: (source, firstHitPending) => (
        this.bossBuild?.openingHitBonus(source, firstHitPending) ?? 0
      ),
    });
    this.temporaryOrbManager = new TemporaryOrbManager(this, {
      getDirectDamageBonus: () => build.directDamageBonus(),
      getGameplayElapsedMs: () => this.gameplayElapsedMs,
    });
    this.encounterDirector = new EncounterDirector(runSeed);
    const initialFormation = createInitialFormation(runSeed).enemies;
    this.enemyManager = new EnemyManager(this, {
      player: this.player,
      orbManager: this.orbManager,
      temporaryOrbManager: this.temporaryOrbManager,
      getGameplayElapsedMs: () => this.gameplayElapsedMs,
      formation: initialFormation,
      onContact: (damage) => this.damagePlayer(damage),
      onBreach: (kind) => this.damagePlayer(breachDamage(kind)),
      onBulletHit: (damage) => this.damagePlayer(damage),
      onEnemyKilled: ({ kind }) => this.handleEnemyKilled(kind),
      onDirectHit: (event) => this.handleDirectHit(event),
      getExternalBulletCount: () => this.bossManager?.getBulletCount() ?? 0,
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
      this.debugAdvanceEncounter = (deltaMs) => {
        if (!Number.isFinite(deltaMs) || deltaMs < 0) {
          throw new RangeError('encounter delta must be finite and non-negative');
        }
        if (this.defeated || this.pause.isPaused()) return;
        this.advanceEncounter(deltaMs);
      };
      this.debugRecordEnemyKill = (kind) => this.encounterDirector?.recordEnemyKill(kind);
      this.debugDamageBossPart = (partId, damage) => {
        if (!Number.isFinite(damage) || damage <= 0) {
          throw new RangeError('boss damage must be finite and positive');
        }
        const snapshot = this.bossManager?.getSnapshot();
        if (!snapshot?.position) return;
        const offset = partId === 'leftWeakpoint'
          ? -BOSS_GEOMETRY.weakpointOffsetX
          : partId === 'rightWeakpoint'
            ? BOSS_GEOMETRY.weakpointOffsetX
            : 0;
        this.bossManager?.applyAreaDamage(
          { x: snapshot.position.x + offset, y: snapshot.position.y },
          0,
          damage,
        );
      };
      this.debugSetBossPosition = (x) => this.bossManager?.debugSetPosition?.(x);
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

    if (shouldFinalizeBossReward(
      this.bossDefeatPending,
      this.defeated,
      this.pause.has('levelUp'),
    )) {
      this.finalizeBossDefeat();
      return;
    }
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
    this.bossManager?.update();
    this.advanceEncounter(gameplayDelta);
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
        speed: enemy.speed,
      })),
      activeShooters: enemySnapshot.activeShooters,
      bullets: enemySnapshot.bullets,
      experiment: { ...this.experiment },
      encounter: this.encounterDirector?.getSnapshot() ?? {
        elapsedMs: 0,
        elapsedSinceSpawnMs: 0,
        phase: 0,
        spawnSequence: 0,
        runSeed: 0,
        lastFormationId: null,
        state: 'running',
        section: 0,
        sectionElapsedMs: 0,
        bossScore: 0,
        warningElapsedMs: 0,
        bossesDefeated: 0,
      },
      progression: this.progression?.getSnapshot() ?? {
        level: 0,
        xp: 0,
        xpRequired: 12,
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
      boss: this.bossManager?.getSnapshot() ?? {
        active: false,
        phase: null,
        position: null,
        parts: null,
        aimedBullets: 0,
        fallingHazards: 0,
        warnings: 0,
      },
      bossRewards: this.bossBuild?.snapshot() ?? [],
      bossRewardChoices: [...this.bossRewardChoices],
      bossRewardVisible: this.bossRewardOverlay?.isVisible() ?? false,
      temporaryOrbs: this.temporaryOrbManager?.getSnapshot().length ?? 0,
      gameplayElapsedMs: this.gameplayElapsedMs,
    };
  }

  private handleEnemyKilled(kind: Parameters<ProgressionManager['gainEnemyKill']>[0]): void {
    if (this.defeated) return;
    this.encounterDirector?.recordEnemyKill(kind);
    this.progression?.gainEnemyKill(kind);
    this.updateProgressionText();
    this.openNextLevelUp();
  }

  private handleDirectHit(event: DirectHitEvent): void {
    this.handlePostDirectHit(event, (radius, damage) => {
      this.enemyManager?.applyAreaDamage(
        event.position,
        radius,
        damage,
        event.enemyId,
      );
      this.bossManager?.applyAreaDamage(event.position, radius, damage);
    });
  }

  private handleBossDirectHit(event: BossDirectHitEvent): void {
    this.handlePostDirectHit(event, (radius, damage) => {
      this.enemyManager?.applyAreaDamage(event.position, radius, damage, -1);
      this.bossManager?.applyAreaDamage(event.position, radius, damage, event.partId);
    });
  }

  private handlePostDirectHit(
    event: Pick<DirectHitEvent, 'source' | 'position' | 'charged' | 'direction'>,
    applyExplosion: (radius: number, damage: number) => void,
  ): void {
    if (event.source === 'temporary' && !this.bossBuild?.temporaryExplosionEnabled()) return;
    const explosion = this.build?.explosion();
    if (explosion) {
      applyExplosion(explosion.radius, explosion.damage);
      this.drawExplosion(event.position, explosion.radius);
    }
    if (event.source !== 'permanent' || !event.charged) return;
    const count = this.build?.splitCount() ?? 0;
    if (count > 0) this.temporaryOrbManager?.spawn(event.position, event.direction, count);
  }

  private drawExplosion(position: Vector, radius: number): void {
    const ring = this.add.graphics()
      .lineStyle(2, 0xffb45c, 0.85)
      .strokeCircle(position.x, position.y, radius)
      .setDepth(4);
    this.time.delayedCall(120, () => ring.destroy());
  }

  private advanceEncounter(deltaMs: number): void {
    if (!this.encounterDirector || !this.enemyManager) return;
    const enemies = this.enemyManager.getSnapshot();
    const { formation, transition } = this.encounterDirector.update(deltaMs, {
      activeEnemies: enemies.enemies.length,
      topmostEnemyY: enemies.topmostEnemyY,
    });
    if (formation) this.enemyManager.spawnFormation(formation);
    if (transition === 'bossWarningStarted') this.showBossWarning();
    if (transition === 'bossStarted') this.startBoss();
  }

  private showBossWarning(): void {
    this.clearBossWarning();
    this.bossWarning = this.add.text(GAME_WIDTH / 2, 116, 'WARNING · MIDBOSS APPROACHING', {
      color: '#ffcf5c',
      fontSize: '22px',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(18);
  }

  private clearBossWarning(): void {
    this.bossWarning?.destroy();
    this.bossWarning = undefined;
  }

  private startBoss(): void {
    if (!this.player || !this.orbManager || !this.temporaryOrbManager || !this.enemyManager) return;
    this.clearBossWarning();
    this.bossManager?.destroy();
    this.bossManager = new BossManager(this, {
      player: this.player,
      orbManager: this.orbManager,
      temporaryOrbManager: this.temporaryOrbManager,
      getEnemies: () => this.enemyManager?.getSnapshot().enemies ?? [],
      getEnemyBulletCount: () => this.enemyManager?.getBulletCount() ?? 0,
      getGameplayElapsedMs: () => this.gameplayElapsedMs,
      onPlayerHit: (damage) => this.damagePlayer(damage),
      onDirectHit: (event) => this.handleBossDirectHit(event),
      onDefeated: () => this.handleBossDefeatSignal(),
    });
  }

  private handleBossDefeatSignal(): void {
    if (this.defeated || this.bossDefeatPending) return;
    this.enemyManager?.clearHostileActions();
    this.bossManager?.clearHostileActions();
    this.bossDefeatPending = true;
  }

  private finalizeBossDefeat(): void {
    if (!this.bossDefeatPending || this.defeated) return;
    this.bossDefeatPending = false;
    this.clearBossWarning();
    this.enemyManager?.clearHostileActions();
    this.bossManager?.clearHostileActions();
    this.encounterDirector?.markBossDefeated();
    const owned = new Set(this.bossBuild?.snapshot() ?? []);
    this.bossRewardChoices = selectBossRewardOptions(
      owned,
      this.build?.getRanks() ?? { firepower: 0, kinetic: 0, explosion: 0, split: 0 },
      BOSS_REWARD_SEED,
    );
    this.pause.add('bossReward');
    this.syncPauseState();
    this.bossRewardOverlay?.show(this.bossRewardChoices, (id) => this.chooseBossReward(id));
  }

  private chooseBossReward(id: BossRewardId): boolean {
    if (this.defeated || !this.bossRewardOverlay?.isVisible() || !this.bossBuild) return false;
    if (!this.bossRewardChoices.includes(id) || this.bossBuild.owns(id)) return false;
    this.bossBuild.acquire(id);
    if (id === 'expanded-magazine') this.orbManager?.addOrb();
    this.encounterDirector?.resumeAfterBossReward();
    this.bossManager?.destroy();
    this.bossManager = undefined;
    this.bossRewardOverlay.hide();
    this.bossRewardChoices = [];
    this.pause.remove('bossReward');
    this.syncPauseState();
    return true;
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
      if (shouldFinalizeBossReward(this.bossDefeatPending, this.defeated, false)) {
        this.finalizeBossDefeat();
      } else {
        this.syncPauseState();
      }
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
    this.bossDefeatPending = false;
    this.clearBossWarning();
    this.levelUpOverlay?.hide();
    this.bossRewardOverlay?.hide();
    this.bossRewardChoices = [];
    this.pause.remove('levelUp');
    this.pause.remove('bossReward');
    this.pause.add('defeated');
    this.syncPauseState();
    this.enemyManager?.clearHostileActions();
    this.bossManager?.destroy();
    this.bossManager = undefined;
    this.bossBuild = new BossBuild();
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
    this.playerInput?.setGameplayPointerEnabled(
      !this.pause.has('levelUp') && !this.pause.has('bossReward'),
    );
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
    this.clearBossWarning();
    this.bossManager?.destroy();
    this.enemyManager?.destroy();
    this.temporaryOrbManager?.destroy();
    this.orbManager?.destroy();
    this.playerInput?.destroy();
    this.levelUpOverlay?.destroy();
    this.bossRewardOverlay?.destroy();
    this.bossDefeatPending = false;
    this.bossRewardChoices = [];
    this.bossManager = undefined;
    this.enemyManager = undefined;
    this.encounterDirector = undefined;
    this.orbManager = undefined;
    this.temporaryOrbManager = undefined;
    this.playerInput = undefined;
    this.levelUpOverlay = undefined;
    this.bossRewardOverlay = undefined;
    this.progression = undefined;
    this.build = undefined;
    this.bossBuild = undefined;
    this.debugAdvanceEncounter = undefined;
    this.debugRecordEnemyKill = undefined;
    this.debugDamageBossPart = undefined;
    this.debugSetBossPosition = undefined;
  };

  private createTextures(): void {
    const createBaseTextures = !this.textures.exists('player');
    const createBossTextures = !this.textures.exists('boss-body');
    if (!createBaseTextures && !createBossTextures) return;
    const graphics = this.add.graphics();
    if (createBaseTextures) {
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
    }
    if (createBossTextures) {
      const { body, weakpoint, core } = GAME_TUNING.boss;
      const bodyStrokeInset = 2;
      const weakpointStrokeInset = 1;
      graphics.clear().fillStyle(0x3b315d).fillRoundedRect(0, 0, body.width, body.height, 12);
      graphics.lineStyle(4, 0x7d6ab3).strokeRoundedRect(
        bodyStrokeInset,
        bodyStrokeInset,
        body.width - bodyStrokeInset * 2,
        body.height - bodyStrokeInset * 2,
        10,
      ).generateTexture('boss-body', body.width, body.height);
      graphics.clear().fillStyle(0xff6c8c).fillRoundedRect(
        0,
        0,
        weakpoint.visual.width,
        weakpoint.visual.height,
        6,
      );
      graphics.lineStyle(2, 0xffd1dc).strokeRoundedRect(
        weakpointStrokeInset,
        weakpointStrokeInset,
        weakpoint.visual.width - weakpointStrokeInset * 2,
        weakpoint.visual.height - weakpointStrokeInset * 2,
        5,
      ).generateTexture(
        'boss-left-weakpoint',
        weakpoint.visual.width,
        weakpoint.visual.height,
      );
      graphics.clear().fillStyle(0xff6c8c).fillRoundedRect(
        0,
        0,
        weakpoint.visual.width,
        weakpoint.visual.height,
        6,
      );
      graphics.lineStyle(2, 0xffd1dc).strokeRoundedRect(
        weakpointStrokeInset,
        weakpointStrokeInset,
        weakpoint.visual.width - weakpointStrokeInset * 2,
        weakpoint.visual.height - weakpointStrokeInset * 2,
        5,
      ).generateTexture(
        'boss-right-weakpoint',
        weakpoint.visual.width,
        weakpoint.visual.height,
      );
      const coreCenter = core.visualSize / 2;
      graphics.clear().fillStyle(0xffd15c).fillCircle(coreCenter, coreCenter, coreCenter - 2);
      graphics.lineStyle(3, 0xffffff).strokeCircle(coreCenter, coreCenter, coreCenter - 3)
        .generateTexture('boss-core', core.visualSize, core.visualSize);
      graphics.clear().fillStyle(0xfff08a).fillCircle(5, 5, 5)
        .generateTexture('boss-aimed-bullet', 10, 10);
      graphics.clear().fillStyle(0xff7b55).fillRoundedRect(0, 0, 16, 24, 5)
        .generateTexture('boss-falling-hazard', 16, 24);
      graphics.clear().lineStyle(2, 0xffe45c, 0.9).strokeCircle(16, 16, 14)
        .generateTexture('boss-aim-marker', 32, 32);
      graphics.clear().lineStyle(3, 0xff704d, 0.9).strokeRoundedRect(1, 1, 30, 10, 4)
        .generateTexture('boss-drop-marker', 32, 12);
    }
    graphics.destroy();
  }
}
