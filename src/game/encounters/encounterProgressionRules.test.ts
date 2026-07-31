import { describe, expect, it } from 'vitest';
import { STAGES } from './stageDefinitions';
import {
  bossEntryReady,
  bossProgressForKill,
  coreSupplyCountAt,
  stageProgress,
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

  it.each(STAGES)(
    'uses the exact stage-local boss gates for $id',
    ({ boss }) => {
      expect(bossEntryReady(boss, boss.minimumMs - 1, boss.scoreTarget)).toBe(false);
      expect(bossEntryReady(boss, boss.minimumMs, boss.scoreTarget - 1)).toBe(false);
      expect(bossEntryReady(boss, boss.minimumMs, boss.scoreTarget)).toBe(true);
      expect(bossEntryReady(boss, boss.hardMaximumMs - 1, 0)).toBe(false);
      expect(bossEntryReady(boss, boss.hardMaximumMs, 0)).toBe(true);
    },
  );

  it('combines active play and hard-time fallback into stage progress', () => {
    const boss = {
      kind: 'sentinel',
      minimumMs: 120_000,
      scoreTarget: 70,
      hardMaximumMs: 210_000,
      warningMs: 2_000,
    } as const;

    expect(stageProgress(boss, 0, 0)).toBe(0);
    expect(stageProgress(boss, 60_000, 35)).toBeCloseTo(0.5);
    expect(stageProgress(boss, 105_000, 0)).toBeCloseTo(0.5);
    expect(stageProgress(boss, 120_000, 70)).toBe(1);
    expect(stageProgress(boss, 210_000, 0)).toBe(1);
  });

  it('counts every crossed core-supply milestone', () => {
    const milestones = [0.2, 0.55] as const;

    expect(coreSupplyCountAt(0.19, milestones)).toBe(0);
    expect(coreSupplyCountAt(0.2, milestones)).toBe(1);
    expect(coreSupplyCountAt(0.8, milestones)).toBe(2);
  });
});
