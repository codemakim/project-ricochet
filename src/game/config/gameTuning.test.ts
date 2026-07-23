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
  return structuredClone(GAME_TUNING) as unknown as Mutable<GameTuning>;
}

describe('GAME_TUNING', () => {
  it('defines the approved boss, enemy, and encounter values once', () => {
    expect(GAME_TUNING.boss.body).toEqual({ width: 168, height: 96 });
    expect(GAME_TUNING.boss.movement.maxSpeed).toBe(35);
    expect(GAME_TUNING.enemies).toMatchObject({
      descentSpeed: 8,
      hp: { basic: 2, shooter: 2, armored: 5, splitter: 3, fragment: 1 },
      splitter: {
        width: 38, height: 30, fragmentOffsetX: 12,
        populationCost: 2, score: 2, xp: 1, breachDamage: 3,
      },
      fragment: { width: 22, height: 18, populationCost: 1, score: 0, xp: 1, breachDamage: 1 },
    });
    expect(GAME_TUNING.encounter.initialFormation).toEqual({
      count: 26, originY: 80, armored: 3, shooters: 3,
    });
    expect(GAME_TUNING.encounter.reinforcementReleaseY).toBe(50);
    expect(GAME_TUNING.encounter.phases).toEqual([
      { formation: { minimum: 13, maximum: 15 }, activeCap: 48, spawnIntervalMs: 8000, armored: 1, shooters: 0, splitters: 0 },
      { formation: { minimum: 15, maximum: 18 }, activeCap: 60, spawnIntervalMs: 7000, armored: 2, shooters: 1, splitters: 0 },
      { formation: { minimum: 18, maximum: 21 }, activeCap: 72, spawnIntervalMs: 6000, armored: 2, shooters: 2, splitters: 0 },
      { formation: { minimum: 21, maximum: 25 }, activeCap: 84, spawnIntervalMs: 5500, armored: 3, shooters: 3, splitters: 2 },
    ]);
    expect(GAME_TUNING.encounter.phases[3]).toEqual({
      formation: { minimum: 21, maximum: 25 },
      activeCap: 84,
      spawnIntervalMs: 5500,
      armored: 3,
      shooters: 3,
      splitters: 2,
    });
    expect(GAME_TUNING.encounter.bossSchedule).toEqual([
      { section: 0, kind: 'sentinel', minimumMs: 120000, scoreTarget: 70, hardMaximumMs: 210000, warningMs: 2000 },
      { section: 1, kind: 'hive', minimumMs: 150000, scoreTarget: 110, hardMaximumMs: 210000, warningMs: 2000 },
    ]);
    expect(Object.hasOwn(GAME_TUNING.encounter, 'bossEntry')).toBe(false);
    expect(GAME_TUNING.temporaryOrbs).toEqual({
      radius: 6, speed: 440, cap: 12, lifetimeMs: 1500, hitCooldownMs: 80,
    });
    expect(GAME_TUNING.hiveBoss).toMatchObject({
      core: { x: 225, y: 140, visualSize: 56, hitboxSize: 48, hp: 72 },
      shooter: { width: 34, height: 28, hp: 12 },
      reflector: {
        width: 18, height: 96, y: 280, hp: 14,
        leftTravel: { minimum: 96, maximum: 168 },
        rightTravel: { minimum: 282, maximum: 354 },
        speed: 30,
        hitCooldownMs: 80,
        minimumCorridorWidth: 96,
      },
      timing: { shieldedMs: 4000, telegraphMs: 1500, exposedMs: 7000 },
    });
    expect(GAME_TUNING.projectiles.hiveShooter).toEqual({
      intervalMs: 1400, offsetMs: 700, warningMs: 300, speed: 170, damage: 1, radius: 5,
    });
    expect(GAME_TUNING.projectiles.hiveCore).toEqual({
      intervalMs: 7000, speed: 140, damage: 1, radius: 5, fanDegrees: [-36, -18, 0, 18, 36],
    });
    expect(GAME_TUNING.relics.secondBoss).toEqual({
      auxiliaryOrbit: { orbLimit: 6 },
      recoverySalvo: { temporaryOrbCount: 2 },
      siegeResonance: { hitsRequired: 10, radius: 80, damage: 2 },
      hyperpressureCore: { chargedDamageBonus: 0.75 },
      aftershockExplosion: { delayMs: 350, radiusScale: 0.8, damageScale: 0.5 },
      chainSplit: { childCount: 2, angles: [-25, 25] },
    });
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
    ['negative phase splitters', (value: Mutable<GameTuning>) => {
      value.encounter.phases[3]!.splitters = -1;
    }],
    ['special counts exceeding formation minimum', (value: Mutable<GameTuning>) => {
      value.encounter.phases[3]!.splitters = 16;
    }],
    ['duplicate schedule sections', (value: Mutable<GameTuning>) => {
      value.encounter.bossSchedule[1]!.section = 0;
    }],
    ['misordered schedule sections', (value: Mutable<GameTuning>) => {
      value.encounter.bossSchedule[0]!.section = 1;
    }],
    ['reversed boss schedule timings', (value: Mutable<GameTuning>) => {
      value.encounter.bossSchedule[1]!.minimumMs = value.encounter.bossSchedule[1]!.hardMaximumMs + 1;
    }],
    ['hive geometry outside the game', (value: Mutable<GameTuning>) => {
      value.hiveBoss.core.x = 451;
    }],
    ['derived hive shooter outside the game', (value: Mutable<GameTuning>) => {
      value.hiveBoss.core.x = 30;
    }],
    ['hive core hitbox larger than its visual', (value: Mutable<GameTuning>) => {
      value.hiveBoss.core.hitboxSize = value.hiveBoss.core.visualSize + 1;
    }],
    ['worst-case reflector corridor below minimum', (value: Mutable<GameTuning>) => {
      value.hiveBoss.reflector.rightTravel.minimum = 281;
    }],
    ['reflector path overlapping the core', (value: Mutable<GameTuning>) => {
      value.hiveBoss.reflector.y = 140;
      value.hiveBoss.reflector.leftTravel = { minimum: 138, maximum: 210 };
      value.hiveBoss.reflector.rightTravel = { minimum: 324, maximum: 396 };
    }],
    ['left reflector swept path overlapping its deployed shooter', (value: Mutable<GameTuning>) => {
      value.hiveBoss.reflector.y = 150;
      value.hiveBoss.reflector.rightTravel = { minimum: 330, maximum: 402 };
    }],
    ['right reflector swept path overlapping its deployed shooter', (value: Mutable<GameTuning>) => {
      value.hiveBoss.reflector.y = 150;
      value.hiveBoss.reflector.leftTravel = { minimum: 48, maximum: 120 };
    }],
    ['recalled hive modules overlapping each other', (value: Mutable<GameTuning>) => {
      value.hiveBoss.shooter.height = 100;
    }],
    ['non-positive reflector hit cooldown', (value: Mutable<GameTuning>) => {
      value.hiveBoss.reflector.hitCooldownMs = 0;
    }],
    ['invalid permanent orb cap', (value: Mutable<GameTuning>) => {
      value.relics.secondBoss.auxiliaryOrbit.orbLimit = 2;
    }],
    ['non-finite hive core x', (value: Mutable<GameTuning>) => {
      value.hiveBoss.core.x = Number.NaN;
    }],
    ['non-finite hive core y', (value: Mutable<GameTuning>) => {
      value.hiveBoss.core.y = Number.NaN;
    }],
    ['non-positive hive timing', (value: Mutable<GameTuning>) => {
      value.hiveBoss.timing.shieldedMs = 0;
    }],
    ['non-positive hive projectile value', (value: Mutable<GameTuning>) => {
      value.projectiles.hiveShooter.speed = 0;
    }],
    ['invalid temporary orb cap', (value: Mutable<GameTuning>) => {
      value.temporaryOrbs.cap = 0;
    }],
    ['invalid temporary orb lifetime', (value: Mutable<GameTuning>) => {
      value.temporaryOrbs.lifetimeMs = -1;
    }],
    ['non-finite relic value', (value: Mutable<GameTuning>) => {
      value.relics.secondBoss.aftershockExplosion.radiusScale = Number.NaN;
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
