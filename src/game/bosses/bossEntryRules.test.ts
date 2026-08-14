import { describe, expect, it } from 'vitest';
import { GAME_TUNING } from '../config/gameTuning';
import { bossEntryCleanup, bossEntryCorridor } from './bossEntryRules';

describe('boss entry cleanup rules', () => {
  it('covers sentinel and siege initial collision geometry', () => {
    expect(bossEntryCorridor('sentinel')).toEqual({ left: 107, right: 343, bottom: 176 });
    expect(bossEntryCorridor('siege')).toEqual({ left: 107, right: 343, bottom: 176 });
  });

  it('covers every deployed hive part', () => {
    expect(bossEntryCorridor('hive')).toEqual({ left: 74, right: 376, bottom: 384 });
  });

  it('selects corridor cleanup by default and all cleanup explicitly', () => {
    expect(GAME_TUNING.encounter.bossEntry).toEqual({
      cleanupMode: 'corridor',
      padding: 8,
    });
    expect(bossEntryCleanup('hive', 'all')).toEqual({ mode: 'all' });
  });
});
