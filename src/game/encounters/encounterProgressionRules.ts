import { GAME_TUNING } from '../config/gameTuning';
import type { EnemyKind } from '../enemies/enemyRules';

const FIRST_BOSS_SCHEDULE = GAME_TUNING.encounter.bossSchedule[0];

export const BOSS_PROGRESS_TARGET = FIRST_BOSS_SCHEDULE.scoreTarget;
export const BOSS_ENTRY_MIN_MS = FIRST_BOSS_SCHEDULE.minimumMs;
export const BOSS_ENTRY_HARD_MAX_MS = FIRST_BOSS_SCHEDULE.hardMaximumMs;
export const BOSS_WARNING_MS = FIRST_BOSS_SCHEDULE.warningMs;

export type EncounterState = 'running' | 'bossWarning' | 'boss' | 'bossRewardPaused';
export type EncounterTransition = 'bossWarningStarted' | 'bossStarted';

export function bossProgressForKill(kind: EnemyKind): number {
  switch (kind) {
    case 'basic': return 1;
    case 'armored':
    case 'shooter': return 2;
  }
}

export function bossEntryReady(elapsedMs: number, score: number): boolean {
  return elapsedMs >= BOSS_ENTRY_HARD_MAX_MS
    || (elapsedMs >= BOSS_ENTRY_MIN_MS && score >= BOSS_PROGRESS_TARGET);
}
