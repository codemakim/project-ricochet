import type { EnemyKind } from '../enemies/enemyRules';

export const BOSS_PROGRESS_TARGET = 70;
export const BOSS_ENTRY_MIN_MS = 120_000;
export const BOSS_ENTRY_HARD_MAX_MS = 210_000;
export const BOSS_WARNING_MS = 2_000;

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
