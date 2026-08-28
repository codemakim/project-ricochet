import type { BossKind } from '../config/gameTuning';
import type { StageId } from './stageDefinitions';

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
