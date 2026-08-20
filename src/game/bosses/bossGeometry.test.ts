import { expect, it } from 'vitest';
import { GAME_TUNING } from '../config/gameTuning';
import { GAME_WIDTH } from '../constants';
import { BOSS_GEOMETRY } from './bossGeometry';

it('fills at least a four-by-two grid envelope and keeps symmetric movement bounds', () => {
  const grid = GAME_TUNING.encounter.grid;
  expect(BOSS_GEOMETRY.collisionHalfWidth * 2).toBe(grid.cellWidth * 4);
  expect(BOSS_GEOMETRY.collisionHalfHeight * 2).toBe(grid.cellHeight * 2);
  expect(BOSS_GEOMETRY.movementBounds).toEqual({
    minimum: 168,
    maximum: 282,
  });
});
