import { describe, expect, it } from 'vitest';
import {
  FUSION_ORB_IDS,
  availableFusionIds,
  fusionLevel,
  fusionMaterialPairs,
} from './orbFusionRules';

describe('orb fusion rules', () => {
  it('derives a bounded fusion level from two physical materials', () => {
    expect(fusionLevel(1, 1)).toBe(1);
    expect(fusionLevel(4, 2)).toBe(5);
    expect(fusionLevel(5, 5)).toBe(9);
    expect(() => fusionLevel(0, 1)).toThrow('material level');
  });

  it('offers each registered fusion only for two matching basic orbs', () => {
    const orbs = [
      { id: 1, coreType: 'inertia' as const, level: 4 },
      { id: 2, coreType: 'conduction' as const, level: 2 },
      { id: 3, coreType: 'split' as const, level: 1 },
    ];

    expect(availableFusionIds(orbs)).toEqual(['photon-orbit', 'resonant-swarm']);
    expect(fusionMaterialPairs(orbs, 'photon-orbit')).toEqual([
      { firstId: 1, secondId: 2, resultLevel: 5 },
    ]);
  });

  it('blocks duplicate fusion ownership and never uses a fusion as material', () => {
    const orbs = [
      { id: 1, coreType: 'inertia' as const, level: 5 },
      { id: 2, coreType: 'conduction' as const, level: 5 },
      { id: 3, coreType: 'photon-orbit' as const, level: 9 },
    ];

    expect(availableFusionIds(orbs)).toEqual([]);
    expect(fusionMaterialPairs(orbs, 'photon-orbit')).toEqual([]);
  });

  it('offers the second fusion batch from its three material pairs', () => {
    const orbs = [
      { id: 0, coreType: 'corrosion' as const, level: 3 },
      { id: 1, coreType: 'inertia' as const, level: 4 },
      { id: 2, coreType: 'echo' as const, level: 2 },
      { id: 3, coreType: 'explosion' as const, level: 5 },
      { id: 4, coreType: 'split' as const, level: 3 },
    ];

    expect(FUSION_ORB_IDS).toEqual([
      'photon-orbit',
      'resonant-swarm',
      'nano-proliferator',
      'mass-collapse',
      'reactor-orb',
      'cluster-bombardment',
    ]);
    expect(availableFusionIds(orbs)).toEqual(expect.arrayContaining([
      'mass-collapse',
      'reactor-orb',
      'cluster-bombardment',
    ]));
    expect(fusionMaterialPairs(orbs, 'mass-collapse')).toEqual([
      { firstId: 0, secondId: 1, resultLevel: 6 },
    ]);
  });
});
