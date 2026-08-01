import { describe, expect, it } from 'vitest';
import {
  NanoSeedState,
  PhotonTrailState,
  nanoFusionProfile,
  photonFusionProfile,
  resonantSwarmProfile,
} from './FusionCombatState';

describe('fusion combat profiles', () => {
  it('unlocks each fusion milestone from the central nine-level curve', () => {
    expect(photonFusionProfile(1)).toMatchObject({ trail: null, intersectionBlast: null });
    expect(photonFusionProfile(4).trail).not.toBeNull();
    expect(photonFusionProfile(9).intersectionBlast).toEqual({ radius: 42, damage: 0.8 });
    expect(resonantSwarmProfile(1)).toMatchObject({ count: 2, targets: 1 });
    expect(resonantSwarmProfile(9)).toMatchObject({ count: 4, targets: 3 });
    expect(nanoFusionProfile(6).maximumGeneration).toBe(0);
    expect(nanoFusionProfile(7).maximumGeneration).toBe(1);
    expect(nanoFusionProfile(9).maximumGeneration).toBe(2);
  });

  it('rejects fusion levels outside one through nine', () => {
    expect(() => photonFusionProfile(0)).toThrow('fusion level');
    expect(() => resonantSwarmProfile(10)).toThrow('fusion level');
  });
});

describe('PhotonTrailState', () => {
  it('ticks bounded live trails and emits only interior crossing blasts', () => {
    const state = new PhotonTrailState();
    const profile = photonFusionProfile(9);

    expect(state.add(1, { x: 0, y: 0 }, { x: 10, y: 10 }, 0, profile)).toEqual([]);
    expect(state.add(1, { x: 0, y: 10 }, { x: 10, y: 0 }, 10, profile))
      .toEqual([{ x: 5, y: 5 }]);
    expect(state.add(1, { x: 10, y: 0 }, { x: 20, y: 0 }, 20, profile)).toEqual([]);
    expect(state.drainDue(20)).toHaveLength(3);
    expect(state.drainDue(21)).toEqual([]);
    state.update(10_000);
    expect(state.getSnapshot()).toEqual([]);
  });

  it('evicts the oldest trail at the per-orb cap', () => {
    const state = new PhotonTrailState();
    const profile = photonFusionProfile(7);
    for (let index = 0; index <= profile.trail!.maximumSegments; index += 1) {
      state.add(2, { x: index, y: 0 }, { x: index, y: 10 }, index, profile);
    }
    expect(state.getSnapshot()).toHaveLength(profile.trail!.maximumSegments);
    expect(state.getSnapshot()[0]!.start.x).toBe(1);
  });
});

describe('NanoSeedState', () => {
  it('scatters bounded fixed seeds, ticks them, and replicates one generation on a covered kill', () => {
    const state = new NanoSeedState();
    const profile = nanoFusionProfile(7);
    expect(state.spawn(3, { x: 100, y: 100 }, { x: 1, y: 0 }, 0, profile))
      .toBe(profile.count);
    expect(state.drainDue(0)).toHaveLength(profile.count);
    expect(state.spreadOnDeath({ x: 100, y: 100 }, 100, profile)).toBe(true);
    expect(state.getSnapshot().some(({ generation }) => generation === 1)).toBe(true);
    expect(state.spreadOnDeath({ x: 999, y: 999 }, 100, profile)).toBe(false);
  });

  it('stops replication at the configured generation and global cap', () => {
    const state = new NanoSeedState();
    const profile = { ...nanoFusionProfile(9), maximumSeeds: 2, count: 1 };
    state.spawn(1, { x: 0, y: 0 }, { x: 1, y: 0 }, 0, profile);
    expect(state.spreadOnDeath({ x: 0, y: 0 }, 1, profile)).toBe(true);
    expect(state.spreadOnDeath({ x: 0, y: 0 }, 2, profile)).toBe(false);
    expect(state.getSnapshot()).toHaveLength(2);
  });
});
