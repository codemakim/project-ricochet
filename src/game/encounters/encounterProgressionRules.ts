import { GAME_TUNING } from '../config/gameTuning';
import type { EnemyKind } from '../enemies/enemyRules';

export const BOSS_PROGRESS_TARGET = GAME_TUNING.encounter.bossEntry.scoreTarget;
export const BOSS_ENTRY_MIN_MS = GAME_TUNING.encounter.bossEntry.minimumMs;
export const BOSS_ENTRY_HARD_MAX_MS = GAME_TUNING.encounter.bossEntry.hardMaximumMs;
export const BOSS_WARNING_MS = GAME_TUNING.encounter.bossEntry.warningMs;

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
