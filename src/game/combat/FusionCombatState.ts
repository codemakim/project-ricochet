import { GAME_TUNING } from '../config/gameTuning';
import {
  normalize,
  segmentIntersection,
  type Vector,
} from '../math/vector';

function levelIndex(level: number): number {
  if (!Number.isInteger(level) || level < 1 || level > 9) {
    throw new RangeError('fusion level must be an integer from 1 through 9');
  }
  return level - 1;
}

export interface PhotonFusionProfile {
  speedMultiplier: number;
  beam: { length: number; thickness: number; damage: number };
  trail: {
    durationMs: number;
    tickMs: number;
    thickness: number;
    damage: number;
    maximumSegments: number;
  } | null;
  intersectionBlast: { radius: number; damage: number } | null;
}

export function photonFusionProfile(level: number): PhotonFusionProfile {
  const index = levelIndex(level);
  const tuning = GAME_TUNING.orbFusions.photonOrbit;
  return {
    speedMultiplier: tuning.speedMultiplierByLevel[index]!,
    beam: {
      length: tuning.beamLengthByLevel[index]!,
      thickness: tuning.beamThicknessByLevel[index]!,
      damage: tuning.beamDamageByLevel[index]!,
    },
    trail: level >= tuning.trail.fromLevel ? {
      durationMs: tuning.trail.durationMsByLevel[index]!,
      tickMs: tuning.trail.tickMs,
      thickness: tuning.trail.thickness,
      damage: tuning.trail.damageByLevel[index]!,
      maximumSegments: tuning.trail.maximumSegmentsByLevel[index]!,
    } : null,
    intersectionBlast: level >= tuning.intersection.fromLevel
      ? { radius: tuning.intersection.radius, damage: tuning.intersection.damage }
      : null,
  };
}

export interface ResonantSwarmProfile {
  chance: number;
  cooldownMs: number;
  count: number;
  lifetimeMs: number;
  targets: number;
  radius: number;
  damage: number;
  siblingRadius: number;
  siblingDamageBonus: number;
  maximumSiblingBonus: number;
  finalPulse: { radius: number; damage: number };
}

export function resonantSwarmProfile(level: number): ResonantSwarmProfile {
  const index = levelIndex(level);
  const tuning = GAME_TUNING.orbFusions.resonantSwarm;
  return {
    chance: tuning.chanceByLevel[index]!,
    cooldownMs: tuning.cooldownMs,
    count: tuning.countByLevel[index]!,
    lifetimeMs: tuning.lifetimeMsByLevel[index]!,
    targets: tuning.targetCountByLevel[index]!,
    radius: tuning.radiusByLevel[index]!,
    damage: tuning.damageByLevel[index]!,
    siblingRadius: tuning.siblingRadius,
    siblingDamageBonus: tuning.siblingDamageBonus,
    maximumSiblingBonus: tuning.maximumSiblingBonus,
    finalPulse: {
      radius: tuning.finalRadiusByLevel[index]!,
      damage: tuning.finalDamageByLevel[index]!,
    },
  };
}

export interface NanoFusionProfile {
  chance: number;
  cooldownMs: number;
  count: number;
  radius: number;
  durationMs: number;
  tickMs: number;
  damage: number;
  maximumSeeds: number;
  maximumGeneration: number;
  spreadRadius: number;
}

export function nanoFusionProfile(level: number): NanoFusionProfile {
  const index = levelIndex(level);
  const tuning = GAME_TUNING.orbFusions.nanoProliferator;
  return {
    chance: tuning.chanceByLevel[index]!,
    cooldownMs: tuning.cooldownMs,
    count: tuning.countByLevel[index]!,
    radius: tuning.radiusByLevel[index]!,
    durationMs: tuning.durationMsByLevel[index]!,
    tickMs: tuning.tickMs,
    damage: tuning.damageByLevel[index]!,
    maximumSeeds: tuning.maximumSeeds,
    maximumGeneration: tuning.maximumGenerationByLevel[index]!,
    spreadRadius: tuning.spreadRadius,
  };
}

export interface MassCollapseProfile {
  minimumSpeedRatio: number;
  stacksPerHit: number;
  precisionBonusStacks: number;
  threshold: number;
  damage: number;
  radius: number;
  secondaryScale: number;
  maximumTrackedTargets: number;
}

