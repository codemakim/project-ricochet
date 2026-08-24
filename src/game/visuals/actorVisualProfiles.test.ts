import { describe, expect, it } from 'vitest';
import {
  ACTOR_SKIN_PROFILES,
  REQUIRED_ACTOR_STATES,
  actorAnimationKey,
  actorSkinProfile,
} from './actorVisualProfiles';

describe('actor visual profiles', () => {
  it('ships one complete default skin for every combat role', () => {
    for (const [role, required] of Object.entries(REQUIRED_ACTOR_STATES)) {
      const profile = actorSkinProfile(
        role as keyof typeof REQUIRED_ACTOR_STATES,
        'default',
      );
      expect(profile.role).toBe(role);
      expect(profile.skinId).toBe('default');
      expect(required.every((state) => profile.states[state])).toBe(true);
      expect(profile.frameWidth).toBeGreaterThan(0);
      expect(profile.frameHeight).toBeGreaterThan(0);
      expect(profile.displayWidth).toBeGreaterThan(0);
      expect(profile.displayHeight).toBeGreaterThan(0);
    }
    expect(new Set(ACTOR_SKIN_PROFILES.map(({ role }) => role)).size)
      .toBe(Object.keys(REQUIRED_ACTOR_STATES).length);
  });

  it('rejects unknown skins instead of silently changing role geometry', () => {
    expect(() => actorSkinProfile('player', 'missing'))
      .toThrow('unknown player skin: missing');
  });

  it('builds stable animation keys from role, skin, and state', () => {
    expect(actorAnimationKey('enemy-shooter', 'default', 'charge'))
      .toBe('actor:enemy-shooter:default:charge');
  });
});
