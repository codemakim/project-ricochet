import { describe, expect, it } from 'vitest';
import { FLOOR_Y, GAME_HEIGHT, GAME_WIDTH, PADDLE_Y } from './constants';

describe('logical playfield', () => {
  it('keeps combat inside the approved portrait dimensions', () => {
    expect({ width: GAME_WIDTH, height: GAME_HEIGHT }).toEqual({ width: 450, height: 800 });
    expect(PADDLE_Y).toBe(720);
    expect(FLOOR_Y).toBe(798);
  });
});
