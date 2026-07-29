import { describe, expect, it } from 'vitest';
import {
  aimedBurst,
  aimedShot,
  fallingOrigins,
  fanShots,
  movingVerticalLaser,
} from './bossAttackPatterns';

function angles(shots: readonly { direction: { x: number; y: number } }[]): number[] {
  return shots.map(({ direction }) => Math.round(Math.atan2(direction.x, direction.y) * 180 / Math.PI));
}

describe('boss attack patterns', () => {
  it('normalizes an aimed shot and preserves its speed', () => {
    expect(aimedShot({ x: 1, y: 2 }, { x: 4, y: 6 }, 220, { x: 0, y: 1 })).toEqual({
      direction: { x: 0.6, y: 0.8 },
      speed: 220,
    });
  });

  it('uses a normalized fallback for a zero-length aim', () => {
    expect(aimedShot({ x: 4, y: 6 }, { x: 4, y: 6 }, 1, { x: 0, y: 4 })).toEqual({
      direction: { x: 0, y: 1 },
      speed: 1,
    });
  });

  it('builds symmetric aimed bursts and fans', () => {
    expect(angles(aimedBurst({ x: 0, y: 0 }, { x: 0, y: 1 }, 220, 3, 24, { x: 0, y: -1 })))
      .toEqual([12, 0, -12]);
    expect(angles(fanShots({ x: 0, y: 1 }, 140, 5, 72))).toEqual([-36, -18, 0, 18, 36]);
  });

  it('applies a fan offset after evenly spacing the fan', () => {
    expect(angles(fanShots({ x: 0, y: 1 }, 1, 3, 24, 12))).toEqual([0, 12, 24]);
  });

  it('clamps deterministic falling origins to the playfield', () => {
    expect(fallingOrigins(30, 24, 426, [0, 90, -90, 500])).toEqual([30, 120, 24, 426]);
  });

  it('defines a bounded moving vertical laser', () => {
    expect(movingVerticalLaser(
      80,
      1,
      { minimum: 40, maximum: 410 },
      90,
      600,
      1600,
      18,
    )).toEqual({
      startX: 80,
      endX: 224,
      speed: 90,
      warningMs: 600,
      activeMs: 1600,
      width: 18,
    });
    expect(() => movingVerticalLaser(
      80,
      1,
      { minimum: 40, maximum: 410 },
      0,
      600,
      1600,
      18,
    )).toThrow('laser speed must be positive');
  });

  it.each([
    () => aimedShot({ x: 0, y: 0 }, { x: 1, y: 1 }, 0, { x: 0, y: 1 }),
    () => aimedBurst({ x: 0, y: 0 }, { x: 1, y: 1 }, 1, 0, 24, { x: 0, y: 1 }),
    () => fanShots({ x: 0, y: 1 }, 1, 1.5, 24),
    () => fanShots({ x: 0, y: 1 }, 1, 3, Number.NaN),
    () => fallingOrigins(0, 1, 0, [0]),
  ])('rejects invalid pattern parameters', (call) => {
    expect(call).toThrow(RangeError);
  });
});
