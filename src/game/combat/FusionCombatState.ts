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

export interface MirrorCircuitProfile {
  durationMs: number;
  tickMs: number;
  damage: number;
  maximumMirrors: number;
  thickness: number;
  intersectionBlast: { radius: number; damage: number } | null;
}

export function mirrorCircuitProfile(level: number): MirrorCircuitProfile {
  const index = levelIndex(level);
  const tuning = GAME_TUNING.orbFusions.mirrorCircuit;
  return {
    durationMs: tuning.durationMsByLevel[index]!,
    tickMs: tuning.tickMs,
    damage: tuning.damageByLevel[index]!,
    maximumMirrors: tuning.maximumMirrorsByLevel[index]!,
    thickness: tuning.thicknessByLevel[index]!,
    intersectionBlast: level >= tuning.intersectionFromLevel
      ? { radius: tuning.intersectionRadius, damage: tuning.intersectionDamage }
      : null,
  };
}

export interface MeltdownCoreProfile {
  chance: number;
  cooldownMs: number;
  radius: number;
  durationMs: number;
  tickMs: number;
  damage: number;
  heatPerHit: number;
  heatThreshold: number;
  meltdownDamage: number;
  maximumZones: number;
  bossHeatCap: number;
}

export function meltdownCoreProfile(level: number): MeltdownCoreProfile {
  const index = levelIndex(level);
  const tuning = GAME_TUNING.orbFusions.meltdownCore;
  return {
    chance: tuning.chanceByLevel[index]!,
    cooldownMs: tuning.cooldownMs,
    radius: tuning.radiusByLevel[index]!,
    durationMs: tuning.durationMsByLevel[index]!,
    tickMs: tuning.tickMs,
    damage: tuning.damageByLevel[index]!,
    heatPerHit: tuning.heatPerHitByLevel[index]!,
    heatThreshold: tuning.thresholdByLevel[index]!,
    meltdownDamage: tuning.meltdownDamageByLevel[index]!,
    maximumZones: tuning.maximumZones,
    bossHeatCap: tuning.bossHeatCap,
  };
}

export interface VectorBladeProfile {
  length: number;
  damage: number;
  thickness: number;
  maximumVectors: number;
  speedScale: number;
  pathScale: number;
  replayCount: number;
}

