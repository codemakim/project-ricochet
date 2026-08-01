import { GAME_HEIGHT, GAME_WIDTH, PLAYER_MIN_Y } from '../constants';

export interface RangeTuning { minimum: number; maximum: number }
export type BossKind = 'sentinel' | 'hive' | 'siege';
type FiveLevelValues = readonly [number, number, number, number, number];

export interface ProjectileVisualTuning {
  fill: number;
  accent: number;
  width: number;
  height: number;
}

export interface GameTuning {
  boss: {
    y: number;
    body: { width: number; height: number };
    weakpoint: {
      visual: { width: number; height: number };
      hitbox: { width: number; height: number };
      edgeOverlap: number;
      hp: number;
    };
    core: { visualSize: number; hitboxSize: number; hp: number };
    movement: { maxSpeed: number; minimumTurnSpeed: number; obstaclePadding: number; enemyHalfSize: number };
    majorIntervalsMs: { twoWeakpoints: number; oneWeakpoint: number; core: number };
  };
  enemies: {
    descentSpeed: number;
    hp: { basic: number; shooter: number; armored: number; splitter: number; fragment: number };
    shooter: { intervalMs: number; warningMs: number; bulletSpeed: number; damage: number };
    splitter: {
      width: number;
      height: number;
      fragmentOffsetX: number;
      populationCost: number;
      score: number;
      xp: number;
      breachDamage: number;
    };
    fragment: {
      width: number;
      height: number;
      populationCost: number;
      score: number;
      xp: number;
      breachDamage: number;
    };
  };
  encounter: {
    reinforcementReleaseY: number;
    bossEntry: {
      cleanupMode: 'corridor' | 'all';
      padding: number;
    };
    grid: {
      columns: number;
      left: number;
      cellWidth: number;
      cellHeight: number;
      gap: number;
    };
  };
  rewardFlow: {
    resumeGameplayMs: number;
    mixedCards: {
      maximumCards: number;
      early: { maximumOrbs: number; orbCards: number; abilityCards: number };
      growing: { maximumOrbs: number; orbCards: number; abilityCards: number };
      full: { orbUpgradeCards: number; minimumAbilityCards: number };
    };
  };
  projectiles: {
    hostileCap: number;
    offscreenMargin: number;
    bossBasic: { intervalMs: number; warningMs: number; speed: number; damage: number; radius: number };
    bossAimed: { warningMs: number; speed: number; damage: number; radius: number; count: number; spreadDegrees: number };
    bossSupport: { warningMs: number; speed: number; damage: number; width: number; height: number };
    hiveShooter: { intervalMs: number; offsetMs: number; warningMs: number; speed: number; damage: number; radius: number };
    hiveCore: { intervalMs: number; speed: number; damage: number; radius: number; count: number; arcDegrees: number; offsetDegrees: number };
    hiveEnrage: {
      fan: {
        intervalMs: number; warningMs: number; speed: number; damage: number; radius: number;
        count: number; arcDegrees: number; alternatingOffsetDegrees: number;
      };
      aimedBurst: {
        intervalMs: number; warningMs: number; speed: number; damage: number; radius: number;
        count: number; spreadDegrees: number;
      };
    };
    siegeLaser: {
      intervalMs: number;
      warningMs: number;
      activeMs: number;
      speed: number;
      damage: number;
      width: number;
    };
  };
  build: {
    conditionalDamageCap: number;
    firepower: { damageBonusPerRank: number };
    kinetic: { speedBonusPerRank: number };
    nearAmplification: { distance: number; damageBonusPerRank: number };
    precisionHit: { damageBonusPerRank: number };
    kineticConversion: {
      speedStep: number;
      damageBonusPerStepPerRank: number;
      maxDamageBonus: number;
    };
    wallAcceleration: { speedBonusPerStack: number; maxStacks: number };
    cutter: {
      chance: number;
      cooldownMs: number;
      thickness: number;
      damage: number;
    };
    destructionReaction: {
      chance: number;
      cooldownMs: number;
      radius: number;
      damage: number;
    };
    microMissile: { hitsRequired: number; travelMs: number; damage: number };
    recoveryShockwave: {
      recoveriesRequired: number;
      radius: number;
      damageByRank: readonly [number, number];
    };
    basicGrowth: {
      maximumOrbs: number;
      orbRadiusBonusPerRank: number;
      recoveryRadiusPerRank: number;
      playerSpeedBonusPerRank: number;
      healthPerRank: number;
    };
    directHitFlight: {
      reloadDamageBonusPerRank: number;
      consecutiveDamageBonus: number;
      killOverclockDurationMs: number;
      killOverclockBonusPerRank: number;
      collisionAccelerationDurationMs: number;
      collisionAccelerationSpeedPerRank: number;
      trackingDurationMs: number;
      trackingRadiusPerRank: number;
      highSpeedImpact: {
        speedRatio: number;
        hitsRequired: number;
        radius: number;
        damage: number;
      };
    };
    effectModifiers: {
      procChancePerRank: number;
      secondaryDamagePerRank: number;
      circularRadiusPerRank: number;
      durationPerRank: number;
      cutterThicknessPerRank: number;
      fragmentCountPerRank: number;
      fragmentDamagePerRank: number;
      fragmentLifetimeMsPerRank: number;
      conductionTargetsPerRank: number;
    };
    explosion: {
      chance: number;
      cooldownMs: number;
      radius: number;
      damage: number;
    };
    split: { chance: number; cooldownMs: number; count: number };
  };
  orbCores: {
    echo: {
      maxStacks: number;
      damageBonusPerStack: number;
      maxStacksByLevel: FiveLevelValues;
      damageBonusPerStackByLevel: FiveLevelValues;
      shockwave: { fromLevel: number; radius: number; damage: number };
      cutter: {
        fromLevel: number;
        chance: number;
        damage: number;
        thickness: number;
        cooldownMs: number;
      };
      replay: { fromLevel: number; damage: number; thickness: number; pointCap: number };
      fill: number;
      accent: number;
    };
    corrosion: {
      chance: number;
      cooldownMs: number;
      radius: number;
      durationMs: number;
      tickMs: number;
      damagePerTick: number;
      fieldLimitPerOrb: number;
      globalFieldLimit: number;
      chanceByLevel: FiveLevelValues;
      radiusByLevel: FiveLevelValues;
      durationMsByLevel: FiveLevelValues;
      attachedFromLevel: number;
      vulnerability: {
        fromLevel: number;
        damageBonusPerStack: number;
        maximumStacks: number;
      };
      deathSpread: {
        fromLevel: number;
        radius: number;
        durationMs: number;
        damagePerTick: number;
      };
      fill: number;
      accent: number;
    };
    conduction: {
      targetCount: number;
      radius: number;
      damage: number;
      targetCountByLevel: FiveLevelValues;
      radiusByLevel: FiveLevelValues;
      directDamageByLevel: FiveLevelValues;
      flight: {
        fromLevel: number;
        targetCountByLevel: FiveLevelValues;
        tickMsByLevel: FiveLevelValues;
        damageByLevel: FiveLevelValues;
      };
      overcharge: { fromLevel: number; damage: number };
      fill: number;
      accent: number;
    };
    inertia: {
      maxStacks: number;
      speedBonusPerStack: number;
      baseSpeedMultiplierByLevel: FiveLevelValues;
      damagePerSpeedStepByLevel: FiveLevelValues;
      maximumDamageBonusByLevel: FiveLevelValues;
      speedStep: number;
      shockwave: { fromLevel: number; radius: number; damage: number };
      topSpeedHold: { fromLevel: number; durationMs: number };
      pierce: {
        fromLevel: number;
        enemyCount: number;
        explosionRadius: number;
        explosionDamage: number;
      };
      fill: number;
      accent: number;
    };
    split: {
      chanceByLevel: FiveLevelValues;
      countByLevel: FiveLevelValues;
      extraBouncesByLevel: FiveLevelValues;
      lifetimeMsByLevel: FiveLevelValues;
      inheritedEffects: { fromLevel: number; outputScale: number };
      genericSynergy: { chanceBonus: number; countBonus: number };
      fill: number;
      accent: number;
    };
    explosion: {
      chanceByLevel: FiveLevelValues;
      damageByLevel: FiveLevelValues;
      radiusByLevel: FiveLevelValues;
      pity: { fromLevel: number; chancePerFailure: number; maximumFailures: number };
      centerBlast: { fromLevel: number; radius: number; damageMultiplier: number };
      genericSynergy: { chanceBonus: number; damageMultiplier: number };
      fill: number;
      accent: number;
    };
  };
  temporaryOrbs: {
    radius: number;
    speed: number;
    cap: number;
    lifetimeMs: number;
    hitCooldownMs: number;
    baseDamage: number;
  };
  bossAreaDamage: { secondaryDamageScale: number; maxSecondaryTargets: number };
  hiveBoss: {
    core: { x: number; y: number; visualSize: number; hitboxSize: number; hp: number };
    shooter: { width: number; height: number; hp: number };
    reflector: {
      width: number;
      height: number;
      y: number;
      hp: number;
      leftTravel: RangeTuning;
      rightTravel: RangeTuning;
      speed: number;
      hitCooldownMs: number;
      minimumCorridorWidth: number;
    };
    timing: { shieldedMs: number; telegraphMs: number; exposedMs: number };
  };
  siegeBoss: { defenseHp: number; damageTakenScale: number; movementSpeedScale: number };
  relics: {
    auxiliaryLink: { procScale: number };
    crossCut: { damageScale: number };
    gasIgnition: { remainingDamageFraction: number };
    recursiveSplit: { chance: number; childCount: number };
    inertiaRetention: { directHits: number };
    directLink: { overchargeScale: number };
    superconductingCircuit: { targetBonus: number; damageBonus: number };
    resonanceRupture: { radius: number; damage: number };
  };
  visual: {
    friendly: { permanentOrb: ProjectileVisualTuning; temporaryOrb: ProjectileVisualTuning };
    coreFeedback: {
      corrosionFieldAlpha: number;
      corrosionLineAlpha: number;
      corrosionTickDurationMs: number;
      corrosionDamageNumberDurationMs: number;
      conductionDurationMs: number;
    };
    triggerFeedback: {
      durationMs: number;
      laserColor: number;
      destructionColor: number;
      missileColor: number;
      shockwaveColor: number;
    };
    hostile: {
      enemyBullet: ProjectileVisualTuning;
      bossBasic: ProjectileVisualTuning;
      bossAimed: ProjectileVisualTuning;
      bossHazard: ProjectileVisualTuning;
      bossMuzzleFlash: ProjectileVisualTuning;
    };
  };
}

