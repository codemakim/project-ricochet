import { GAME_HEIGHT, GAME_WIDTH, PLAYER_MIN_Y } from '../constants';

export interface RangeTuning { minimum: number; maximum: number }
export type BossKind = 'sentinel' | 'hive';
export type ThreatPhase = 0 | 1 | 2 | 3;

export interface BossScheduleTuning {
  section: number;
  kind: BossKind;
  minimumMs: number;
  scoreTarget: number;
  hardMaximumMs: number;
  warningMs: number;
}

export interface PhaseTuning {
  formation: RangeTuning;
  activeCap: number;
  spawnIntervalMs: number;
  armored: number;
  shooters: number;
  splitters: number;
}

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
    reinforcementOriginY: number;
    reinforcementReleaseY: number;
    initialFormation: { count: number; originY: number; armored: number; shooters: number };
    phases: readonly [PhaseTuning, PhaseTuning, PhaseTuning, PhaseTuning];
    bossSchedule: readonly [BossScheduleTuning, BossScheduleTuning];
  };
  projectiles: {
    hostileCap: number;
    offscreenMargin: number;
    bossBasic: { intervalMs: number; warningMs: number; speed: number; damage: number; radius: number };
    bossAimed: { warningMs: number; speed: number; damage: number; radius: number; fanDegrees: readonly [number, number, number] };
    bossSupport: { warningMs: number; speed: number; damage: number; width: number; height: number };
    hiveShooter: { intervalMs: number; offsetMs: number; warningMs: number; speed: number; damage: number; radius: number };
    hiveCore: { intervalMs: number; speed: number; damage: number; radius: number; fanDegrees: readonly [number, number, number, number, number] };
  };
  temporaryOrbs: { radius: number; speed: number; cap: number; lifetimeMs: number; hitCooldownMs: number };
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
  relics: {
    secondBoss: {
      auxiliaryOrbit: { orbLimit: number };
      recoverySalvo: { temporaryOrbCount: number };
      siegeResonance: { hitsRequired: number; radius: number; damage: number };
      hyperpressureCore: { chargedDamageBonus: number };
      aftershockExplosion: { delayMs: number; radiusScale: number; damageScale: number };
      chainSplit: { childCount: number; angles: readonly [number, number] };
    };
  };
  visual: {
    friendly: { permanentOrb: ProjectileVisualTuning; temporaryOrb: ProjectileVisualTuning };
    hostile: {
      enemyBullet: ProjectileVisualTuning;
      bossBasic: ProjectileVisualTuning;
      bossAimed: ProjectileVisualTuning;
      bossHazard: ProjectileVisualTuning;
      bossMuzzleFlash: ProjectileVisualTuning;
    };
  };
}

const BOSS_SCHEDULE = [
  { section: 0, kind: 'sentinel', minimumMs: 120000, scoreTarget: 70, hardMaximumMs: 210000, warningMs: 2000 },
  { section: 1, kind: 'hive', minimumMs: 150000, scoreTarget: 110, hardMaximumMs: 210000, warningMs: 2000 },
] as const satisfies readonly [BossScheduleTuning, BossScheduleTuning];