export function massCollapseProfile(level: number): MassCollapseProfile {
  const index = levelIndex(level);
  const tuning = GAME_TUNING.orbFusions.massCollapse;
  return {
    minimumSpeedRatio: tuning.minimumSpeedRatioByLevel[index]!,
    stacksPerHit: tuning.stacksPerHitByLevel[index]!,
    precisionBonusStacks: tuning.precisionBonusStacksByLevel[index]!,
    threshold: tuning.thresholdByLevel[index]!,
    damage: tuning.collapseDamageByLevel[index]!,
    radius: tuning.radiusByLevel[index]!,
    secondaryScale: tuning.secondaryScale,
    maximumTrackedTargets: tuning.maximumTrackedTargets,
  };
}

export interface ReactorOrbProfile {
  maximumCharges: number;
  damagePerCharge: number;
  radiusPerCharge: number;
  baseRadius: number;
  outerWave: { damageScale: number; radiusScale: number } | null;
}

export function reactorOrbProfile(level: number): ReactorOrbProfile {
  const index = levelIndex(level);
  const tuning = GAME_TUNING.orbFusions.reactorOrb;
  return {
    maximumCharges: tuning.maximumChargesByLevel[index]!,
    damagePerCharge: tuning.damagePerChargeByLevel[index]!,
    radiusPerCharge: tuning.radiusPerChargeByLevel[index]!,
    baseRadius: tuning.baseRadius,
    outerWave: level >= tuning.outerWaveFromLevel ? {
      damageScale: tuning.outerWaveDamageScale,
      radiusScale: tuning.outerWaveRadiusScale,
    } : null,
  };
}

export interface ClusterBombardmentProfile {
  chance: number;
  cooldownMs: number;
  projectileCount: 6;
  damage: number;
  radius: number;
  travelMs: number;
  distance: number;
  angles: readonly number[];
  maximumActiveProjectiles: number;
  maximumFields: number;
  lingering: { durationMs: number; tickMs: number; damage: number } | null;
}

export function clusterBombardmentProfile(level: number): ClusterBombardmentProfile {
  const index = levelIndex(level);
  const tuning = GAME_TUNING.orbFusions.clusterBombardment;
  return {
    chance: tuning.chanceByLevel[index]!,
    cooldownMs: tuning.cooldownMs,
    projectileCount: tuning.projectileCount,
    damage: tuning.damageByLevel[index]!,
    radius: tuning.radiusByLevel[index]!,
    travelMs: tuning.travelMsByLevel[index]!,
    distance: tuning.distanceByLevel[index]!,
    angles: [210, 270, 330, 30, 90, 150],
    maximumActiveProjectiles: tuning.maximumActiveProjectiles,
    maximumFields: Math.ceil(tuning.maximumActiveProjectiles / tuning.projectileCount),
    lingering: level >= tuning.lingeringFromLevel ? {
      durationMs: tuning.lingeringDurationMsByLevel[index]!,
      tickMs: tuning.lingeringTickMs,
      damage: tuning.lingeringDamageByLevel[index]!,
    } : null,
  };
}

export interface MassCollapseResult {
  collapsed: boolean;
  stacks: number;
}

export class MassCollapseState {
  private readonly stacks = new Map<string, number>();

  record(targetKey: string, addedStacks: number, profile: MassCollapseProfile): MassCollapseResult {
    if (!targetKey || !Number.isInteger(addedStacks) || addedStacks <= 0) {
      throw new RangeError('collapse target and stacks must be valid');
    }
    if (!this.stacks.has(targetKey) && this.stacks.size >= profile.maximumTrackedTargets) {
      this.stacks.delete(this.stacks.keys().next().value!);
    }
    const stacks = (this.stacks.get(targetKey) ?? 0) + addedStacks;
    if (stacks >= profile.threshold) {
      this.stacks.delete(targetKey);
      return { collapsed: true, stacks: 0 };
    }
    this.stacks.set(targetKey, stacks);
    return { collapsed: false, stacks };
  }

  getSnapshot(): Array<{ targetKey: string; stacks: number }> {
    return [...this.stacks].map(([targetKey, stacks]) => ({ targetKey, stacks }));
  }

  clear(): void { this.stacks.clear(); }
}