const ORB_CORE_LEVEL_TUNING = {
  echo: {
    maxStacksByLevel: [5, 7, 7, 9, 9],
    damageBonusPerStackByLevel: [0.08, 0.1, 0.1, 0.12, 0.12],
  },
  corrosion: {
    chanceByLevel: [0.15, 0.18, 0.18, 0.22, 0.22],
    radiusByLevel: [42, 50, 50, 58, 58],
    durationMsByLevel: [2500, 3000, 3000, 3500, 3500],
  },
  conduction: {
    targetCountByLevel: [1, 2, 2, 3, 3],
    radiusByLevel: [120, 150, 150, 180, 180],
    directDamageByLevel: [0.25, 0.3, 0.3, 0.35, 0.35],
    flightTargetCountByLevel: [0, 0, 1, 2, 2],
    flightTickMsByLevel: [0, 0, 600, 400, 400],
    flightDamageByLevel: [0, 0, 0.08, 0.1, 0.1],
  },
  inertia: {
    baseSpeedMultiplierByLevel: [1, 1.08, 1.08, 1.15, 1.15],
    damagePerSpeedStepByLevel: [0.04, 0.05, 0.05, 0.06, 0.06],
    maximumDamageBonusByLevel: [0.24, 0.32, 0.32, 0.42, 0.42],
  },
  split: {
    chanceByLevel: [0.22, 0.3, 0.3, 0.35, 0.35],
    countByLevel: [2, 2, 2, 3, 3],
    extraBouncesByLevel: [0, 0, 1, 1, 1],
    lifetimeMsByLevel: [1500, 1500, 1500, 1900, 1900],
  },
  explosion: {
    chanceByLevel: [0.2, 0.2, 0.2, 0.2, 0.2],
    damageByLevel: [0.45, 0.6, 0.6, 0.75, 0.75],
    radiusByLevel: [48, 48, 48, 58, 58],
  },
} as const;

