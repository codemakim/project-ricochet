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

  it('uses shape and palette separation for friendly and hostile projectiles', () => {
    const { friendly, hostile } = GAME_TUNING.visual;
    expect(friendly.temporaryOrb).toEqual({
      fill: 0x8cf7ff, accent: 0x167d9a, width: 12, height: 12,
    });
    expect(hostile.enemyBullet).toEqual({
      fill: 0xff4d5a, accent: 0x4a0710, width: 10, height: 10,
    });
    expect(hostile.enemyBullet.fill).not.toBe(friendly.temporaryOrb.fill);
    expect(hostile.enemyBullet.accent).not.toBe(friendly.temporaryOrb.accent);
    expect(hostile.bossHazard.height).toBeGreaterThan(hostile.bossHazard.width);
  });

  it('accepts the shipped configuration', () => {
    expect(() => validateGameTuning(mutableTuning())).not.toThrow();
  });

  it.each([
    ['non-positive enemy speed', (value: Mutable<GameTuning>) => { value.enemies.descentSpeed = 0; }],
    ['reversed formation range', (value: Mutable<GameTuning>) => { value.encounter.phases[0]!.formation.minimum = 16; }],
    ['non-finite formation maximum', (value: Mutable<GameTuning>) => {
      value.encounter.phases[0]!.formation.maximum = Number.NaN;
    }],
    ['fractional formation count', (value: Mutable<GameTuning>) => {
      value.encounter.phases[0]!.formation.maximum = 14.5;
    }],
    ['cap below formation maximum', (value: Mutable<GameTuning>) => { value.encounter.phases[2]!.activeCap = 20; }],
    ['non-finite active cap', (value: Mutable<GameTuning>) => {
      value.encounter.phases[0]!.activeCap = Number.NaN;
    }],
    ['fractional active cap', (value: Mutable<GameTuning>) => {
      value.encounter.phases[0]!.activeCap = 48.5;
    }],
    ['fractional initial formation count', (value: Mutable<GameTuning>) => {
      value.encounter.initialFormation.count = 26.5;
    }],
    ['non-positive boss entry timing', (value: Mutable<GameTuning>) => {
      value.encounter.bossEntry.warningMs = 0;
    }],
    ['reversed boss entry timings', (value: Mutable<GameTuning>) => {
      value.encounter.bossEntry.minimumMs = value.encounter.bossEntry.hardMaximumMs + 1;
    }],
    ['non-finite obstacle padding', (value: Mutable<GameTuning>) => {
      value.boss.movement.obstaclePadding = Number.POSITIVE_INFINITY;
    }],
    ['non-finite boss y', (value: Mutable<GameTuning>) => { value.boss.y = Number.NaN; }],
    ['non-finite initial formation y', (value: Mutable<GameTuning>) => {
      value.encounter.initialFormation.originY = Number.NEGATIVE_INFINITY;
    }],
    ['non-finite reinforcement y', (value: Mutable<GameTuning>) => {
      value.encounter.reinforcementOriginY = Number.NaN;
    }],
    ['non-finite friendly color', (value: Mutable<GameTuning>) => {
      value.visual.friendly.permanentOrb.fill = Number.NaN;
    }],
    ['non-finite hostile color', (value: Mutable<GameTuning>) => {
      value.visual.hostile.enemyBullet.accent = Number.POSITIVE_INFINITY;
    }],
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