export const GAME_TUNING = {
  boss: {
    y: 120,
    body: { width: 168, height: 96 },
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
    hp: { basic: 2, shooter: 2, armored: 5, splitter: 3, fragment: 1 },
    shooter: { intervalMs: 1300, warningMs: 350, bulletSpeed: 180, damage: 1 },
    splitter: { width: 38, height: 30, fragmentOffsetX: 12, populationCost: 2, score: 2, xp: 1, breachDamage: 3 },
    fragment: { width: 22, height: 18, populationCost: 1, score: 0, xp: 1, breachDamage: 1 },
  },
  encounter: {
    initialFormation: { count: 26, originY: 80, armored: 3, shooters: 3 },
    reinforcementOriginY: -28,
    reinforcementReleaseY: 50,
    phases: [
      { formation: { minimum: 13, maximum: 15 }, activeCap: 48, spawnIntervalMs: 8000, armored: 1, shooters: 0, splitters: 0 },
      { formation: { minimum: 15, maximum: 18 }, activeCap: 60, spawnIntervalMs: 7000, armored: 2, shooters: 1, splitters: 0 },
      { formation: { minimum: 18, maximum: 21 }, activeCap: 72, spawnIntervalMs: 6000, armored: 2, shooters: 2, splitters: 0 },
      { formation: { minimum: 21, maximum: 25 }, activeCap: 84, spawnIntervalMs: 5500, armored: 3, shooters: 3, splitters: 2 },
    ],
    bossSchedule: BOSS_SCHEDULE,
  },
  projectiles: {
    hostileCap: 12,
    offscreenMargin: 20,
    bossBasic: { intervalMs: 900, warningMs: 150, speed: 150, damage: 1, radius: 5 },
    bossAimed: { warningMs: 600, speed: 220, damage: 1, radius: 5, fanDegrees: [-12, 0, 12] },
    bossSupport: { warningMs: 800, speed: 240, damage: 2, width: 16, height: 24 },
    hiveShooter: { intervalMs: 1400, offsetMs: 700, warningMs: 300, speed: 170, damage: 1, radius: 5 },
    hiveCore: { intervalMs: 7000, speed: 140, damage: 1, radius: 5, fanDegrees: [-36, -18, 0, 18, 36] },
  },
  temporaryOrbs: { radius: 6, speed: 440, cap: 12, lifetimeMs: 1500, hitCooldownMs: 80 },
  hiveBoss: {
    core: { x: 225, y: 140, visualSize: 56, hitboxSize: 48, hp: 72 },
    shooter: { width: 34, height: 28, hp: 12 },
    reflector: {
      width: 18,
      height: 96,
      y: 280,
      hp: 14,
      leftTravel: { minimum: 96, maximum: 168 },
      rightTravel: { minimum: 282, maximum: 354 },
      speed: 30,
      hitCooldownMs: 80,
      minimumCorridorWidth: 96,
    },
    timing: { shieldedMs: 4000, telegraphMs: 1500, exposedMs: 7000 },
  },
  relics: {
    secondBoss: {
      auxiliaryOrbit: { orbLimit: 6 },
      recoverySalvo: { temporaryOrbCount: 2 },
      siegeResonance: { hitsRequired: 10, radius: 80, damage: 2 },
      hyperpressureCore: { chargedDamageBonus: 0.75 },
      aftershockExplosion: { delayMs: 350, radiusScale: 0.8, damageScale: 0.5 },
      chainSplit: { childCount: 2, angles: [-25, 25] },
    },
  },
  visual: {
    friendly: {
      permanentOrb: { fill: 0xffffff, accent: 0x4ddcff, width: 16, height: 16 },
      temporaryOrb: { fill: 0x8cf7ff, accent: 0x167d9a, width: 12, height: 12 },
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

function positiveInteger(value: number, name: string): void {
  positive(value, name);
  if (!Number.isInteger(value)) throw new RangeError(`${name} must be an integer`);
}

function nonNegativeInteger(value: number, name: string): void {
  nonNegative(value, name);
  if (!Number.isInteger(value)) throw new RangeError(`${name} must be an integer`);
}

export function validateGameTuning(tuning: GameTuning): void {
  const {
    boss, enemies, encounter, projectiles, temporaryOrbs,
    hiveBoss, relics, visual,
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
  positiveInteger(encounter.initialFormation.count, 'encounter.initialFormation.count');
  finite(encounter.initialFormation.originY, 'encounter.initialFormation.originY');
  nonNegativeInteger(encounter.initialFormation.armored, 'encounter.initialFormation.armored');
  nonNegativeInteger(encounter.initialFormation.shooters, 'encounter.initialFormation.shooters');
  if (encounter.initialFormation.armored + encounter.initialFormation.shooters
      > encounter.initialFormation.count) {
    throw new RangeError('encounter initial special counts must fit the formation');
  }
  for (const [index, phase] of encounter.phases.entries()) {
    positiveInteger(phase.formation.minimum, `encounter.phases.${index}.formation.minimum`);
    positiveInteger(phase.formation.maximum, `encounter.phases.${index}.formation.maximum`);
    if (phase.formation.maximum < phase.formation.minimum) {
      throw new RangeError(`encounter.phases.${index}.formation must be ordered`);
    }
    positiveInteger(phase.activeCap, `encounter.phases.${index}.activeCap`);
    if (phase.activeCap < phase.formation.maximum) {
      throw new RangeError(`encounter.phases.${index}.activeCap must fit one formation`);
    }
    positive(phase.spawnIntervalMs, `encounter.phases.${index}.spawnIntervalMs`);
    nonNegativeInteger(phase.armored, `encounter.phases.${index}.armored`);
    nonNegativeInteger(phase.shooters, `encounter.phases.${index}.shooters`);
    nonNegativeInteger(phase.splitters, `encounter.phases.${index}.splitters`);
    if (phase.armored + phase.shooters + phase.splitters > phase.formation.minimum) {
      throw new RangeError(`encounter.phases.${index} special counts must fit the minimum formation`);
    }
  }
  finite(encounter.reinforcementOriginY, 'encounter.reinforcementOriginY');
  finite(encounter.reinforcementReleaseY, 'encounter.reinforcementReleaseY');
  if (!(encounter.reinforcementOriginY < encounter.reinforcementReleaseY
    && encounter.reinforcementReleaseY < PLAYER_MIN_Y)) {
    throw new RangeError('encounter reinforcement heights must be ordered below PLAYER_MIN_Y');
  }
  for (const [index, entry] of encounter.bossSchedule.entries()) {
    nonNegativeInteger(entry.section, `encounter.bossSchedule.${index}.section`);
    if (entry.section !== index) {
      throw new RangeError('encounter boss schedule sections must be unique and ordered');
    }
    positive(entry.scoreTarget, `encounter.bossSchedule.${index}.scoreTarget`);
    positive(entry.minimumMs, `encounter.bossSchedule.${index}.minimumMs`);
    positive(entry.hardMaximumMs, `encounter.bossSchedule.${index}.hardMaximumMs`);
    positive(entry.warningMs, `encounter.bossSchedule.${index}.warningMs`);
    if (entry.minimumMs > entry.hardMaximumMs) {
      throw new RangeError('encounter boss schedule timings must be ordered');
    }
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
  if (!projectiles.bossAimed.fanDegrees.every(Number.isFinite)) {
    throw new RangeError('projectiles.bossAimed.fanDegrees must be finite');
  }
  if (!projectiles.hiveCore.fanDegrees.every(Number.isFinite)) {
    throw new RangeError('projectiles.hiveCore.fanDegrees must be finite');
  }
  positive(temporaryOrbs.radius, 'temporaryOrbs.radius');
  positive(temporaryOrbs.speed, 'temporaryOrbs.speed');
  positiveInteger(temporaryOrbs.cap, 'temporaryOrbs.cap');
  positive(temporaryOrbs.lifetimeMs, 'temporaryOrbs.lifetimeMs');
  positive(temporaryOrbs.hitCooldownMs, 'temporaryOrbs.hitCooldownMs');
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
  const coreBounds = {
    left: hiveBoss.core.x - hiveBoss.core.visualSize / 2,
    right: hiveBoss.core.x + hiveBoss.core.visualSize / 2,
    top: hiveBoss.core.y - hiveBoss.core.visualSize / 2,
    bottom: hiveBoss.core.y + hiveBoss.core.visualSize / 2,
  };
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
  for (const [phase, duration] of Object.entries(hiveBoss.timing)) {
    positive(duration, `hiveBoss.timing.${phase}`);
  }
  const { secondBoss } = relics;
  positiveInteger(secondBoss.auxiliaryOrbit.orbLimit, 'relics.secondBoss.auxiliaryOrbit.orbLimit');
  if (secondBoss.auxiliaryOrbit.orbLimit < 3) {
    throw new RangeError('auxiliary orbit limit must fit the starting orb count');
  }
  positiveInteger(secondBoss.recoverySalvo.temporaryOrbCount, 'relics.secondBoss.recoverySalvo.temporaryOrbCount');
  positiveInteger(secondBoss.siegeResonance.hitsRequired, 'relics.secondBoss.siegeResonance.hitsRequired');
  positive(secondBoss.siegeResonance.radius, 'relics.secondBoss.siegeResonance.radius');
  positive(secondBoss.siegeResonance.damage, 'relics.secondBoss.siegeResonance.damage');
  positive(secondBoss.hyperpressureCore.chargedDamageBonus, 'relics.secondBoss.hyperpressureCore.chargedDamageBonus');
  positive(secondBoss.aftershockExplosion.delayMs, 'relics.secondBoss.aftershockExplosion.delayMs');
  positive(secondBoss.aftershockExplosion.radiusScale, 'relics.secondBoss.aftershockExplosion.radiusScale');
  positive(secondBoss.aftershockExplosion.damageScale, 'relics.secondBoss.aftershockExplosion.damageScale');
  positiveInteger(secondBoss.chainSplit.childCount, 'relics.secondBoss.chainSplit.childCount');
  if (!secondBoss.chainSplit.angles.every(Number.isFinite)) {
    throw new RangeError('relics.secondBoss.chainSplit.angles must be finite');
  }
  for (const [name, friendly] of Object.entries(visual.friendly)) {
    finite(friendly.fill, `visual.friendly.${name}.fill`);
    finite(friendly.accent, `visual.friendly.${name}.accent`);
    positive(friendly.width, `visual.friendly.${name}.width`);
    positive(friendly.height, `visual.friendly.${name}.height`);
  }
  const friendlyPairs = Object.values(visual.friendly).map(({ fill, accent }) => `${fill}:${accent}`);
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

if ((import.meta as ImportMeta & { env: { DEV: boolean } }).env.DEV) validateGameTuning(GAME_TUNING);
