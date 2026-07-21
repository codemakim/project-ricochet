import { GAME_HEIGHT, GAME_WIDTH, PLAYER_MIN_Y } from '../constants';

export interface RangeTuning { minimum: number; maximum: number }
export interface PhaseTuning {
  formation: RangeTuning;
  activeCap: number;
  spawnIntervalMs: number;
  armored: number;
  shooters: number;
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
    hp: { basic: number; shooter: number; armored: number };
    shooter: { intervalMs: number; warningMs: number; bulletSpeed: number; damage: number };
  };
  encounter: {
    reinforcementOriginY: number;
    reinforcementReleaseY: number;
    initialFormation: { count: number; originY: number; armored: number; shooters: number };
    phases: readonly [PhaseTuning, PhaseTuning, PhaseTuning];
    bossEntry: { scoreTarget: number; minimumMs: number; hardMaximumMs: number; warningMs: number };
  };
  projectiles: {
    hostileCap: number;
    offscreenMargin: number;
    bossBasic: { intervalMs: number; warningMs: number; speed: number; damage: number; radius: number };
    bossAimed: { warningMs: number; speed: number; damage: number; radius: number; fanDegrees: readonly [number, number, number] };
    bossSupport: { warningMs: number; speed: number; damage: number; width: number; height: number };
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
    hp: { basic: 2, shooter: 2, armored: 5 },
    shooter: { intervalMs: 1300, warningMs: 350, bulletSpeed: 180, damage: 1 },
  },
  encounter: {
    initialFormation: { count: 26, originY: 80, armored: 3, shooters: 3 },
    reinforcementOriginY: -28,
    reinforcementReleaseY: 50,
    phases: [
      { formation: { minimum: 13, maximum: 15 }, activeCap: 48, spawnIntervalMs: 8000, armored: 1, shooters: 0 },
      { formation: { minimum: 15, maximum: 18 }, activeCap: 60, spawnIntervalMs: 7000, armored: 2, shooters: 1 },
      { formation: { minimum: 18, maximum: 21 }, activeCap: 72, spawnIntervalMs: 6000, armored: 2, shooters: 2 },
    ],
    bossEntry: { scoreTarget: 70, minimumMs: 120000, hardMaximumMs: 210000, warningMs: 2000 },
  },
  projectiles: {
    hostileCap: 12,
    offscreenMargin: 20,
    bossBasic: { intervalMs: 900, warningMs: 150, speed: 150, damage: 1, radius: 5 },
    bossAimed: { warningMs: 600, speed: 220, damage: 1, radius: 5, fanDegrees: [-12, 0, 12] },
    bossSupport: { warningMs: 800, speed: 240, damage: 2, width: 16, height: 24 },
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

export function validateGameTuning(tuning: GameTuning): void {
  const { boss, enemies, encounter, projectiles, visual } = tuning;
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
  positive(encounter.initialFormation.count, 'encounter.initialFormation.count');
  if (![encounter.initialFormation.armored, encounter.initialFormation.shooters].every(Number.isInteger)
    || encounter.initialFormation.armored < 0 || encounter.initialFormation.shooters < 0
    || encounter.initialFormation.armored + encounter.initialFormation.shooters
      > encounter.initialFormation.count) {
    throw new RangeError('encounter initial special counts must fit the formation');
  }
  for (const [index, phase] of encounter.phases.entries()) {
    positive(phase.formation.minimum, `encounter.phases.${index}.formation.minimum`);
    if (phase.formation.maximum < phase.formation.minimum) {
      throw new RangeError(`encounter.phases.${index}.formation must be ordered`);
    }
    if (phase.activeCap < phase.formation.maximum) {
      throw new RangeError(`encounter.phases.${index}.activeCap must fit one formation`);
    }
    positive(phase.spawnIntervalMs, `encounter.phases.${index}.spawnIntervalMs`);
    if (![phase.armored, phase.shooters].every(Number.isInteger)
      || phase.armored < 0 || phase.shooters < 0
      || phase.armored + phase.shooters > phase.formation.minimum) {
      throw new RangeError(`encounter.phases.${index} special counts must fit the minimum formation`);
    }
  }
  if (!(encounter.reinforcementOriginY < encounter.reinforcementReleaseY
    && encounter.reinforcementReleaseY < PLAYER_MIN_Y)) {
    throw new RangeError('encounter reinforcement heights must be ordered below PLAYER_MIN_Y');
  }
  const weakpointOffset = (boss.body.width + boss.weakpoint.visual.width) / 2
    - boss.weakpoint.edgeOverlap;
  const collisionWidth = 2 * (weakpointOffset + boss.weakpoint.hitbox.width / 2);
  if (collisionWidth >= GAME_WIDTH) throw new RangeError('boss collision width must fit GAME_WIDTH');
  if (boss.y - boss.body.height / 2 < 0 || boss.y + boss.body.height / 2 > GAME_HEIGHT) {
    throw new RangeError('boss body must fit GAME_HEIGHT');
  }
  positive(projectiles.hostileCap, 'projectiles.hostileCap');
  positive(projectiles.offscreenMargin, 'projectiles.offscreenMargin');
  for (const [name, projectile] of Object.entries({
    bossBasic: projectiles.bossBasic,
    bossAimed: projectiles.bossAimed,
    bossSupport: projectiles.bossSupport,
  })) {
    positive(projectile.warningMs, `projectiles.${name}.warningMs`);
    positive(projectile.speed, `projectiles.${name}.speed`);
    positive(projectile.damage, `projectiles.${name}.damage`);
  }
  positive(projectiles.bossBasic.intervalMs, 'projectiles.bossBasic.intervalMs');
  positive(projectiles.bossBasic.radius, 'projectiles.bossBasic.radius');
  positive(projectiles.bossAimed.radius, 'projectiles.bossAimed.radius');
  positive(projectiles.bossSupport.width, 'projectiles.bossSupport.width');
  positive(projectiles.bossSupport.height, 'projectiles.bossSupport.height');
  if (!projectiles.bossAimed.fanDegrees.every(Number.isFinite)) {
    throw new RangeError('projectiles.bossAimed.fanDegrees must be finite');
  }
  for (const [name, friendly] of Object.entries(visual.friendly)) {
    positive(friendly.width, `visual.friendly.${name}.width`);
    positive(friendly.height, `visual.friendly.${name}.height`);
  }
  const friendlyPairs = Object.values(visual.friendly).map(({ fill, accent }) => `${fill}:${accent}`);
  for (const [name, hostile] of Object.entries(visual.hostile)) {
    positive(hostile.width, `visual.hostile.${name}.width`);
    positive(hostile.height, `visual.hostile.${name}.height`);
    if (friendlyPairs.includes(`${hostile.fill}:${hostile.accent}`)) {
      throw new RangeError(`visual.hostile.${name} must differ from friendly projectiles`);
    }
  }
}

if ((import.meta as ImportMeta & { env: { DEV: boolean } }).env.DEV) validateGameTuning(GAME_TUNING);
