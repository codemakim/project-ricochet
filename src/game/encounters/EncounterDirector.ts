import { GAME_TUNING, type BossKind } from '../config/gameTuning';
import { GAME_HEIGHT } from '../constants';
import type { DevelopmentBalanceSettings } from '../dev/developmentBalanceSettings';
import type { EnemySpec } from '../enemies/enemyRules';
import { canReleaseFormation, formationDepleted } from './encounterRules';
import {
  type BossDefeatAdvance,
  type EncounterState,
  type EncounterTransition,
  type StageAdvance,
} from './encounterProgressionRules';
import {
  createAuthoredFormation,
  resolveStageFormationOrder,
  type FormationResult,
  type ResolvedStageFormation,
} from './formationRules';
import {
  STAGES,
  type StageDefinition,
  type StageParagraphDefinition,
} from './stageDefinitions';

export interface EncounterEnemyState {
  activePopulation: number;
  topmostEnemyTop: number;
  formationPopulations: Readonly<Record<string, number>>;
}

export interface EncounterUpdate {
  formation: EnemySpec[] | null;
  transition: EncounterTransition | null;
}

const NO_UPDATE: EncounterUpdate = { formation: null, transition: null };

export class EncounterDirector {
  private state: EncounterState = 'running';
  private stageIndex = 0;
  private stageOrder: readonly ResolvedStageFormation[];
  private formationIndex = -1;
  private elapsedMs = 0;
  private stageElapsedMs = 0;
  private emptyElapsedMs = 0;
  private warningElapsedMs = 0;
  private pendingBossKind: BossKind | null = null;
  private pendingBossWarningMs = 0;
  private bossesDefeated = 0;
  private lastFormationInitialPopulation = 0;
  private lastFormationId: string | null = null;
  private lastFormationRemainingRatio: number | null = null;
  private activePopulation = 0;

  constructor(
    private readonly runSeed = 0,
    private readonly developmentBalance?: DevelopmentBalanceSettings,
  ) {
    this.stageOrder = resolveStageFormationOrder(this.activeStage(), runSeed);
  }

  update(deltaMs: number, enemyState: EncounterEnemyState): EncounterUpdate {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) {
      throw new RangeError('deltaMs must be finite and non-negative');
    }
    this.elapsedMs += deltaMs;
    this.activePopulation = enemyState.activePopulation;

    if (this.state === 'bossWarning') {
      this.warningElapsedMs += deltaMs;
      if (this.warningElapsedMs < this.pendingBossWarningMs) return NO_UPDATE;
      if (!this.pendingBossKind) throw new Error('boss warning has no pending boss kind');
      this.state = 'boss';
      return {
        formation: null,
        transition: { type: 'bossStarted', bossKind: this.pendingBossKind },
      };
    }
    if (this.state !== 'running') return NO_UPDATE;

    this.stageElapsedMs += deltaMs;
    if (this.formationIndex < 0) return this.releaseFormation(0, enemyState);

    const remaining = enemyState.formationPopulations[this.lastFormationId!] ?? 0;
    this.lastFormationRemainingRatio = remaining / this.lastFormationInitialPopulation;
    if (this.formationIndex === this.stageOrder.length - 1) {
      return enemyState.activePopulation === 0 ? this.beginBossWarning() : NO_UPDATE;
    }
    if (!formationDepleted(this.lastFormationInitialPopulation, remaining)) {
      if (enemyState.activePopulation > 0) this.emptyElapsedMs = 0;
      return NO_UPDATE;
    }

    if (enemyState.activePopulation === 0) {
      this.emptyElapsedMs += deltaMs;
      const multiplier = this.developmentBalance?.reinforcementIntervalMultiplier ?? 1;
      if (this.emptyElapsedMs < GAME_TUNING.encounter.emptyRespawnMs * multiplier) {
        return NO_UPDATE;
      }
    } else {
      this.emptyElapsedMs = 0;
    }

