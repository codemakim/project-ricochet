import { describe, expect, it } from 'vitest';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants';
import {
  HIVE_BOSS_GEOMETRY,
  bodyBounds,
  bodiesOverlap,
  reflectorCorridorWidth,
} from './hiveBossGeometry';

describe('hive boss geometry', () => {
  it('defines two distinct shooter positions outside the core', () => {
    const shooters = Object.values(HIVE_BOSS_GEOMETRY.shooters);
    expect(shooters).toHaveLength(2);
    expect(new Set(shooters.map(({ x, y }) => `${x}:${y}`)).size).toBe(2);
    expect(shooters.every((shooter) => !bodiesOverlap(shooter, HIVE_BOSS_GEOMETRY.core))).toBe(true);
  });

  it('defines two ordered reflector paths with the configured minimum corridor', () => {
    const { leftReflector, rightReflector } = HIVE_BOSS_GEOMETRY.reflectors;
    expect(leftReflector.travel).toEqual({ minimum: 70, maximum: 130 });
    expect(rightReflector.travel).toEqual({ minimum: 320, maximum: 380 });
    expect(reflectorCorridorWidth(
      leftReflector.travel.maximum,
      rightReflector.travel.minimum,
    )).toBeGreaterThanOrEqual(HIVE_BOSS_GEOMETRY.minimumCorridorWidth);
  });

  it('keeps every body throughout its path inside 450x800 and away from the core', () => {
    const bodies = [
      HIVE_BOSS_GEOMETRY.core,
      ...Object.entries(HIVE_BOSS_GEOMETRY.recalled).map(([partId, position]) => ({
        ...position,
        ...(partId.includes('Shooter')
          ? { width: HIVE_BOSS_GEOMETRY.shooters.leftShooter.width, height: HIVE_BOSS_GEOMETRY.shooters.leftShooter.height }
          : { width: HIVE_BOSS_GEOMETRY.reflectors.leftReflector.width, height: HIVE_BOSS_GEOMETRY.reflectors.leftReflector.height }),
      })),
      ...Object.values(HIVE_BOSS_GEOMETRY.shooters),
      ...Object.values(HIVE_BOSS_GEOMETRY.reflectors).flatMap((reflector) => [
        { ...reflector, x: reflector.travel.minimum },
        { ...reflector, x: reflector.travel.maximum },
      ]),
    ];
    for (const body of bodies) {
      const bounds = bodyBounds(body);
      expect(bounds.left).toBeGreaterThanOrEqual(0);
      expect(bounds.right).toBeLessThanOrEqual(GAME_WIDTH);
      expect(bounds.top).toBeGreaterThanOrEqual(0);
      expect(bounds.bottom).toBeLessThanOrEqual(GAME_HEIGHT);
    }
    for (const reflector of Object.values(HIVE_BOSS_GEOMETRY.reflectors)) {
      expect(bodiesOverlap(
        { ...reflector, x: reflector.travel.minimum },
        HIVE_BOSS_GEOMETRY.core,
      )).toBe(false);
      expect(bodiesOverlap(
        { ...reflector, x: reflector.travel.maximum },
        HIVE_BOSS_GEOMETRY.core,
      )).toBe(false);
    }
  });

  it('gives every visible part a hitbox and spans at least four by three grid cells', () => {
    const bodies = [
      HIVE_BOSS_GEOMETRY.core,
      ...Object.values(HIVE_BOSS_GEOMETRY.shooters),
      ...Object.values(HIVE_BOSS_GEOMETRY.reflectors).map((body) => ({
        ...body,
        x: body.travel.minimum,
      })),
    ];
    expect(bodies.every(({ width, height }) => width > 0 && height > 0)).toBe(true);

    const bounds = bodies.map(bodyBounds);
    const width = Math.max(...bounds.map(({ right }) => right))
      - Math.min(...bounds.map(({ left }) => left));
    const height = Math.max(...bounds.map(({ bottom }) => bottom))
      - Math.min(...bounds.map(({ top }) => top));
    expect(width).toBeGreaterThanOrEqual(208);
    expect(height).toBeGreaterThanOrEqual(144);
  });
});
