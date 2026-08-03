import { describe, expect, it } from 'vitest';
import type { OrbTypeId } from '../orbs/orbFusionRules';
import {
  ABILITY_MAX_RANKS,
  createEmptyAbilityRanks,
  type AbilityRanks,
} from './progressionRules';
import {
  runRewardChoiceKey,
  selectRunRewardOptions,
  type RunRewardChoice,
  type RunRewardContext,
} from './runRewardRules';

type RewardOrb = { coreType: OrbTypeId; level: number };

function orb(coreType: OrbTypeId, level = 1): RewardOrb {
  return { coreType, level };
}

function context(
  orbs: readonly RewardOrb[],
  abilityRanks: AbilityRanks = createEmptyAbilityRanks(),
): RunRewardContext {
  return {
    orbs,
    abilityRanks,
    abilityEligibility: {
      coreTypes: orbs.map(({ coreType }) => coreType)
        .filter((coreType): coreType is Exclude<OrbTypeId, 'photon-orbit' | 'resonant-swarm' | 'nano-proliferator'> => (
          !coreType.includes('-orbit')
          && coreType !== 'resonant-swarm'
          && coreType !== 'nano-proliferator'
        )),
    },
  };
}

function kinds(choices: readonly RunRewardChoice[]): RunRewardChoice['kind'][] {
  return choices.map(({ kind }) => kind);
}

describe('run reward rules', () => {
  it.each([1, 2])('offers two concrete orb additions with one ability at %s orbs', (count) => {
    const choices = selectRunRewardOptions(
      context(Array.from({ length: count }, () => orb('echo'))),
      0,
      0,
    );

    expect(kinds(choices).filter((kind) => kind === 'orb-add')).toHaveLength(2);
    expect(kinds(choices).filter((kind) => kind === 'ability')).toHaveLength(1);
    expect(new Set(
      choices.filter((choice) => choice.kind === 'orb-add')
        .map(({ coreType }) => coreType),
    )).toHaveLength(2);
    expect(choices).toContainEqual({ kind: 'orb-add', coreType: 'echo' });
  });

  it.each([3, 4, 5])('offers one concrete orb addition with two abilities at %s orbs', (count) => {
    const choices = selectRunRewardOptions(
      context(Array.from({ length: count }, () => orb('echo'))),
      4,
      19,
    );

    expect(kinds(choices).filter((kind) => kind === 'orb-add')).toHaveLength(1);
    expect(kinds(choices).filter((kind) => kind === 'ability')).toHaveLength(2);
  });

  it('mixes one fusion, one eligible core upgrade, and one ability at six orbs', () => {
    const choices = selectRunRewardOptions(context([
      orb('echo'),
      orb('echo'),
      orb('corrosion'),
      orb('conduction'),
      orb('inertia'),
      orb('split'),
    ]), 8, 31);
    const upgrades = choices.filter((choice) => choice.kind === 'orb-upgrade');

    expect(choices.some((choice) => choice.kind === 'orb-add')).toBe(false);
    expect(choices.filter((choice) => choice.kind === 'orb-fusion')).toHaveLength(1);
    expect(upgrades).toHaveLength(1);
    expect(choices.filter((choice) => choice.kind === 'ability')).toHaveLength(1);
  });

  it('does not offer a fusion recipe already owned in the run', () => {
    const choices = selectRunRewardOptions(context([
      orb('inertia'),
      orb('conduction'),
      orb('split'),
      orb('corrosion'),
      orb('echo'),
      { coreType: 'photon-orbit', level: 4 } as RewardOrb,
    ]), 8, 0);

    expect(choices).not.toContainEqual({ kind: 'orb-fusion', fusionType: 'photon-orbit' });
  });

  it('excludes a core type only when all physical copies are level five', () => {
    const choices = selectRunRewardOptions(context([
      orb('echo', 5),
      orb('echo', 5),
      orb('conduction', 4),
      orb('conduction', 5),
      orb('split', 5),
      orb('explosion', 5),
    ]), 5, 0);
    const upgrades = choices.filter((choice) => choice.kind === 'orb-upgrade');

    expect(upgrades).toContainEqual({ kind: 'orb-upgrade', coreType: 'conduction' });
    expect(upgrades).not.toContainEqual({ kind: 'orb-upgrade', coreType: 'echo' });
  });

  it('offers a fusion and abilities when all six basic orbs are level five', () => {
    const choices = selectRunRewardOptions(context([
      orb('echo', 5),
      orb('corrosion', 5),
      orb('conduction', 5),
      orb('inertia', 5),
      orb('split', 5),
      orb('explosion', 5),
    ]), 12, 9);

    expect(choices.some((choice) => choice.kind === 'orb-fusion')).toBe(true);
    expect(choices.some((choice) => choice.kind === 'orb-upgrade')).toBe(false);
    expect(choices.some((choice) => choice.kind === 'ability')).toBe(true);
  });

  it('filters capped abilities from mixed choices', () => {
    const ranks = { ...ABILITY_MAX_RANKS, firepower: 4 };
    const choices = selectRunRewardOptions(context([
      orb('echo', 5),
      orb('corrosion', 5),
      orb('conduction', 5),
      orb('inertia', 5),
      orb('split', 5),
      orb('explosion', 5),
    ], ranks), 20, 7);

    expect(choices).toContainEqual({ kind: 'ability', id: 'firepower' });
  });

  it('returns the same structural choices for the same run inputs', () => {
    const input = context([orb('echo'), orb('conduction'), orb('split')]);

    const first = selectRunRewardOptions(input, 7, 1234);
    const second = selectRunRewardOptions(input, 7, 1234);

    expect(second).toEqual(first);
    expect(new Set(first.map(runRewardChoiceKey))).toHaveLength(first.length);
  });

  it('returns only valid cards when both ability and upgrade candidates are scarce', () => {
    const choices = selectRunRewardOptions(context([
      orb('echo', 4),
      orb('corrosion', 5),
      orb('conduction', 5),
      orb('inertia', 5),
      orb('split', 5),
      orb('explosion', 5),
    ], { ...ABILITY_MAX_RANKS }), 50, 3);

    expect(choices).toHaveLength(2);
    expect(choices.filter((choice) => choice.kind === 'orb-fusion')).toHaveLength(1);
    expect(choices).toContainEqual({ kind: 'orb-upgrade', coreType: 'echo' });
  });
});
