import { describe, expect, it } from 'vitest';
import { GAME_TUNING } from '../config/gameTuning';
import { ORB_CORE_IDS } from '../orbs/orbCoreRules';
import { FUSION_ORB_IDS } from '../orbs/orbFusionRules';
import { REQUIRED_COMBAT_VFX_IDS } from './combatVfxIds';
import { ORB_VISUAL_PROFILES, orbVisualProfile } from './orbVisualProfiles';

describe('orb visual profiles', () => {
  it('covers every current orb exactly once with a distinct identity', () => {
    const ids = [...ORB_CORE_IDS, ...FUSION_ORB_IDS];
    expect(Object.keys(ORB_VISUAL_PROFILES).sort()).toEqual([...ids].sort());
    expect(new Set(ids.map((id) => orbVisualProfile(id).identity)).size).toBe(ids.length);
    expect(ids.every((id) => orbVisualProfile(id).layers.length > 0)).toBe(true);
  });

  it('uses registered semantic VFX IDs for every orb', () => {
    const registered = new Set<string>(REQUIRED_COMBAT_VFX_IDS);
    for (const profile of Object.values(ORB_VISUAL_PROFILES)) {
      expect(registered.has(profile.trailVfx)).toBe(true);
      expect(registered.has(profile.hitVfx)).toBe(true);
      expect(registered.has(profile.procVfx)).toBe(true);
    }
  });

  it('uses one compact PC body and energy image for every orb', () => {
    for (const profile of Object.values(ORB_VISUAL_PROFILES)) {
      expect(profile.bodyUrl).toBe(`/assets/combat/pc/orbs/${profile.id}/body.png`);
      expect(profile.layers).toHaveLength(1);
      expect(profile.layers[0]).toMatchObject({
        id: 'energy', url: `/assets/combat/pc/orbs/${profile.id}/energy.png`, scale: 1,
      });
      expect(profile.layers[0]!.frameConfig).toBeUndefined();
    }
  });

  it('keeps every orb within the central mobile visual budget', () => {
    const { maximumLayersPerOrb, mobileMaximumOrbVisualObjects } =
      GAME_TUNING.visual.orbAnimation;
    expect(Object.values(ORB_VISUAL_PROFILES).every(({ layers }) => (
      layers.length <= maximumLayersPerOrb
    ))).toBe(true);
    expect(GAME_TUNING.build.basicGrowth.maximumOrbs * (maximumLayersPerOrb + 1))
      .toBeLessThanOrEqual(mobileMaximumOrbVisualObjects);
  });

  it.each([
    ['echo', [['energy', 'pulse']]],
    ['corrosion', [['energy', 'spin']]],
    ['conduction', [['energy', 'pulse']]],
    ['inertia', [['energy', 'spin']]],
    ['split', [['energy', 'spin']]],
    ['explosion', [['energy', 'pulse']]],
  ] as const)('locks %s to its readable base motion identity', (id, expected) => {
    expect(orbVisualProfile(id).layers.map(({ id: layerId, motion }) => (
      [layerId, motion.kind]
    ))).toEqual(expected);
  });

  it('locks every fusion core to its declared energy motion', () => {
    const required = {
      'photon-orbit': { kind: 'spin', direction: 1, radiansPerSecond: 1.8 },
      'resonant-swarm': { kind: 'spin', direction: -1, radiansPerSecond: 1.3 },
      'nano-proliferator': { kind: 'pulse', periodMs: 840, alphaMinimum: 0.24, alphaMaximum: 0.72 },
      'mass-collapse': { kind: 'pulse', periodMs: 620, alphaMinimum: 0.24, alphaMaximum: 0.72 },
      'reactor-orb': { kind: 'pulse', periodMs: 540, alphaMinimum: 0.24, alphaMaximum: 0.72 },
      'cluster-bombardment': { kind: 'spin', direction: 1, radiansPerSecond: 0.8 },
      'mirror-circuit': { kind: 'pulse', periodMs: 900, alphaMinimum: 0.24, alphaMaximum: 0.72 },
      'meltdown-core': { kind: 'spin', direction: 1, radiansPerSecond: 1.1 },
      'vector-blade': { kind: 'pulse', periodMs: 380, alphaMinimum: 0.24, alphaMaximum: 0.72 },
    } as const;
    expect(Object.fromEntries(Object.keys(required).map((id) => [
      id,
      orbVisualProfile(id as keyof typeof required).layers[0]!.motion,
    ]))).toEqual(required);
    expect(new Set(Object.keys(required).map((id) => (
      orbVisualProfile(id as keyof typeof required).identity
    ))).size).toBe(Object.keys(required).length);
  });
});
