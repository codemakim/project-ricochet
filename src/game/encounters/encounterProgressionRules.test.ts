import { describe, expect, it } from 'vitest';
import { GAME_TUNING } from '../config/gameTuning';
import {
  BOSS_ENTRY_HARD_MAX_MS,
  BOSS_ENTRY_MIN_MS,
  BOSS_PROGRESS_TARGET,
  BOSS_WARNING_MS,
  bossEntryReady,
  bossProgressForKill,
} from './encounterProgressionRules';

describe('encounter progression rules', () => {
  it.each([
    ['basic', 1],
    ['armored', 2],
    ['shooter', 2],
  ] as const)('scores a %s kill as %i boss progress', (kind, expected) => {
    expect(bossProgressForKill(kind)).toBe(expected);
  });

  it('requires the target score and minimum time together', () => {
    expect(BOSS_PROGRESS_TARGET).toBe(GAME_TUNING.encounter.bossEntry.scoreTarget);
    expect(BOSS_ENTRY_MIN_MS).toBe(GAME_TUNING.encounter.bossEntry.minimumMs);
    expect(BOSS_WARNING_MS).toBe(GAME_TUNING.encounter.bossEntry.warningMs);
    expect(bossEntryReady(119_999, 70)).toBe(false);
    expect(bossEntryReady(120_000, 69)).toBe(false);
    expect(bossEntryReady(120_000, 70)).toBe(true);
  });

  it('forces entry at the hard maximum without the target score', () => {
    expect(BOSS_ENTRY_HARD_MAX_MS).toBe(GAME_TUNING.encounter.bossEntry.hardMaximumMs);
    expect(bossEntryReady(209_999, 0)).toBe(false);
    expect(bossEntryReady(210_000, 0)).toBe(true);
  });
});
