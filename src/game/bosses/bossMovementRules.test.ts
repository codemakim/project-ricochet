import { describe, expect, it } from 'vitest';
import { GAME_TUNING } from '../config/gameTuning';
import { BOSS_GEOMETRY } from './bossGeometry';
import { updateBossMotion, type HorizontalInterval } from './bossMovementRules';

const CENTER_BOUNDS: HorizontalInterval = { minimum: 60, maximum: 390 };

describe('boss movement rules', () => {
  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])(
    'rejects invalid deltaMs %s',
    (deltaMs) => {
      expect(() => updateBossMotion({ x: 225, direction: 1 }, deltaMs, [])).toThrow(
        'deltaMs must be finite and non-negative',
      );
    },
  );

  it.each([Number.NaN, Number.NEGATIVE_INFINITY])('rejects invalid current x %s', (x) => {
    expect(() => updateBossMotion({ x, direction: 1 }, 1000, [])).toThrow(
      'current x must be finite',
    );
  });

  it.each([
    { minimum: Number.NaN, maximum: 390 },
    { minimum: 60, maximum: Number.POSITIVE_INFINITY },
    { minimum: 390, maximum: 60 },
  ])('rejects invalid bounds $minimum..$maximum', (bounds) => {
    expect(() => updateBossMotion({ x: 225, direction: 1 }, 1000, [], bounds)).toThrow(
      'bounds must have finite, ordered endpoints',
    );
  });

  it.each([
    { minimum: Number.NaN, maximum: 200 },
    { minimum: 150, maximum: Number.NEGATIVE_INFINITY },
    { minimum: 200, maximum: 150 },
  ])('rejects invalid obstacle $minimum..$maximum', (obstacle) => {
    expect(() => updateBossMotion({ x: 120, direction: 1 }, 1000, [obstacle])).toThrow(
      'obstacles must have finite, ordered endpoints',
    );
  });

  it('moves freely across the derived center bounds at 35px/s', () => {
    expect(updateBossMotion({ x: 225, direction: 1 }, 1000, [])).toEqual({
      x: 260,
      direction: 1,
    });

    expect(updateBossMotion({ x: 340, direction: 1 }, 1000, [])).toEqual({
      x: 351,
      direction: 1,
    });
  });

  it('decelerates near a boundary, settles there, then reverses on a later update', () => {
    const decelerating = updateBossMotion({ x: 321, direction: 1 }, 500, []);
    expect(decelerating).toEqual({ x: 336, direction: 1 });

    const settling = updateBossMotion(decelerating, 1000, []);
    expect(settling).toEqual({ x: 351, direction: 1 });

    const reversing = updateBossMotion(settling, 16, []);
    expect(reversing).toEqual({ x: 351, direction: -1 });
  });

  it('clips movement to a padded obstacle interval', () => {
    const enemy = { minimum: 300, maximum: 344 };
    const paddedObstacle = {
      minimum: enemy.minimum
        - BOSS_GEOMETRY.collisionHalfWidth
        - GAME_TUNING.boss.movement.obstaclePadding,
      maximum: enemy.maximum
        + BOSS_GEOMETRY.collisionHalfWidth
        + GAME_TUNING.boss.movement.obstaclePadding,
    };

    expect(updateBossMotion({ x: 120, direction: 1 }, 1000, [paddedObstacle])).toEqual({
      x: 155,
      direction: 1,
    });
  });

  it('reverses at an obstacle before overlap', () => {
    expect(
      updateBossMotion({ x: 120, direction: 1 }, 1000, [{ minimum: 150, maximum: 200 }]),
    ).toEqual({ x: 150, direction: 1 });
  });

  it('stops when merged obstacles block both sides', () => {
    expect(
      updateBossMotion(
        { x: 225, direction: 1 },
        1000,
        [
          { minimum: 0, maximum: 225 },
          { minimum: 200, maximum: 450 },
        ],
      ),
    ).toEqual({ x: 225, direction: 0 });
  });

  it('resumes into newly expanded range after obstacle removal', () => {
    const stopped = updateBossMotion(
      { x: 200, direction: 0 },
      1000,
      [
        { minimum: 99, maximum: 200 },
        { minimum: 200, maximum: 351 },
      ],
    );

    expect(stopped).toEqual({ x: 200, direction: 0 });
    expect(updateBossMotion(stopped, 1000, [])).toEqual({ x: 235, direction: 1 });
  });

  it('merges overlapping forbidden intervals and never crosses them on a large delta', () => {
    expect(
      updateBossMotion(
        { x: 100, direction: 1 },
        3000,
        [
          { minimum: 150, maximum: 220 },
          { minimum: 200, maximum: 260 },
        ],
        CENTER_BOUNDS,
      ),
    ).toEqual({ x: 150, direction: 1 });
  });
});
