import { describe, expect, it } from 'vitest';
import { createEmptyAbilityRanks } from '../progression/progressionRules';
import { createRunConfig, createRunResult } from '../run/runContract';
import {
  createDefaultMetaProgress,
  purchaseCore,
  setLoadout,
  settleRun,
} from './metaProgress';

const result = (
  runId: string,
  durationMs: number,
  bosses: Array<'sentinel' | 'hive' | 'siege'> = [],
  success = false,
) => createRunResult(
  createRunConfig(['echo'], 1, runId),
  success,
  durationMs,
  bosses,
  createEmptyAbilityRanks(),
);

describe('meta progress', () => {
  it('pays at least 40 parts for the first valid run and settles it once', () => {
    const first = settleRun(createDefaultMetaProgress(), result('run-1', 180_000));
    expect(first.earned).toBe(40);
    expect(first.progress.parts).toBe(40);
    expect(settleRun(first.progress, result('run-1', 180_000)).earned).toBe(0);
  });

  it('pays boss, first-kill, and clear rewards', () => {
    const settled = settleRun(
      createDefaultMetaProgress(),
      result('clear-1', 180_000, ['sentinel', 'hive', 'siege'], true),
    );
    expect(settled.breakdown).toMatchObject({
      participation: 10,
      firstValidRun: 30,
      bosses: 55,
      firstKills: 60,
      clear: 30,
    });
    expect(settled.earned).toBe(185);
  });

  it('keeps short failures unrewarded unless a boss was defeated', () => {
    expect(settleRun(createDefaultMetaProgress(), result('short', 10_000)).earned).toBe(0);
    expect(settleRun(
      createDefaultMetaProgress(),
      result('boss', 10_000, ['sentinel']),
    ).earned).toBe(62);
  });

  it('purchases locked cores in price order and equips one unlocked core', () => {
    const earned = settleRun(createDefaultMetaProgress(), result('run-1', 180_000)).progress;
    const bought = purchaseCore(earned, 'conduction');
    expect(bought.parts).toBe(0);
    expect(() => purchaseCore(bought, 'corrosion')).toThrow('insufficient parts');
    expect(setLoadout(bought, ['conduction']).loadout).toEqual(['conduction']);
    expect(() => setLoadout(bought, ['echo', 'conduction']))
      .toThrow('exactly one core');
    expect(() => setLoadout(bought, ['corrosion']))
      .toThrow('locked core');
  });

  it('can purchase all five cores after the default echo core', () => {
    let progress = { ...createDefaultMetaProgress(), parts: 800 };

    for (const core of [
      'corrosion',
      'conduction',
      'inertia',
      'split',
      'explosion',
    ] as const) {
      progress = purchaseCore(progress, core);
    }

    expect(progress.unlockedCores).toEqual([
      'echo',
      'corrosion',
      'conduction',
      'inertia',
      'split',
      'explosion',
    ]);
    expect(progress.parts).toBe(0);
  });
});