export class ReactorChargeState {
  private readonly charges = new Map<number, number>();

  add(orbId: number, profile: ReactorOrbProfile): number {
    const next = Math.min(profile.maximumCharges, (this.charges.get(orbId) ?? 0) + 1);
    this.charges.set(orbId, next);
    return next;
  }

  consume(orbId: number): number {
    const value = this.charges.get(orbId) ?? 0;
    this.charges.delete(orbId);
    return value;
  }

  get(orbId: number): number { return this.charges.get(orbId) ?? 0; }
  clear(): void { this.charges.clear(); }
}

export interface ClusterFieldSnapshot {
  fieldId: number;
  position: Vector;
  radius: number;
  damage: number;
  expiresAt: number;
}

interface ClusterFieldRecord extends ClusterFieldSnapshot {
  tickMs: number;
  nextTickAt: number;
}

export class ClusterFieldState {
  private readonly fields: ClusterFieldRecord[] = [];
  private nextId = 0;

  add(position: Vector, nowMs: number, profile: ClusterBombardmentProfile): boolean {
    if (!profile.lingering) return false;
    this.update(nowMs);
    while (this.fields.length >= profile.maximumFields) this.fields.shift();
    this.fields.push({
      fieldId: this.nextId++,
      position: { ...position },
      radius: profile.radius,
      damage: profile.lingering.damage,
      expiresAt: nowMs + profile.lingering.durationMs,
      tickMs: profile.lingering.tickMs,
      nextTickAt: nowMs,
    });
    return true;
  }

  drainDue(nowMs: number): ClusterFieldSnapshot[] {
    this.update(nowMs);
    const due = this.fields.filter((field) => nowMs >= field.nextTickAt);
    for (const field of due) field.nextTickAt = nowMs + field.tickMs;
    return due.map((field) => this.snapshot(field));
  }

  update(nowMs: number): void {
    for (let index = this.fields.length - 1; index >= 0; index -= 1) {
      if (nowMs >= this.fields[index]!.expiresAt) this.fields.splice(index, 1);
    }
  }

  getSnapshot(): ClusterFieldSnapshot[] {
    return this.fields.map((field) => this.snapshot(field));
  }

  clear(): void { this.fields.length = 0; }

  private snapshot(field: ClusterFieldRecord): ClusterFieldSnapshot {
    return {
      fieldId: field.fieldId,
      position: { ...field.position },
      radius: field.radius,
      damage: field.damage,
      expiresAt: field.expiresAt,
    };
  }
}

export interface PhotonTrailSnapshot {
  trailId: number;
  orbId: number;
  start: Vector;
  end: Vector;
  thickness: number;
  damage: number;
  expiresAt: number;
}

interface PhotonTrailRecord extends PhotonTrailSnapshot {
  tickMs: number;
  nextTickAt: number;
}

const ENDPOINT_EPSILON = 0.001;

export class PhotonTrailState {
  private readonly trails: PhotonTrailRecord[] = [];
  private nextId = 0;

  add(
    orbId: number,
    start: Vector,
    end: Vector,
    nowMs: number,
    profile: PhotonFusionProfile,
  ): Vector[] {
    this.update(nowMs);
    if (!profile.trail || Math.hypot(end.x - start.x, end.y - start.y) === 0) return [];
    const owned = this.trails.filter((trail) => trail.orbId === orbId);
    while (owned.length >= profile.trail.maximumSegments) {
      const oldest = owned.shift()!;
      this.trails.splice(this.trails.indexOf(oldest), 1);
    }

    const intersections = profile.intersectionBlast ? this.trails
      .map((trail) => segmentIntersection(start, end, trail.start, trail.end))
      .filter((point): point is Vector => point !== null)
      .filter((point) => [start, end].every((endpoint) => (
        Math.hypot(point.x - endpoint.x, point.y - endpoint.y) > ENDPOINT_EPSILON
      ))) : [];
    this.trails.push({
      trailId: this.nextId++,
      orbId,
      start: { ...start },
      end: { ...end },
      thickness: profile.trail.thickness,
      damage: profile.trail.damage,
      expiresAt: nowMs + profile.trail.durationMs,
      tickMs: profile.trail.tickMs,
      nextTickAt: nowMs,
    });
    return intersections;
  }

