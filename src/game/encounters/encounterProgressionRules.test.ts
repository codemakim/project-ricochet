import { describe, expect, it } from 'vitest';
import { STAGES } from './stageDefinitions';
import {
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

  it.each(STAGES)(
    'uses the exact stage-local boss score for $id',
    ({ boss }) => {
      expect(bossEntryReady(boss, boss.scoreTarget - 1)).toBe(false);
      expect(bossEntryReady(boss, boss.scoreTarget)).toBe(true);
    },
  );

});
