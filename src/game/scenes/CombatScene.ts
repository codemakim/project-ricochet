import Phaser from 'phaser';
import { traceFirstBounce } from '../aim/trajectory';
import { BossManager, type BossManagerSnapshot } from '../bosses/BossManager';
import { bossEntryCleanup } from '../bosses/bossEntryRules';
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
import { CombatProcState } from '../combat/CombatProcState';
import {
  ClusterFieldState,
  MassCollapseState,
  NanoSeedState,
  PhotonTrailState,
  ReactorChargeState,
  clusterBombardmentProfile,
  nanoFusionProfile,
  photonFusionProfile,
  reactorOrbProfile,
  resonantSwarmProfile,
  type ClusterFieldSnapshot,
  type NanoSeedSnapshot,
  type PhotonTrailSnapshot,
} from '../combat/FusionCombatState';
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
  raiseMaximumHealth,
  type HealthState,
} from '../combat/health';
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  PLAYER_RADIUS,
  STARTING_ORB_COUNT,
  type ExperimentSettings,
} from '../constants';
import { EncounterDirector } from '../encounters/EncounterDirector';
import { createInitialFormation } from '../encounters/formationRules';
import {
  EnemyManager,
  type DirectHitEvent,
  type EnemyAreaDamageEffect,
  type EnemyKilledEvent,
  type EnemyManagerSnapshot,
} from '../enemies/EnemyManager';
import { PlayerInput } from '../input/PlayerInput';
import { clamp, type Vector } from '../math/vector';
import { OrbManager, ORB_RADIUS } from '../orbs/OrbManager';
import {
  ORB_CORE_IDS,
  coreDirectEffectProfile,
  explosionProfile,
  splitProfile,
  type OrbCoreId,
} from '../orbs/orbCoreRules';
import {
  FUSION_ORB_IDS,
  isBasicOrbCoreId,
  type FusionOrbId,
} from '../orbs/orbFusionRules';
import type { RecoverySource } from '../orbs/orbRules';
import {
  TemporaryOrbManager,
  type ResonantSwarmSource,
  type TemporaryOrbExpiredEvent,
} from '../orbs/TemporaryOrbManager';
import { movePlayer, resolveAim } from '../player/playerRules';
import { BuildState } from '../progression/BuildState';
import { BossBuild } from '../progression/BossBuild';
import { ProgressionManager, type ProgressionSnapshot } from '../progression/ProgressionManager';
import type { RunRewardChoice } from '../progression/runRewardRules';
import {
  createEmptyAbilityRanks,
  type AbilityId,
  type AbilityRanks,
} from '../progression/progressionRules';
import {
  selectBossRewardOptions,
  type BossRewardChoice,
  type BossRewardId,
  type BossRewardTier,
} from '../progression/bossRewardRules';
import { BossRewardOverlay } from '../ui/BossRewardOverlay';
import { LevelUpOverlay } from '../ui/LevelUpOverlay';
import { OrbLoadoutOverlay } from '../ui/OrbLoadoutOverlay';
import { OrbFusionOverlay } from '../ui/OrbFusionOverlay';
import { OrbUpgradeOverlay } from '../ui/OrbUpgradeOverlay';
import { progressionHudState } from '../ui/progressionHud';
import { RunCompleteOverlay } from '../ui/RunCompleteOverlay';
import {
  createRunResult,
  type RunConfig,
  type RunResult,
} from '../run/runContract';
import {
  bossKindAfterTransition,
  createBossForKind,
  finalizeCombatLifecycle,
  inactiveBossSnapshot,
  pendingRunRewardKind,
  planDirectHitEffects,
  planFusionDirectHitEffects,
  planOrbCoreEffects,
  recordDiscovery,
  rewardTierForBoss,
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
export const RUN_ENDED_EVENT = 'ricochet:run-ended';

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
  orbUpgradeVisible: boolean;
  orbFusionVisible: boolean;
  boss: BossEncounterSnapshot & Partial<Pick<
    BossManagerSnapshot,
    'basicBullets' | 'aimedBullets' | 'fallingHazards'
  >>;
  bossRewardTier: BossRewardTier | null;
  bossRewards: BossRewardId[];
  bossRewardChoices: Array<BossRewardId | AbilityId>;
  bossRewardVisible: boolean;
  runCompleteVisible: boolean;
  temporaryOrbs: number;
  temporaryOrbSnapshots: ReturnType<TemporaryOrbManager['getSnapshot']>;
  corrosionFields: readonly CorrosionFieldSnapshot[];
  photonTrails: readonly PhotonTrailSnapshot[];
  nanoSeeds: readonly NanoSeedSnapshot[];
  clusterFields: readonly ClusterFieldSnapshot[];
  activePopulation: number;
  gameplayElapsedMs: number;
  discoveredCoreTypes: OrbCoreId[];
  discoveredFusionTypes: FusionOrbId[];
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
  declare debugDamageBossPart?: (
    partId: BossPartId | HivePartId | 'defenseModule',
    damage: number,
  ) => void;
  declare debugSetBossPosition?: (x: number) => void;
  declare debugAdvanceHiveCycle?: (deltaMs: number) => void;
  declare debugPlaceTemporaryOrb?: (id: number, position: Vector) => boolean;
  declare debugAddOrb?: (coreType: OrbCoreId) => boolean;
  declare debugFuseOrbs?: (
    firstId: number,
    secondId: number,
    fusionType: FusionOrbId,
  ) => boolean;
  declare debugUpgradeOrb?: (id: number) => boolean;
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
  private readonly corrosionFields = new CorrosionFieldState();
  private readonly corrosionVisuals = new Map<number, Phaser.GameObjects.Graphics>();
  private readonly photonTrails = new PhotonTrailState();
  private readonly photonTrailVisuals = new Map<number, Phaser.GameObjects.Graphics>();
  private readonly nanoSeeds = new NanoSeedState();
  private readonly nanoSeedVisuals = new Map<number, Phaser.GameObjects.Graphics>();
  private readonly massCollapse = new MassCollapseState();
  private readonly reactorCharges = new ReactorChargeState();
  private readonly clusterFields = new ClusterFieldState();
  private readonly clusterFieldVisuals = new Map<number, Phaser.GameObjects.Graphics>();
  private readonly clusterProjectiles = new Set<Phaser.GameObjects.Graphics>();
  private readonly clusterTimers = new Set<Phaser.Time.TimerEvent>();
  private combatProcs?: CombatProcState;
  private aimGuide!: Phaser.GameObjects.Graphics;
  private healthText!: Phaser.GameObjects.Text;
  private progressionText!: Phaser.GameObjects.Text;
  private progressionBarFill!: Phaser.GameObjects.Rectangle;
  private build?: BuildState;
  private progression?: ProgressionManager;
  private levelUpOverlay?: LevelUpOverlay;
  private orbLoadoutOverlay?: OrbLoadoutOverlay;
  private orbUpgradeOverlay?: OrbUpgradeOverlay;
  private orbFusionOverlay?: OrbFusionOverlay;
  private bossBuild?: BossBuild;
  private bossRewardOverlay?: BossRewardOverlay;
  private runCompleteOverlay?: RunCompleteOverlay;
  private bossWarning?: Phaser.GameObjects.Text;
  private bossRewardChoices: BossRewardChoice[] = [];
  private bossDefeatPending = false;
  private health: HealthState = createHealth();
  private experiment: ExperimentSettings = parseExperimentSettings('');
  private aim: Vector = { x: 0, y: -1 };
  private invulnerableUntil = 0;
  private aimQueueActivated = false;
  private defeated = false;
  private pause = new CombatPauseController();
  private gameplayElapsedMs = 0;
  private nextRunRewardAtMs = 0;
  private runConfig?: RunConfig;
  private runResultEmitted = false;
  private defeatedBossIds: BossKind[] = [];
  private discoveredCoreTypes = new Set<OrbCoreId>(ORB_CORE_IDS);
  private discoveredFusionTypes = new Set<FusionOrbId>(FUSION_ORB_IDS);

  constructor() {
    super('combat');
  }

  setRunConfig(config: RunConfig): this {
    this.runConfig = {
      identity: { ...config.identity },
      loadout: [...config.loadout],
      unlockedCoreTypes: [...config.unlockedCoreTypes],
      discoveredCoreTypes: [...config.discoveredCoreTypes],
      discoveredFusionTypes: [...config.discoveredFusionTypes],
    };
    return this;
  }

  create(): void {
    const runSeed = this.runConfig?.identity.seed ?? formationRunSeed;
    if (!this.runConfig) formationRunSeed = (formationRunSeed + 1) >>> 0;
    this.health = createHealth();
    this.experiment = parseExperimentSettings(window.location.search);
    this.aim = { x: 0, y: -1 };
    this.invulnerableUntil = 0;
    this.aimQueueActivated = false;
    this.defeated = false;
    this.bossDefeatPending = false;
    this.activeBossKind = undefined;
    this.bossRewardTier = null;
    this.corrosionFields.clear();
    this.corrosionVisuals.clear();
    this.photonTrails.clear();
    this.photonTrailVisuals.clear();
    this.nanoSeeds.clear();
    this.nanoSeedVisuals.clear();
    this.massCollapse.clear();
    this.reactorCharges.clear();
    this.clusterFields.clear();
    this.clusterFieldVisuals.clear();
    this.clearClusterProjectiles();
    this.bossRewardChoices = [];
    this.pause = new CombatPauseController();
    this.gameplayElapsedMs = 0;
    this.nextRunRewardAtMs = 0;
    this.runResultEmitted = false;
    this.defeatedBossIds = [];
    this.discoveredCoreTypes = new Set(
      this.runConfig?.discoveredCoreTypes ?? ORB_CORE_IDS,
    );
    this.discoveredFusionTypes = new Set(
      this.runConfig?.discoveredFusionTypes ?? FUSION_ORB_IDS,
    );
    this.combatProcs = new CombatProcState(runSeed);
    const build = new BuildState();
    this.build = build;
    this.bossBuild = new BossBuild();
    this.progression = new ProgressionManager(
      PROGRESSION_SEED,
      build,
      () => {
        const orbs = this.orbManager?.getSnapshot() ?? [];
        return {
          orbs,
          coreTypes: orbs.map(({ coreType }) => coreType).filter(isBasicOrbCoreId),
        };
      },
    );
    this.levelUpOverlay = new LevelUpOverlay(this);
    this.orbLoadoutOverlay = new OrbLoadoutOverlay(this);
    this.orbUpgradeOverlay = new OrbUpgradeOverlay(this);
    this.orbFusionOverlay = new OrbFusionOverlay(this);
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
      getOrbRadius: () => build.orbRadius(),
      getRecoveryRadius: () => build.recoveryRadius(),
      getFlightSpeedMultiplier: (killActive, collisionActive) => (
        build.flightSpeedMultiplier(killActive, collisionActive)
      ),
      getTrackingRadiusBonus: (active) => build.trackingRadiusBonus(active),
      getTimedDurationMs: (baseMs) => build.durationMs(baseMs),
      getInertiaHitLimit: () => this.bossBuild?.inertiaHitLimit() ?? 1,
      getOrbLimit: () => GAME_TUNING.build.basicGrowth.maximumOrbs,
      onRecovery: (orbId, source) => {
        this.combatProcs?.resetOrbFlight(orbId);
        this.handleOrbRecovery(source);
      },
      onCoreWallBounce: (event) => this.handleCoreWallBounce(event),
      onConductionFlight: (event) => this.handleConductionFlight(event),
    });
    this.temporaryOrbManager = new TemporaryOrbManager(this, {
      getDirectDamageBonus: () => build.directDamageBonus(),
      getGameplayElapsedMs: () => this.gameplayElapsedMs,
      getDamageMultiplier: () => build.temporaryDamageMultiplier(),
      getLifetimeMs: () => build.temporaryLifetimeMs(GAME_TUNING.temporaryOrbs.lifetimeMs),
      onExpired: (event) => this.handleTemporaryOrbExpired(event),
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
      onEnemyKilled: (event) => this.handleEnemyKilled(event),
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
        this.openPendingRunReward();
      };
      this.debugChooseAbility = (id) => {
        const choice = this.progression?.getChoices().find((candidate) => (
          candidate.kind === 'ability' && candidate.id === id
        ));
        return choice ? this.chooseRunReward(choice) : false;
      };
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
      this.debugAddOrb = (coreType) => this.orbManager?.addOrb(coreType) ?? false;
      this.debugFuseOrbs = (firstId, secondId, fusionType) => (
        this.orbManager?.fuseOrbs(firstId, secondId, fusionType) ?? false
      );
      this.debugUpgradeOrb = (id) => this.orbManager?.upgradeOrb(id) ?? false;
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
    if (this.runConfig) {
      if (!this.orbManager.configureStartingCores(this.runConfig.loadout)) {
        throw new Error('run configuration contains an invalid core loadout');
      }
    } else {
      this.pause.add('loadout');
      this.syncPauseState();
      this.orbLoadoutOverlay.showStarting(ORB_CORE_IDS, (types) => {
        if (!this.orbManager?.configureStartingCores(types)) return false;
        this.pause.remove('loadout');
        this.syncPauseState();
        return true;
      });
    }
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
      this.hasPendingRunReward(),
    )) {
      this.finalizeBossDefeat();
      return;
    }
    if (this.pause.isPaused()) return;

    const gameplayDelta = this.pause.consumeGameplayDelta(delta);
    this.gameplayElapsedMs += gameplayDelta;
    const next = movePlayer(
      this.player,
      this.playerInput.movement,
      gameplayDelta,
      this.build?.playerSpeed(),
    );
    this.player.setPosition(next.x, next.y);
    this.aim = resolveAim(this.aim, this.playerInput.aimCandidate);
    if (!this.aimQueueActivated && this.playerInput.aimActivated) {
      this.aimQueueActivated = true;
      this.orbManager.activateAim();
    }
    this.drawAimGuide();
    this.orbManager.update(this.time.now, gameplayDelta, next, this.aim);
    this.temporaryOrbManager?.update(this.gameplayElapsedMs);
    this.drainFusionEffects();
    this.enemyManager.update();
    this.activeBoss?.update();
    this.drainCorrosionFields();
    this.advanceEncounter(gameplayDelta);
    this.openPendingRunReward();
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
        level: orb.level,
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
        footprint: enemy.footprint ? { ...enemy.footprint } : undefined,
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
        expectedOrbCount: STARTING_ORB_COUNT,
        stageElapsedMs: 0,
        bossScore: 0,
        warningElapsedMs: 0,
        pendingBossKind: null,
        bossesDefeated: 0,
      },
      progression: this.progression?.getSnapshot() ?? {
        level: 0,
        xp: 0,
        xpRequired: 8,
        pendingChoices: 0,
        choices: [],
      },
      buildRanks: this.build?.getRanks() ?? createEmptyAbilityRanks(),
      pauseReasons: PAUSE_REASONS.filter((reason) => this.pause.has(reason)),
      levelUpVisible: this.levelUpOverlay?.isVisible() ?? false,
      loadoutVisible: this.orbLoadoutOverlay?.isVisible() ?? false,
      orbUpgradeVisible: this.orbUpgradeOverlay?.isVisible() ?? false,
      orbFusionVisible: this.orbFusionOverlay?.isVisible() ?? false,
      boss: this.activeBoss?.getSnapshot() ?? {
        ...inactiveBossSnapshot(this.activeBossKind ?? null),
        basicBullets: 0,
        aimedBullets: 0,
        fallingHazards: 0,
      },
      bossRewardTier: this.bossRewardTier,
      bossRewards: this.bossBuild?.snapshot() ?? [],
      bossRewardChoices: this.bossRewardChoices.map(({ id }) => id),
      bossRewardVisible: this.bossRewardOverlay?.isVisible() ?? false,
      runCompleteVisible: this.runCompleteOverlay?.isVisible() ?? false,
      temporaryOrbs: this.temporaryOrbManager?.getSnapshot().length ?? 0,
      temporaryOrbSnapshots: this.temporaryOrbManager?.getSnapshot().map((orb) => ({
        ...orb,
        position: { ...orb.position },
        velocity: { ...orb.velocity },
      })) ?? [],
      corrosionFields: this.corrosionFields.getSnapshot(),
      photonTrails: this.photonTrails.getSnapshot(),
      nanoSeeds: this.nanoSeeds.getSnapshot(),
      clusterFields: this.clusterFields.getSnapshot(),
      activePopulation: enemySnapshot.activePopulation,
      gameplayElapsedMs: this.gameplayElapsedMs,
      discoveredCoreTypes: [...this.discoveredCoreTypes],
      discoveredFusionTypes: [...this.discoveredFusionTypes],
    };
  }

  private handleEnemyKilled(event: EnemyKilledEvent): void {
    if (this.defeated) return;
    this.encounterDirector?.recordEnemyKill(event.kind);
    this.progression?.gainEnemyKill(event.kind);
    const spread = GAME_TUNING.orbCores.corrosion.deathSpread;
    this.corrosionFields.spreadAttachedOnDeath(
      event.enemyId,
      event.position,
      this.gameplayElapsedMs,
      {
        radius: spread.radius,
        durationMs: spread.durationMs,
        damage: spread.damagePerTick,
      },
    );
    const nano = this.orbManager?.getSnapshot().find(({ coreType }) => (
      coreType === 'nano-proliferator'
    ));
    if (
      nano
      && this.nanoSeeds.spreadOnDeath(
        event.position,
        this.gameplayElapsedMs,
        nanoFusionProfile(nano.level),
      )
    ) this.syncNanoSeedVisuals();
    this.updateProgressionText();
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
      | 'coreLevel'
      | 'conductionTriggered'
      | 'explosionFailures'
      | 'killed'
      | 'speedRatio'
      | 'firstHitAfterProximity'
      | 'echoStacks'
      | 'precisionHit'
      | 'echoPath'
      | 'inheritedOutputScale'
      | 'fusionSource'
    >,
    excludedEnemyId: number,
    excludedBossTargetId?: BossTargetId,
  ): void {
    if (!this.build || !this.bossBuild) return;
    const linkedBonus = event.firstHitAfterProximity
      ? this.bossBuild.reloadSecondaryBonus(this.build.reloadOverchargeBonus())
      : 0;
    const inheritedOutputScale = event.source === 'temporary'
      ? event.inheritedOutputScale ?? 0
      : 1;
    const linkedDamage = (damage: number) => damage
      * (1 + linkedBonus)
      * (event.source === 'temporary' && inheritedOutputScale > 0
        ? inheritedOutputScale
        : 1);
    const explosion = this.build.explosion();
    const split = this.build.split();
    const permanent = event.source === 'permanent';
    const coreLevel = event.coreLevel ?? 1;
    let fusionProcTriggered = false;
    if (permanent && event.coreType === 'resonant-swarm') {
      const profile = resonantSwarmProfile(coreLevel);
      fusionProcTriggered = this.combatProcs?.tryProc(
        'resonant-swarm',
        event.sourceOrbId,
        this.gameplayElapsedMs,
        this.build.procChance(profile.chance),
        profile.cooldownMs,
      ) ?? false;
    } else if (permanent && event.coreType === 'nano-proliferator') {
      const profile = nanoFusionProfile(coreLevel);
      fusionProcTriggered = this.combatProcs?.tryProc(
        'nano-proliferator',
        event.sourceOrbId,
        this.gameplayElapsedMs,
        this.build.procChance(profile.chance),
        profile.cooldownMs,
      ) ?? false;
    } else if (permanent && event.coreType === 'cluster-bombardment') {
      const profile = clusterBombardmentProfile(coreLevel);
      fusionProcTriggered = this.combatProcs?.tryProc(
        'cluster-bombardment',
        event.sourceOrbId,
        this.gameplayElapsedMs,
        this.build.procChance(profile.chance),
        profile.cooldownMs,
      ) ?? false;
    }
    const fusionPlan = planFusionDirectHitEffects(event, fusionProcTriggered);
    const basicCoreType = event.coreType && isBasicOrbCoreId(event.coreType)
      ? event.coreType
      : undefined;
    const advancedCore = basicCoreType
      ? coreDirectEffectProfile(
        basicCoreType,
        coreLevel,
        event.precisionHit === true,
        event.echoStacks ?? 0,
      )
      : null;
    const mergedExplosion = permanent && basicCoreType
      ? explosionProfile(basicCoreType, coreLevel, explosion, event.explosionFailures ?? 0)
      : explosion ? { ...explosion, maximumFailures: 0 } : null;
    const mergedSplit = permanent && basicCoreType
      ? splitProfile(basicCoreType, coreLevel, split)
      : split ? {
        ...split,
        extraBounces: 0,
        lifetimeMs: GAME_TUNING.temporaryOrbs.lifetimeMs,
        inheritedOutputScale: 0,
      } : null;
    const horizontalCutter = this.build.horizontalCutter();
    const verticalCutter = this.build.verticalCutter();
    const destructionReaction = this.build.destructionReaction();
    const corrosion = GAME_TUNING.orbCores.corrosion;
    const corrosionLevelIndex = Math.max(0, Math.min(4, coreLevel - 1));
    const corrosionTriggered = Boolean(
      permanent
      && event.coreType === 'corrosion'
      && this.combatProcs?.tryProc(
        'corrosion',
        event.sourceOrbId,
        this.gameplayElapsedMs,
        this.build.procChance(corrosion.chanceByLevel[corrosionLevelIndex]!),
        corrosion.cooldownMs,
      )
    );
    const procOrbId = permanent ? event.sourceOrbId : event.sourceOrbId + 1_000_000;
    const chanceFor = (chance: number) => (
      permanent
        ? chance
        : inheritedOutputScale > 0
          ? chance
          : this.bossBuild!.temporaryProcChance(chance)
    );
    const corePlan = planOrbCoreEffects(event, corrosionTriggered);
    const recursiveSplit = permanent ? null : this.bossBuild.recursiveSplit();
    const decision = {
      explosion: Boolean(mergedExplosion && chanceFor(mergedExplosion.chance) > 0 && this.combatProcs?.tryProc(
        'explosion',
        procOrbId,
        this.gameplayElapsedMs,
        chanceFor(mergedExplosion.chance),
        mergedExplosion.cooldownMs,
      )),
      split: Boolean(
        permanent
          ? mergedSplit && this.combatProcs?.trySplit(
            event.sourceOrbId,
            this.gameplayElapsedMs,
            mergedSplit.chance,
            mergedSplit.cooldownMs,
          )
          : recursiveSplit && this.combatProcs?.trySplit(
            procOrbId,
            this.gameplayElapsedMs,
            recursiveSplit.chance,
            GAME_TUNING.build.split.cooldownMs,
          ),
      ),
      horizontalCutter: Boolean(horizontalCutter && chanceFor(horizontalCutter.chance) > 0
        && this.combatProcs?.tryProc(
          'horizontal-cutter',
          procOrbId,
          this.gameplayElapsedMs,
          chanceFor(horizontalCutter.chance),
          horizontalCutter.cooldownMs,
        )),
      verticalCutter: Boolean(verticalCutter && chanceFor(verticalCutter.chance) > 0
        && this.combatProcs?.tryProc(
          'vertical-cutter',
          procOrbId,
          this.gameplayElapsedMs,
          chanceFor(verticalCutter.chance),
          verticalCutter.cooldownMs,
        )),
      destructionReaction: Boolean(
        event.killed
        && destructionReaction
        && chanceFor(destructionReaction.chance) > 0
        && this.combatProcs?.tryProc(
          'destruction-reaction',
          procOrbId,
          this.gameplayElapsedMs,
          chanceFor(destructionReaction.chance),
          destructionReaction.cooldownMs,
        ),
      ),
    };
    const plan = planDirectHitEffects(
      event,
      this.build,
      decision,
      {
        explosion: mergedExplosion ? {
          ...mergedExplosion,
          damage: this.build.secondaryDamage(mergedExplosion.damage),
          radius: this.build.circularRadius(mergedExplosion.radius),
        } : null,
        split: mergedSplit ? {
          ...mergedSplit,
          count: this.build.splitCount(mergedSplit.count),
          lifetimeMs: this.build.temporaryLifetimeMs(mergedSplit.lifetimeMs),
        } : null,
      },
    );
    this.applyFusionDirectHit(
      fusionPlan,
      event,
      excludedEnemyId,
      excludedBossTargetId,
    );
    if (event.source === 'temporary' && event.fusionSource) {
      this.applyResonantSwarmHit(
        event.sourceOrbId,
        event.position,
        event.fusionSource,
        excludedEnemyId,
        excludedBossTargetId,
      );
    }
    if (permanent && event.coreType === 'explosion') {
      this.orbManager?.recordExplosionOutcome(event.sourceOrbId, decision.explosion);
    }
    if (plan.spawnChildren) {
      this.temporaryOrbManager?.spawnChildren(
        event.sourceOrbId,
        event.position,
        event.direction,
        recursiveSplit!.childCount,
      );
    }
    if (corePlan.spawnCorrosion) {
      this.corrosionFields.spawn(
        event.sourceOrbId,
        event.position,
        this.gameplayElapsedMs,
        {
          durationMs: this.build.durationMs(corrosion.durationMsByLevel[corrosionLevelIndex]!),
          radius: this.build.circularRadius(corrosion.radiusByLevel[corrosionLevelIndex]!),
          damage: this.build.secondaryDamage(corrosion.damagePerTick),
          ...(coreLevel >= corrosion.attachedFromLevel
            && event.precisionHit
            && excludedBossTargetId === undefined
            ? { attachedEnemyId: excludedEnemyId }
            : {}),
          spreadsOnDeath: coreLevel >= corrosion.deathSpread.fromLevel,
          vulnerabilityEnabled: coreLevel >= corrosion.vulnerability.fromLevel,
        },
      );
      this.syncCorrosionVisuals();
    }
    if (corePlan.dischargeConduction) {
      const chain = advancedCore?.chain;
      const radius = this.build.circularRadius(chain?.radius ?? 0);
      const targetCount = this.build.conductionTargetCount(chain?.targets ?? 0)
        + this.bossBuild.conductionTargetBonus();
      const damage = this.build.secondaryDamage(
        this.bossBuild.conductionDamage(
          (chain?.damage ?? 0) + (chain?.overchargeDamage ?? 0),
        ),
      ) * (1 + linkedBonus);
      let targetPositions: Vector[] = [];
      if (excludedBossTargetId === undefined) {
        targetPositions = this.enemyManager?.nearestSecondaryTargets(
          event.position,
          excludedEnemyId,
          radius,
          targetCount,
        ).map(({ position }) => position) ?? [];
        this.enemyManager?.applyNearestSecondaryDamage(
          event.position,
          excludedEnemyId,
          radius,
          targetCount,
          damage,
        );
      } else {
        const targetIds = this.activeBoss?.applyAreaDamage(
          event.position,
          radius,
          damage,
          excludedBossTargetId,
        ) ?? [];
        targetPositions = targetIds
          .map((targetId) => this.activeBoss?.getTargetPosition(targetId))
          .filter((position): position is Vector => position !== null && position !== undefined);
      }
      this.drawConductionFeedback(event.position, targetPositions);
    }
    if (advancedCore?.shockwave) {
      const rupture = event.coreType === 'echo'
        ? this.bossBuild.resonanceRupture(
          GAME_TUNING.orbCores.echo.maxStacksByLevel[coreLevel - 1]!,
          event.echoStacks ?? 0,
        )
        : null;
      const radius = this.build.circularRadius(Math.max(
        advancedCore.shockwave.radius,
        rupture?.radius ?? 0,
      ));
      const damage = linkedDamage(this.build.secondaryDamage(
        advancedCore.shockwave.damage + (rupture?.damage ?? 0),
      ));
      this.applyAreaEffects(event.position, [{ radius, damage }], excludedEnemyId, excludedBossTargetId);
      this.drawEffectRing(
        event.position,
        radius,
        GAME_TUNING.visual.triggerFeedback.shockwaveColor,
        `core-feedback-${event.coreType}-shockwave`,
      );
    }
    if (advancedCore?.kineticExplosion) {
      const effect = advancedCore.kineticExplosion;
      const radius = this.build.circularRadius(effect.radius);
      const damage = linkedDamage(this.build.secondaryDamage(effect.damage));
      this.applyAreaEffects(event.position, [{ radius, damage }], excludedEnemyId, excludedBossTargetId);
      this.drawEffectRing(
        event.position,
        radius,
        GAME_TUNING.orbCores.inertia.accent,
        'core-feedback-inertia-explosion',
      );
    }
    if (advancedCore?.replayPath && event.echoPath && event.echoPath.length > 0) {
      this.applyEchoPathReplay(event.echoPath, excludedEnemyId, excludedBossTargetId);
    }
    if (decision.horizontalCutter) {
      this.applyCutter(
        'horizontal',
        event.position.y,
        { ...horizontalCutter!, damage: linkedDamage(horizontalCutter!.damage) },
        excludedEnemyId,
        excludedBossTargetId,
      );
      const crossDamage = linkedDamage(
        this.bossBuild.crossCutDamage(horizontalCutter!.damage),
      );
      if (crossDamage > 0) {
        this.applyCutter(
          'vertical',
          event.position.x,
          { ...horizontalCutter!, damage: crossDamage },
          excludedEnemyId,
          excludedBossTargetId,
        );
      }
    }
    if (decision.verticalCutter) {
      this.applyCutter(
        'vertical',
        event.position.x,
        { ...verticalCutter!, damage: linkedDamage(verticalCutter!.damage) },
        excludedEnemyId,
        excludedBossTargetId,
      );
      const crossDamage = linkedDamage(
        this.bossBuild.crossCutDamage(verticalCutter!.damage),
      );
      if (crossDamage > 0) {
        this.applyCutter(
          'horizontal',
          event.position.y,
          { ...verticalCutter!, damage: crossDamage },
          excludedEnemyId,
          excludedBossTargetId,
        );
      }
    }
    if (decision.destructionReaction) {
      const reaction = destructionReaction!;
      this.applyAreaEffects(
        event.position,
        [{ radius: reaction.radius, damage: linkedDamage(reaction.damage) }],
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
      const linkedAreas = plan.immediateAreas.map((effect) => ({
        ...effect,
        damage: linkedDamage(effect.damage),
      }));
      this.applyAreaEffects(
        event.position,
        linkedAreas,
        excludedEnemyId,
        excludedBossTargetId,
      );
      for (const effect of linkedAreas) {
        this.drawExplosion(event.position, effect.radius);
        const ignitionFraction = effect.kind === 'explosion'
          ? this.bossBuild.gasIgnitionFraction()
          : 0;
        if (ignitionFraction > 0) {
          const ignited = this.corrosionFields.igniteOverlapping(
            event.position,
            effect.radius,
            this.gameplayElapsedMs,
            ignitionFraction,
          );
          for (const field of ignited) {
            this.applyAreaEffects(field.position, [field]);
            this.drawExplosion(field.position, field.radius);
          }
          this.syncCorrosionVisuals();
        }
      }
    }
    if (plan.splitCount > 0) {
      this.temporaryOrbManager?.spawn(
        event.position,
        event.direction,
        plan.splitCount,
        {
          lifetimeMs: mergedSplit?.lifetimeMs,
          extraBounces: mergedSplit?.extraBounces,
          inheritedOutputScale: mergedSplit?.inheritedOutputScale,
        },
      );
      this.drawEffectRing(
        event.position,
        18,
        GAME_TUNING.orbCores.split.accent,
        'core-feedback-split',
      );
    }
    const missile = this.build.microMissile();
    if (
      permanent
      && missile
      && this.combatProcs?.recordMicroMissileHit(missile.hitsRequired)
    ) {
      this.launchMicroMissile(
        event.position,
        excludedEnemyId,
        excludedBossTargetId,
        { ...missile, damage: linkedDamage(missile.damage) },
      );
    }
    const highSpeedImpact = this.build.highSpeedImpact();
    if (
      permanent
      && highSpeedImpact
      && (event.speedRatio ?? 0) >= highSpeedImpact.speedRatio
      && this.combatProcs?.recordHighSpeedHit(highSpeedImpact.hitsRequired)
    ) {
      this.applyAreaEffects(
        event.position,
        [{ radius: highSpeedImpact.radius, damage: linkedDamage(highSpeedImpact.damage) }],
        excludedEnemyId,
        excludedBossTargetId,
      );
      this.drawEffectRing(
        event.position,
        highSpeedImpact.radius,
        GAME_TUNING.visual.triggerFeedback.shockwaveColor,
        'trigger-feedback-high-speed-impact',
      );
    }
    if (
      permanent
      && event.killed
      && event.firstHitAfterProximity
      && this.bossBuild.completeCycleEnabled()
    ) {
      this.orbManager?.beginImmediateRecall(event.sourceOrbId);
    }
  }

  private handleCoreWallBounce(event: {
    orbId: number;
    coreType: string;
    coreLevel: number;
    position: Vector;
    segmentStart: Vector;
    echoStacks: number;
  }): void {
    if (event.coreType === 'reactor-orb') {
      const charge = this.reactorCharges.add(event.orbId, reactorOrbProfile(event.coreLevel));
      this.drawEffectRing(
        event.position,
        8 + charge * 2,
        GAME_TUNING.orbFusions.reactorOrb.accent,
        'fusion-feedback-reactor-charge',
      );
      return;
    }
    if (event.coreType === 'photon-orbit' && this.build) {
      const profile = photonFusionProfile(event.coreLevel);
      const intersections = this.photonTrails.add(
        event.orbId,
        event.segmentStart,
        event.position,
        this.gameplayElapsedMs,
        profile,
      );
      for (const position of intersections) {
        const blast = profile.intersectionBlast!;
        const radius = this.build.circularRadius(blast.radius);
        const damage = this.build.secondaryDamage(blast.damage);
        this.applyAreaEffects(position, [{ radius, damage }]);
        this.drawEffectRing(
          position,
          radius,
          GAME_TUNING.orbFusions.photonOrbit.accent,
          'fusion-feedback-photon-intersection',
        );
      }
      this.syncPhotonTrailVisuals();
      return;
    }
    if (
      event.coreType !== 'echo'
      || event.coreLevel < GAME_TUNING.orbCores.echo.cutter.fromLevel
      || !this.build
      || !this.combatProcs
    ) return;
    const cutter = GAME_TUNING.orbCores.echo.cutter;
    const axis = event.echoStacks % 2 === 0 ? 'horizontal' : 'vertical';
    if (!this.combatProcs.tryProc(
      axis === 'horizontal' ? 'horizontal-cutter' : 'vertical-cutter',
      event.orbId,
      this.gameplayElapsedMs,
      this.build.procChance(cutter.chance),
      cutter.cooldownMs,
    )) return;
    this.applyCutter(axis, axis === 'horizontal' ? event.position.y : event.position.x, {
      chance: cutter.chance,
      cooldownMs: cutter.cooldownMs,
      thickness: this.build.cutterThickness(cutter.thickness),
      damage: this.build.secondaryDamage(cutter.damage),
    }, -1);
  }

  private handleConductionFlight(event: {
    position: Vector;
    targets: number;
    radius: number;
    damage: number;
  }): void {
    if (!this.build || !this.bossBuild) return;
    const radius = this.build.circularRadius(event.radius);
    const targetCount = this.build.conductionTargetCount(event.targets)
      + this.bossBuild.conductionTargetBonus();
    const damage = this.build.secondaryDamage(
      this.bossBuild.conductionDamage(event.damage),
    );
    const targets = this.enemyManager?.nearestSecondaryTargets(
      event.position,
      -1,
      radius,
      targetCount,
    ) ?? [];
    this.enemyManager?.applyNearestSecondaryDamage(
      event.position,
      -1,
      radius,
      targetCount,
      damage,
    );
    this.activeBoss?.applyAreaDamage(event.position, radius, damage);
    this.drawConductionFeedback(event.position, targets.map(({ position }) => position));
  }

  private applyFusionDirectHit(
    plan: ReturnType<typeof planFusionDirectHitEffects>,
    event: {
      sourceOrbId: number;
      position: Vector;
      direction: Vector;
      coreLevel?: number;
      coreType?: string;
    },
    excludedEnemyId: number,
    excludedBossTargetId?: BossTargetId,
  ): void {
    if (!this.build) return;
    if (plan.massCollapse) {
      const targetKey = excludedBossTargetId === undefined
        ? `enemy:${excludedEnemyId}`
        : `boss:${excludedBossTargetId}`;
      const result = this.massCollapse.record(
        targetKey,
        plan.massCollapse.addedStacks,
        plan.massCollapse,
      );
      if (result.collapsed) {
        const radius = this.build.circularRadius(plan.massCollapse.radius);
        const damage = this.build.secondaryDamage(plan.massCollapse.damage);
        this.applyAreaEffects(event.position, [
          { radius: radius * 0.45, damage },
          { radius, damage: damage * plan.massCollapse.secondaryScale },
        ]);
        this.drawCollapseFeedback(event.position, radius);
      }
    }
    if (event.coreType === 'reactor-orb' && event.coreLevel !== undefined) {
      const charges = this.reactorCharges.consume(event.sourceOrbId);
      if (charges > 0) {
        const profile = reactorOrbProfile(event.coreLevel);
        const radius = this.build.circularRadius(
          profile.baseRadius + charges * profile.radiusPerCharge,
        );
        const damage = this.build.secondaryDamage(charges * profile.damagePerCharge);
        this.applyAreaEffects(
          event.position,
          [
            { radius, damage },
            ...(profile.outerWave && charges === profile.maximumCharges ? [{
              radius: radius * profile.outerWave.radiusScale,
              damage: damage * profile.outerWave.damageScale,
            }] : []),
          ],
          excludedEnemyId,
          excludedBossTargetId,
        );
        this.drawEffectRing(
          event.position,
          radius,
          GAME_TUNING.orbFusions.reactorOrb.accent,
          'fusion-feedback-reactor-blast',
        );
      }
    }
    if (plan.photonBeam) {
      const beam = plan.photonBeam;
      const end = {
        x: event.position.x + event.direction.x * beam.length,
        y: event.position.y + event.direction.y * beam.length,
      };
      const thickness = this.build.cutterThickness(beam.thickness);
      const damage = this.build.secondaryDamage(beam.damage);
      this.enemyManager?.applySegmentDamage(
        event.position,
        end,
        thickness,
        damage,
        excludedEnemyId,
      );
      this.activeBoss?.applySegmentDamage(
        event.position,
        end,
        thickness,
        damage,
        excludedBossTargetId,
      );
      const line = this.add.graphics()
        .lineStyle(thickness, GAME_TUNING.orbFusions.photonOrbit.accent, 0.85)
        .lineBetween(event.position.x, event.position.y, end.x, end.y)
        .setDepth(4)
        .setName('fusion-feedback-photon-beam');
      this.time.delayedCall(GAME_TUNING.visual.triggerFeedback.durationMs, () => line.destroy());
    }
    if (plan.resonantSwarm) {
      this.temporaryOrbManager?.spawn(
        event.position,
        event.direction,
        plan.resonantSwarm.count,
        {
          lifetimeMs: plan.resonantSwarm.lifetimeMs,
          fusionSource: {
            fusionType: 'resonant-swarm',
            sourceOrbId: event.sourceOrbId,
            level: event.coreLevel!,
          },
        },
      );
      this.drawEffectRing(
        event.position,
        20,
        GAME_TUNING.orbFusions.resonantSwarm.accent,
        'fusion-feedback-resonant-spawn',
      );
    }
    if (plan.nanoSeeds) {
      this.nanoSeeds.spawn(
        event.sourceOrbId,
        event.position,
        event.direction,
        this.gameplayElapsedMs,
        plan.nanoSeeds,
      );
      this.syncNanoSeedVisuals();
      this.drawEffectRing(
        event.position,
        plan.nanoSeeds.radius,
        GAME_TUNING.orbFusions.nanoProliferator.accent,
        'fusion-feedback-nano-spawn',
      );
    }
    if (plan.clusterBombardment) {
      this.launchClusterBombardment(event.position, plan.clusterBombardment);
    }
  }

  private applyResonantSwarmHit(
    temporaryOrbId: number,
    position: Vector,
    source: ResonantSwarmSource,
    excludedEnemyId: number,
    excludedBossTargetId?: BossTargetId,
  ): void {
    if (!this.build) return;
    const profile = resonantSwarmProfile(source.level);
    const siblings = Math.min(
      profile.maximumSiblingBonus,
      this.temporaryOrbManager?.nearbyFusionCount(
        temporaryOrbId,
        profile.siblingRadius,
      ) ?? 0,
    );
    const radius = this.build.circularRadius(profile.radius);
    const targets = this.build.conductionTargetCount(profile.targets);
    const damage = this.build.secondaryDamage(profile.damage)
      * (1 + siblings * profile.siblingDamageBonus);
    const enemyTargets = this.enemyManager?.nearestSecondaryTargets(
      position,
      excludedEnemyId,
      radius,
      targets,
    ) ?? [];
    this.enemyManager?.applyNearestSecondaryDamage(
      position,
      excludedEnemyId,
      radius,
      targets,
      damage,
    );
    const bossTargetIds = this.activeBoss?.applyAreaDamage(
      position,
      radius,
      damage,
      excludedBossTargetId,
    ) ?? [];
    const bossPositions = bossTargetIds
      .map((targetId) => this.activeBoss?.getTargetPosition(targetId))
      .filter((target): target is Vector => target !== null && target !== undefined);
    this.drawConductionFeedback(
      position,
      [...enemyTargets.map(({ position: target }) => target), ...bossPositions],
    );
  }

  private launchClusterBombardment(
    origin: Vector,
    profile: ReturnType<typeof clusterBombardmentProfile>,
  ): void {
    const available = Math.max(
      0,
      profile.maximumActiveProjectiles - this.clusterProjectiles.size,
    );
    for (const degrees of profile.angles.slice(0, available)) {
      const radians = degrees * Math.PI / 180;
      const landing = {
        x: clamp(origin.x + Math.cos(radians) * profile.distance, profile.radius, GAME_WIDTH - profile.radius),
        y: clamp(origin.y + Math.sin(radians) * profile.distance, profile.radius, GAME_HEIGHT - profile.radius),
      };
      const projectile = this.add.graphics()
        .fillStyle(GAME_TUNING.orbFusions.clusterBombardment.fill, 0.95)
        .fillCircle(origin.x, origin.y, 4)
        .setDepth(5)
        .setName('fusion-feedback-cluster-projectile');
      this.clusterProjectiles.add(projectile);
      this.tweens.add({
        targets: projectile,
        x: landing.x - origin.x,
        y: landing.y - origin.y,
        duration: profile.travelMs,
        ease: 'Quad.easeOut',
      });
      let timer!: Phaser.Time.TimerEvent;
      timer = this.time.delayedCall(profile.travelMs, () => {
        this.clusterTimers.delete(timer);
        this.clusterProjectiles.delete(projectile);
        projectile.destroy();
        const radius = this.build?.circularRadius(profile.radius) ?? profile.radius;
        const damage = this.build?.secondaryDamage(profile.damage) ?? profile.damage;
        this.applyAreaEffects(landing, [{ radius, damage }]);
        this.drawEffectRing(
          landing,
          radius,
          GAME_TUNING.orbFusions.clusterBombardment.accent,
          'fusion-feedback-cluster-impact',
        );
        if (this.clusterFields.add(landing, this.gameplayElapsedMs, profile)) {
          this.syncClusterFieldVisuals();
        }
      });
      this.clusterTimers.add(timer);
    }
  }

  private drawCollapseFeedback(position: Vector, radius: number): void {
    const graphic = this.add.graphics()
      .lineStyle(4, GAME_TUNING.orbFusions.massCollapse.accent, 0.9)
      .strokeCircle(position.x, position.y, radius)
      .lineStyle(2, GAME_TUNING.orbFusions.massCollapse.fill, 0.9)
      .strokeCircle(position.x, position.y, radius * 0.45)
      .setDepth(5)
      .setName('fusion-feedback-mass-collapse');
    this.time.delayedCall(
      GAME_TUNING.visual.triggerFeedback.durationMs,
      () => graphic.destroy(),
    );
  }

  private handleTemporaryOrbExpired(event: TemporaryOrbExpiredEvent): void {
    if (!event.fusionSource || !this.build) return;
    const pulse = resonantSwarmProfile(event.fusionSource.level).finalPulse;
    const radius = this.build.circularRadius(pulse.radius);
    const damage = this.build.secondaryDamage(pulse.damage);
    this.applyAreaEffects(event.position, [{ radius, damage }]);
    this.drawEffectRing(
      event.position,
      radius,
      GAME_TUNING.orbFusions.resonantSwarm.accent,
      'fusion-feedback-resonant-final',
    );
  }

  private drainFusionEffects(): void {
    for (const trail of this.photonTrails.drainDue(this.gameplayElapsedMs)) {
      const damage = this.build?.secondaryDamage(trail.damage) ?? trail.damage;
      this.enemyManager?.applySegmentDamage(
        trail.start,
        trail.end,
        trail.thickness,
        damage,
      );
      this.activeBoss?.applySegmentDamage(
        trail.start,
        trail.end,
        trail.thickness,
        damage,
      );
    }
    for (const seed of this.nanoSeeds.drainDue(this.gameplayElapsedMs)) {
      const radius = this.build?.circularRadius(seed.radius) ?? seed.radius;
      const damage = this.build?.secondaryDamage(seed.damage) ?? seed.damage;
      this.applyAreaEffects(seed.position, [{ radius, damage }]);
      this.drawEffectRing(
        seed.position,
        radius * 0.75,
        GAME_TUNING.orbFusions.nanoProliferator.accent,
        'fusion-feedback-nano-tick',
      );
    }
    for (const field of this.clusterFields.drainDue(this.gameplayElapsedMs)) {
      const radius = this.build?.circularRadius(field.radius) ?? field.radius;
      const damage = this.build?.secondaryDamage(field.damage) ?? field.damage;
      this.applyAreaEffects(field.position, [{ radius, damage }]);
      this.drawEffectRing(
        field.position,
        radius * 0.75,
        GAME_TUNING.orbFusions.clusterBombardment.fill,
        'fusion-feedback-cluster-field-tick',
      );
    }
    this.syncPhotonTrailVisuals();
    this.syncNanoSeedVisuals();
    this.syncClusterFieldVisuals();
  }

  private syncPhotonTrailVisuals(): void {
    const trails = this.photonTrails.getSnapshot();
    const active = new Set(trails.map(({ trailId }) => trailId));
    for (const [trailId, visual] of this.photonTrailVisuals) {
      if (active.has(trailId)) continue;
      visual.destroy();
      this.photonTrailVisuals.delete(trailId);
    }
    for (const trail of trails) {
      if (this.photonTrailVisuals.has(trail.trailId)) continue;
      const visual = this.add.graphics()
        .lineStyle(trail.thickness, GAME_TUNING.orbFusions.photonOrbit.fill, 0.42)
        .lineBetween(trail.start.x, trail.start.y, trail.end.x, trail.end.y)
        .setDepth(3)
        .setName('fusion-feedback-photon-trail');
      this.photonTrailVisuals.set(trail.trailId, visual);
    }
  }

  private syncNanoSeedVisuals(): void {
    const seeds = this.nanoSeeds.getSnapshot();
    const active = new Set(seeds.map(({ seedId }) => seedId));
    for (const [seedId, visual] of this.nanoSeedVisuals) {
      if (active.has(seedId)) continue;
      visual.destroy();
      this.nanoSeedVisuals.delete(seedId);
    }
    for (const seed of seeds) {
      if (this.nanoSeedVisuals.has(seed.seedId)) continue;
      const visual = this.add.graphics()
        .fillStyle(GAME_TUNING.orbFusions.nanoProliferator.fill, 0.18)
        .fillCircle(seed.position.x, seed.position.y, seed.radius)
        .lineStyle(2, GAME_TUNING.orbFusions.nanoProliferator.accent, 0.5)
        .strokeCircle(seed.position.x, seed.position.y, seed.radius)
        .setDepth(3)
        .setName('fusion-feedback-nano-seed');
      this.nanoSeedVisuals.set(seed.seedId, visual);
    }
  }

  private syncClusterFieldVisuals(): void {
    const fields = this.clusterFields.getSnapshot();
    const active = new Set(fields.map(({ fieldId }) => fieldId));
    for (const [fieldId, visual] of this.clusterFieldVisuals) {
      if (active.has(fieldId)) continue;
      visual.destroy();
      this.clusterFieldVisuals.delete(fieldId);
    }
    for (const field of fields) {
      if (this.clusterFieldVisuals.has(field.fieldId)) continue;
      const visual = this.add.graphics()
        .fillStyle(GAME_TUNING.orbFusions.clusterBombardment.fill, 0.14)
        .fillCircle(field.position.x, field.position.y, field.radius)
        .lineStyle(2, GAME_TUNING.orbFusions.clusterBombardment.accent, 0.45)
        .strokeCircle(field.position.x, field.position.y, field.radius)
        .setDepth(3)
        .setName('fusion-feedback-cluster-field');
      this.clusterFieldVisuals.set(field.fieldId, visual);
    }
  }

  private clearClusterProjectiles(): void {
    for (const timer of this.clusterTimers) timer.remove(false);
    this.clusterTimers.clear();
    for (const projectile of this.clusterProjectiles) projectile.destroy();
    this.clusterProjectiles.clear();
  }

  private applyEchoPathReplay(
    points: readonly Vector[],
    excludedEnemyId: number,
    excludedBossTargetId?: BossTargetId,
  ): void {
    if (!this.build) return;
    const replay = GAME_TUNING.orbCores.echo.replay;
    const radius = this.build.cutterThickness(replay.thickness);
    const damage = this.build.secondaryDamage(replay.damage);
    for (const point of points) {
      this.applyAreaEffects(point, [{ radius, damage }], excludedEnemyId, excludedBossTargetId);
    }
    const line = this.add.graphics()
      .lineStyle(radius, GAME_TUNING.orbCores.echo.accent, 0.65)
      .setDepth(4)
      .setName('core-feedback-echo-path-replay');
    line.beginPath();
    line.moveTo(points[0]!.x, points[0]!.y);
    for (const point of points.slice(1)) line.lineTo(point.x, point.y);
    line.strokePath();
    this.time.delayedCall(GAME_TUNING.visual.triggerFeedback.durationMs, () => line.destroy());
  }

  private applyCutter(
    axis: 'horizontal' | 'vertical',
    coordinate: number,
    cutter: NonNullable<ReturnType<BuildState['horizontalCutter']>>,
    excludedEnemyId: number,
    excludedBossTargetId?: BossTargetId,
  ): void {
    const { thickness, damage } = cutter;
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

  private drainCorrosionFields(): void {
    for (const tick of this.corrosionFields.drainDue(
      this.gameplayElapsedMs,
      (enemyId) => this.enemyManager?.getEnemyPosition(enemyId) ?? null,
    )) {
      const targets = this.enemyManager?.nearestSecondaryTargets(
        tick.position,
        -1,
        tick.radius,
        Number.MAX_SAFE_INTEGER,
      ) ?? [];
      if (tick.vulnerabilityEnabled) {
        const vulnerability = GAME_TUNING.orbCores.corrosion.vulnerability;
        this.enemyManager?.applyVulnerability(
          targets.map(({ id }) => id),
          vulnerability.maximumStacks,
        );
      }
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
        .fillCircle(field.position.x, field.position.y, field.radius)
        .lineStyle(2, tuning.accent, feedback.corrosionLineAlpha)
        .strokeCircle(field.position.x, field.position.y, field.radius)
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

  private handleOrbRecovery(source: RecoverySource): void {
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
      .lineStyle(2, GAME_TUNING.orbCores.explosion.accent, 0.85)
      .strokeCircle(position.x, position.y, radius)
      .setDepth(4)
      .setName('core-feedback-explosion');
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
    const cleanup = bossEntryCleanup(
      kind,
      GAME_TUNING.encounter.bossEntry.cleanupMode,
    );
    const removed = cleanup.mode === 'all'
      ? this.enemyManager.clearEnemies()
      : this.enemyManager.clearCorridor(cleanup.corridor);
    for (const position of removed) {
      this.drawExplosion(position, GAME_TUNING.encounter.bossEntry.padding + 12);
    }
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
      siege: () => new BossManager(this, {
        ...commonOptions,
        kind: 'siege',
        getEnemies: () => this.enemyManager?.getSnapshot().enemies ?? [],
      }),
    });
  }

  private handleBossDefeatSignal(): void {
    if (this.defeated || this.bossDefeatPending) return;
    this.enemyManager?.clearHostileActions();
    this.activeBoss?.clearHostileActions();
    this.bossDefeatPending = true;
  }

  private finalizeBossDefeat(): void {
    if (!this.bossDefeatPending || this.defeated) return;
    this.bossDefeatPending = false;
    const defeatedBossKind = this.activeBossKind;
    if (!defeatedBossKind) throw new Error('boss defeat has no active boss kind');
    this.defeatedBossIds.push(defeatedBossKind);
    const advance = this.encounterDirector?.markBossDefeated();
    if (advance?.type === 'runCompleted') {
      this.applyLifecycle('rewardCompleted');
      this.finishRun();
      return;
    }
    this.bossRewardTier = rewardTierForBoss(defeatedBossKind);
    const owned = new Set(this.bossBuild?.snapshot() ?? []);
    this.bossRewardChoices = selectBossRewardOptions({
      ownedRewards: owned,
      ranks: this.build?.getRanks() ?? createEmptyAbilityRanks(),
      coreTypes: this.orbManager?.getSnapshot()
        .map(({ coreType }) => coreType)
        .filter(isBasicOrbCoreId) ?? [],
    },
      BOSS_REWARD_SEED,
    );
    this.applyLifecycle('rewardOpened');
    this.pause.add('bossReward');
    this.syncPauseState();
    this.bossRewardOverlay?.show(
      this.bossRewardChoices,
      (choice) => this.chooseBossReward(choice),
    );
  }

  private chooseBossReward(choice: BossRewardChoice): boolean {
    if (
      this.defeated
      || !this.bossRewardOverlay?.isVisible()
      || !this.bossBuild
      || !this.encounterDirector
    ) return false;
    if (!this.bossRewardTier) return false;
    if (!this.bossRewardChoices.some((candidate) =>
      candidate.kind === choice.kind && candidate.id === choice.id)) return false;
    if (choice.kind === 'ability-rank') this.build?.upgrade(choice.id);
    else {
      if (this.bossBuild.owns(choice.id)) return false;
      this.bossBuild.acquire(choice.id);
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
      this.finishRun();
      return true;
    }
    this.syncPauseState();
    return true;
  }

  private finishRun(): void {
    this.enemyManager?.clearEnemies();
    this.pause.add('runComplete');
    this.syncPauseState();
    if (this.emitRunResult(true)) return;
    this.runCompleteOverlay?.show(() => {
      this.handleShutdown();
      this.scene.restart();
    });
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
    this.photonTrails.clear();
    this.nanoSeeds.clear();
    for (const visual of this.photonTrailVisuals.values()) visual.destroy();
    for (const visual of this.nanoSeedVisuals.values()) visual.destroy();
    this.photonTrailVisuals.clear();
    this.nanoSeedVisuals.clear();
    const next = finalizeCombatLifecycle(reason, {
      activeBoss: this.activeBoss,
      activeBossKind: this.activeBossKind,
      bossRewardTier: this.bossRewardTier,
      bossRewardChoices: this.bossRewardChoices,
      bossDefeatPending: this.bossDefeatPending,
      bossBuild: this.bossBuild ?? new BossBuild(),
    }, {
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
    this.levelUpOverlay.show(
      snapshot.choices,
      this.build,
      this.orbManager?.getSnapshot() ?? [],
      (choice) => this.chooseRunReward(choice),
      [...this.discoveredCoreTypes],
      [...this.discoveredFusionTypes],
    );
  }

  private openPendingRunReward(): void {
    if (this.defeated || this.pause.isPaused() || !this.progression) return;
    const reward = pendingRunRewardKind(
      this.progression.getSnapshot().pendingChoices,
      this.gameplayElapsedMs >= this.nextRunRewardAtMs,
    );
    if (reward === 'levelUp') this.openNextLevelUp();
  }

  private hasPendingRunReward(): boolean {
    return (this.progression?.getSnapshot().pendingChoices ?? 0) > 0
      || (this.levelUpOverlay?.isVisible() ?? false)
      || (this.orbLoadoutOverlay?.isVisible() ?? false)
      || (this.orbUpgradeOverlay?.isVisible() ?? false)
      || (this.orbFusionOverlay?.isVisible() ?? false);
  }

  private chooseRunReward(choice: RunRewardChoice): boolean {
    if (
      this.defeated
      || !this.progression
      || !this.orbManager
      || !this.levelUpOverlay?.isVisible()
      || !this.progression.canChoose(choice)
    ) return false;

    if (choice.kind === 'ability') {
      if (!this.progression.consume(choice)) return false;
      this.refreshCombatModifiers();
      this.completeRunRewardChoice();
      return true;
    }
    if (choice.kind === 'orb-add') {
      if (!this.orbManager.addOrb(choice.coreType)) return false;
      if (!this.progression.consume(choice)) return false;
      this.discoveredCoreTypes = recordDiscovery(
        this.discoveredCoreTypes,
        choice.coreType,
      );
      this.completeRunRewardChoice();
      return true;
    }

    if (choice.kind === 'orb-fusion') {
      this.levelUpOverlay.hide();
      const reopen = () => this.openNextLevelUp();
      this.orbFusionOverlay?.show(
        choice.fusionType,
        this.orbManager.getSnapshot(),
        (firstId, secondId) => {
          if (
            !this.orbManager?.fuseOrbs(firstId, secondId, choice.fusionType)
            || !this.progression?.consume(choice)
          ) {
            reopen();
            return;
          }
          this.discoveredFusionTypes = recordDiscovery(
            this.discoveredFusionTypes,
            choice.fusionType,
          );
          this.completeRunRewardChoice();
        },
        reopen,
        this.discoveredFusionTypes.has(choice.fusionType),
      );
      return true;
    }

    this.levelUpOverlay.hide();
    const reopen = () => this.openNextLevelUp();
    this.orbUpgradeOverlay?.show(
      choice.coreType,
      this.orbManager.getSnapshot(),
      (orbId) => {
        if (
          !this.orbManager?.upgradeOrb(orbId, choice.coreType)
          || !this.progression?.consume(choice)
        ) {
          reopen();
          return;
        }
        this.completeRunRewardChoice();
      },
      reopen,
    );
    return true;
  }

  private completeRunRewardChoice(): void {
    if (!this.progression) return;
    this.updateProgressionText();
    this.levelUpOverlay?.hide();
    this.orbUpgradeOverlay?.hide();
    this.orbFusionOverlay?.hide();
    this.pause.remove('levelUp');
    this.nextRunRewardAtMs =
      this.gameplayElapsedMs + GAME_TUNING.rewardFlow.resumeGameplayMs;
    this.syncPauseState();
  }

  private refreshCombatModifiers(): void {
    this.orbManager?.refreshCombatModifiers();
    const maximum = this.build?.maximumHealth() ?? this.health.maximum;
    if (maximum > this.health.maximum) {
      this.health = raiseMaximumHealth(this.health, maximum);
      this.updateHealthText();
    }
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
    if (this.emitRunResult(false)) return;
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

  private emitRunResult(success: boolean): RunResult | null {
    if (!this.runConfig || this.runResultEmitted) return null;
    this.runResultEmitted = true;
    const result = createRunResult(
      this.runConfig,
      success,
      this.gameplayElapsedMs,
      this.defeatedBossIds,
      this.build?.getRanks() ?? createEmptyAbilityRanks(),
      [...this.discoveredCoreTypes],
      [...this.discoveredFusionTypes],
    );
    this.game.events.emit(RUN_ENDED_EVENT, result);
    return result;
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
    if (!this.sys.isActive()) return;
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
    this.massCollapse.clear();
    this.reactorCharges.clear();
    this.clusterFields.clear();
    this.clearClusterProjectiles();
    this.applyLifecycle('shutdown');
    this.enemyManager?.destroy();
    this.temporaryOrbManager?.destroy();
    this.orbManager?.destroy();
    this.playerInput?.destroy();
    this.levelUpOverlay?.destroy();
    this.orbLoadoutOverlay?.destroy();
    this.orbUpgradeOverlay?.destroy();
    this.orbFusionOverlay?.destroy();
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
    this.orbUpgradeOverlay = undefined;
    this.orbFusionOverlay = undefined;
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
    this.debugAddOrb = undefined;
    this.debugFuseOrbs = undefined;
    this.debugUpgradeOrb = undefined;
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
        if (descriptor.symbol) {
          graphics.lineStyle(1.5, descriptor.accent).beginPath();
          switch (descriptor.symbol) {
            case 'wave':
              graphics.moveTo(centerX - 5, centerY).lineTo(centerX - 2, centerY - 3)
                .lineTo(centerX + 1, centerY + 3).lineTo(centerX + 5, centerY);
              break;
            case 'drop':
              graphics.moveTo(centerX, centerY - 5).lineTo(centerX - 4, centerY + 2)
                .lineTo(centerX, centerY + 5).lineTo(centerX + 4, centerY + 2)
                .lineTo(centerX, centerY - 5);
              break;
            case 'bolt':
              graphics.moveTo(centerX + 1, centerY - 6).lineTo(centerX - 3, centerY)
                .lineTo(centerX + 1, centerY).lineTo(centerX - 1, centerY + 6)
                .lineTo(centerX + 4, centerY - 1).lineTo(centerX, centerY - 1);
              break;
            case 'arrow':
              graphics.moveTo(centerX - 5, centerY + 4).lineTo(centerX + 4, centerY - 5)
                .moveTo(centerX, centerY - 5).lineTo(centerX + 4, centerY - 5)
                .lineTo(centerX + 4, centerY - 1);
              break;
            case 'fork':
              graphics.moveTo(centerX, centerY + 5).lineTo(centerX, centerY)
                .lineTo(centerX - 4, centerY - 4).moveTo(centerX, centerY)
                .lineTo(centerX + 4, centerY - 4);
              break;
            case 'burst':
              graphics.moveTo(centerX - 5, centerY).lineTo(centerX + 5, centerY)
                .moveTo(centerX, centerY - 5).lineTo(centerX, centerY + 5)
                .moveTo(centerX - 4, centerY - 4).lineTo(centerX + 4, centerY + 4)
                .moveTo(centerX + 4, centerY - 4).lineTo(centerX - 4, centerY + 4);
              break;
            case 'beam':
              graphics.moveTo(centerX - 5, centerY + 3).lineTo(centerX + 5, centerY - 3)
                .moveTo(centerX - 4, centerY - 4).lineTo(centerX + 4, centerY + 4);
              break;
            case 'swarm':
              graphics.moveTo(centerX - 5, centerY).lineTo(centerX, centerY - 4)
                .lineTo(centerX + 5, centerY).lineTo(centerX, centerY + 4)
                .lineTo(centerX - 5, centerY);
              break;
            case 'seed':
              graphics.moveTo(centerX, centerY - 5).lineTo(centerX + 4, centerY)
                .lineTo(centerX, centerY + 5).lineTo(centerX - 4, centerY)
                .lineTo(centerX, centerY - 5)
                .moveTo(centerX - 3, centerY).lineTo(centerX + 3, centerY);
              break;
            case 'collapse':
              graphics.strokeCircle(centerX, centerY, 4)
                .moveTo(centerX - 6, centerY).lineTo(centerX - 2, centerY)
                .moveTo(centerX + 6, centerY).lineTo(centerX + 2, centerY);
              break;
            case 'reactor':
              graphics.strokeCircle(centerX, centerY, 4)
                .moveTo(centerX, centerY - 6).lineTo(centerX, centerY - 3)
                .moveTo(centerX, centerY + 6).lineTo(centerX, centerY + 3);
              break;
            case 'cluster':
              graphics.strokeCircle(centerX, centerY, 2)
                .moveTo(centerX - 5, centerY).lineTo(centerX - 3, centerY)
                .moveTo(centerX + 5, centerY).lineTo(centerX + 3, centerY)
                .moveTo(centerX, centerY - 5).lineTo(centerX, centerY - 3)
                .moveTo(centerX, centerY + 5).lineTo(centerX, centerY + 3);
              break;
            case 'mirror':
              graphics.strokeRect(centerX - 5, centerY - 5, 4, 10)
                .strokeRect(centerX + 1, centerY - 5, 4, 10);
              break;
            case 'melt':
              graphics.moveTo(centerX, centerY - 6).lineTo(centerX + 5, centerY + 2)
                .lineTo(centerX, centerY + 6).lineTo(centerX - 5, centerY + 2)
                .lineTo(centerX, centerY - 6);
              break;
            case 'blade':
              graphics.moveTo(centerX - 6, centerY + 5).lineTo(centerX + 6, centerY - 5)
                .moveTo(centerX + 1, centerY - 4).lineTo(centerX + 5, centerY)
                .lineTo(centerX + 6, centerY - 5);
              break;
          }
          graphics.strokePath();
        }
        if (descriptor.notches) {
          graphics.fillStyle(descriptor.accent);
          for (let notch = 0; notch < descriptor.notches; notch += 1) {
            const angle = Math.PI + notch * Math.PI / 4;
            graphics.fillCircle(
              centerX + Math.cos(angle) * (radius - 2),
              centerY + Math.sin(angle) * (radius - 2),
              0.8,
            );
          }
        }
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