  update(nowMs: number): void {
    for (let index = this.trails.length - 1; index >= 0; index -= 1) {
      if (nowMs >= this.trails[index]!.expiresAt) this.trails.splice(index, 1);
    }
  }

  drainDue(nowMs: number): PhotonTrailSnapshot[] {
    this.update(nowMs);
    const due = this.trails.filter((trail) => nowMs >= trail.nextTickAt);
    for (const trail of due) trail.nextTickAt = nowMs + trail.tickMs;
    return due.map(({ tickMs: _tickMs, nextTickAt: _nextTickAt, ...trail }) => ({
      ...trail,
      start: { ...trail.start },
      end: { ...trail.end },
    }));
  }

  getSnapshot(): PhotonTrailSnapshot[] {
    return this.trails.map(({ tickMs: _tickMs, nextTickAt: _nextTickAt, ...trail }) => ({
      ...trail,
      start: { ...trail.start },
      end: { ...trail.end },
    }));
  }

  clear(): void { this.trails.length = 0; }
}

export interface NanoSeedSnapshot {
  seedId: number;
  orbId: number;
  position: Vector;
  radius: number;
  damage: number;
  generation: number;
  expiresAt: number;
}

interface NanoSeedRecord extends NanoSeedSnapshot {
  tickMs: number;
  nextTickAt: number;
  maximumGeneration: number;
}

export class NanoSeedState {
  private readonly seeds: NanoSeedRecord[] = [];
  private nextId = 0;

  spawn(
    orbId: number,
    position: Vector,
    direction: Vector,
    nowMs: number,
    profile: NanoFusionProfile,
  ): number {
    this.update(nowMs);
    const count = Math.min(profile.count, profile.maximumSeeds - this.seeds.length);
    if (count <= 0) return 0;
    const forward = normalize(direction);
    const side = { x: -forward.y, y: forward.x };
    for (let index = 0; index < count; index += 1) {
      const offset = count === 1 ? 0 : (index / (count - 1) - 0.5) * 2;
      this.addSeed(orbId, {
        x: position.x + side.x * profile.spreadRadius * offset,
        y: position.y + side.y * profile.spreadRadius * offset,
      }, 0, nowMs, profile);
    }
    return count;
  }

  spreadOnDeath(position: Vector, nowMs: number, profile: NanoFusionProfile): boolean {
    this.update(nowMs);
    if (this.seeds.length >= profile.maximumSeeds) return false;
    const source = this.seeds.find((seed) => (
      seed.generation < seed.maximumGeneration
      && Math.hypot(seed.position.x - position.x, seed.position.y - position.y) <= seed.radius
    ));
    if (!source) return false;
    this.addSeed(source.orbId, position, source.generation + 1, nowMs, profile);
    return true;
  }

  drainDue(nowMs: number): NanoSeedSnapshot[] {
    this.update(nowMs);
    const due = this.seeds.filter((seed) => nowMs >= seed.nextTickAt);
    for (const seed of due) seed.nextTickAt = nowMs + seed.tickMs;
    return due.map((seed) => this.snapshot(seed));
  }

  update(nowMs: number): void {
    for (let index = this.seeds.length - 1; index >= 0; index -= 1) {
      if (nowMs >= this.seeds[index]!.expiresAt) this.seeds.splice(index, 1);
    }
  }

  getSnapshot(): NanoSeedSnapshot[] {
    return this.seeds.map((seed) => this.snapshot(seed));
  }

  clear(): void { this.seeds.length = 0; }

  private addSeed(
    orbId: number,
    position: Vector,
    generation: number,
    nowMs: number,
    profile: NanoFusionProfile,
  ): void {
    this.seeds.push({
      seedId: this.nextId++,
      orbId,
      position: { ...position },
      radius: profile.radius,
      damage: profile.damage,
      generation,
      expiresAt: nowMs + profile.durationMs,
      tickMs: profile.tickMs,
      nextTickAt: nowMs,
      maximumGeneration: profile.maximumGeneration,
    });
  }

  private snapshot(seed: NanoSeedRecord): NanoSeedSnapshot {
    return {
      seedId: seed.seedId,
      orbId: seed.orbId,
      position: { ...seed.position },
      radius: seed.radius,
      damage: seed.damage,
      generation: seed.generation,
      expiresAt: seed.expiresAt,
    };
  }
}
