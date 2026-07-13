import { describe, expect, it } from 'vitest';
import {
  EXPERIMENT_DEFAULTS,
  GAME_HEIGHT,
  GAME_WIDTH,
  MAX_ORB_COUNT,
  PLAYER_MIN_Y,
  STARTING_ORB_COUNT,
} from './constants';

describe('logical playfield', () => {
  it('keeps combat inside the approved portrait dimensions', () => {
    expect({ width: GAME_WIDTH, height: GAME_HEIGHT, minY: PLAYER_MIN_Y }).toEqual({
      width: 450,
      height: 800,
      minY: 98,
    });
  });

  it('starts with three permanent orbs and caps them at six', () => {
    expect(STARTING_ORB_COUNT).toBe(3);
    expect(MAX_ORB_COUNT).toBe(6);
  });

  it('uses the approved experiment defaults', () => {
    expect(EXPERIMENT_DEFAULTS).toEqual({
      passThroughOnKill: false,
      homeOnBottomHit: true,
      autoReturnAfterMs: null,
    });
  });
});
