import { expect, it } from 'vitest';
import { BOSS_GEOMETRY } from './bossGeometry';

it('derives every boss extent from tuning', () => {
  expect(BOSS_GEOMETRY).toMatchObject({
    bodyHalfWidth: 84,
    bodyHalfHeight: 48,
    weakpointOffsetX: 88,
    collisionHalfWidth: 99,
    collisionHalfHeight: 48,
    movementBounds: { minimum: 99, maximum: 351 },
  });
});
