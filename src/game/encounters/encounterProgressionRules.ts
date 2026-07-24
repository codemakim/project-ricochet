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
