import { GAME_TUNING, type BossKind } from '../config/gameTuning';
import type { EnemyKind } from '../enemies/enemyRules';
import type { StageBossDefinition, StageId } from './stageDefinitions';

export type EncounterState = 'running' | 'bossWarning' | 'boss' | 'bossRewardPaused' | 'runComplete';
export type EncounterTransition =
  | { type: 'bossWarningStarted'; bossKind: BossKind }
  | { type: 'bossStarted'; bossKind: BossKind };
export type StageAdvance =
  | { type: 'stageStarted'; stageId: StageId; stageNumber: number }
  | { type: 'runCompleted' };
export type BossDefeatAdvance =
  | { type: 'rewardRequired' }
  | { type: 'runCompleted' };

export function bossProgressForKill(kind: EnemyKind): number {
  switch (kind) {
    case 'basic': return 1;
    case 'armored':
    case 'shooter': return 2;
    case 'splitter': return GAME_TUNING.enemies.splitter.score;
    case 'fragment': return GAME_TUNING.enemies.fragment.score;
  }
}

export function bossEntryReady(
  entry: StageBossDefinition,
  elapsedMs: number,
  score: number,
): boolean {
  return elapsedMs >= entry.hardMaximumMs
    || (elapsedMs >= entry.minimumMs && score >= entry.scoreTarget);
}

export function stageProgress(
  entry: StageBossDefinition,
  elapsedMs: number,
  score: number,
): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    throw new RangeError('elapsedMs must be finite and non-negative');
  }
  if (!Number.isFinite(score) || score < 0) {
    throw new RangeError('score must be finite and non-negative');
  }
  return Math.min(
    1,
    Math.max(
      elapsedMs / entry.hardMaximumMs,
      Math.min(elapsedMs / entry.minimumMs, score / entry.scoreTarget),
    ),
  );
}

export function coreSupplyCountAt(
  progress: number,
  milestones: readonly number[],
): number {
  if (!Number.isFinite(progress) || progress < 0 || progress > 1) {
    throw new RangeError('progress must be from 0 through 1');
  }
  return milestones.filter((milestone) => milestone <= progress).length;
}
