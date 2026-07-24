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
  it('defines the approved global boss, enemy, and encounter values once', () => {
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
    expect(Object.hasOwn(GAME_TUNING.encounter, 'initialFormation')).toBe(false);
    expect(GAME_TUNING.encounter.reinforcementReleaseY).toBe(50);
    expect(Object.hasOwn(GAME_TUNING.encounter, 'phases')).toBe(false);
    expect(Object.hasOwn(GAME_TUNING.encounter, 'bossSchedule')).toBe(false);
    expect(Object.hasOwn(GAME_TUNING.encounter, 'bossEntry')).toBe(false);
    expect(GAME_TUNING.temporaryOrbs).toEqual({
      radius: 6, speed: 440, cap: 12, lifetimeMs: 1500, hitCooldownMs: 80,
    });
    expect(GAME_TUNING.bossAreaDamage).toEqual({ secondaryDamageScale: 0.5, maxSecondaryTargets: 1 });
    expect(GAME_TUNING.hiveBoss).toMatchObject({
      core: { x: 225, y: 140, visualSize: 112, hitboxSize: 96, hp: 120 },
      shooter: { width: 68, height: 56, hp: 20 },
      reflector: {
        width: 36, height: 192, y: 280, hp: 24,
        leftTravel: { minimum: 70, maximum: 130 },
        rightTravel: { minimum: 320, maximum: 380 },
        speed: 30,
        hitCooldownMs: 80,
        minimumCorridorWidth: 96,
      },
      timing: { shieldedMs: 4000, telegraphMs: 1500, exposedMs: 7000 },
    });
    expect(GAME_TUNING.projectiles.hiveShooter).toEqual({
      intervalMs: 1400, offsetMs: 700, warningMs: 300, speed: 170, damage: 1, radius: 5,
    });
    expect(GAME_TUNING.projectiles.bossAimed).toEqual({
      warningMs: 600, speed: 220, damage: 1, radius: 5, count: 3, spreadDegrees: 24,
    });
    expect(GAME_TUNING.projectiles.hiveCore).toEqual({
      intervalMs: 7000, speed: 140, damage: 1, radius: 5, count: 5, arcDegrees: 72, offsetDegrees: 0,
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
    ['boss area damage scale above one', (value: Mutable<GameTuning>) => {
      value.bossAreaDamage.secondaryDamageScale = 1.1;
    }],
    ['fractional boss area target count', (value: Mutable<GameTuning>) => {
      value.bossAreaDamage.maxSecondaryTargets = 1.5;
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