export const GAME_TUNING = {
  boss: {
    y: 120,
    body: { width: 176, height: 96 },
    weakpoint: {
      visual: { width: 18, height: 48 },
      hitbox: { width: 22, height: 52 },
      edgeOverlap: 5,
      hp: 14,
    },
    core: { visualSize: 32, hitboxSize: 28, hp: 36 },
    movement: { maxSpeed: 35, minimumTurnSpeed: 15, obstaclePadding: 12, enemyHalfSize: 22 },
    majorIntervalsMs: { twoWeakpoints: 2800, oneWeakpoint: 2300, core: 1900 },
  },
  enemies: {
    descentSpeed: 8,
    hp: { basic: 3, shooter: 4, armored: 10, splitter: 7, fragment: 2 },
    shooter: { intervalMs: 1300, warningMs: 350, bulletSpeed: 180, damage: 1 },
    splitter: { width: 38, height: 30, fragmentOffsetX: 12, populationCost: 2, score: 2, xp: 1, breachDamage: 3 },
    fragment: { width: 22, height: 18, populationCost: 1, score: 0, xp: 1, breachDamage: 1 },
  },
  encounter: {
    reinforcementReleaseY: 50,
    bossEntry: { cleanupMode: 'corridor' as 'corridor' | 'all', padding: 8 },
    grid: { columns: 8, left: 17, cellWidth: 52, cellHeight: 48, gap: 4 },
  },
  rewardFlow: {
    resumeGameplayMs: 300,
    mixedCards: {
      maximumCards: 3,
      early: { maximumOrbs: 2, orbCards: 2, abilityCards: 1 },
      growing: { maximumOrbs: 5, orbCards: 1, abilityCards: 2 },
      full: { orbUpgradeCards: 2, minimumAbilityCards: 1 },
    },
  },
  projectiles: {
    hostileCap: 12,
    offscreenMargin: 20,
    bossBasic: { intervalMs: 900, warningMs: 150, speed: 150, damage: 1, radius: 5 },
    bossAimed: { warningMs: 600, speed: 220, damage: 1, radius: 5, count: 3, spreadDegrees: 24 },
    bossSupport: { warningMs: 800, speed: 240, damage: 2, width: 16, height: 24 },
    hiveShooter: { intervalMs: 1400, offsetMs: 700, warningMs: 300, speed: 170, damage: 1, radius: 5 },
    hiveCore: { intervalMs: 7000, speed: 140, damage: 1, radius: 5, count: 5, arcDegrees: 72, offsetDegrees: 0 },
    hiveEnrage: {
      fan: {
        intervalMs: 2800, warningMs: 350, speed: 150, damage: 1, radius: 5,
        count: 9, arcDegrees: 96, alternatingOffsetDegrees: 6,
      },
      aimedBurst: {
        intervalMs: 1600, warningMs: 350, speed: 190, damage: 1, radius: 5,
        count: 3, spreadDegrees: 18,
      },
    },
    siegeLaser: {
      intervalMs: 5_000,
      warningMs: 700,
      activeMs: 1_800,
      speed: 70,
      damage: 2,
      width: 18,
    },
  },
  build: {
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
      chance: 0.25,
      cooldownMs: 120,
      radius: 56,
      damage: 0.8,
    },
    microMissile: { hitsRequired: 6, travelMs: 180, damage: 1.2 },
    recoveryShockwave: {
      recoveriesRequired: 4,
      radius: 72,
      damageByRank: [0.75, 1.25],
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
      killOverclockDurationMs: 2_000,
      killOverclockBonusPerRank: 0.08,
      collisionAccelerationDurationMs: 800,
      collisionAccelerationSpeedPerRank: 0.08,
      trackingDurationMs: 1_200,
      trackingRadiusPerRank: 16,
      highSpeedImpact: {
        speedRatio: 1.3,
        hitsRequired: 5,
        radius: 44,
        damage: 0.65,
      },
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
  },
  orbCores: {
    echo: {
      ...ORB_CORE_LEVEL_TUNING.echo,
      maxStacks: ORB_CORE_LEVEL_TUNING.echo.maxStacksByLevel[0],
      damageBonusPerStack: ORB_CORE_LEVEL_TUNING.echo.damageBonusPerStackByLevel[0],
      shockwave: { fromLevel: 3, radius: 44, damage: 0.5 },
      cutter: {
        fromLevel: 4,
        chance: 0.1,
        damage: 0.45,
        thickness: 10,
        cooldownMs: 120,
      },
      replay: { fromLevel: 5, damage: 0.65, thickness: 12, pointCap: 8 },
      fill: 0x74c8ff,
      accent: 0xeaf8ff,
    },
    corrosion: {
      ...ORB_CORE_LEVEL_TUNING.corrosion,
      chance: ORB_CORE_LEVEL_TUNING.corrosion.chanceByLevel[0],
      cooldownMs: 120,
      radius: ORB_CORE_LEVEL_TUNING.corrosion.radiusByLevel[0],
      durationMs: ORB_CORE_LEVEL_TUNING.corrosion.durationMsByLevel[0],
      tickMs: 500,
      damagePerTick: 0.2,
      fieldLimitPerOrb: 2,
      globalFieldLimit: 12,
      attachedFromLevel: 3,
      vulnerability: { fromLevel: 4, damageBonusPerStack: 0.05, maximumStacks: 3 },
      deathSpread: { fromLevel: 5, radius: 32, durationMs: 1500, damagePerTick: 0.15 },
      fill: 0x9be564,
      accent: 0xe8ffc8,
    },
    conduction: {
      targetCountByLevel: ORB_CORE_LEVEL_TUNING.conduction.targetCountByLevel,
      radiusByLevel: ORB_CORE_LEVEL_TUNING.conduction.radiusByLevel,
      directDamageByLevel: ORB_CORE_LEVEL_TUNING.conduction.directDamageByLevel,
      targetCount: 2,
      radius: 150,
      damage: 0.45,
      flight: {
        fromLevel: 3,
        targetCountByLevel: ORB_CORE_LEVEL_TUNING.conduction.flightTargetCountByLevel,
        tickMsByLevel: ORB_CORE_LEVEL_TUNING.conduction.flightTickMsByLevel,
        damageByLevel: ORB_CORE_LEVEL_TUNING.conduction.flightDamageByLevel,
      },
      overcharge: { fromLevel: 5, damage: 0.35 },
      fill: 0xc58cff,
      accent: 0xf3e8ff,
    },
    inertia: {
      ...ORB_CORE_LEVEL_TUNING.inertia,
      maxStacks: 3,
      speedBonusPerStack: 0.1,
      speedStep: 0.1,
      shockwave: { fromLevel: 3, radius: 42, damage: 0.5 },
      topSpeedHold: { fromLevel: 4, durationMs: 800 },
      pierce: {
        fromLevel: 5,
        enemyCount: 1,
        explosionRadius: 40,
        explosionDamage: 0.6,
      },
      fill: 0xffbd59,
      accent: 0xfff0c2,
    },
    split: {
      ...ORB_CORE_LEVEL_TUNING.split,
      inheritedEffects: { fromLevel: 5, outputScale: 0.35 },
      genericSynergy: { chanceBonus: 0.08, countBonus: 1 },
      fill: 0x52d6b4,
      accent: 0xd8fff4,
    },
    explosion: {
      ...ORB_CORE_LEVEL_TUNING.explosion,
      pity: { fromLevel: 3, chancePerFailure: 0.05, maximumFailures: 4 },
      centerBlast: { fromLevel: 5, radius: 24, damageMultiplier: 2 },
      genericSynergy: { chanceBonus: 0.08, damageMultiplier: 1.2 },
      fill: 0xff8f3d,
      accent: 0xffe4ad,
    },
  },
  temporaryOrbs: {
    radius: 6,
    speed: 440,
    cap: 30,
    lifetimeMs: 1500,
    hitCooldownMs: 80,
    baseDamage: 0.4,
  },
  bossAreaDamage: { secondaryDamageScale: 0.5, maxSecondaryTargets: 1 },
  hiveBoss: {
    core: { x: 225, y: 140, visualSize: 112, hitboxSize: 96, hp: 120 },
    shooter: { width: 68, height: 56, hp: 20 },
    reflector: {
      width: 36,
      height: 192,
      y: 280,
      hp: 24,
      leftTravel: { minimum: 70, maximum: 130 },
      rightTravel: { minimum: 320, maximum: 380 },
      speed: 30,
      hitCooldownMs: 80,
      minimumCorridorWidth: 96,
    },
    timing: { shieldedMs: 4000, telegraphMs: 1500, exposedMs: 7000 },
  },
  siegeBoss: { defenseHp: 60, damageTakenScale: 0.45, movementSpeedScale: 0.6 },
  relics: {
    auxiliaryLink: { procScale: 0.25 },
    crossCut: { damageScale: 0.6 },
    gasIgnition: { remainingDamageFraction: 0.5 },
    recursiveSplit: { chance: 0.2, childCount: 1 },
    inertiaRetention: { directHits: 2 },
    directLink: { overchargeScale: 0.3 },
    superconductingCircuit: { targetBonus: 1, damageBonus: 0.2 },
    resonanceRupture: { radius: 44, damage: 0.65 },
  },
  visual: {
    friendly: {
      permanentOrb: { fill: 0xffffff, accent: 0x4ddcff, width: 16, height: 16 },
      temporaryOrb: { fill: 0x8cf7ff, accent: 0x167d9a, width: 12, height: 12 },
    },
    coreFeedback: {
      corrosionFieldAlpha: 0.16,
      corrosionLineAlpha: 0.7,
      corrosionTickDurationMs: 160,
      corrosionDamageNumberDurationMs: 260,
      conductionDurationMs: 180,
    },
    triggerFeedback: {
      durationMs: 180,
      laserColor: 0x65f6ff,
      destructionColor: 0xff8e55,
      missileColor: 0xffd45c,
      shockwaveColor: 0x8cf7ff,
    },
    hostile: {
      enemyBullet: { fill: 0xff4d5a, accent: 0x4a0710, width: 10, height: 10 },
      bossBasic: { fill: 0xff704d, accent: 0x4a0710, width: 10, height: 10 },
      bossAimed: { fill: 0xff704d, accent: 0x4a0710, width: 10, height: 10 },
      bossHazard: { fill: 0xff7b55, accent: 0x4a0710, width: 16, height: 24 },
      bossMuzzleFlash: { fill: 0xff704d, accent: 0xffd6a3, width: 20, height: 20 },
    },
  },
} as const satisfies GameTuning;

function positive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be finite and positive`);
}

function finite(value: number, name: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
}

function nonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be finite and non-negative`);
  }
}

