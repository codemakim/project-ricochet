import {
  GAME_TUNING,
  type BossKind,
  type BossScheduleTuning,
} from '../config/gameTuning';
import type { EnemyKind } from '../enemies/enemyRules';

export type EncounterState = 'running' | 'bossWarning' | 'boss' | 'bossRewardPaused';
export type EncounterTransition =
  | { type: 'bossWarningStarted'; bossKind: BossKind }
  | { type: 'bossStarted'; bossKind: BossKind };

export function bossProgressForKill(kind: EnemyKind): number {
  switch (kind) {
    case 'basic': return 1;
    case 'armored':
    case 'shooter': return 2;
    case 'splitter': return GAME_TUNING.enemies.splitter.score;
    case 'fragment': return GAME_TUNING.enemies.fragment.score;
  }
}

export function bossEntryForSection(section: number): BossScheduleTuning | null {
  return GAME_TUNING.encounter.bossSchedule.find((entry) => entry.section === section) ?? null;
}

export function bossEntryReady(
  entry: BossScheduleTuning,
  elapsedMs: number,
  score: number,
): boolean {
  return elapsedMs >= entry.hardMaximumMs
    || (elapsedMs >= entry.minimumMs && score >= entry.scoreTarget);
}
