import { expect, it } from 'vitest';
import { GAME_TUNING } from '../config/gameTuning';
import { GAME_WIDTH } from '../constants';
import { BOSS_GEOMETRY } from './bossGeometry';

it('fills at least a four-by-two grid envelope and keeps symmetric movement bounds', () => {
  const grid = GAME_TUNING.encounter.grid;
  expect(BOSS_GEOMETRY.collisionHalfWidth * 2)
    .toBeGreaterThanOrEqual(grid.cellWidth * 4 - grid.gap);
  expect(BOSS_GEOMETRY.collisionHalfHeight * 2)
    .toBeGreaterThanOrEqual(grid.cellHeight * 2 - grid.gap);
  expect(BOSS_GEOMETRY.movementBounds).toEqual({
    minimum: BOSS_GEOMETRY.collisionHalfWidth,
    maximum: GAME_WIDTH - BOSS_GEOMETRY.collisionHalfWidth,
  });
});