function probability(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be between zero and one`);
  }
}

function nonNegativeInteger(value: number, name: string): void {
  nonNegative(value, name);
  if (!Number.isInteger(value)) throw new RangeError(`${name} must be an integer`);
}

function positiveInteger(value: number, name: string): void {
  positive(value, name);
  if (!Number.isInteger(value)) throw new RangeError(`${name} must be an integer`);
}

function levelCurve(
  values: FiveLevelValues,
  name: string,
  validate: (value: number, name: string) => void,
): void {
  if (values.length !== 5) throw new RangeError(`${name} must contain 5 values`);
  values.forEach((value, level) => validate(value, `${name}.${level + 1}`));
}

function coreLevel(value: number, name: string): void {
  positiveInteger(value, name);
  if (value > 5) throw new RangeError(`${name} must be at most 5`);
}

interface RectBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function rectBounds(
  x: number,
  y: number,
  width: number,
  height: number,
): RectBounds {
  return {
    left: x - width / 2,
    right: x + width / 2,
    top: y - height / 2,
    bottom: y + height / 2,
  };
}

function rectsOverlap(left: RectBounds, right: RectBounds): boolean {
  return left.left < right.right
    && left.right > right.left
    && left.top < right.bottom
    && left.bottom > right.top;
}

export function validateGameTuning(tuning: GameTuning): void {
  const {
    boss, enemies, encounter, rewardFlow, projectiles, build, orbCores, temporaryOrbs,
    bossAreaDamage, hiveBoss, relics, visual,
  } = tuning;
  finite(boss.y, 'boss.y');
  positive(boss.body.width, 'boss.body.width');
  positive(boss.body.height, 'boss.body.height');
  positive(boss.weakpoint.visual.width, 'boss.weakpoint.visual.width');
  positive(boss.weakpoint.visual.height, 'boss.weakpoint.visual.height');
  positive(boss.weakpoint.hitbox.width, 'boss.weakpoint.hitbox.width');
  positive(boss.weakpoint.hitbox.height, 'boss.weakpoint.hitbox.height');
  positive(boss.weakpoint.edgeOverlap, 'boss.weakpoint.edgeOverlap');
  positive(boss.weakpoint.hp, 'boss.weakpoint.hp');
  positive(boss.core.visualSize, 'boss.core.visualSize');
  positive(boss.core.hitboxSize, 'boss.core.hitboxSize');
  positive(boss.core.hp, 'boss.core.hp');
  positive(boss.movement.maxSpeed, 'boss.movement.maxSpeed');
  positive(boss.movement.minimumTurnSpeed, 'boss.movement.minimumTurnSpeed');
  nonNegative(boss.movement.obstaclePadding, 'boss.movement.obstaclePadding');
  positive(boss.movement.enemyHalfSize, 'boss.movement.enemyHalfSize');
  if (boss.movement.minimumTurnSpeed > boss.movement.maxSpeed) {
    throw new RangeError('boss minimum turn speed must not exceed max speed');
  }
  for (const [phase, interval] of Object.entries(boss.majorIntervalsMs)) {
    positive(interval, `boss.majorIntervalsMs.${phase}`);
  }
  positive(enemies.descentSpeed, 'enemies.descentSpeed');
  for (const [kind, hp] of Object.entries(enemies.hp)) positive(hp, `enemies.hp.${kind}`);
  positive(enemies.shooter.intervalMs, 'enemies.shooter.intervalMs');
  positive(enemies.shooter.warningMs, 'enemies.shooter.warningMs');
  positive(enemies.shooter.bulletSpeed, 'enemies.shooter.bulletSpeed');
  positive(enemies.shooter.damage, 'enemies.shooter.damage');
  for (const [kind, enemy] of Object.entries({ splitter: enemies.splitter, fragment: enemies.fragment })) {
    positive(enemy.width, `enemies.${kind}.width`);
    positive(enemy.height, `enemies.${kind}.height`);
    positiveInteger(enemy.populationCost, `enemies.${kind}.populationCost`);
    nonNegative(enemy.score, `enemies.${kind}.score`);
    nonNegative(enemy.xp, `enemies.${kind}.xp`);
    positive(enemy.breachDamage, `enemies.${kind}.breachDamage`);
  }
  positive(enemies.splitter.fragmentOffsetX, 'enemies.splitter.fragmentOffsetX');
  finite(encounter.reinforcementReleaseY, 'encounter.reinforcementReleaseY');
  if (encounter.bossEntry.cleanupMode !== 'corridor'
    && encounter.bossEntry.cleanupMode !== 'all') {
    throw new RangeError('encounter.bossEntry.cleanupMode must be corridor or all');
  }
  nonNegative(encounter.bossEntry.padding, 'encounter.bossEntry.padding');
  positiveInteger(encounter.grid.columns, 'encounter.grid.columns');
  nonNegative(encounter.grid.left, 'encounter.grid.left');
  positiveInteger(encounter.grid.cellWidth, 'encounter.grid.cellWidth');
  positiveInteger(encounter.grid.cellHeight, 'encounter.grid.cellHeight');
  positiveInteger(encounter.grid.gap, 'encounter.grid.gap');
  if (encounter.grid.columns !== 8) {
    throw new RangeError('encounter.grid.columns must equal eight');
  }
  if (encounter.grid.gap >= encounter.grid.cellWidth
    || encounter.grid.gap >= encounter.grid.cellHeight) {
    throw new RangeError('encounter.grid.gap must fit inside its cells');
  }
  if (!(encounter.reinforcementReleaseY < PLAYER_MIN_Y)) {
    throw new RangeError('encounter reinforcement release must be below PLAYER_MIN_Y');
  }
  nonNegative(rewardFlow.resumeGameplayMs, 'rewardFlow.resumeGameplayMs');
  const mixedCards = rewardFlow.mixedCards;
  positiveInteger(mixedCards.maximumCards, 'rewardFlow.mixedCards.maximumCards');
  positiveInteger(mixedCards.early.maximumOrbs, 'rewardFlow.mixedCards.early.maximumOrbs');
  positiveInteger(
    mixedCards.growing.maximumOrbs,
    'rewardFlow.mixedCards.growing.maximumOrbs',
  );
  for (const [name, row] of Object.entries({
    early: mixedCards.early,
    growing: mixedCards.growing,
  })) {
    nonNegativeInteger(row.orbCards, `rewardFlow.mixedCards.${name}.orbCards`);
    nonNegativeInteger(row.abilityCards, `rewardFlow.mixedCards.${name}.abilityCards`);
    if (row.orbCards + row.abilityCards > mixedCards.maximumCards) {
      throw new RangeError(`rewardFlow.mixedCards.${name} must fit maximumCards`);
    }
  }
  nonNegativeInteger(
    mixedCards.full.orbUpgradeCards,
    'rewardFlow.mixedCards.full.orbUpgradeCards',
  );
  positiveInteger(
    mixedCards.full.minimumAbilityCards,
    'rewardFlow.mixedCards.full.minimumAbilityCards',
  );
  if (
    mixedCards.full.orbUpgradeCards + mixedCards.full.minimumAbilityCards
      > mixedCards.maximumCards
  ) {
    throw new RangeError('rewardFlow.mixedCards.full must fit maximumCards');
  }
  if (
    mixedCards.early.maximumOrbs >= mixedCards.growing.maximumOrbs
    || mixedCards.growing.maximumOrbs >= build.basicGrowth.maximumOrbs
  ) {
    throw new RangeError(
      'rewardFlow.mixedCards orb bands must increase below the orb cap',
    );
  }
  const weakpointOffset = (boss.body.width + boss.weakpoint.visual.width) / 2
    - boss.weakpoint.edgeOverlap;
  const collisionWidth = 2 * (weakpointOffset + boss.weakpoint.hitbox.width / 2);
  if (collisionWidth >= GAME_WIDTH) throw new RangeError('boss collision width must fit GAME_WIDTH');
  if (boss.y - boss.body.height / 2 < 0 || boss.y + boss.body.height / 2 > GAME_HEIGHT) {
    throw new RangeError('boss body must fit GAME_HEIGHT');
  }
  positiveInteger(projectiles.hostileCap, 'projectiles.hostileCap');
  positive(projectiles.offscreenMargin, 'projectiles.offscreenMargin');
  for (const [name, projectile] of Object.entries({
    bossBasic: projectiles.bossBasic,
    bossAimed: projectiles.bossAimed,
    bossSupport: projectiles.bossSupport,
    hiveShooter: projectiles.hiveShooter,
    hiveCore: projectiles.hiveCore,
    hiveEnrageFan: projectiles.hiveEnrage.fan,
    hiveEnrageAimedBurst: projectiles.hiveEnrage.aimedBurst,
  })) {
    positive(projectile.speed, `projectiles.${name}.speed`);
    positive(projectile.damage, `projectiles.${name}.damage`);
  }
  positive(projectiles.bossBasic.warningMs, 'projectiles.bossBasic.warningMs');
  positive(projectiles.bossAimed.warningMs, 'projectiles.bossAimed.warningMs');
  positive(projectiles.bossSupport.warningMs, 'projectiles.bossSupport.warningMs');
  positive(projectiles.hiveShooter.intervalMs, 'projectiles.hiveShooter.intervalMs');
  nonNegative(projectiles.hiveShooter.offsetMs, 'projectiles.hiveShooter.offsetMs');
  positive(projectiles.hiveShooter.warningMs, 'projectiles.hiveShooter.warningMs');
  positive(projectiles.hiveShooter.radius, 'projectiles.hiveShooter.radius');
  positive(projectiles.hiveCore.intervalMs, 'projectiles.hiveCore.intervalMs');
  positive(projectiles.hiveCore.radius, 'projectiles.hiveCore.radius');
  positive(projectiles.bossBasic.intervalMs, 'projectiles.bossBasic.intervalMs');
  positive(projectiles.bossBasic.radius, 'projectiles.bossBasic.radius');
  positive(projectiles.bossAimed.radius, 'projectiles.bossAimed.radius');
  positive(projectiles.bossSupport.width, 'projectiles.bossSupport.width');
  positive(projectiles.bossSupport.height, 'projectiles.bossSupport.height');
  positiveInteger(projectiles.bossAimed.count, 'projectiles.bossAimed.count');
  finite(projectiles.bossAimed.spreadDegrees, 'projectiles.bossAimed.spreadDegrees');
  positiveInteger(projectiles.hiveCore.count, 'projectiles.hiveCore.count');
  finite(projectiles.hiveCore.arcDegrees, 'projectiles.hiveCore.arcDegrees');
  finite(projectiles.hiveCore.offsetDegrees, 'projectiles.hiveCore.offsetDegrees');
  positive(projectiles.hiveEnrage.fan.intervalMs, 'projectiles.hiveEnrage.fan.intervalMs');
  positive(projectiles.hiveEnrage.fan.warningMs, 'projectiles.hiveEnrage.fan.warningMs');
  positive(projectiles.hiveEnrage.fan.radius, 'projectiles.hiveEnrage.fan.radius');
  positiveInteger(projectiles.hiveEnrage.fan.count, 'projectiles.hiveEnrage.fan.count');
  nonNegative(projectiles.hiveEnrage.fan.arcDegrees, 'projectiles.hiveEnrage.fan.arcDegrees');
  nonNegative(
    projectiles.hiveEnrage.fan.alternatingOffsetDegrees,
    'projectiles.hiveEnrage.fan.alternatingOffsetDegrees',
  );
  positive(projectiles.hiveEnrage.aimedBurst.intervalMs, 'projectiles.hiveEnrage.aimedBurst.intervalMs');
  positive(projectiles.hiveEnrage.aimedBurst.warningMs, 'projectiles.hiveEnrage.aimedBurst.warningMs');
  positive(projectiles.hiveEnrage.aimedBurst.radius, 'projectiles.hiveEnrage.aimedBurst.radius');
  positiveInteger(projectiles.hiveEnrage.aimedBurst.count, 'projectiles.hiveEnrage.aimedBurst.count');
  nonNegative(projectiles.hiveEnrage.aimedBurst.spreadDegrees, 'projectiles.hiveEnrage.aimedBurst.spreadDegrees');
  for (const [id, effect] of Object.entries({
    explosion: build.explosion,
    split: build.split,
  })) {
    if (!Number.isFinite(effect.chance) || effect.chance < 0 || effect.chance > 1) {
      throw new RangeError(`build.${id}.chance must be between zero and one`);
    }
    positive(effect.cooldownMs, `build.${id}.cooldownMs`);
  }
  nonNegative(build.firepower.damageBonusPerRank, 'build.firepower.damageBonusPerRank');
  nonNegative(build.kinetic.speedBonusPerRank, 'build.kinetic.speedBonusPerRank');
  positive(build.conditionalDamageCap, 'build.conditionalDamageCap');
  positive(build.nearAmplification.distance, 'build.nearAmplification.distance');
  nonNegative(
    build.nearAmplification.damageBonusPerRank,
    'build.nearAmplification.damageBonusPerRank',
  );
  nonNegative(build.precisionHit.damageBonusPerRank, 'build.precisionHit.damageBonusPerRank');
  positive(build.kineticConversion.speedStep, 'build.kineticConversion.speedStep');
  nonNegative(
    build.kineticConversion.damageBonusPerStepPerRank,
    'build.kineticConversion.damageBonusPerStepPerRank',
  );
  nonNegative(
    build.kineticConversion.maxDamageBonus,
    'build.kineticConversion.maxDamageBonus',
  );
  nonNegative(
    build.wallAcceleration.speedBonusPerStack,
    'build.wallAcceleration.speedBonusPerStack',
  );
  positiveInteger(build.wallAcceleration.maxStacks, 'build.wallAcceleration.maxStacks');
  for (const [id, effect] of Object.entries({
    cutter: build.cutter,
    destructionReaction: build.destructionReaction,
  })) {
    if (!Number.isFinite(effect.chance) || effect.chance < 0 || effect.chance > 1) {
      throw new RangeError(`build.${id}.chance must be between zero and one`);
    }
    positive(effect.cooldownMs, `build.${id}.cooldownMs`);
    nonNegative(effect.damage, `build.${id}.damage`);
  }
  positive(build.cutter.thickness, 'build.cutter.thickness');
  positive(build.destructionReaction.radius, 'build.destructionReaction.radius');
  positiveInteger(build.microMissile.hitsRequired, 'build.microMissile.hitsRequired');
  positive(build.microMissile.travelMs, 'build.microMissile.travelMs');
  nonNegative(build.microMissile.damage, 'build.microMissile.damage');
  positiveInteger(
    build.recoveryShockwave.recoveriesRequired,
    'build.recoveryShockwave.recoveriesRequired',
  );
  positive(build.recoveryShockwave.radius, 'build.recoveryShockwave.radius');
  build.recoveryShockwave.damageByRank.forEach((damage, index) => {
    nonNegative(damage, `build.recoveryShockwave.damageByRank.${index}`);
  });
  positiveInteger(build.basicGrowth.maximumOrbs, 'build.basicGrowth.maximumOrbs');
  for (const [id, value] of Object.entries({
    ...build.basicGrowth,
    ...build.effectModifiers,
    reloadDamageBonusPerRank: build.directHitFlight.reloadDamageBonusPerRank,
    consecutiveDamageBonus: build.directHitFlight.consecutiveDamageBonus,
    killOverclockBonusPerRank: build.directHitFlight.killOverclockBonusPerRank,
    collisionAccelerationSpeedPerRank:
      build.directHitFlight.collisionAccelerationSpeedPerRank,
    trackingRadiusPerRank: build.directHitFlight.trackingRadiusPerRank,
  })) nonNegative(value, `build.${id}`);
  positive(build.directHitFlight.killOverclockDurationMs, 'build.directHitFlight.killOverclockDurationMs');
  positive(
    build.directHitFlight.collisionAccelerationDurationMs,
    'build.directHitFlight.collisionAccelerationDurationMs',
  );
  positive(build.directHitFlight.trackingDurationMs, 'build.directHitFlight.trackingDurationMs');
  positive(build.directHitFlight.highSpeedImpact.speedRatio, 'build.directHitFlight.highSpeedImpact.speedRatio');
  positiveInteger(
    build.directHitFlight.highSpeedImpact.hitsRequired,
    'build.directHitFlight.highSpeedImpact.hitsRequired',
  );
  positive(build.directHitFlight.highSpeedImpact.radius, 'build.directHitFlight.highSpeedImpact.radius');
  nonNegative(build.directHitFlight.highSpeedImpact.damage, 'build.directHitFlight.highSpeedImpact.damage');
  positive(build.explosion.radius, 'build.explosion.radius');
  nonNegative(build.explosion.damage, 'build.explosion.damage');
  positiveInteger(build.split.count, 'build.split.count');
  positiveInteger(orbCores.echo.maxStacks, 'orbCores.echo.maxStacks');
  positive(orbCores.echo.damageBonusPerStack, 'orbCores.echo.damageBonusPerStack');
  if (
    !Number.isFinite(orbCores.corrosion.chance)
    || orbCores.corrosion.chance < 0
    || orbCores.corrosion.chance > 1
  ) {
    throw new RangeError('orbCores.corrosion.chance must be between zero and one');
  }
  positive(orbCores.corrosion.cooldownMs, 'orbCores.corrosion.cooldownMs');
  positive(orbCores.corrosion.radius, 'orbCores.corrosion.radius');
  positive(orbCores.corrosion.durationMs, 'orbCores.corrosion.durationMs');
  positive(orbCores.corrosion.tickMs, 'orbCores.corrosion.tickMs');
  if (orbCores.corrosion.tickMs > orbCores.corrosion.durationMs) {
    throw new RangeError('orbCores.corrosion.tickMs must fit its duration');
  }
  positive(orbCores.corrosion.damagePerTick, 'orbCores.corrosion.damagePerTick');
  positiveInteger(orbCores.corrosion.fieldLimitPerOrb, 'orbCores.corrosion.fieldLimitPerOrb');
  positiveInteger(orbCores.corrosion.globalFieldLimit, 'orbCores.corrosion.globalFieldLimit');
  positiveInteger(orbCores.conduction.targetCount, 'orbCores.conduction.targetCount');
  positive(orbCores.conduction.radius, 'orbCores.conduction.radius');
  positive(orbCores.conduction.damage, 'orbCores.conduction.damage');
  positiveInteger(orbCores.inertia.maxStacks, 'orbCores.inertia.maxStacks');
  positive(orbCores.inertia.speedBonusPerStack, 'orbCores.inertia.speedBonusPerStack');
  levelCurve(
    orbCores.echo.maxStacksByLevel,
    'orbCores.echo.maxStacksByLevel',
    positiveInteger,
  );
  levelCurve(
    orbCores.echo.damageBonusPerStackByLevel,
    'orbCores.echo.damageBonusPerStackByLevel',
    nonNegative,
  );
  coreLevel(orbCores.echo.shockwave.fromLevel, 'orbCores.echo.shockwave.fromLevel');
  positive(orbCores.echo.shockwave.radius, 'orbCores.echo.shockwave.radius');
  nonNegative(orbCores.echo.shockwave.damage, 'orbCores.echo.shockwave.damage');
  coreLevel(orbCores.echo.cutter.fromLevel, 'orbCores.echo.cutter.fromLevel');
  probability(orbCores.echo.cutter.chance, 'orbCores.echo.cutter.chance');
  nonNegative(orbCores.echo.cutter.damage, 'orbCores.echo.cutter.damage');
  positive(orbCores.echo.cutter.thickness, 'orbCores.echo.cutter.thickness');
  positive(orbCores.echo.cutter.cooldownMs, 'orbCores.echo.cutter.cooldownMs');
  coreLevel(orbCores.echo.replay.fromLevel, 'orbCores.echo.replay.fromLevel');
  nonNegative(orbCores.echo.replay.damage, 'orbCores.echo.replay.damage');
  positive(orbCores.echo.replay.thickness, 'orbCores.echo.replay.thickness');
  positiveInteger(orbCores.echo.replay.pointCap, 'orbCores.echo.replay.pointCap');
  levelCurve(
    orbCores.corrosion.chanceByLevel,
    'orbCores.corrosion.chanceByLevel',
    probability,
  );
  levelCurve(
    orbCores.corrosion.radiusByLevel,
    'orbCores.corrosion.radiusByLevel',
    positive,
  );
  levelCurve(
    orbCores.corrosion.durationMsByLevel,
    'orbCores.corrosion.durationMsByLevel',
    positive,
  );
  coreLevel(orbCores.corrosion.attachedFromLevel, 'orbCores.corrosion.attachedFromLevel');
  coreLevel(
    orbCores.corrosion.vulnerability.fromLevel,
    'orbCores.corrosion.vulnerability.fromLevel',
  );
  nonNegative(
    orbCores.corrosion.vulnerability.damageBonusPerStack,
    'orbCores.corrosion.vulnerability.damageBonusPerStack',
  );
  positiveInteger(
    orbCores.corrosion.vulnerability.maximumStacks,
    'orbCores.corrosion.vulnerability.maximumStacks',
  );
  coreLevel(
    orbCores.corrosion.deathSpread.fromLevel,
    'orbCores.corrosion.deathSpread.fromLevel',
  );
  positive(orbCores.corrosion.deathSpread.radius, 'orbCores.corrosion.deathSpread.radius');
  positive(
    orbCores.corrosion.deathSpread.durationMs,
    'orbCores.corrosion.deathSpread.durationMs',
  );
  nonNegative(
    orbCores.corrosion.deathSpread.damagePerTick,
    'orbCores.corrosion.deathSpread.damagePerTick',
  );
  levelCurve(
    orbCores.conduction.targetCountByLevel,
    'orbCores.conduction.targetCountByLevel',
    positiveInteger,
  );
  levelCurve(
    orbCores.conduction.radiusByLevel,
    'orbCores.conduction.radiusByLevel',
    positive,
  );
  levelCurve(
    orbCores.conduction.directDamageByLevel,
    'orbCores.conduction.directDamageByLevel',
    nonNegative,
  );
  coreLevel(orbCores.conduction.flight.fromLevel, 'orbCores.conduction.flight.fromLevel');
  levelCurve(
    orbCores.conduction.flight.targetCountByLevel,
    'orbCores.conduction.flight.targetCountByLevel',
    nonNegativeInteger,
  );
  levelCurve(
    orbCores.conduction.flight.tickMsByLevel,
    'orbCores.conduction.flight.tickMsByLevel',
    nonNegative,
  );
  levelCurve(
    orbCores.conduction.flight.damageByLevel,
    'orbCores.conduction.flight.damageByLevel',
    nonNegative,
  );
  coreLevel(
    orbCores.conduction.overcharge.fromLevel,
    'orbCores.conduction.overcharge.fromLevel',
  );
  nonNegative(orbCores.conduction.overcharge.damage, 'orbCores.conduction.overcharge.damage');
  levelCurve(
    orbCores.inertia.baseSpeedMultiplierByLevel,
    'orbCores.inertia.baseSpeedMultiplierByLevel',
    positive,
  );
  levelCurve(
    orbCores.inertia.damagePerSpeedStepByLevel,
    'orbCores.inertia.damagePerSpeedStepByLevel',
    nonNegative,
  );
  levelCurve(
    orbCores.inertia.maximumDamageBonusByLevel,
    'orbCores.inertia.maximumDamageBonusByLevel',
    nonNegative,
  );
  positive(orbCores.inertia.speedStep, 'orbCores.inertia.speedStep');
  coreLevel(orbCores.inertia.shockwave.fromLevel, 'orbCores.inertia.shockwave.fromLevel');
  positive(orbCores.inertia.shockwave.radius, 'orbCores.inertia.shockwave.radius');
  nonNegative(orbCores.inertia.shockwave.damage, 'orbCores.inertia.shockwave.damage');
  coreLevel(
    orbCores.inertia.topSpeedHold.fromLevel,
    'orbCores.inertia.topSpeedHold.fromLevel',
  );
  positive(
    orbCores.inertia.topSpeedHold.durationMs,
    'orbCores.inertia.topSpeedHold.durationMs',
  );
  coreLevel(orbCores.inertia.pierce.fromLevel, 'orbCores.inertia.pierce.fromLevel');
  positiveInteger(orbCores.inertia.pierce.enemyCount, 'orbCores.inertia.pierce.enemyCount');
  positive(
    orbCores.inertia.pierce.explosionRadius,
    'orbCores.inertia.pierce.explosionRadius',
  );
  nonNegative(
    orbCores.inertia.pierce.explosionDamage,
    'orbCores.inertia.pierce.explosionDamage',
  );
  levelCurve(orbCores.split.chanceByLevel, 'orbCores.split.chanceByLevel', probability);
  levelCurve(orbCores.split.countByLevel, 'orbCores.split.countByLevel', positiveInteger);
  levelCurve(
    orbCores.split.extraBouncesByLevel,
    'orbCores.split.extraBouncesByLevel',
    nonNegativeInteger,
  );
  levelCurve(
    orbCores.split.lifetimeMsByLevel,
    'orbCores.split.lifetimeMsByLevel',
    positive,
  );
  coreLevel(
    orbCores.split.inheritedEffects.fromLevel,
    'orbCores.split.inheritedEffects.fromLevel',
  );
  probability(
    orbCores.split.inheritedEffects.outputScale,
    'orbCores.split.inheritedEffects.outputScale',
  );
  probability(
    orbCores.split.genericSynergy.chanceBonus,
    'orbCores.split.genericSynergy.chanceBonus',
  );
  nonNegativeInteger(
    orbCores.split.genericSynergy.countBonus,
    'orbCores.split.genericSynergy.countBonus',
  );
  levelCurve(
    orbCores.explosion.chanceByLevel,
    'orbCores.explosion.chanceByLevel',
    probability,
  );
  levelCurve(
    orbCores.explosion.damageByLevel,
    'orbCores.explosion.damageByLevel',
    nonNegative,
  );
  levelCurve(
    orbCores.explosion.radiusByLevel,
    'orbCores.explosion.radiusByLevel',
    positive,
  );
  coreLevel(orbCores.explosion.pity.fromLevel, 'orbCores.explosion.pity.fromLevel');
  probability(
    orbCores.explosion.pity.chancePerFailure,
    'orbCores.explosion.pity.chancePerFailure',
  );
  positiveInteger(
    orbCores.explosion.pity.maximumFailures,
    'orbCores.explosion.pity.maximumFailures',
  );
  coreLevel(
    orbCores.explosion.centerBlast.fromLevel,
    'orbCores.explosion.centerBlast.fromLevel',
  );
  positive(
    orbCores.explosion.centerBlast.radius,
    'orbCores.explosion.centerBlast.radius',
  );
  positive(
    orbCores.explosion.centerBlast.damageMultiplier,
    'orbCores.explosion.centerBlast.damageMultiplier',
  );
  probability(
    orbCores.explosion.genericSynergy.chanceBonus,
    'orbCores.explosion.genericSynergy.chanceBonus',
  );
  positive(
    orbCores.explosion.genericSynergy.damageMultiplier,
    'orbCores.explosion.genericSynergy.damageMultiplier',
  );
  const corePalettes = Object.values(orbCores).map(({ fill, accent }) => {
    finite(fill, 'orbCores.fill');
    finite(accent, 'orbCores.accent');
    return `${fill}:${accent}`;
  });
  if (new Set(corePalettes).size !== corePalettes.length) {
    throw new RangeError('orb core palettes must be distinct');
  }
  positive(temporaryOrbs.radius, 'temporaryOrbs.radius');
  positive(temporaryOrbs.speed, 'temporaryOrbs.speed');
  positiveInteger(temporaryOrbs.cap, 'temporaryOrbs.cap');
  positive(temporaryOrbs.lifetimeMs, 'temporaryOrbs.lifetimeMs');
  positive(temporaryOrbs.hitCooldownMs, 'temporaryOrbs.hitCooldownMs');
  positive(temporaryOrbs.baseDamage, 'temporaryOrbs.baseDamage');
  if (!Number.isFinite(bossAreaDamage.secondaryDamageScale)
    || bossAreaDamage.secondaryDamageScale < 0
    || bossAreaDamage.secondaryDamageScale > 1) {
    throw new RangeError('bossAreaDamage.secondaryDamageScale must be between zero and one');
  }
  nonNegativeInteger(bossAreaDamage.maxSecondaryTargets, 'bossAreaDamage.maxSecondaryTargets');
  positive(hiveBoss.core.visualSize, 'hiveBoss.core.visualSize');
  positive(hiveBoss.core.hitboxSize, 'hiveBoss.core.hitboxSize');
  positive(hiveBoss.core.hp, 'hiveBoss.core.hp');
  if (hiveBoss.core.hitboxSize > hiveBoss.core.visualSize) {
    throw new RangeError('hiveBoss core hitbox must fit its visual');
  }
  finite(hiveBoss.core.x, 'hiveBoss.core.x');
  finite(hiveBoss.core.y, 'hiveBoss.core.y');
  if (
    hiveBoss.core.x - hiveBoss.core.visualSize / 2 < 0
    || hiveBoss.core.x + hiveBoss.core.visualSize / 2 > GAME_WIDTH
    || hiveBoss.core.y - hiveBoss.core.visualSize / 2 < 0
    || hiveBoss.core.y + hiveBoss.core.visualSize / 2 > GAME_HEIGHT
  ) {
    throw new RangeError('hiveBoss core must fit the game bounds');
  }
  positive(hiveBoss.shooter.width, 'hiveBoss.shooter.width');
  positive(hiveBoss.shooter.height, 'hiveBoss.shooter.height');
  positive(hiveBoss.shooter.hp, 'hiveBoss.shooter.hp');
  const shooterOffsetX = hiveBoss.core.visualSize / 2 + hiveBoss.shooter.width / 2;
  const deployedShooterY = hiveBoss.core.y
    - hiveBoss.core.visualSize / 2
    - hiveBoss.shooter.height / 2;
  if (
    hiveBoss.core.x - shooterOffsetX - hiveBoss.shooter.width / 2 < 0
    || hiveBoss.core.x + shooterOffsetX + hiveBoss.shooter.width / 2 > GAME_WIDTH
    || deployedShooterY - hiveBoss.shooter.height / 2 < 0
    || deployedShooterY + hiveBoss.shooter.height / 2 > GAME_HEIGHT
  ) {
    throw new RangeError('hiveBoss derived shooter positions must fit the game bounds');
  }
  const recalledReflectorOffsetX = hiveBoss.core.visualSize / 2
    + hiveBoss.reflector.width / 2;
  const recalledReflectorY = hiveBoss.core.y
    + hiveBoss.core.visualSize / 2
    + hiveBoss.reflector.height / 2;
  if (
    hiveBoss.core.x - recalledReflectorOffsetX - hiveBoss.reflector.width / 2 < 0
    || hiveBoss.core.x + recalledReflectorOffsetX + hiveBoss.reflector.width / 2
      > GAME_WIDTH
    || recalledReflectorY + hiveBoss.reflector.height / 2 > GAME_HEIGHT
  ) {
    throw new RangeError('hiveBoss recalled module positions must fit the game bounds');
  }
  positive(hiveBoss.reflector.width, 'hiveBoss.reflector.width');
  positive(hiveBoss.reflector.height, 'hiveBoss.reflector.height');
  positive(hiveBoss.reflector.hp, 'hiveBoss.reflector.hp');
  finite(hiveBoss.reflector.y, 'hiveBoss.reflector.y');
  for (const [side, travel] of Object.entries({
    leftTravel: hiveBoss.reflector.leftTravel,
    rightTravel: hiveBoss.reflector.rightTravel,
  })) {
    finite(travel.minimum, `hiveBoss.reflector.${side}.minimum`);
    finite(travel.maximum, `hiveBoss.reflector.${side}.maximum`);
    if (
      travel.minimum > travel.maximum
      || travel.minimum - hiveBoss.reflector.width / 2 < 0
      || travel.maximum + hiveBoss.reflector.width / 2 > GAME_WIDTH
    ) {
      throw new RangeError(`hiveBoss.reflector.${side} must fit the game bounds`);
    }
  }
  if (
    hiveBoss.reflector.y - hiveBoss.reflector.height / 2 < 0
    || hiveBoss.reflector.y + hiveBoss.reflector.height / 2 > GAME_HEIGHT
  ) {
    throw new RangeError('hiveBoss reflector must fit the game bounds');
  }
  positive(hiveBoss.reflector.speed, 'hiveBoss.reflector.speed');
  positive(hiveBoss.reflector.hitCooldownMs, 'hiveBoss.reflector.hitCooldownMs');
  positive(hiveBoss.reflector.minimumCorridorWidth, 'hiveBoss.reflector.minimumCorridorWidth');
  const worstCaseCorridor = hiveBoss.reflector.rightTravel.minimum
    - hiveBoss.reflector.leftTravel.maximum
    - hiveBoss.reflector.width;
  if (worstCaseCorridor < hiveBoss.reflector.minimumCorridorWidth) {
    throw new RangeError('hiveBoss reflector paths must preserve the minimum corridor');
  }
  const coreBounds = rectBounds(
    hiveBoss.core.x,
    hiveBoss.core.y,
    hiveBoss.core.visualSize,
    hiveBoss.core.visualSize,
  );
  const reflectorTop = hiveBoss.reflector.y - hiveBoss.reflector.height / 2;
  const reflectorBottom = hiveBoss.reflector.y + hiveBoss.reflector.height / 2;
  const verticallyOverlapsCore = reflectorTop < coreBounds.bottom
    && reflectorBottom > coreBounds.top;
  const pathOverlapsCore = (
    travel: RangeTuning,
  ) => travel.minimum - hiveBoss.reflector.width / 2 < coreBounds.right
    && travel.maximum + hiveBoss.reflector.width / 2 > coreBounds.left;
  if (
    verticallyOverlapsCore
    && (
      pathOverlapsCore(hiveBoss.reflector.leftTravel)
      || pathOverlapsCore(hiveBoss.reflector.rightTravel)
    )
  ) {
    throw new RangeError('hiveBoss reflector paths must not overlap the core');
  }
  const deployedShooters = [
    rectBounds(
      hiveBoss.core.x - shooterOffsetX,
      deployedShooterY,
      hiveBoss.shooter.width,
      hiveBoss.shooter.height,
    ),
    rectBounds(
      hiveBoss.core.x + shooterOffsetX,
      deployedShooterY,
      hiveBoss.shooter.width,
      hiveBoss.shooter.height,
    ),
  ];
  const reflectorSweeps = [
    {
      left: hiveBoss.reflector.leftTravel.minimum - hiveBoss.reflector.width / 2,
      right: hiveBoss.reflector.leftTravel.maximum + hiveBoss.reflector.width / 2,
      top: reflectorTop,
      bottom: reflectorBottom,
    },
    {
      left: hiveBoss.reflector.rightTravel.minimum - hiveBoss.reflector.width / 2,
      right: hiveBoss.reflector.rightTravel.maximum + hiveBoss.reflector.width / 2,
      top: reflectorTop,
      bottom: reflectorBottom,
    },
  ];
  if (reflectorSweeps.some((sweep) => (
    deployedShooters.some((shooterBounds) => rectsOverlap(sweep, shooterBounds))
  ))) {
    throw new RangeError('hiveBoss reflector paths must not overlap deployed shooters');
  }
  const recalledBodies = [
    coreBounds,
    rectBounds(
      hiveBoss.core.x - shooterOffsetX,
      hiveBoss.core.y,
      hiveBoss.shooter.width,
      hiveBoss.shooter.height,
    ),
    rectBounds(
      hiveBoss.core.x + shooterOffsetX,
      hiveBoss.core.y,
      hiveBoss.shooter.width,
      hiveBoss.shooter.height,
    ),
    rectBounds(
      hiveBoss.core.x - recalledReflectorOffsetX,
      recalledReflectorY,
      hiveBoss.reflector.width,
      hiveBoss.reflector.height,
    ),
    rectBounds(
      hiveBoss.core.x + recalledReflectorOffsetX,
      recalledReflectorY,
      hiveBoss.reflector.width,
      hiveBoss.reflector.height,
    ),
  ];
  for (let left = 0; left < recalledBodies.length; left += 1) {
    for (let right = left + 1; right < recalledBodies.length; right += 1) {
      if (rectsOverlap(recalledBodies[left]!, recalledBodies[right]!)) {
        throw new RangeError('hiveBoss recalled bodies must not overlap');
      }
    }
  }
  for (const [phase, duration] of Object.entries(hiveBoss.timing)) {
    positive(duration, `hiveBoss.timing.${phase}`);
  }
  probability(relics.auxiliaryLink.procScale, 'relics.auxiliaryLink.procScale');
  probability(relics.crossCut.damageScale, 'relics.crossCut.damageScale');
  probability(relics.gasIgnition.remainingDamageFraction, 'relics.gasIgnition.remainingDamageFraction');
  probability(relics.recursiveSplit.chance, 'relics.recursiveSplit.chance');
  positiveInteger(relics.recursiveSplit.childCount, 'relics.recursiveSplit.childCount');
  positiveInteger(relics.inertiaRetention.directHits, 'relics.inertiaRetention.directHits');
  probability(relics.directLink.overchargeScale, 'relics.directLink.overchargeScale');
  positiveInteger(relics.superconductingCircuit.targetBonus, 'relics.superconductingCircuit.targetBonus');
  positive(relics.superconductingCircuit.damageBonus, 'relics.superconductingCircuit.damageBonus');
  positive(relics.resonanceRupture.radius, 'relics.resonanceRupture.radius');
  positive(relics.resonanceRupture.damage, 'relics.resonanceRupture.damage');
  for (const [name, friendly] of Object.entries(visual.friendly)) {
    finite(friendly.fill, `visual.friendly.${name}.fill`);
    finite(friendly.accent, `visual.friendly.${name}.accent`);
    positive(friendly.width, `visual.friendly.${name}.width`);
    positive(friendly.height, `visual.friendly.${name}.height`);
  }
  const feedback = visual.coreFeedback;
  for (const [name, alpha] of Object.entries({
    corrosionFieldAlpha: feedback.corrosionFieldAlpha,
    corrosionLineAlpha: feedback.corrosionLineAlpha,
  })) {
    if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 1) {
      throw new RangeError(`visual.coreFeedback.${name} must be greater than zero and at most one`);
    }
  }
  positive(
    feedback.corrosionTickDurationMs,
    'visual.coreFeedback.corrosionTickDurationMs',
  );
  positive(feedback.conductionDurationMs, 'visual.coreFeedback.conductionDurationMs');
  const friendlyPairs = [
    ...Object.values(visual.friendly).map(({ fill, accent }) => `${fill}:${accent}`),
    ...corePalettes,
  ];
  for (const [name, hostile] of Object.entries(visual.hostile)) {
    finite(hostile.fill, `visual.hostile.${name}.fill`);
    finite(hostile.accent, `visual.hostile.${name}.accent`);
    positive(hostile.width, `visual.hostile.${name}.width`);
    positive(hostile.height, `visual.hostile.${name}.height`);
    if (friendlyPairs.includes(`${hostile.fill}:${hostile.accent}`)) {
      throw new RangeError(`visual.hostile.${name} must differ from friendly projectiles`);
    }
  }
}

if ((import.meta as ImportMeta & { env?: { DEV: boolean } }).env?.DEV) {
  validateGameTuning(GAME_TUNING);
}