export function vectorBladeProfile(level: number): VectorBladeProfile {
  const index = levelIndex(level);
  const tuning = GAME_TUNING.orbFusions.vectorBlade;
  return {
    length: tuning.lengthByLevel[index]!,
    damage: tuning.damageByLevel[index]!,
    thickness: tuning.thicknessByLevel[index]!,
    maximumVectors: tuning.maximumVectorsByLevel[index]!,
    speedScale: tuning.speedScale,
    pathScale: tuning.pathScale,
    replayCount: level >= tuning.replayFromLevel ? 2 : 1,
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

export interface MirrorCircuitSnapshot {
  mirrorId: number;
  orbId: number;
  start: Vector;
  end: Vector;
  thickness: number;
  damage: number;
  expiresAt: number;
}

interface MirrorCircuitRecord extends MirrorCircuitSnapshot {
  tickMs: number;
  nextTickAt: number;
}

export class MirrorCircuitState {
  private readonly mirrors: MirrorCircuitRecord[] = [];
  private readonly lastPoints = new Map<number, { position: Vector; expiresAt: number }>();
  private nextId = 0;

  add(
    orbId: number,
    position: Vector,
    nowMs: number,
    profile: MirrorCircuitProfile,
  ): { segment: MirrorCircuitSnapshot | null; intersections: Vector[] } {
    this.update(nowMs);
    const previous = this.lastPoints.get(orbId);
    this.lastPoints.set(orbId, {
      position: { ...position },
      expiresAt: nowMs + profile.durationMs,
    });
    if (!previous || Math.hypot(position.x - previous.position.x, position.y - previous.position.y) === 0) {
      return { segment: null, intersections: [] };
    }

    const intersections = profile.intersectionBlast ? this.mirrors
      .map((mirror) => segmentIntersection(previous.position, position, mirror.start, mirror.end))
      .filter((point): point is Vector => point !== null)
      .filter((point) => [previous.position, position].every((endpoint) => (
        Math.hypot(point.x - endpoint.x, point.y - endpoint.y) > ENDPOINT_EPSILON
      ))) : [];
    const owned = this.mirrors.filter((mirror) => mirror.orbId === orbId);
    while (owned.length >= profile.maximumMirrors) {
      const oldest = owned.shift()!;
      this.mirrors.splice(this.mirrors.indexOf(oldest), 1);
    }
    const record: MirrorCircuitRecord = {
      mirrorId: this.nextId++,
      orbId,
      start: { ...previous.position },
      end: { ...position },
      thickness: profile.thickness,
      damage: profile.damage,
      expiresAt: nowMs + profile.durationMs,
      tickMs: profile.tickMs,
      nextTickAt: nowMs,
    };
    this.mirrors.push(record);
    return { segment: this.snapshot(record), intersections };
  }

  drainDue(nowMs: number): MirrorCircuitSnapshot[] {
    this.update(nowMs);
    const due = this.mirrors.filter((mirror) => nowMs >= mirror.nextTickAt);
    for (const mirror of due) mirror.nextTickAt = nowMs + mirror.tickMs;
    return due.map((mirror) => this.snapshot(mirror));
  }

  update(nowMs: number): void {
    for (let index = this.mirrors.length - 1; index >= 0; index -= 1) {
      if (nowMs >= this.mirrors[index]!.expiresAt) this.mirrors.splice(index, 1);
    }
    for (const [orbId, point] of this.lastPoints) {
      if (nowMs >= point.expiresAt) this.lastPoints.delete(orbId);
    }
  }

  getSnapshot(): MirrorCircuitSnapshot[] {
    return this.mirrors.map((mirror) => this.snapshot(mirror));
  }

  clear(): void {
    this.mirrors.length = 0;
    this.lastPoints.clear();
  }

  private snapshot(mirror: MirrorCircuitRecord): MirrorCircuitSnapshot {
    return {
      mirrorId: mirror.mirrorId,
      orbId: mirror.orbId,
      start: { ...mirror.start },
      end: { ...mirror.end },
      thickness: mirror.thickness,
      damage: mirror.damage,
      expiresAt: mirror.expiresAt,
    };
  }
}

export interface MeltdownZoneSnapshot {
  zoneId: number;
  position: Vector;
  radius: number;
  heat: number;
  damage: number;
  expiresAt: number;
}

interface MeltdownZoneRecord extends MeltdownZoneSnapshot {
  baseDamage: number;
  tickMs: number;
  nextTickAt: number;
}

export class MeltdownZoneState {
  private readonly zones: MeltdownZoneRecord[] = [];
  private nextId = 0;

  addHeat(
    position: Vector,
    boss: boolean,
    nowMs: number,
    profile: MeltdownCoreProfile,
  ): { erupted: boolean; zone: MeltdownZoneSnapshot | null } {
    this.update(nowMs);
    let zone = this.zones.find((candidate) => (
      Math.hypot(candidate.position.x - position.x, candidate.position.y - position.y)
      <= candidate.radius
    ));
    if (!zone) {
      while (this.zones.length >= profile.maximumZones) this.zones.shift();
      zone = {
        zoneId: this.nextId++,
        position: { ...position },
        radius: profile.radius,
        heat: 0,
        damage: 0,
        baseDamage: profile.damage,
        expiresAt: nowMs + profile.durationMs,
        tickMs: profile.tickMs,
        nextTickAt: nowMs,
      };
      this.zones.push(zone);
    }
    const cap = boss ? profile.bossHeatCap : profile.heatThreshold;
    zone.heat = Math.min(cap, zone.heat + profile.heatPerHit);
    zone.damage = zone.baseDamage * zone.heat;
    zone.expiresAt = nowMs + profile.durationMs;
    const snapshot = this.snapshot(zone);
    if (zone.heat < profile.heatThreshold) return { erupted: false, zone: snapshot };
    this.zones.splice(this.zones.indexOf(zone), 1);
    return { erupted: true, zone: snapshot };
  }

  drainDue(nowMs: number): MeltdownZoneSnapshot[] {
    this.update(nowMs);
    const due = this.zones.filter((zone) => nowMs >= zone.nextTickAt);
    for (const zone of due) zone.nextTickAt = nowMs + zone.tickMs;
    return due.map((zone) => this.snapshot(zone));
  }

  update(nowMs: number): void {
    for (let index = this.zones.length - 1; index >= 0; index -= 1) {
      if (nowMs >= this.zones[index]!.expiresAt) this.zones.splice(index, 1);
    }
  }

  getSnapshot(): MeltdownZoneSnapshot[] {
    return this.zones.map((zone) => this.snapshot(zone));
  }

  clear(): void { this.zones.length = 0; }

  private snapshot(zone: MeltdownZoneRecord): MeltdownZoneSnapshot {
    return {
      zoneId: zone.zoneId,
      position: { ...zone.position },
      radius: zone.radius,
      heat: zone.heat,
      damage: zone.damage,
      expiresAt: zone.expiresAt,
    };
  }
}

export interface StoredBladeVector {
  direction: Vector;
  pathLength: number;
}

export class VectorBladeState {
  private readonly vectors = new Map<number, StoredBladeVector[]>();

  recordBounce(
    orbId: number,
    vector: Vector,
    pathLength: number,
    profile: VectorBladeProfile,
  ): void {
    const records = this.vectors.get(orbId) ?? [];
    records.push({ direction: normalize(vector), pathLength });
    while (records.length > profile.maximumVectors) records.shift();
    this.vectors.set(orbId, records);
  }

  consume(orbId: number): StoredBladeVector[] {
    const records = this.vectors.get(orbId) ?? [];
    this.vectors.delete(orbId);
    return records.map((record) => ({
      direction: { ...record.direction },
      pathLength: record.pathLength,
    }));
  }

  clear(): void { this.vectors.clear(); }
}
