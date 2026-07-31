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
    expect(GAME_TUNING.boss.body).toEqual({ width: 176, height: 96 });
    expect(GAME_TUNING.boss.movement.maxSpeed).toBe(35);
    expect(GAME_TUNING.enemies).toMatchObject({
      descentSpeed: 8,
      hp: { basic: 3, shooter: 4, armored: 10, splitter: 7, fragment: 2 },
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
    expect(GAME_TUNING.encounter.bossEntry).toEqual({
      cleanupMode: 'corridor',
      padding: 8,
    });
    expect(GAME_TUNING.rewardFlow).toEqual({ resumeGameplayMs: 300 });
    expect(GAME_TUNING.build).toEqual({
      conditionalDamageCap: 1.5,
      firepower: { damageBonusPerRank: 0.12 },
      kinetic: { speedBonusPerRank: 0.07 },
      nearAmplification: { distance: 150, damageBonusPerRank: 0.15 },
      precisionHit: { damageBonusPerRank: 0.2 },
      kineticConversion: {
        speedStep: 0.1,
        damageBonusPerStepPerRank: 0.06,
        maxDamageBonus: 0.36,
      },
      wallAcceleration: { speedBonusPerStack: 0.04, maxStacks: 5 },
      cutter: { chance: 0.15, cooldownMs: 120, thickness: 12, damage: 0.7 },
      destructionReaction: {
        chance: 0.25, cooldownMs: 120, radius: 56, damage: 0.8,
      },
      microMissile: { hitsRequired: 6, travelMs: 180, damage: 1.2 },
      recoveryShockwave: {
        recoveriesRequired: 4, radius: 72, damageByRank: [0.75, 1.25],
      },
      basicGrowth: {
        maximumOrbs: 6,
        orbRadiusBonusPerRank: 0.08,
        recoveryRadiusPerRank: 8,
        playerSpeedBonusPerRank: 0.08,
        healthPerRank: 1,
      },
      directHitFlight: {
        reloadDamageBonusPerRank: 0.2,
        consecutiveDamageBonus: 0.1,
        killOverclockDurationMs: 2000,
        killOverclockBonusPerRank: 0.08,
        collisionAccelerationDurationMs: 800,
        collisionAccelerationSpeedPerRank: 0.08,
        trackingDurationMs: 1200,
        trackingRadiusPerRank: 16,
        highSpeedImpact: { speedRatio: 1.3, hitsRequired: 5, radius: 44, damage: 0.65 },
      },
      effectModifiers: {
        procChancePerRank: 0.04,
        secondaryDamagePerRank: 0.15,
        circularRadiusPerRank: 0.1,
        durationPerRank: 0.15,
        cutterThicknessPerRank: 0.2,
        fragmentCountPerRank: 1,
        fragmentDamagePerRank: 0.15,
        fragmentLifetimeMsPerRank: 350,
        conductionTargetsPerRank: 1,
      },
      explosion: { chance: 0.2, cooldownMs: 120, radius: 48, damage: 0.45 },
      split: { chance: 0.25, cooldownMs: 120, count: 2 },
    });
    expect(GAME_TUNING.temporaryOrbs).toEqual({
      radius: 6, speed: 440, cap: 30, lifetimeMs: 1500, hitCooldownMs: 80,
      baseDamage: 0.4,
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
    expect(GAME_TUNING.projectiles.hiveEnrage).toEqual({
      fan: {
        intervalMs: 2800, warningMs: 350, speed: 150, damage: 1, radius: 5,
        count: 9, arcDegrees: 96, alternatingOffsetDegrees: 6,
      },
      aimedBurst: {
        intervalMs: 1600, warningMs: 350, speed: 190, damage: 1, radius: 5,
        count: 3, spreadDegrees: 18,
      },
    });
    expect(GAME_TUNING.relics).toMatchObject({
      auxiliaryLink: { procScale: 0.25 },
      crossCut: { damageScale: 0.6 },
      gasIgnition: { remainingDamageFraction: 0.5 },
      recursiveSplit: { chance: 0.2, childCount: 1 },
      inertiaRetention: { directHits: 2 },
      directLink: { overchargeScale: 0.3 },
      superconductingCircuit: { hitReduction: 1, damageBonus: 0.2 },
      resonanceRupture: { radius: 44, damage: 0.65 },
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

  it('provides five finite values for every permanent-core level curve', () => {
    const curves: Array<[string, readonly number[]]> = [];
    const visit = (value: unknown, path: string): void => {
      if (Array.isArray(value)) {
        if (path.endsWith('ByLevel')) curves.push([path, value as number[]]);
        return;
      }
      if (!value || typeof value !== 'object') return;
      for (const [key, child] of Object.entries(value)) {
        visit(child, path ? `${path}.${key}` : key);
      }
    };

    visit(GAME_TUNING.orbCores, 'orbCores');

    expect(curves.length).toBeGreaterThan(0);
    for (const [, values] of curves) {
      expect(values).toHaveLength(5);
      expect(values.every(Number.isFinite)).toBe(true);
    }
  });

  it('rejects a permanent-core level curve with the wrong length', () => {
    const tuning = mutableTuning();
    tuning.orbCores.explosion.chanceByLevel.pop();

    expect(() => validateGameTuning(tuning)).toThrow(
      'orbCores.explosion.chanceByLevel must contain 5 values',
    );
  });

  it.each([
    ['probability above one', (tuning: Mutable<GameTuning>) => {
      tuning.orbCores.explosion.chanceByLevel[2] = 1.1;
    }, 'orbCores.explosion.chanceByLevel.3 must be between zero and one'],
    ['fractional count', (tuning: Mutable<GameTuning>) => {
      tuning.orbCores.split.countByLevel[1] = 1.5;
    }, 'orbCores.split.countByLevel.2 must be an integer'],
    ['zero duration', (tuning: Mutable<GameTuning>) => {
      tuning.orbCores.corrosion.durationMsByLevel[0] = 0;
    }, 'orbCores.corrosion.durationMsByLevel.1 must be finite and positive'],
    ['level above five', (tuning: Mutable<GameTuning>) => {
      tuning.orbCores.echo.replay.fromLevel = 6;
    }, 'orbCores.echo.replay.fromLevel must be at most 5'],
  ])('rejects invalid core tuning: %s', (_name, mutate, message) => {
    const tuning = mutableTuning();
    mutate(tuning);

    expect(() => validateGameTuning(tuning)).toThrow(message);
  });

  it('rejects invalid reward-flow timing', () => {
    const tuning = mutableTuning();
    tuning.rewardFlow.resumeGameplayMs = Number.NaN;
    expect(() => validateGameTuning(tuning)).toThrow(
      'rewardFlow.resumeGameplayMs must be finite',
    );
  });

  it.each([
    ['non-positive enemy speed', (value: Mutable<GameTuning>) => { value.enemies.descentSpeed = 0; }],
    ['non-eight-column formation grid', (value: Mutable<GameTuning>) => {
      value.encounter.grid.columns = 7;
    }],
    ['formation gap outside its cells', (value: Mutable<GameTuning>) => {
      value.encounter.grid.gap = value.encounter.grid.cellWidth;
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
    ['boss area damage scale above one', (value: Mutable<GameTuning>) => {
      value.bossAreaDamage.secondaryDamageScale = 1.1;
    }],
    ['fractional boss area target count', (value: Mutable<GameTuning>) => {
      value.bossAreaDamage.maxSecondaryTargets = 1.5;
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
    ['non-positive hive enrage timing', (value: Mutable<GameTuning>) => {
      value.projectiles.hiveEnrage.fan.intervalMs = 0;
    }],
    ['non-finite hive enrage speed', (value: Mutable<GameTuning>) => {
      value.projectiles.hiveEnrage.aimedBurst.speed = Number.NaN;
    }],
    ['fractional hive enrage count', (value: Mutable<GameTuning>) => {
      value.projectiles.hiveEnrage.fan.count = 1.5;
    }],
    ['negative hive enrage angle', (value: Mutable<GameTuning>) => {
      value.projectiles.hiveEnrage.fan.alternatingOffsetDegrees = -1;
    }],
    ['invalid temporary orb cap', (value: Mutable<GameTuning>) => {
      value.temporaryOrbs.cap = 0;
    }],
    ['invalid temporary orb lifetime', (value: Mutable<GameTuning>) => {
      value.temporaryOrbs.lifetimeMs = -1;
    }],
    ['build explosion chance above one', (value: Mutable<GameTuning>) => {
      value.build.explosion.chance = 1.1;
    }],
    ['non-finite build explosion chance', (value: Mutable<GameTuning>) => {
      value.build.explosion.chance = Number.NaN;
    }],
    ['fractional build split count', (value: Mutable<GameTuning>) => {
      value.build.split.count = 1.5;
    }],
    ['corrosion tick longer than its field', (value: Mutable<GameTuning>) => {
      value.orbCores.corrosion.durationMs = value.orbCores.corrosion.tickMs - 1;
    }],
    ['non-positive temporary orb base damage', (value: Mutable<GameTuning>) => {
      value.temporaryOrbs.baseDamage = 0;
    }],
    ['non-finite relic value', (value: Mutable<GameTuning>) => {
      value.relics.crossCut.damageScale = Number.NaN;
    }],
    ['non-finite obstacle padding', (value: Mutable<GameTuning>) => {
      value.boss.movement.obstaclePadding = Number.POSITIVE_INFINITY;
    }],
    ['non-finite boss y', (value: Mutable<GameTuning>) => { value.boss.y = Number.NaN; }],
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

  it('accepts all-enemy boss entry cleanup', () => {
    const tuning = mutableTuning();
    tuning.encounter.bossEntry.cleanupMode = 'all';
    expect(() => validateGameTuning(tuning)).not.toThrow();
  });
});
