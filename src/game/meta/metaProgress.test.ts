import { describe, expect, it } from 'vitest';
import { createEmptyAbilityRanks } from '../progression/progressionRules';
import { createRunConfig, createRunResult } from '../run/runContract';
import {
  createDefaultMetaProgress,
  purchaseCore,
  setLoadout,
  settleRun,
  type MetaProgress,
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
  it('starts with only the echo core discovered', () => {
    expect(createDefaultMetaProgress()).toMatchObject({
      schemaVersion: 3,
      discoveredCores: ['echo'],
      discoveredFusions: [],
    });
  });

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

  it('settles new discoveries once for defeat and victory', () => {
    const failedDiscovery = createRunResult(
      createRunConfig(['echo'], 1, 'discover-fail'),
      false,
      10_000,
      [],
      createEmptyAbilityRanks(),
      ['echo', 'conduction'],
      ['photon-orbit'],
    );
    const failed = settleRun(createDefaultMetaProgress(), failedDiscovery);
    expect(failed.progress).toMatchObject({
      discoveredCores: ['echo', 'conduction'],
      discoveredFusions: ['photon-orbit'],
    });
    expect(settleRun(failed.progress, failedDiscovery).progress).toEqual(failed.progress);

    const victory = createRunResult(
      createRunConfig(['echo'], 1, 'discover-win'),
      true,
      180_000,
      ['sentinel', 'hive', 'siege'],
      createEmptyAbilityRanks(),
      ['echo', 'split'],
      ['nano-proliferator'],
    );
    expect(settleRun(createDefaultMetaProgress(), victory).progress).toMatchObject({
      discoveredCores: ['echo', 'split'],
      discoveredFusions: ['nano-proliferator'],
    });
  });

  it('purchases locked cores in price order and equips one unlocked core', () => {
    const earned = settleRun(createDefaultMetaProgress(), result('run-1', 180_000)).progress;
    expect(() => purchaseCore(earned, 'conduction'))
      .toThrow('core must be discovered before unlock');
    const bought = purchaseCore({
      ...earned,
      discoveredCores: ['echo', 'conduction'],
    }, 'conduction');
    expect(bought.parts).toBe(0);
    expect(() => purchaseCore({
      ...bought,
      discoveredCores: [...bought.discoveredCores, 'corrosion'],
    }, 'corrosion')).toThrow('insufficient parts');
    expect(setLoadout(bought, ['conduction']).loadout).toEqual(['conduction']);
    expect(() => setLoadout(bought, ['echo', 'conduction']))
      .toThrow('exactly one core');
    expect(() => setLoadout(bought, ['corrosion']))
      .toThrow('locked core');
  });

  it('can purchase all five cores after the default echo core', () => {
    let progress: MetaProgress = {
      ...createDefaultMetaProgress(),
      parts: 800,
      discoveredCores: [
        'echo',
        'corrosion',
        'conduction',
        'inertia',
        'split',
        'explosion',
      ],
    };

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
