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

  it('keeps every orb within the central mobile visual budget', () => {
    const { maximumLayersPerOrb, mobileMaximumOrbVisualObjects } =
      GAME_TUNING.visual.orbAnimation;
    expect(Object.values(ORB_VISUAL_PROFILES).every(({ layers }) => (
      layers.length <= maximumLayersPerOrb
    ))).toBe(true);
    expect(GAME_TUNING.build.basicGrowth.maximumOrbs * (maximumLayersPerOrb + 1))
      .toBeLessThanOrEqual(mobileMaximumOrbVisualObjects);
  });
});
