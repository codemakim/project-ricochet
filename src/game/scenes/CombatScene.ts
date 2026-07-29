import Phaser from 'phaser';
import { traceFirstBounce } from '../aim/trajectory';
import { BossManager, type BossManagerSnapshot } from '../bosses/BossManager';
import type {
  BossDirectHitEvent,
  BossEncounter,
  BossEncounterSnapshot,
  BossTargetId,
} from '../bosses/bossEncounter';
import { HiveBossManager } from '../bosses/HiveBossManager';
import type { BossPartId } from '../bosses/bossRules';
import type { HivePartId } from '../bosses/hiveBossRules';
import { CombatPauseController, type PauseReason } from '../combat/CombatPauseController';
import { CombatEffectScheduler, type ScheduledAreaEffect } from '../combat/CombatEffectScheduler';
import { CombatProcState } from '../combat/CombatProcState';
import {
  CorrosionFieldState,
  type CorrosionFieldSnapshot,
} from '../combat/CorrosionFieldState';
import { GAME_TUNING, type BossKind } from '../config/gameTuning';
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
  type EnemyAreaDamageEffect,
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
import {
  createEmptyAbilityRanks,
  type AbilityId,
  type AbilityRanks,
} from '../progression/progressionRules';
import {
  selectBossRewardOptions,
  type BossRewardId,
  type BossRewardTier,
} from '../progression/bossRewardRules';
import { BossRewardOverlay } from '../ui/BossRewardOverlay';
import { LevelUpOverlay } from '../ui/LevelUpOverlay';
import { OrbLoadoutOverlay } from '../ui/OrbLoadoutOverlay';
import { progressionHudState } from '../ui/progressionHud';
import { RunCompleteOverlay } from '../ui/RunCompleteOverlay';
import {
  bossKindAfterTransition,
  bossOrbModifiers,
  createBossForKind,
  finalizeCombatLifecycle,
  inactiveBossSnapshot,
  planDirectHitEffects,
  planOrbCoreEffects,
  rewardAddsPermanentOrb,
  rewardTierForBoss,
  schedulePlannedAftershock,
  settlePlannedAreaEffects,
  shouldFinalizeBossReward,
} from './combatSceneRules';
import { renderableCombatTextureDescriptors, type CombatTextureDescriptor } from './combatTextureRules';
import { parseExperimentSettings } from './experimentSettings';

