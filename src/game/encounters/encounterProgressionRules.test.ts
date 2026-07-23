import { describe, expect, it } from 'vitest';
import { GAME_TUNING } from '../config/gameTuning';
import {
  bossEntryForSection,
  bossEntryReady,
  bossProgressForKill,
} from './encounterProgressionRules';

describe('encounter progression rules', () => {
  it.each([
    ['basic', 1],
    ['armored', 2],
    ['shooter', 2],
    ['splitter', 2],
    ['fragment', 0],
  ] as const)('scores a %s kill as %i boss progress', (kind, expected) => {
    expect(bossProgressForKill(kind)).toBe(expected);
  });

  it('looks up each configured boss schedule by section', () => {
    expect(bossEntryForSection(0)).toEqual(GAME_TUNING.encounter.bossSchedule[0]);
    expect(bossEntryForSection(1)).toEqual(GAME_TUNING.encounter.bossSchedule[1]);
    expect(bossEntryForSection(2)).toBeNull();
  });

  it.each(GAME_TUNING.encounter.bossSchedule)(
    'requires time and score or the hard maximum for $kind',
    (entry) => {
      expect(bossEntryReady(entry, entry.minimumMs - 1, entry.scoreTarget)).toBe(false);
      expect(bossEntryReady(entry, entry.minimumMs, entry.scoreTarget - 1)).toBe(false);
      expect(bossEntryReady(entry, entry.minimumMs, entry.scoreTarget)).toBe(true);
      expect(bossEntryReady(entry, entry.hardMaximumMs - 1, 0)).toBe(false);
      expect(bossEntryReady(entry, entry.hardMaximumMs, 0)).toBe(true);
    },
  );

  it('uses the exact hive score and time boundaries', () => {
    const hive = GAME_TUNING.encounter.bossSchedule[1];
    expect(bossEntryReady(hive, 149_999, 110)).toBe(false);
    expect(bossEntryReady(hive, 150_000, 110)).toBe(true);
    expect(bossEntryReady(hive, 210_000, 0)).toBe(true);
  });
});
