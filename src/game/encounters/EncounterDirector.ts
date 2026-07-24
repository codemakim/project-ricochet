import { GAME_TUNING, type BossKind } from '../config/gameTuning';
import type { EnemyKind, EnemySpec } from '../enemies/enemyRules';
import { canSpawnReinforcement, phaseAt } from './encounterRules';
import {
  bossEntryReady,
  bossProgressForKill,
  type EncounterState,
  type EncounterTransition,
  type StageAdvance,
} from './encounterProgressionRules';
import {
  createReinforcementFormation,
  type FormationRecipe,
  type FormationResult,
} from './formationRules';
import {
  FORMATION_PROFILES,
  STAGES,
  type StageDefinition,
  type StagePhaseDefinition,
} from './stageDefinitions';

export interface EncounterEnemyState {
  activePopulation: number;
  topmostEnemyY: number;
}

interface PendingFormation {
  phaseIndex: number;
  sequence: number;
  result: FormationResult;
}

export interface EncounterUpdate {
  formation: EnemySpec[] | null;
  transition: EncounterTransition | null;
}

const NO_UPDATE: EncounterUpdate = { formation: null, transition: null };

export class EncounterDirector {
  private state: EncounterState = 'running';
  private stageIndex = 0;
  private elapsedMs = 0;
  private stageElapsedMs = 0;
  private elapsedSinceSpawnMs = 0;
  private bossScore = 0;
  private warningElapsedMs = 0;
  private pendingBossKind: BossKind | null = null;
  private pendingBossWarningMs = 0;
  private bossesDefeated = 0;
  private spawnSequence = 0;
  private lastFormationId: string | null = null;
  private pendingFormation: PendingFormation | null = null;

  constructor(private readonly runSeed = 0) {}

  update(deltaMs: number, enemyState: EncounterEnemyState): EncounterUpdate {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) {
      throw new RangeError('deltaMs must be finite and non-negative');
    }
    this.elapsedMs += deltaMs;

    if (this.state === 'bossWarning') {
      this.warningElapsedMs += deltaMs;
      if (this.warningElapsedMs >= this.pendingBossWarningMs) {
        if (!this.pendingBossKind) {
          throw new Error('boss warning has no pending boss kind');
        }
        this.state = 'boss';
        return {
          formation: null,
          transition: { type: 'bossStarted', bossKind: this.pendingBossKind },
        };
      }
      return NO_UPDATE;
    }
    if (this.state !== 'running') return NO_UPDATE;

    const stage = this.activeStage();
    this.stageElapsedMs += deltaMs;
    this.elapsedSinceSpawnMs += deltaMs;
    if (bossEntryReady(stage.boss, this.stageElapsedMs, this.bossScore)) {
      this.state = 'bossWarning';
      this.pendingBossKind = stage.boss.kind;
      this.pendingBossWarningMs = stage.boss.warningMs;
      this.warningElapsedMs = 0;
      this.pendingFormation = null;
      return {
        formation: null,
        transition: { type: 'bossWarningStarted', bossKind: stage.boss.kind },
      };
    }

    const phase = phaseAt(stage, this.stageElapsedMs);
    if (this.elapsedSinceSpawnMs < phase.definition.spawnIntervalMs
      || enemyState.topmostEnemyY < GAME_TUNING.encounter.reinforcementReleaseY) return NO_UPDATE;

    if (this.pendingFormation?.phaseIndex !== phase.index
      || this.pendingFormation.sequence !== this.spawnSequence) {
      this.pendingFormation = {
        phaseIndex: phase.index,
        sequence: this.spawnSequence,
        result: createReinforcementFormation(
          formationRecipe(stage, phase.definition),
          this.spawnSequence,
          this.runSeed,
        ),
      };
    }
    const formation = this.pendingFormation.result;
    if (!canSpawnReinforcement({
      elapsedSinceSpawnMs: this.elapsedSinceSpawnMs,
      spawnIntervalMs: phase.definition.spawnIntervalMs,
      topmostEnemyY: enemyState.topmostEnemyY,
      requiredTopmostY: GAME_TUNING.encounter.reinforcementReleaseY,
      activeEnemies: enemyState.activePopulation,
      incomingEnemies: formation.populationCost,
      activeCap: phase.definition.activeCap,
    })) return NO_UPDATE;

    this.elapsedSinceSpawnMs = 0;
    this.spawnSequence += 1;
    this.lastFormationId = formation.id;
    this.pendingFormation = null;
    return { formation: formation.enemies, transition: null };
  }

  recordEnemyKill(kind: EnemyKind): void {
    if (this.state === 'running') this.bossScore += bossProgressForKill(kind);
  }

  markBossDefeated(): void {
    if (this.state !== 'boss') {
      throw new Error(`cannot mark boss defeated while encounter state is ${this.state}`);
    }
    this.state = 'bossRewardPaused';
    this.bossesDefeated += 1;
  }

  resumeAfterBossReward(): StageAdvance {
    if (this.state !== 'bossRewardPaused') {
      throw new Error(`cannot resume after boss reward while encounter state is ${this.state}`);
    }
    if (this.stageIndex + 1 >= STAGES.length) {
      this.state = 'runComplete';
      this.pendingBossKind = null;
      this.pendingFormation = null;
      return { type: 'runCompleted' };
    }

    this.state = 'running';
    this.stageIndex += 1;
    this.stageElapsedMs = 0;
    this.elapsedSinceSpawnMs = 0;
    this.bossScore = 0;
    this.warningElapsedMs = 0;
    this.pendingBossKind = null;
    this.pendingBossWarningMs = 0;
    this.pendingFormation = null;
    const stage = this.activeStage();
    return { type: 'stageStarted', stageId: stage.id, stageNumber: stage.number };
  }

  getSnapshot() {
    const stage = this.activeStage();
    const phase = phaseAt(stage, this.stageElapsedMs).index;
    return {
      elapsedMs: this.elapsedMs,
      elapsedSinceSpawnMs: this.elapsedSinceSpawnMs,
      phase,
      spawnSequence: this.spawnSequence,
      runSeed: this.runSeed,
      lastFormationId: this.lastFormationId,
      state: this.state,
      stageIndex: this.stageIndex,
      stageId: stage.id,
      stageNumber: stage.number,
      stageElapsedMs: this.stageElapsedMs,
      // Temporary debug compatibility; remove after E2E consumers use stage fields.
      section: this.stageIndex,
      sectionElapsedMs: this.stageElapsedMs,
      bossScore: this.bossScore,
      warningElapsedMs: this.warningElapsedMs,
      pendingBossKind: this.pendingBossKind,
      bossesDefeated: this.bossesDefeated,
    } as const;
  }

  private activeStage(): StageDefinition {
    return STAGES[this.stageIndex]!;
  }
}

function formationRecipe(
  stage: StageDefinition,
  phase: StagePhaseDefinition,
): FormationRecipe {
  const profile = FORMATION_PROFILES.find(({ id }) => id === phase.formationProfileId);
  if (!profile) throw new Error(`formation profile ${phase.formationProfileId} does not exist`);
  return {
    stageNumber: stage.number,
    battlefield: stage.battlefield,
    profile,
    enemyWeightMultipliers: phase.enemyWeightMultipliers,
    maxPerFormationOverrides: phase.maxPerFormationOverrides,
    hpMultiplier: stage.hpMultiplier,
    descentSpeedMultiplier: stage.descentSpeedMultiplier,
  };
}