const INVULNERABILITY_MS = 600;
const AIM_REFLECTION_LENGTH = 90;
const PROGRESSION_SEED = 0x5249434f;
const BOSS_REWARD_SEED = 0x424f5353;
let formationRunSeed = (Date.now() ^ 0x5249434f) >>> 0;
const XP_BAR_WIDTH = 220;
const PAUSE_REASONS: readonly PauseReason[] = [
  'visibility',
  'loadout',
  'levelUp',
  'bossReward',
  'runComplete',
  'defeated',
];

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
  loadoutVisible: boolean;
  boss: BossEncounterSnapshot & Partial<Pick<
    BossManagerSnapshot,
    'basicBullets' | 'aimedBullets' | 'fallingHazards'
  >>;
  bossRewardTier: BossRewardTier | null;
  bossRewards: BossRewardId[];
  bossRewardChoices: BossRewardId[];
  bossRewardVisible: boolean;
  runCompleteVisible: boolean;
  temporaryOrbs: number;
  temporaryOrbSnapshots: ReturnType<TemporaryOrbManager['getSnapshot']>;
  scheduledEffects: ScheduledAreaEffect[];
  corrosionFields: readonly CorrosionFieldSnapshot[];
  activePopulation: number;
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
  declare debugDamageBossPart?: (partId: BossPartId | HivePartId, damage: number) => void;
  declare debugSetBossPosition?: (x: number) => void;
  declare debugAdvanceHiveCycle?: (deltaMs: number) => void;
  declare debugPlaceTemporaryOrb?: (id: number, position: Vector) => boolean;
  declare debugShowCoreFeedback?: (
    type: 'corrosion' | 'conduction',
    position: Vector,
  ) => void;

  private player!: Phaser.Physics.Arcade.Sprite;
  private playerInput?: PlayerInput;
  private orbManager?: OrbManager;
  private temporaryOrbManager?: TemporaryOrbManager;
  private enemyManager?: EnemyManager;
  private encounterDirector?: EncounterDirector;
  private activeBoss?: BossEncounter;
  private activeBossKind?: BossKind;
  private bossRewardTier: BossRewardTier | null = null;
  private readonly combatEffects = new CombatEffectScheduler();
  private readonly corrosionFields = new CorrosionFieldState();
  private readonly corrosionVisuals = new Map<number, Phaser.GameObjects.Graphics>();
  private combatProcs?: CombatProcState;
  private aimGuide!: Phaser.GameObjects.Graphics;
  private healthText!: Phaser.GameObjects.Text;
  private progressionText!: Phaser.GameObjects.Text;
  private progressionBarFill!: Phaser.GameObjects.Rectangle;
  private build?: BuildState;
  private progression?: ProgressionManager;
  private levelUpOverlay?: LevelUpOverlay;
  private orbLoadoutOverlay?: OrbLoadoutOverlay;
  private bossBuild?: BossBuild;
  private bossRewardOverlay?: BossRewardOverlay;
  private runCompleteOverlay?: RunCompleteOverlay;
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
    this.activeBossKind = undefined;
    this.bossRewardTier = null;
    this.combatEffects.clear();
    this.corrosionFields.clear();
    this.corrosionVisuals.clear();
    this.bossRewardChoices = [];
    this.pause = new CombatPauseController();
    this.gameplayElapsedMs = 0;
    this.combatProcs = new CombatProcState(runSeed);
    const build = new BuildState();
    this.build = build;
    this.bossBuild = new BossBuild();
    this.progression = new ProgressionManager(PROGRESSION_SEED, build);
    this.levelUpOverlay = new LevelUpOverlay(this);
    this.orbLoadoutOverlay = new OrbLoadoutOverlay(this);
    this.bossRewardOverlay = new BossRewardOverlay(this);
    this.runCompleteOverlay = new RunCompleteOverlay(this);
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
      getConditionalDirectDamageBonus: (context) => (
        build.conditionalDirectDamageBonus(context)
      ),
      getWallSpeedMultiplier: (wallHits) => build.wallSpeedMultiplier(wallHits),
      getRestoredCharges: (source) => this.bossBuild?.restoredCharges(source) ?? 3,
      getOpeningHitBonus: (source, firstHitPending) => (
        this.bossBuild?.openingHitBonus(source, firstHitPending) ?? 0
      ),
      getChargedDamageBonus: () => (
        this.bossBuild ? bossOrbModifiers(this.bossBuild).chargedDamageBonus : 0
      ),
      chargedKillPierces: () => (
        this.bossBuild ? bossOrbModifiers(this.bossBuild).chargedKillPierces : false
      ),
      getOrbLimit: () => this.bossBuild?.orbLimit() ?? 3,
      onRecovery: (orbId, source) => {
        this.combatProcs?.resetOrbFlight(orbId);
        this.handleOrbRecovery(source);
      },
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
      getExternalBulletCount: () => this.activeBoss?.getBulletCount() ?? 0,
      textureKeys: {
        splitter: 'enemy-splitter',
        fragmentLeft: 'enemy-fragment-left',
        fragmentRight: 'enemy-fragment-right',
      },
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
        this.activeBoss?.applyDirectDamage(partId, damage);
      };
      this.debugSetBossPosition = (x) => {
        if (this.activeBossKind === 'sentinel' && this.activeBoss instanceof BossManager) {
          this.activeBoss.debugSetPosition?.(x);
        }
      };
      this.debugAdvanceHiveCycle = (deltaMs) => {
        if (!Number.isFinite(deltaMs) || deltaMs < 0) {
          throw new RangeError('hive cycle delta must be finite and non-negative');
        }
        if (this.activeBossKind === 'hive' && this.activeBoss instanceof HiveBossManager) {
          this.activeBoss.debugAdvanceCycle?.(deltaMs);
        }
      };
      this.debugPlaceTemporaryOrb = (id, position) => (
        this.temporaryOrbManager?.debugPlaceOrb?.(id, position) ?? false
      );
      this.debugShowCoreFeedback = (type, position) => {
        if (type === 'corrosion') {
          this.corrosionFields.spawn(-1, position, this.gameplayElapsedMs);
          this.syncCorrosionVisuals();
        } else {
          this.drawConductionFeedback(position, []);
        }
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
    this.pause.add('loadout');
    this.syncPauseState();
    this.orbLoadoutOverlay.showStarting((types) => {
      if (!this.orbManager?.configureStartingCores(types)) return false;
      this.pause.remove('loadout');
      this.syncPauseState();
      return true;
    });
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
    this.activeBoss?.update();
    this.drainCombatEffects();
    this.drainCorrosionFields();
    this.advanceEncounter(gameplayDelta);
  }

  getDebugSnapshot(): CombatDebugSnapshot {
    const enemySnapshot = this.enemyManager?.getSnapshot() ?? {
      enemies: [],
      activePopulation: 0,
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
        coreType: orb.coreType,
        coreState: { ...orb.coreState },
        state: orb.state,
        charges: orb.charges,
        damageEnabled: orb.damageEnabled,
        collisionEnabled: orb.collisionEnabled,
        position: { ...orb.position },
        velocity: { ...orb.velocity },
        lastRecoverySource: orb.lastRecoverySource,
        wallHits: orb.wallHits,
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
        stageIndex: 0,
        stageId: 'default-1',
        stageNumber: 1,
        stageElapsedMs: 0,
        bossScore: 0,
        warningElapsedMs: 0,
        pendingBossKind: null,
        bossesDefeated: 0,
      },
      progression: this.progression?.getSnapshot() ?? {
        level: 0,
        xp: 0,
        xpRequired: 12,
        pendingChoices: 0,
        choices: [],
      },
      buildRanks: this.build?.getRanks() ?? createEmptyAbilityRanks(),
      pauseReasons: PAUSE_REASONS.filter((reason) => this.pause.has(reason)),
      levelUpVisible: this.levelUpOverlay?.isVisible() ?? false,
      loadoutVisible: this.orbLoadoutOverlay?.isVisible() ?? false,
      boss: this.activeBoss?.getSnapshot() ?? {
        ...inactiveBossSnapshot(this.activeBossKind ?? null),
        basicBullets: 0,
        aimedBullets: 0,
        fallingHazards: 0,
      },
      bossRewardTier: this.bossRewardTier,
      bossRewards: this.bossBuild?.snapshot() ?? [],
      bossRewardChoices: [...this.bossRewardChoices],
      bossRewardVisible: this.bossRewardOverlay?.isVisible() ?? false,
      runCompleteVisible: this.runCompleteOverlay?.isVisible() ?? false,
      temporaryOrbs: this.temporaryOrbManager?.getSnapshot().length ?? 0,
      temporaryOrbSnapshots: this.temporaryOrbManager?.getSnapshot().map((orb) => ({
        ...orb,
        position: { ...orb.position },
        velocity: { ...orb.velocity },
      })) ?? [],
      scheduledEffects: this.combatEffects.getSnapshot(),
      corrosionFields: this.corrosionFields.getSnapshot(),
      activePopulation: enemySnapshot.activePopulation,
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
    this.handlePostDirectHit(event, event.enemyId);
  }

  private handleBossDirectHit(event: BossDirectHitEvent): void {
    this.handlePostDirectHit(event, -1, event.targetId);
  }

  private handlePostDirectHit(
    event: Pick<
      DirectHitEvent,
      | 'source'
      | 'sourceOrbId'
      | 'position'
      | 'charged'
      | 'direction'
      | 'coreType'
      | 'conductionTriggered'
      | 'killed'
    >,
    excludedEnemyId: number,
    excludedBossTargetId?: BossTargetId,
  ): void {
    if (!this.build || !this.bossBuild) return;
    const explosion = this.build.explosion();
    const split = this.build.split();
    const permanent = event.source === 'permanent';
    const cutter = GAME_TUNING.build.cutter;
    const corrosion = GAME_TUNING.orbCores.corrosion;
    const corrosionTriggered = Boolean(
      permanent
      && event.coreType === 'corrosion'
      && this.combatProcs?.tryProc(
        'corrosion',
        event.sourceOrbId,
        this.gameplayElapsedMs,
        corrosion.chance,
        corrosion.cooldownMs,
      )
    );
    const corePlan = planOrbCoreEffects(event, corrosionTriggered);
    const decision = {
      explosion: Boolean(permanent && explosion && this.combatProcs?.tryProc(
        'explosion',
        event.sourceOrbId,
        this.gameplayElapsedMs,
        explosion.chance,
        explosion.cooldownMs,
      )),
      split: Boolean(permanent && split && this.combatProcs?.trySplit(
        event.sourceOrbId,
        this.gameplayElapsedMs,
        split.chance,
        split.cooldownMs,
      )),
      horizontalCutter: Boolean(permanent && this.build.horizontalCutter()
        && this.combatProcs?.tryProc(
          'horizontal-cutter',
          event.sourceOrbId,
          this.gameplayElapsedMs,
          cutter.chance,
          cutter.cooldownMs,
        )),
      verticalCutter: Boolean(permanent && this.build.verticalCutter()
        && this.combatProcs?.tryProc(
          'vertical-cutter',
          event.sourceOrbId,
          this.gameplayElapsedMs,
          cutter.chance,
          cutter.cooldownMs,
        )),
      destructionReaction: Boolean(
        permanent
        && event.killed
        && this.build.destructionReaction()
        && this.combatProcs?.tryProc(
          'destruction-reaction',
          event.sourceOrbId,
          this.gameplayElapsedMs,
          GAME_TUNING.build.destructionReaction.chance,
          GAME_TUNING.build.destructionReaction.cooldownMs,
        ),
      ),
    };
    const plan = planDirectHitEffects(
      event,
      this.build,
      this.bossBuild,
      decision,
    );
    if (plan.spawnChildren) {
      this.temporaryOrbManager?.spawnChildren(
        event.sourceOrbId,
        event.position,
        event.direction,
      );
    }
    if (corePlan.spawnCorrosion) {
      this.corrosionFields.spawn(
        event.sourceOrbId,
        event.position,
        this.gameplayElapsedMs,
      );
      this.syncCorrosionVisuals();
    }
    if (corePlan.dischargeConduction) {
      const conduction = GAME_TUNING.orbCores.conduction;
      let targetPositions: Vector[] = [];
      if (excludedBossTargetId === undefined) {
        targetPositions = this.enemyManager?.nearestSecondaryTargets(
          event.position,
          excludedEnemyId,
          conduction.radius,
          conduction.targetCount,
        ).map(({ position }) => position) ?? [];
        this.enemyManager?.applyNearestSecondaryDamage(
          event.position,
          excludedEnemyId,
          conduction.radius,
          conduction.targetCount,
          conduction.damage,
        );
      } else {
        const targetIds = this.activeBoss?.applyAreaDamage(
          event.position,
          conduction.radius,
          conduction.damage,
          excludedBossTargetId,
        ) ?? [];
        targetPositions = targetIds
          .map((targetId) => this.activeBoss?.getTargetPosition(targetId))
          .filter((position): position is Vector => position !== null && position !== undefined);
      }
      this.drawConductionFeedback(event.position, targetPositions);
    }
    if (decision.horizontalCutter) {
      this.applyCutter('horizontal', event.position.y, excludedEnemyId, excludedBossTargetId);
    }
    if (decision.verticalCutter) {
      this.applyCutter('vertical', event.position.x, excludedEnemyId, excludedBossTargetId);
    }
    if (decision.destructionReaction) {
      const reaction = GAME_TUNING.build.destructionReaction;
      this.applyAreaEffects(
        event.position,
        [{ radius: reaction.radius, damage: reaction.damage }],
        excludedEnemyId,
        excludedBossTargetId,
      );
      this.drawEffectRing(
        event.position,
        reaction.radius,
        GAME_TUNING.visual.triggerFeedback.destructionColor,
        'trigger-feedback-destruction',
      );
    }
    if (plan.immediateAreas.length > 0) {
      this.applyAreaEffects(
        event.position,
        plan.immediateAreas,
        excludedEnemyId,
        excludedBossTargetId,
      );
      for (const effect of plan.immediateAreas) {
        this.drawExplosion(event.position, effect.radius);
      }
    }
    schedulePlannedAftershock(
      plan,
      this.combatEffects,
      this.gameplayElapsedMs,
      event.position,
      excludedBossTargetId,
    );
    if (plan.splitCount > 0) {
      this.temporaryOrbManager?.spawn(
        event.position,
        event.direction,
        plan.splitCount,
      );
    }
    const missile = this.build.microMissile();
    if (
      permanent
      && missile
      && this.combatProcs?.recordMicroMissileHit(missile.hitsRequired)
    ) {
      this.launchMicroMissile(event.position, excludedEnemyId, excludedBossTargetId, missile);
    }
  }

  private applyCutter(
    axis: 'horizontal' | 'vertical',
    coordinate: number,
    excludedEnemyId: number,
    excludedBossTargetId?: BossTargetId,
  ): void {
    const { thickness, damage } = GAME_TUNING.build.cutter;
    this.enemyManager?.applyLineDamage(axis, coordinate, thickness, damage, excludedEnemyId);
    this.activeBoss?.applyLineDamage(
      axis,
      coordinate,
      thickness,
      damage,
      excludedBossTargetId,
    );
    const feedback = GAME_TUNING.visual.triggerFeedback;
    const line = this.add.graphics()
      .lineStyle(thickness, feedback.laserColor, 0.75)
      .setDepth(4)
      .setName(`trigger-feedback-${axis}-cutter`);
    if (axis === 'horizontal') line.lineBetween(0, coordinate, GAME_WIDTH, coordinate);
    else line.lineBetween(coordinate, 0, coordinate, GAME_HEIGHT);
    this.time.delayedCall(feedback.durationMs, () => line.destroy());
  }

  private applyAreaEffects(
    position: Vector,
    effects: readonly Pick<EnemyAreaDamageEffect, 'radius' | 'damage'>[],
    excludedEnemyId = -1,
    excludedBossTargetId?: BossTargetId,
  ): void {
    settlePlannedAreaEffects(
      position,
      effects,
      excludedEnemyId,
      excludedBossTargetId,
      {
        applyEnemyBatch: (batch) => this.enemyManager?.applyAreaDamageBatch(batch),
        applyBossArea: (center, radius, damage, excludedTargetId) => (
          this.activeBoss?.applyAreaDamage(center, radius, damage, excludedTargetId)
        ),
      },
    );
  }

  private drainCombatEffects(): void {
    for (const effect of this.combatEffects.drainDue(this.gameplayElapsedMs)) {
      this.applyAreaEffects(effect.position, [effect], -1, effect.excludedBossTargetId);
      this.drawExplosion(effect.position, effect.radius);
    }
  }

  private drainCorrosionFields(): void {
    for (const tick of this.corrosionFields.drainDue(this.gameplayElapsedMs)) {
      const targets = this.enemyManager?.nearestSecondaryTargets(
        tick.position,
        -1,
        tick.radius,
        Number.MAX_SAFE_INTEGER,
      ) ?? [];
      this.applyAreaEffects(tick.position, [tick]);
      this.drawCorrosionTick(tick.position, tick.radius);
      for (const target of targets) this.drawCorrosionDamage(target.position, tick.damage);
    }
    this.syncCorrosionVisuals();
  }

  private syncCorrosionVisuals(): void {
    const fields = this.corrosionFields.getSnapshot();
    const activeIds = new Set(fields.map(({ fieldId }) => fieldId));
    for (const [fieldId, visual] of this.corrosionVisuals) {
      if (activeIds.has(fieldId)) continue;
      visual.destroy();
      this.corrosionVisuals.delete(fieldId);
    }
    for (const field of fields) {
      if (this.corrosionVisuals.has(field.fieldId)) continue;
      const tuning = GAME_TUNING.orbCores.corrosion;
      const feedback = GAME_TUNING.visual.coreFeedback;
      const visual = this.add.graphics()
        .fillStyle(tuning.fill, feedback.corrosionFieldAlpha)
        .fillCircle(field.position.x, field.position.y, tuning.radius)
        .lineStyle(2, tuning.accent, feedback.corrosionLineAlpha)
        .strokeCircle(field.position.x, field.position.y, tuning.radius)
        .setDepth(3)
        .setName('core-feedback-corrosion');
      this.corrosionVisuals.set(field.fieldId, visual);
    }
  }

  private drawCorrosionTick(position: Vector, radius: number): void {
    const pulse = this.add.graphics()
      .lineStyle(3, GAME_TUNING.orbCores.corrosion.accent, 0.8)
      .strokeCircle(position.x, position.y, radius * 0.72)
      .setDepth(4)
      .setName('core-feedback-corrosion-tick');
    this.time.delayedCall(
      GAME_TUNING.visual.coreFeedback.corrosionTickDurationMs,
      () => pulse.destroy(),
    );
  }

  private drawConductionFeedback(position: Vector, targets: readonly Vector[]): void {
    const { conduction } = GAME_TUNING.orbCores;
    const pulse = this.add.graphics()
      .lineStyle(3, conduction.accent, 0.95)
      .strokeCircle(position.x, position.y, 8)
      .setDepth(4)
      .setName('core-feedback-conduction');
    for (const target of targets) {
      const middle = {
        x: (position.x + target.x) / 2 + (target.y - position.y) * 0.08,
        y: (position.y + target.y) / 2 - (target.x - position.x) * 0.08,
      };
      pulse.beginPath()
        .moveTo(position.x, position.y)
        .lineTo(middle.x, middle.y)
        .lineTo(target.x, target.y)
        .strokePath();
      pulse.strokeCircle(target.x, target.y, 5);
    }
    this.time.delayedCall(
      GAME_TUNING.visual.coreFeedback.conductionDurationMs,
      () => pulse.destroy(),
    );
  }

  private drawCorrosionDamage(position: Vector, damage: number): void {
    const label = this.add.text(position.x, position.y - 14, `-${damage.toFixed(2)}`, {
      color: '#7dff91',
      fontSize: '12px',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(5).setName('core-feedback-corrosion-damage');
    this.time.delayedCall(
      GAME_TUNING.visual.coreFeedback.corrosionDamageNumberDurationMs,
      () => label.destroy(),
    );
  }

  private handleOrbRecovery(source: Parameters<BossBuild['recoverySalvoCount']>[0]): void {
    const count = this.bossBuild?.recoverySalvoCount(source) ?? 0;
    if (count > 0 && this.player) {
      this.temporaryOrbManager?.spawn(
        { x: this.player.x, y: this.player.y },
        this.aim,
        count,
      );
    }
    const shockwave = this.build?.recoveryShockwave();
    if (
      source === 'proximity'
      && shockwave
      && this.combatProcs?.recordProximityRecovery(shockwave.recoveriesRequired)
      && this.player
    ) {
      const position = { x: this.player.x, y: this.player.y };
      this.applyAreaEffects(position, [shockwave]);
      this.drawEffectRing(
        position,
        shockwave.radius,
        GAME_TUNING.visual.triggerFeedback.shockwaveColor,
        'trigger-feedback-recovery-shockwave',
      );
    }
  }

  private launchMicroMissile(
    origin: Vector,
    excludedEnemyId: number,
    excludedBossTargetId: BossTargetId | undefined,
    missile: NonNullable<ReturnType<BuildState['microMissile']>>,
  ): void {
    const enemy = this.enemyManager?.nearestSecondaryTargets(
      origin,
      excludedEnemyId,
      Number.POSITIVE_INFINITY,
      1,
    )[0];
    const bossTargets = Object.entries(this.activeBoss?.getSnapshot().parts ?? {})
      .filter(([targetId, hp]) => hp > 0 && targetId !== excludedBossTargetId)
      .map(([targetId]) => ({
        targetId,
        position: this.activeBoss?.getTargetPosition(targetId),
      }))
      .filter((target): target is { targetId: string; position: Vector } => Boolean(target.position));
    const targets = [
      ...(enemy ? [{ kind: 'enemy' as const, id: enemy.id, position: enemy.position }] : []),
      ...bossTargets.map(({ targetId, position }) => ({
        kind: 'boss' as const,
        id: targetId,
        position,
      })),
    ].sort((left, right) => (
      Math.hypot(left.position.x - origin.x, left.position.y - origin.y)
      - Math.hypot(right.position.x - origin.x, right.position.y - origin.y)
    ));
    const target = targets[0];
    if (!target) return;
    const trail = this.add.graphics()
      .lineStyle(3, GAME_TUNING.visual.triggerFeedback.missileColor, 0.9)
      .lineBetween(origin.x, origin.y, target.position.x, target.position.y)
      .setDepth(4)
      .setName('trigger-feedback-micro-missile');
    this.time.delayedCall(missile.travelMs, () => {
      trail.destroy();
      if (target.kind === 'enemy') this.enemyManager?.applyDirectDamage(target.id, missile.damage);
      else this.activeBoss?.applyDirectDamage(target.id, missile.damage);
      this.drawEffectRing(
        target.position,
        12,
        GAME_TUNING.visual.triggerFeedback.missileColor,
        'trigger-feedback-micro-missile-impact',
      );
    });
  }

  private drawEffectRing(position: Vector, radius: number, color: number, name: string): void {
    const ring = this.add.graphics()
      .lineStyle(3, color, 0.9)
      .strokeCircle(position.x, position.y, radius)
      .setDepth(4)
      .setName(name);
    this.time.delayedCall(
      GAME_TUNING.visual.triggerFeedback.durationMs,
      () => ring.destroy(),
    );
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
      activePopulation: enemies.activePopulation,
      topmostEnemyY: enemies.topmostEnemyY,
    });
    if (formation) this.enemyManager.spawnFormation(formation);
    if (transition) {
      this.activeBossKind = bossKindAfterTransition(
        this.activeBossKind ?? null,
        transition,
      );
      if (transition.type === 'bossWarningStarted') this.showBossWarning();
      else this.startBoss(transition.bossKind);
    }
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

  private startBoss(kind: BossKind): void {
    if (!this.player || !this.orbManager || !this.temporaryOrbManager || !this.enemyManager) return;
    this.clearBossWarning();
    this.activeBoss?.destroy();
    const commonOptions = {
      player: this.player,
      orbManager: this.orbManager,
      temporaryOrbManager: this.temporaryOrbManager,
      getEnemyBulletCount: () => this.enemyManager?.getBulletCount() ?? 0,
      getGameplayElapsedMs: () => this.gameplayElapsedMs,
      onPlayerHit: (damage: number) => this.damagePlayer(damage),
      onDirectHit: (event: BossDirectHitEvent) => this.handleBossDirectHit(event),
      onDefeated: () => this.handleBossDefeatSignal(),
    };
    this.activeBoss = createBossForKind<BossEncounter>(kind, {
      sentinel: () => new BossManager(this, {
        ...commonOptions,
        getEnemies: () => this.enemyManager?.getSnapshot().enemies ?? [],
      }),
      hive: () => new HiveBossManager(this, commonOptions),
    });
  }

  private handleBossDefeatSignal(): void {
    if (this.defeated || this.bossDefeatPending) return;
    this.enemyManager?.clearHostileActions();
    this.activeBoss?.clearHostileActions();
    this.combatEffects.clear();
    this.bossDefeatPending = true;
  }

  private finalizeBossDefeat(): void {
    if (!this.bossDefeatPending || this.defeated) return;
    this.bossDefeatPending = false;
    const defeatedBossKind = this.activeBossKind;
    if (!defeatedBossKind) throw new Error('boss defeat has no active boss kind');
    this.bossRewardTier = rewardTierForBoss(defeatedBossKind);
    this.encounterDirector?.markBossDefeated();
    const owned = new Set(this.bossBuild?.snapshot() ?? []);
    this.bossRewardChoices = selectBossRewardOptions(
      this.bossRewardTier,
      owned,
      this.build?.getRanks() ?? createEmptyAbilityRanks(),
      BOSS_REWARD_SEED,
    );
    this.applyLifecycle('rewardOpened');
    this.pause.add('bossReward');
    this.syncPauseState();
    this.bossRewardOverlay?.show(
      this.bossRewardTier,
      this.bossRewardChoices,
      (id) => this.chooseBossReward(id),
    );
  }

  private chooseBossReward(id: BossRewardId): boolean {
    if (
      this.defeated
      || !this.bossRewardOverlay?.isVisible()
      || !this.bossBuild
      || !this.encounterDirector
    ) return false;
    if (!this.bossRewardTier) return false;
    if (!this.bossRewardChoices.includes(id) || this.bossBuild.owns(id)) return false;
    this.bossBuild.acquire(id);
    if (rewardAddsPermanentOrb(id)) {
      this.orbLoadoutOverlay?.showAdditional((type) => {
        if (!this.orbManager?.addOrb(type)) return false;
        return this.completeBossReward();
      });
      return true;
    }
    return this.completeBossReward();
  }

  private completeBossReward(): boolean {
    if (!this.encounterDirector) return false;
    const advance = this.encounterDirector.resumeAfterBossReward();
    if (advance.type === 'stageStarted') {
      const encounter = this.encounterDirector.getSnapshot();
      if (
        encounter.stageId !== advance.stageId
        || encounter.stageNumber !== advance.stageNumber
      ) {
        throw new Error(`boss reward did not start stage ${advance.stageId}`);
      }
    }
    this.applyLifecycle('rewardCompleted');
    this.pause.remove('bossReward');
    if (advance.type === 'runCompleted') {
      this.enemyManager?.clearEnemies();
      this.pause.add('runComplete');
      this.syncPauseState();
      this.runCompleteOverlay?.show(() => {
        this.handleShutdown();
        this.scene.restart();
      });
      return true;
    }
    this.syncPauseState();
    return true;
  }

  private clearTemporaryOrbs(): void {
    const manager = this.temporaryOrbManager;
    if (!manager || manager.getSnapshot().length === 0) return;
    manager.getGroup().clear(true, true);
    manager.update(this.gameplayElapsedMs);
  }

  private applyLifecycle(
    reason: Parameters<typeof finalizeCombatLifecycle>[0],
  ): void {
    this.corrosionFields.clear();
    const next = finalizeCombatLifecycle(reason, {
      activeBoss: this.activeBoss,
      activeBossKind: this.activeBossKind,
      bossRewardTier: this.bossRewardTier,
      bossRewardChoices: this.bossRewardChoices,
      bossDefeatPending: this.bossDefeatPending,
      bossBuild: this.bossBuild ?? new BossBuild(),
    }, {
      scheduler: this.combatEffects,
      clearEnemyHostileActions: () => this.enemyManager?.clearHostileActions(),
      clearWarning: () => this.clearBossWarning(),
      clearTemporaryOrbs: () => this.clearTemporaryOrbs(),
      hideRewardOverlay: () => this.bossRewardOverlay?.hide(),
    });
    this.activeBoss = next.activeBoss;
    this.activeBossKind = next.activeBossKind;
    this.bossRewardTier = next.bossRewardTier;
    this.bossRewardChoices = [...next.bossRewardChoices];
    this.bossDefeatPending = next.bossDefeatPending;
    this.bossBuild = next.bossBuild;
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
    this.applyLifecycle('defeat');
    this.levelUpOverlay?.hide();
    this.pause.remove('levelUp');
    this.pause.remove('bossReward');
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
      .once('pointerup', () => {
        this.handleShutdown();
        this.scene.restart();
      });
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
      !this.pause.has('levelUp')
        && !this.pause.has('loadout')
        && !this.pause.has('bossReward')
        && !this.pause.has('runComplete'),
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
    this.applyLifecycle('shutdown');
    this.enemyManager?.destroy();
    this.temporaryOrbManager?.destroy();
    this.orbManager?.destroy();
    this.playerInput?.destroy();
    this.levelUpOverlay?.destroy();
    this.orbLoadoutOverlay?.destroy();
    this.bossRewardOverlay?.destroy();
    this.runCompleteOverlay?.destroy();
    this.bossDefeatPending = false;
    this.enemyManager = undefined;
    this.encounterDirector = undefined;
    this.orbManager = undefined;
    this.temporaryOrbManager = undefined;
    this.playerInput = undefined;
    this.levelUpOverlay = undefined;
    this.orbLoadoutOverlay = undefined;
    this.bossRewardOverlay = undefined;
    this.runCompleteOverlay = undefined;
    this.progression = undefined;
    this.build = undefined;
    this.bossBuild = undefined;
    this.combatProcs = undefined;
    this.debugAdvanceEncounter = undefined;
    this.debugRecordEnemyKill = undefined;
    this.debugDamageBossPart = undefined;
    this.debugSetBossPosition = undefined;
    this.debugAdvanceHiveCycle = undefined;
    this.debugPlaceTemporaryOrb = undefined;
  };

  private createTextures(): void {
    const createBaseTextures = !this.textures.exists('player');
    const createBossTextures = !this.textures.exists('boss-body');
    const projectileTextures = renderableCombatTextureDescriptors();
    const createProjectileTextures = Object.keys(projectileTextures)
      .some((key) => !this.textures.exists(key));
    if (!createBaseTextures && !createBossTextures && !createProjectileTextures) return;
    const graphics = this.add.graphics();
    if (createBaseTextures) {
      graphics.fillStyle(0x4ddcff).fillCircle(18, 18, 18);
      graphics.fillStyle(0x061225).fillCircle(12, 15, 2).fillCircle(24, 15, 2);
      graphics.lineStyle(2, 0x061225).beginPath().moveTo(12, 24).lineTo(18, 27).lineTo(24, 24).strokePath();
      graphics.generateTexture('player', 36, 36);
      graphics.clear().fillStyle(0xff5c70).fillRoundedRect(0, 0, 36, 28, 5)
        .generateTexture('enemy-basic', 36, 28);
      graphics.clear().fillStyle(0x9b6dff).fillRoundedRect(0, 0, 40, 32, 5);
      graphics.lineStyle(3, 0xd8c8ff).strokeRoundedRect(2, 2, 36, 28, 4)
        .generateTexture('enemy-armored', 40, 32);
      graphics.clear().fillStyle(0xffa23a).fillRoundedRect(0, 0, 38, 30, 5);
      graphics.fillStyle(0x4c2400).fillCircle(19, 15, 5).generateTexture('enemy-shooter', 38, 30);
    }
    for (const [key, descriptor] of Object.entries(projectileTextures)) {
      if (!this.textures.exists(key)) this.createProjectileTexture(graphics, key, descriptor);
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
      graphics.clear().lineStyle(2, 0xffe45c, 0.9).strokeCircle(16, 16, 14)
        .generateTexture('boss-aim-marker', 32, 32);
      graphics.clear().lineStyle(3, 0xff704d, 0.9).strokeRoundedRect(1, 1, 30, 10, 4)
        .generateTexture('boss-drop-marker', 32, 12);
    }
    graphics.destroy();
  }

  private createProjectileTexture(
    graphics: Phaser.GameObjects.Graphics,
    key: string,
    descriptor: CombatTextureDescriptor,
  ): void {
    const centerX = descriptor.width / 2;
    const centerY = descriptor.height / 2;
    const radius = Math.max(1, Math.min(centerX, centerY) - 1);
    const strokeWidth = Math.max(1, Math.floor(radius / 3));

    graphics.clear();
    switch (descriptor.shape) {
      case 'outlinedCircle':
        graphics.fillStyle(descriptor.fill).fillCircle(centerX, centerY, radius);
        graphics.lineStyle(strokeWidth, descriptor.accent).strokeCircle(centerX, centerY, radius);
        break;
      case 'centeredCircle':
        graphics.fillStyle(descriptor.fill).fillCircle(centerX, centerY, radius);
        graphics.fillStyle(descriptor.accent).fillCircle(centerX, centerY, radius / 2);
        break;
      case 'outlinedRoundedRect': {
        const inset = strokeWidth / 2;
        const cornerRadius = Math.max(1, Math.min(descriptor.width, descriptor.height) / 3);
        graphics.fillStyle(descriptor.fill).fillRoundedRect(
          0,
          0,
          descriptor.width,
          descriptor.height,
          cornerRadius,
        );
        graphics.lineStyle(strokeWidth, descriptor.accent).strokeRoundedRect(
          inset,
          inset,
          descriptor.width - strokeWidth,
          descriptor.height - strokeWidth,
          cornerRadius - inset,
        );
        break;
      }
      case 'flash': {
        const armLength = radius;
        const armWidth = Math.max(1, radius / 3);
        graphics.fillStyle(descriptor.fill)
          .fillRect(centerX - armWidth / 2, centerY - armLength, armWidth, armLength * 2)
          .fillRect(centerX - armLength, centerY - armWidth / 2, armLength * 2, armWidth);
        graphics.lineStyle(strokeWidth, descriptor.accent)
          .beginPath()
          .moveTo(centerX - armLength, centerY - armLength)
          .lineTo(centerX + armLength, centerY + armLength)
          .moveTo(centerX + armLength, centerY - armLength)
          .lineTo(centerX - armLength, centerY + armLength)
          .strokePath();
        break;
      }
      case 'crackedRoundedRect':
        graphics.fillStyle(descriptor.fill)
          .fillRoundedRect(0, 0, descriptor.width, descriptor.height, 5);
        graphics.lineStyle(3, descriptor.accent)
          .beginPath()
          .moveTo(centerX - 2, 1)
          .lineTo(centerX + 3, centerY - 3)
          .lineTo(centerX - 3, centerY + 3)
          .lineTo(centerX + 2, descriptor.height - 1)
          .strokePath();
        break;
      case 'fragmentLeft':
      case 'fragmentRight': {
        const isLeft = descriptor.shape === 'fragmentLeft';
        const innerX = isLeft ? descriptor.width : 0;
        const outerX = isLeft ? 0 : descriptor.width;
        graphics.fillStyle(descriptor.fill)
          .beginPath()
          .moveTo(outerX, 1)
          .lineTo(innerX, 1)
          .lineTo(innerX + (isLeft ? -5 : 5), centerY)
          .lineTo(innerX, descriptor.height - 1)
          .lineTo(outerX, descriptor.height - 1)
          .closePath()
          .fillPath();
        graphics.lineStyle(2, descriptor.accent)
          .beginPath()
          .moveTo(innerX, 1)
          .lineTo(innerX + (isLeft ? -5 : 5), centerY)
          .lineTo(innerX, descriptor.height - 1)
          .strokePath();
        break;
      }
      case 'hiveCore':
        graphics.fillStyle(descriptor.fill)
          .fillCircle(centerX, centerY, radius);
        graphics.lineStyle(4, descriptor.accent)
          .strokeCircle(centerX, centerY, radius - 2)
          .strokeCircle(centerX, centerY, radius * 0.45);
        break;
      case 'hiveShooter':
        graphics.fillStyle(descriptor.fill)
          .fillRoundedRect(0, 0, descriptor.width, descriptor.height, 7);
        graphics.lineStyle(2, descriptor.accent)
          .strokeRoundedRect(1, 1, descriptor.width - 2, descriptor.height - 2, 6);
        graphics.fillStyle(descriptor.accent)
          .fillCircle(centerX, descriptor.height - 5, 4);
        break;
      case 'reflectorWall':
        graphics.fillStyle(descriptor.fill)
          .fillRoundedRect(0, 0, descriptor.width, descriptor.height, 4);
        graphics.lineStyle(3, descriptor.accent)
          .strokeRoundedRect(2, 1, descriptor.width - 4, descriptor.height - 2, 3);
        for (let y = 9; y < descriptor.height; y += 16) {
          graphics.lineStyle(2, descriptor.accent)
            .beginPath()
            .moveTo(3, y)
            .lineTo(descriptor.width - 3, y + 7)
            .strokePath();
        }
        break;
    }
    graphics.generateTexture(key, descriptor.width, descriptor.height);
  }
}