    const nextIndex = this.formationIndex + 1;
    const candidate = this.createFormation(nextIndex);
    const paragraph = this.paragraphAt(nextIndex);
    if (!canReleaseFormation(
      enemyState.activePopulation,
      candidate.populationCost,
      paragraph.activeCap,
    )) return NO_UPDATE;
    return this.releaseFormation(nextIndex, enemyState, candidate);
  }

  markBossDefeated(): BossDefeatAdvance {
    if (this.state !== 'boss') {
      throw new Error(`cannot mark boss defeated while encounter state is ${this.state}`);
    }
    this.bossesDefeated += 1;
    if (this.stageIndex + 1 >= STAGES.length) {
      this.state = 'runComplete';
      this.pendingBossKind = null;
      return { type: 'runCompleted' };
    }
    this.state = 'bossRewardPaused';
    return { type: 'rewardRequired' };
  }

  resumeAfterBossReward(): StageAdvance {
    if (this.state !== 'bossRewardPaused') {
      throw new Error(`cannot resume after boss reward while encounter state is ${this.state}`);
    }
    this.state = 'running';
    this.stageIndex += 1;
    this.stageOrder = resolveStageFormationOrder(this.activeStage(), this.runSeed);
    this.formationIndex = -1;
    this.stageElapsedMs = 0;
    this.emptyElapsedMs = 0;
    this.warningElapsedMs = 0;
    this.pendingBossKind = null;
    this.pendingBossWarningMs = 0;
    this.lastFormationInitialPopulation = 0;
    this.lastFormationId = null;
    this.lastFormationRemainingRatio = null;
    this.activePopulation = 0;
    const stage = this.activeStage();
    return { type: 'stageStarted', stageId: stage.id, stageNumber: stage.number };
  }

  getSnapshot() {
    const stage = this.activeStage();
    const order = this.stageOrder[Math.max(0, this.formationIndex)]!;
    const paragraph = stage.paragraphs[order.paragraphIndex]!;
    return {
      elapsedMs: this.elapsedMs,
      emptyElapsedMs: this.emptyElapsedMs,
      paragraphId: order.paragraphId,
      paragraphIndex: order.paragraphIndex,
      formationIndex: this.formationIndex,
      spawnSequence: this.formationIndex + 1,
      runSeed: this.runSeed,
      lastFormationId: this.lastFormationId,
      lastFormationRemainingRatio: this.lastFormationRemainingRatio,
      activePopulation: this.activePopulation,
      activeCap: paragraph.activeCap,
      state: this.state,
      stageIndex: this.stageIndex,
      stageId: stage.id,
      stageNumber: stage.number,
      expectedOrbCount: stage.powerBand.expectedOrbCount,
      stageElapsedMs: this.stageElapsedMs,
      warningElapsedMs: this.warningElapsedMs,
      pendingBossKind: this.pendingBossKind,
      bossesDefeated: this.bossesDefeated,
    } as const;
  }

  private activeStage(): StageDefinition {
    return STAGES[this.stageIndex]!;
  }

  private paragraphAt(index: number): StageParagraphDefinition {
    return this.activeStage().paragraphs[this.stageOrder[index]!.paragraphIndex]!;
  }

  private createFormation(index: number): FormationResult {
    const order = this.stageOrder[index]!;
    return createAuthoredFormation(this.activeStage(), this.paragraphAt(index), order.id);
  }

  private releaseFormation(
    index: number,
    enemyState: EncounterEnemyState,
    formation = this.createFormation(index),
  ): EncounterUpdate {
    this.formationIndex = index;
    this.emptyElapsedMs = 0;
    this.lastFormationId = formation.id;
    this.lastFormationInitialPopulation = formation.populationCost;
    this.lastFormationRemainingRatio = 1;
    return {
      formation: withRapidIngress(formation.enemies, this.paragraphAt(index), enemyState),
      transition: null,
    };
  }

  private beginBossWarning(): EncounterUpdate {
    const boss = this.activeStage().boss;
    this.state = 'bossWarning';
    this.pendingBossKind = boss.kind;
    this.pendingBossWarningMs = boss.warningMs;
    this.warningElapsedMs = 0;
    return {
      formation: null,
      transition: { type: 'bossWarningStarted', bossKind: boss.kind },
    };
  }
}

function withRapidIngress(
  enemies: readonly EnemySpec[],
  paragraph: StageParagraphDefinition,
  enemyState: EncounterEnemyState,
): EnemySpec[] {
  const cellHeight = GAME_TUNING.encounter.grid.cellHeight;
  const currentBottom = Math.max(...enemies.map((enemy) => (
    enemy.y + (enemy.height ?? 1) * cellHeight / 2
  )));
  const paragraphBottom = GAME_HEIGHT * paragraph.targetDepthRatio;
  const targetBottom = enemyState.activePopulation === 0
    ? paragraphBottom
    : Math.min(paragraphBottom, enemyState.topmostEnemyTop - cellHeight);
  const offset = Math.max(0, targetBottom - currentBottom);
  return enemies.map((enemy) => ({
    ...enemy,
    rapidIngressTargetY: enemy.y + offset,
  }));
}
