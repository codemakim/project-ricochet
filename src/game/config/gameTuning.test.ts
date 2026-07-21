import { describe, expect, it } from 'vitest';
import { GAME_TUNING, validateGameTuning, type GameTuning } from './gameTuning';

type Mutable<T> = T extends readonly [unknown, ...unknown[]]
  ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
  : T extends readonly (infer Item)[]
    ? Mutable<Item>[]
    : T extends object
      ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
      : T;

function mutableTuning(): Mutable<GameTuning> {
  return structuredClone(GAME_TUNING) as Mutable<GameTuning>;
}

describe('GAME_TUNING', () => {
  it('defines the approved boss, enemy, and encounter values once', () => {
    expect(GAME_TUNING.boss.body).toEqual({ width: 168, height: 96 });
    expect(GAME_TUNING.boss.movement.maxSpeed).toBe(35);
    expect(GAME_TUNING.enemies).toMatchObject({
      descentSpeed: 8,
      hp: { basic: 2, shooter: 2, armored: 5 },
    });
    expect(GAME_TUNING.encounter.initialFormation).toEqual({
      count: 26, originY: 80, armored: 3, shooters: 3,
    });
    expect(GAME_TUNING.encounter.reinforcementReleaseY).toBe(50);
    expect(GAME_TUNING.encounter.phases).toEqual([
      { formation: { minimum: 13, maximum: 15 }, activeCap: 48, spawnIntervalMs: 8000, armored: 1, shooters: 0 },
      { formation: { minimum: 15, maximum: 18 }, activeCap: 60, spawnIntervalMs: 7000, armored: 2, shooters: 1 },
      { formation: { minimum: 18, maximum: 21 }, activeCap: 72, spawnIntervalMs: 6000, armored: 2, shooters: 2 },
    ]);
  });

  it('accepts the shipped configuration', () => {
    expect(() => validateGameTuning(mutableTuning())).not.toThrow();
  });

  it.each([
    ['non-positive enemy speed', (value: Mutable<GameTuning>) => { value.enemies.descentSpeed = 0; }],
    ['reversed formation range', (value: Mutable<GameTuning>) => { value.encounter.phases[0]!.formation.minimum = 16; }],
    ['cap below formation maximum', (value: Mutable<GameTuning>) => { value.encounter.phases[2]!.activeCap = 20; }],
    ['release height outside ingress band', (value: Mutable<GameTuning>) => { value.encounter.reinforcementReleaseY = 98; }],
    ['boss wider than the game', (value: Mutable<GameTuning>) => { value.boss.body.width = 450; }],
    ['identical friendly and hostile palette', (value: Mutable<GameTuning>) => {
      value.visual.hostile.enemyBullet = { ...value.visual.friendly.temporaryOrb };
    }],
  ])('rejects %s', (_label, mutate) => {
    const tuning = mutableTuning();
    mutate(tuning);
    expect(() => validateGameTuning(tuning)).toThrow();
  });
});
