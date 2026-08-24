/// <reference types="vite/client" />

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

  it('declares the exact core-cast frame maps', () => {
    const expected = {
      player: {
        idle: [0, 1, 2, 3], move: [4, 5, 6, 7], launch: [8, 9, 10],
        recover: [11, 12, 13], hurt: [14, 15], defeated: [16, 17, 18, 19],
      },
      'enemy-basic': { idle: [0, 1, 2], hurt: [3, 4], destroyed: [5, 6, 7, 8] },
      'enemy-armored': {
        idle: [0, 1, 2], brace: [3, 4], hurt: [5, 6], destroyed: [7, 8, 9, 10],
      },
      'enemy-shooter': {
        idle: [0, 1, 2], charge: [3, 4, 5], fire: [6, 7, 8],
        hurt: [9, 10], destroyed: [11, 12, 13, 14],
      },
      'enemy-splitter': {
        idle: [0, 1, 2], fracture: [3, 4, 5], split: [6, 7, 8, 9],
        destroyed: [10, 11, 12, 13],
      },
      'enemy-fragment-left': { idle: [0, 1], hurt: [2, 3], destroyed: [4, 5, 6] },
      'enemy-fragment-right': { idle: [0, 1], hurt: [2, 3], destroyed: [4, 5, 6] },
    } as const;

    for (const [role, states] of Object.entries(expected)) {
      const profile = actorSkinProfile(role as keyof typeof expected);
      expect(Object.fromEntries(Object.entries(profile.states).map(([state, animation]) => (
        [state, animation?.frames]
      )))).toEqual(states);
    }
  });

  it('ships one runtime sheet for every core-cast profile', () => {
    const shipped = new Set(Object.keys(import.meta.glob('/public/assets/combat/actors/**/*')));
    const coreRoles = [
      'player', 'enemy-basic', 'enemy-armored', 'enemy-shooter',
      'enemy-splitter', 'enemy-fragment-left', 'enemy-fragment-right',
    ] as const;
    for (const role of coreRoles) {
      expect(shipped.has(`/public${actorSkinProfile(role).url}`), role).toBe(true);
    }
  });
});
