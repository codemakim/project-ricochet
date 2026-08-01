import type Phaser from 'phaser';
import {
  LAUNCH_INTERVAL_MS,
  ORB_PICKUP_RADIUS,
  ORB_RADIUS,
  ORB_SPEED,
  PLAYER_RADIUS,
  STARTING_ORB_COUNT,
  type ExperimentSettings,
} from '../constants';
import { GAME_TUNING } from '../config/gameTuning';
import { normalize, type Vector } from '../math/vector';
import type { PermanentDirectHitContext } from '../progression/BuildState';
import { LaunchQueue } from './launchQueue';
import {
  directHit,
  transitionOrb,
  type HitResult,
  type OrbState,
  type RecoverySource,
} from './orbRules';
import {
  ORB_CORE_DEFINITIONS,
  applyCoreWallBounce,
  conductionFlightProfile,
  coreDirectEffectProfile,
  coreLaunchSpeedMultiplier,
  createOrbCoreState,
  resolveExplosionOutcome,
  resolveCoreDirectHit,
  resolveCoreRecovery,
  type OrbCoreId,
  type OrbCoreState,
} from './orbCoreRules';

export { ORB_RADIUS } from '../constants';
const ATTRACTION_DURATION_MS = 100;
const RECALL_SPEED = ORB_SPEED;
const HIT_COOLDOWN_MS = 80;
const DEFAULT_RESTORED_CHARGES = 3;

export interface OrbSnapshot {
  id: number;
  coreType: OrbCoreId;
  level: number;
  coreState: OrbCoreState;
  state: OrbState;
  charges: number;
  damageEnabled: boolean;
  collisionEnabled: boolean;
  position: Vector;
  velocity: Vector;
  lastRecoverySource: RecoverySource | null;
  wallHits: number;
}

export interface PermanentHitResult extends HitResult {
  coreType: OrbCoreId;
  coreLevel: number;
  conductionTriggered: boolean;
  explosionFailures: number;
  speedRatio: number;
  firstHitAfterProximity?: boolean;
  echoStacks?: number;
  precisionHit?: boolean;
  echoPath?: readonly Vector[];
}

export interface OrbCallbacks {
  onEnemyDamage?: (enemyId: number, damage: number, reflect: boolean) => void;
  onRecovery?: (orbId: number, source: RecoverySource) => void;
  onCoreWallBounce?: (event: {
    orbId: number;
    coreType: OrbCoreId;
    coreLevel: number;
    position: Vector;
    echoStacks: number;
  }) => void;
  onConductionFlight?: (event: {
    orbId: number;
    position: Vector;
    level: number;
    targets: number;
    radius: number;
    damage: number;
  }) => void;
}

export type FixedTerrainLineOfSight = (orbPosition: Vector, playerPosition: Vector) => boolean;

interface OrbRecord extends OrbSnapshot {
  activeSinceMs: number | null;
  attractionElapsedMs: number;
  attractionStart: Vector;
  enemyHits: Map<number, number>;
  firstHitPending: boolean;
  directHitsSinceWall: number;
  hasDirectHit: boolean;
  killOverclockUntilMs: number;
  collisionAccelerationUntilMs: number;
  trackingUntilMs: number;
  lastNowMs: number;
  appliedFlightSpeedMultiplier: number;
  echoPath: Vector[];
  nextFlightLinkAtMs: number;
  inertiaHoldUntilMs: number;
  inertiaHeldSpeed: number;
}

export class OrbStore {
  private readonly records: OrbRecord[];
  private readonly launchQueue = new LaunchQueue(LAUNCH_INTERVAL_MS);
  private aimActivated = false;
  private startingCoresConfigured = false;

  constructor(
    private readonly settings: ExperimentSettings,
    private readonly callbacks: OrbCallbacks = {},
    private readonly hasFixedTerrainLineOfSight: FixedTerrainLineOfSight = () => false,
    private readonly getDirectDamageBonus: () => number = () => 0,
    private readonly getChargedSpeed: () => number = () => ORB_SPEED,
    private readonly getOrbLimit: () => number = () => GAME_TUNING.build.basicGrowth.maximumOrbs,
    private readonly getConditionalDirectDamageBonus: (
      context: PermanentDirectHitContext,
    ) => number = () => 0,
    private readonly getWallSpeedMultiplier: (wallHits: number) => number = () => 1,
    private readonly getOrbRadius: () => number = () => ORB_RADIUS,
    private readonly getRecoveryRadius: () => number = () => ORB_PICKUP_RADIUS,
    private readonly getFlightSpeedMultiplier: (
      killOverclockActive: boolean,
      collisionAccelerationActive: boolean,
    ) => number = () => 1,
    private readonly getTrackingRadiusBonus: (active: boolean) => number = () => 0,
    private readonly getTimedDurationMs: (baseMs: number) => number = (baseMs) => baseMs,
    private readonly getInertiaHitLimit: () => number = () => 1,
  ) {
    this.records = Array.from(
      { length: STARTING_ORB_COUNT },
      (_, id) => this.createRecord(id, 'echo'),
    );
  }

  configureStartingCores(
    types: readonly [OrbCoreId],
  ): boolean {
    if (this.aimActivated || this.startingCoresConfigured) return false;
    this.startingCoresConfigured = true;
    for (let index = 0; index < STARTING_ORB_COUNT; index += 1) {
      const record = this.records[index]!;
      record.coreType = types[index]!;
      record.coreState = createOrbCoreState();
    }
    return true;
  }

  addOrb(coreType: OrbCoreId = 'echo'): boolean {
    if (this.records.length >= this.runtimeOrbLimit()) return false;
    const record = this.createRecord(this.records.length, coreType);
    this.records.push(record);
    if (this.aimActivated) this.enqueue(record);
    return true;
  }

  upgradeOrb(id: number, expectedCoreType?: OrbCoreId): boolean {
    const record = this.records.find((candidate) => candidate.id === id);
    if (
      !record
      || (expectedCoreType !== undefined && record.coreType !== expectedCoreType)
      || record.level >= ORB_CORE_DEFINITIONS[record.coreType].maximumLevel
    ) {
      return false;
    }
    record.level += 1;
    return true;
  }

  private createRecord(id: number, coreType: OrbCoreId): OrbRecord {
    return {
      id,
      coreType,
      level: 1,
      coreState: createOrbCoreState(),
      state: 'stored',
      charges: DEFAULT_RESTORED_CHARGES,
      damageEnabled: false,
      collisionEnabled: false,
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      lastRecoverySource: null,
      wallHits: 0,
      activeSinceMs: null,
      attractionElapsedMs: 0,
      attractionStart: { x: 0, y: 0 },
      enemyHits: new Map(),
      firstHitPending: false,
      directHitsSinceWall: 0,
      hasDirectHit: false,
      killOverclockUntilMs: 0,
      collisionAccelerationUntilMs: 0,
      trackingUntilMs: 0,
      lastNowMs: 0,
      appliedFlightSpeedMultiplier: 1,
      echoPath: [],
      nextFlightLinkAtMs: 0,
      inertiaHoldUntilMs: 0,
      inertiaHeldSpeed: 0,
    };
  }

  activateAim(): void {
    if (this.aimActivated) return;
    this.aimActivated = true;
    for (const record of this.records) this.enqueue(record);
  }

  update(nowMs: number, deltaMs: number, playerPosition: Vector, aim: Vector): void {
    for (const record of this.records) {
      record.lastNowMs = nowMs;
      if (record.state === 'active') this.updateActive(record, nowMs, playerPosition);
      else if (record.state === 'attracting') this.updateAttraction(record, deltaMs, playerPosition);
      else if (record.state === 'floor-returning' || record.state === 'timeout-returning') {
        this.updateReturning(record, deltaMs, playerPosition);
      }
    }

    for (const id of this.launchQueue.drain(nowMs)) {
      const record = this.requireRecord(id);
      if (record.state === 'queued') this.launch(record, nowMs, playerPosition, aim);
    }
  }

  synchronizeActive(id: number, position: Vector, velocity: Vector): void {
    const record = this.requireRecord(id);
    if (record.state !== 'active') return;
    record.position = { ...position };
    record.velocity = { ...velocity };
  }

  handleWallBounce(id: number): boolean {
    const record = this.requireRecord(id);
    if (record.state !== 'active') return false;
    record.wallHits = Math.min(
      GAME_TUNING.build.wallAcceleration.maxStacks,
      record.wallHits + 1,
    );
    record.directHitsSinceWall = 0;
    record.coreState = applyCoreWallBounce(record.coreType, record.level, record.coreState);
    if (record.coreType === 'echo') {
      record.echoPath.push({ ...record.position });
      if (record.echoPath.length > GAME_TUNING.orbCores.echo.replay.pointCap) {
        record.echoPath.shift();
      }
    }
    this.callbacks.onCoreWallBounce?.({
      orbId: record.id,
      coreType: record.coreType,
      coreLevel: record.level,
      position: { ...record.position },
      echoStacks: record.coreState.echoStacks,
    });
    this.normalizeActiveSpeed(record);
    return true;
  }

  beginProximityRecovery(id: number): boolean {
    const record = this.requireRecord(id);
    if (record.state !== 'active') return false;
    record.state = transitionOrb(record.state, 'attracting');
    record.attractionElapsedMs = 0;
    record.attractionStart = { ...record.position };
    this.disableInteraction(record, 'proximity');
    return true;
  }

  beginFloorRecall(id: number): boolean {
    if (!this.settings.homeOnBottomHit) return false;
    return this.beginDirectReturn(id, 'floor-returning', 'floorRecall');
  }

  beginImmediateRecall(id: number): boolean {
    return this.beginDirectReturn(id, 'floor-returning', 'floorRecall');
  }

  handleEnemyHit(
    id: number,
    enemyId: number,
    enemyHp: number,
    nowMs: number,
    piercing: boolean,
    distanceFromPlayer = Number.POSITIVE_INFINITY,
  ): PermanentHitResult | null {
    const record = this.requireRecord(id);
    if (record.state !== 'active' || !record.damageEnabled) return null;
    record.lastNowMs = nowMs;
    const lastHitMs = record.enemyHits.get(enemyId);
    if (lastHitMs !== undefined && nowMs - lastHitMs < HIT_COOLDOWN_MS) return null;

    const source = record.lastRecoverySource;
    const firstHitAfterProximity = source === 'proximity' && record.firstHitPending;
    const echoStacks = record.coreState.echoStacks;
    const speed = Math.hypot(record.velocity.x, record.velocity.y);
    const precisionHit = record.wallHits === 0
      && record.directHitsSinceWall < (
        record.coreType === 'inertia' ? this.getInertiaHitLimit() : 1
      );
    const echoPath = record.coreType === 'echo'
      ? record.echoPath.map((point) => ({ ...point }))
      : [];
    const core = resolveCoreDirectHit(
      record.coreType,
      record.level,
      record.coreState,
      speed / ORB_SPEED,
    );
    const coreEffects = coreDirectEffectProfile(
      record.coreType,
      record.level,
      precisionHit,
      echoStacks,
    );
    const conditionalBonus = Math.min(
      GAME_TUNING.build.conditionalDamageCap,
      core.directDamageBonus + this.getConditionalDirectDamageBonus({
        distanceFromPlayer,
        wallHits: record.wallHits,
        speed,
        firstHitAfterProximity: source === 'proximity' && record.firstHitPending,
        consecutiveHits: record.directHitsSinceWall,
        killOverclockActive: nowMs < record.killOverclockUntilMs,
      }),
    );
    const result = directHit(
      record.charges,
      enemyHp,
      this.settings,
      piercing || coreEffects.pierce,
      this.getDirectDamageBonus(),
      conditionalBonus,
    );
    record.enemyHits.set(enemyId, nowMs);
    record.firstHitPending = false;
    const firstDirectHit = !record.hasDirectHit;
    record.hasDirectHit = true;
    record.directHitsSinceWall += 1;
    record.collisionAccelerationUntilMs = nowMs
      + this.getTimedDurationMs(
        GAME_TUNING.build.directHitFlight.collisionAccelerationDurationMs,
      );
    if (firstDirectHit) {
      record.trackingUntilMs = nowMs
        + this.getTimedDurationMs(GAME_TUNING.build.directHitFlight.trackingDurationMs);
    }
    if (result.killed) {
      record.killOverclockUntilMs = nowMs
        + this.getTimedDurationMs(GAME_TUNING.build.directHitFlight.killOverclockDurationMs);
    }
    record.charges = result.charges;
    record.coreState = core.next;
    if (record.coreType === 'echo') record.echoPath.length = 0;
    if (coreEffects.holdTopSpeedMs > 0) {
      record.inertiaHoldUntilMs = nowMs + this.getTimedDurationMs(coreEffects.holdTopSpeedMs);
      record.inertiaHeldSpeed = speed;
    }
    if (!result.preserveChargedKinetics) this.normalizeActiveSpeed(record);
    this.callbacks.onEnemyDamage?.(enemyId, result.damage, result.reflect);
    return {
      ...result,
      coreType: record.coreType,
      coreLevel: record.level,
      conductionTriggered: core.conductionTriggered,
      explosionFailures: record.coreState.explosionFailures,
      speedRatio: speed / ORB_SPEED,
      firstHitAfterProximity,
      echoStacks,
      precisionHit,
      echoPath,
    };
  }

  recordExplosionOutcome(id: number, triggered: boolean): void {
    const record = this.requireRecord(id);
    record.coreState = resolveExplosionOutcome(record.coreType, record.coreState, triggered);
  }

  refreshCombatModifiers(id?: number): void {
    if (id !== undefined) {
      const record = this.requireRecord(id);
      if (record.state === 'active') this.normalizeActiveSpeed(record);
      return;
    }
    for (const record of this.records) {
      if (record.state === 'active') this.normalizeActiveSpeed(record);
    }
  }

  getSnapshot(): OrbSnapshot[] {
    return this.records.map((record) => ({
      id: record.id,
      coreType: record.coreType,
      level: record.level,
      coreState: { ...record.coreState },
      state: record.state,
      charges: record.charges,
      damageEnabled: record.damageEnabled,
      collisionEnabled: record.collisionEnabled,
      position: { ...record.position },
      velocity: { ...record.velocity },
      lastRecoverySource: record.lastRecoverySource,
      wallHits: record.wallHits,
    }));
  }

  orbRadius(): number {
    return this.getOrbRadius();
  }

  destroy(): void {
    this.launchQueue.clear();
  }

  private updateActive(record: OrbRecord, nowMs: number, playerPosition: Vector): void {
    if (record.inertiaHeldSpeed > 0 && nowMs >= record.inertiaHoldUntilMs) {
      record.inertiaHeldSpeed = 0;
      this.normalizeActiveSpeed(record);
    }
    const flight = record.coreType === 'conduction'
      ? conductionFlightProfile(record.level)
      : null;
    if (flight && nowMs >= record.nextFlightLinkAtMs) {
      record.nextFlightLinkAtMs = nowMs + flight.tickMs;
      this.callbacks.onConductionFlight?.({
        orbId: record.id,
        position: { ...record.position },
        level: record.level,
        targets: flight.targets,
        radius: flight.radius,
        damage: flight.damage,
      });
    }
    if (this.flightSpeedMultiplier(record) !== record.appliedFlightSpeedMultiplier) {
      this.normalizeActiveSpeed(record);
    }
    if (
      this.settings.autoReturnAfterMs !== null
      && record.activeSinceMs !== null
      && nowMs - record.activeSinceMs >= this.settings.autoReturnAfterMs
    ) {
      this.beginDirectReturn(record.id, 'timeout-returning', 'timeoutRecall');
      return;
    }

    const distance = Math.hypot(record.position.x - playerPosition.x, record.position.y - playerPosition.y);
    const recoveryRadius = this.getRecoveryRadius()
      + this.getTrackingRadiusBonus(nowMs < record.trackingUntilMs);
    if (
      distance <= recoveryRadius
      && this.hasFixedTerrainLineOfSight(record.position, playerPosition)
    ) {
      this.beginProximityRecovery(record.id);
    }
  }

  private updateAttraction(record: OrbRecord, deltaMs: number, playerPosition: Vector): void {
    record.attractionElapsedMs = Math.min(ATTRACTION_DURATION_MS, record.attractionElapsedMs + Math.max(0, deltaMs));
    const progress = record.attractionElapsedMs / ATTRACTION_DURATION_MS;
    record.position = {
      x: record.attractionStart.x + (playerPosition.x - record.attractionStart.x) * progress,
      y: record.attractionStart.y + (playerPosition.y - record.attractionStart.y) * progress,
    };
    if (progress === 1) this.arrive(record);
  }

  private updateReturning(record: OrbRecord, deltaMs: number, playerPosition: Vector): void {
    const offset = {
      x: playerPosition.x - record.position.x,
      y: playerPosition.y - record.position.y,
    };
    const distance = Math.hypot(offset.x, offset.y);
    const step = RECALL_SPEED * Math.max(0, deltaMs) / 1000;
    if (distance <= Math.max(ORB_RADIUS, step)) {
      record.position = { ...playerPosition };
      this.arrive(record);
      return;
    }
    const direction = normalize(offset);
    record.velocity = { x: direction.x * RECALL_SPEED, y: direction.y * RECALL_SPEED };
    record.position = {
      x: record.position.x + direction.x * step,
      y: record.position.y + direction.y * step,
    };
  }

  private beginDirectReturn(id: number, state: 'floor-returning' | 'timeout-returning', source: RecoverySource): boolean {
    const record = this.requireRecord(id);
    if (record.state !== 'active') return false;
    record.state = transitionOrb(record.state, state);
    this.disableInteraction(record, source);
    return true;
  }

  private disableInteraction(record: OrbRecord, source: RecoverySource): void {
    record.collisionEnabled = false;
    record.damageEnabled = false;
    record.velocity = { x: 0, y: 0 };
    record.lastRecoverySource = source;
  }

  private arrive(record: OrbRecord): void {
    const source = record.lastRecoverySource;
    record.state = transitionOrb(record.state, 'stored');
    record.charges = DEFAULT_RESTORED_CHARGES;
    record.firstHitPending = source === 'proximity';
    record.coreState = resolveCoreRecovery(record.coreType, record.coreState, source!);
    record.velocity = { x: 0, y: 0 };
    this.callbacks.onRecovery?.(record.id, source!);
    this.enqueue(record);
  }

  private enqueue(record: OrbRecord): void {
    if (record.state !== 'stored') return;
    record.state = transitionOrb(record.state, 'queued');
    this.launchQueue.enqueue(record.id);
  }

  private launch(record: OrbRecord, nowMs: number, playerPosition: Vector, aim: Vector): void {
    const direction = normalize(aim);
    record.state = transitionOrb(record.state, 'active');
    record.wallHits = 0;
    record.directHitsSinceWall = 0;
    record.hasDirectHit = false;
    record.echoPath.length = 0;
    record.nextFlightLinkAtMs = nowMs;
    record.inertiaHoldUntilMs = 0;
    record.inertiaHeldSpeed = 0;
    const clearance = Math.max(
      PLAYER_RADIUS + this.getOrbRadius() + 4,
      this.getRecoveryRadius() + 1,
    );
    record.position = {
      x: playerPosition.x + direction.x * clearance,
      y: playerPosition.y + direction.y * clearance,
    };
    const speed = this.speedTarget(record);
    record.appliedFlightSpeedMultiplier = this.flightSpeedMultiplier(record);
    record.velocity = { x: direction.x * speed, y: direction.y * speed };
    record.collisionEnabled = true;
    record.damageEnabled = true;
    record.activeSinceMs = nowMs;
    record.enemyHits.clear();
  }

  private requireRecord(id: number): OrbRecord {
    const record = this.records[id];
    if (!record) throw new RangeError(`unknown orb id: ${id}`);
    return record;
  }

  private normalizeActiveSpeed(record: OrbRecord): void {
    const direction = normalize(record.velocity);
    const speed = this.speedTarget(record);
    record.velocity = { x: direction.x * speed, y: direction.y * speed };
    record.appliedFlightSpeedMultiplier = this.flightSpeedMultiplier(record);
  }

  private speedTarget(record: OrbRecord): number {
    const base = this.getChargedSpeed()
      * coreLaunchSpeedMultiplier(record.coreType, record.level)
      * this.getWallSpeedMultiplier(record.wallHits)
      * this.flightSpeedMultiplier(record);
    return record.lastNowMs < record.inertiaHoldUntilMs
      ? Math.max(base, record.inertiaHeldSpeed)
      : base;
  }

  private flightSpeedMultiplier(record: OrbRecord): number {
    return this.getFlightSpeedMultiplier(
        record.lastNowMs < record.killOverclockUntilMs,
        record.lastNowMs < record.collisionAccelerationUntilMs,
      );
  }

  private runtimeOrbLimit(): number {
    const limit = this.getOrbLimit();
    if (
      !Number.isInteger(limit)
      || limit < STARTING_ORB_COUNT
    ) {
      throw new RangeError(
        `orb limit must be an integer of at least ${STARTING_ORB_COUNT}`,
      );
    }
    return Math.min(limit, GAME_TUNING.build.basicGrowth.maximumOrbs);
  }
}

export type OrbSprite = Phaser.Physics.Arcade.Sprite & { orbId: number };

export interface OrbManagerOptions extends OrbCallbacks {
  settings: ExperimentSettings;
  hasFixedTerrainLineOfSight: FixedTerrainLineOfSight;
  getDirectDamageBonus(): number;
  getChargedSpeed(): number;
  getOrbLimit?(): number;
  getConditionalDirectDamageBonus?(context: PermanentDirectHitContext): number;
  getWallSpeedMultiplier?(wallHits: number): number;
  getOrbRadius?(): number;
  getRecoveryRadius?(): number;
  getFlightSpeedMultiplier?(
    killOverclockActive: boolean,
    collisionAccelerationActive: boolean,
  ): number;
  getTrackingRadiusBonus?(active: boolean): number;
  getTimedDurationMs?(baseMs: number): number;
  getInertiaHitLimit?(): number;
  startingCoreTypes?: readonly [OrbCoreId];
  textureKey?: string;
}

export class OrbManager {
  declare debugPlaceOrb?: (id: number, position: Vector) => boolean;

  private readonly store: OrbStore;
  private readonly sprites: OrbSprite[];
  private readonly spriteIds = new Map<OrbSprite, number>();
  private readonly world: Phaser.Physics.Arcade.World;
  private readonly scene: Phaser.Scene;
  private readonly textureKey: string;
  private readonly orbAddedListeners = new Set<(orb: OrbSprite) => void>();
  private destroyed = false;
  private readonly onWorldBounds = (
    body: Phaser.Physics.Arcade.Body,
    up: boolean,
    down: boolean,
    left: boolean,
    right: boolean,
  ): void => {
    const sprite = body?.gameObject as OrbSprite | undefined;
    if (!sprite || sprite.body !== body) return;
    const id = this.spriteIds.get(sprite);
    if (id === undefined) return;
    this.store.synchronizeActive(id, body.center, body.velocity);
    if (down && this.store.beginFloorRecall(id)) {
      this.synchronizeSprites();
      return;
    }
    if (up || down || left || right) this.store.handleWallBounce(id);
    this.synchronizeSprites();
  };

  constructor(scene: Phaser.Scene, options: OrbManagerOptions) {
    this.scene = scene;
    this.textureKey = options.textureKey ?? 'orb';
    this.store = new OrbStore(
      options.settings,
      options,
      options.hasFixedTerrainLineOfSight,
      options.getDirectDamageBonus,
      options.getChargedSpeed,
      options.getOrbLimit,
      options.getConditionalDirectDamageBonus,
      options.getWallSpeedMultiplier,
      options.getOrbRadius,
      options.getRecoveryRadius,
      options.getFlightSpeedMultiplier,
      options.getTrackingRadiusBonus,
      options.getTimedDurationMs,
      options.getInertiaHitLimit,
    );
    if (options.startingCoreTypes) {
      this.store.configureStartingCores(options.startingCoreTypes);
    }
    this.world = scene.physics.world;
    this.sprites = this.store.getSnapshot().map(({ id }) => this.createSprite(id));
    this.world.on('worldbounds', this.onWorldBounds);
    this.synchronizeSprites();
    if ((import.meta as ImportMeta & { env: { DEV: boolean } }).env.DEV) {
      this.debugPlaceOrb = (id, position) => {
        const owned = this.resolveOwnedOrb(id);
        const state = this.store.getSnapshot()[id];
        if (!owned || state?.state !== 'active') return false;
        const body = owned.sprite.body as Phaser.Physics.Arcade.Body;
        const velocity = { x: body.velocity.x, y: body.velocity.y };
        owned.sprite.setPosition(position.x, position.y);
        body.reset(position.x, position.y);
        body.setVelocity(velocity.x, velocity.y);
        this.store.synchronizeActive(id, position, velocity);
        return true;
      };
    }
  }

  activateAim(): void {
    this.store.activateAim();
  }

  configureStartingCores(
    types: readonly [OrbCoreId],
  ): boolean {
    if (this.destroyed) return false;
    const changed = this.store.configureStartingCores(types);
    if (changed) this.synchronizeSprites();
    return changed;
  }

  addOrb(coreType: OrbCoreId = 'echo'): boolean {
    if (this.destroyed) return false;
    if (!this.store.addOrb(coreType)) return false;
    const id = this.sprites.length;
    const sprite = this.createSprite(id);
    this.sprites.push(sprite);
    this.synchronizeSprites();
    for (const listener of this.orbAddedListeners) listener(sprite);
    return true;
  }

  upgradeOrb(id: number, expectedCoreType?: OrbCoreId): boolean {
    return !this.destroyed && this.store.upgradeOrb(id, expectedCoreType);
  }

  onOrbAdded(listener: (orb: OrbSprite) => void): () => void {
    if (this.destroyed) return () => {};
    this.orbAddedListeners.add(listener);
    return () => this.orbAddedListeners.delete(listener);
  }

  update(nowMs: number, deltaMs: number, playerPosition: Vector, aim: Vector): void {
    const snapshot = this.store.getSnapshot();
    for (const sprite of this.sprites) {
      const id = this.spriteIds.get(sprite);
      if (id === undefined) continue;
      const state = snapshot[id];
      if (state?.state === 'active') {
        this.synchronizeOwnedBody(sprite, id);
      }
    }
    this.store.update(nowMs, deltaMs, playerPosition, aim);
    this.synchronizeSprites();
  }

  beginProximityRecovery(orb: OrbSprite | number): boolean {
    const owned = this.resolveOwnedOrb(orb);
    if (!owned) return false;
    this.synchronizeOwnedSprite(owned.sprite, owned.id);
    const changed = this.store.beginProximityRecovery(owned.id);
    if (changed) this.synchronizeSprites();
    return changed;
  }

  beginFloorRecall(orb: OrbSprite | number): boolean {
    const owned = this.resolveOwnedOrb(orb);
    if (!owned) return false;
    this.synchronizeOwnedSprite(owned.sprite, owned.id);
    const changed = this.store.beginFloorRecall(owned.id);
    if (changed) this.synchronizeSprites();
    return changed;
  }

  beginImmediateRecall(orb: OrbSprite | number): boolean {
    const owned = this.resolveOwnedOrb(orb);
    if (!owned) return false;
    this.synchronizeOwnedSprite(owned.sprite, owned.id);
    const changed = this.store.beginImmediateRecall(owned.id);
    if (changed) this.synchronizeSprites();
    return changed;
  }

  handleEnemyHit(
    orb: OrbSprite | number,
    enemyId: number,
    enemyHp: number,
    nowMs: number,
    piercing: boolean,
    distanceFromPlayer = Number.POSITIVE_INFINITY,
  ): PermanentHitResult | null {
    const owned = this.resolveOwnedOrb(orb);
    if (!owned) return null;
    this.synchronizeOwnedBody(owned.sprite, owned.id);
    const result = this.store.handleEnemyHit(
      owned.id,
      enemyId,
      enemyHp,
      nowMs,
      piercing,
      distanceFromPlayer,
    );
    if (result && !result.reflect) this.synchronizeSprites();
    return result;
  }

  getSprites(): readonly OrbSprite[] {
    return this.sprites;
  }

  getSnapshot(): OrbSnapshot[] {
    return this.store.getSnapshot();
  }

  synchronizeOrb(orb: OrbSprite): boolean {
    const owned = this.resolveOwnedOrb(orb);
    if (!owned) return false;
    this.synchronizeOwnedBody(owned.sprite, owned.id);
    this.store.refreshCombatModifiers(owned.id);
    this.synchronizeSprites();
    return true;
  }

  refreshCombatModifiers(): void {
    const snapshot = this.store.getSnapshot();
    for (const sprite of this.sprites) {
      const id = this.spriteIds.get(sprite);
      if (id === undefined || snapshot[id]?.state !== 'active') continue;
      this.synchronizeOwnedBody(sprite, id);
    }
    this.store.refreshCombatModifiers();
    this.synchronizeSprites();
  }

  recordExplosionOutcome(orb: OrbSprite | number, triggered: boolean): void {
    const owned = this.resolveOwnedOrb(orb);
    if (owned) this.store.recordExplosionOutcome(owned.id, triggered);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.world.off('worldbounds', this.onWorldBounds);
    this.store.destroy();
    for (const sprite of this.sprites) sprite.destroy();
    this.spriteIds.clear();
    this.orbAddedListeners.clear();
  }

  private synchronizeSprites(): void {
    for (const state of this.store.getSnapshot()) {
      const sprite = this.sprites[state.id];
      if (!sprite) continue;
      const visible = state.state !== 'stored' && state.state !== 'queued';
      const body = sprite.body as Phaser.Physics.Arcade.Body;
      sprite.setCircle(this.currentOrbRadius());
      sprite.setTexture(`orb-${state.coreType}`);
      const activeBodyOwnsPosition = state.state === 'active' && body.enable;
      sprite.setVisible(visible);
      if (!activeBodyOwnsPosition) sprite.setPosition(state.position.x, state.position.y);
      body.enable = state.collisionEnabled;
      if (state.collisionEnabled) body.setVelocity(state.velocity.x, state.velocity.y);
      else body.setVelocity(0, 0);
    }
  }

  private createSprite(id: number): OrbSprite {
    const sprite = this.scene.physics.add.sprite(0, 0, this.textureKey) as OrbSprite;
    sprite.orbId = id;
    sprite.setCircle(this.currentOrbRadius())
      .setBounce(1, 1)
      .setCollideWorldBounds(true)
      .setVisible(false);
    (sprite.body as Phaser.Physics.Arcade.Body).onWorldBounds = true;
    this.spriteIds.set(sprite, id);
    return sprite;
  }

  private synchronizeOwnedSprite(sprite: OrbSprite, id: number): void {
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    this.store.synchronizeActive(id, sprite, body.velocity);
  }

  private synchronizeOwnedBody(sprite: OrbSprite, id: number): void {
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    if (body.gameObject !== sprite) return;
    this.store.synchronizeActive(id, body.center, body.velocity);
  }

  private resolveOwnedOrb(orb: OrbSprite | number): { id: number; sprite: OrbSprite } | null {
    if (typeof orb === 'number') {
      if (!Number.isInteger(orb)) return null;
      const sprite = this.sprites[orb];
      return sprite ? { id: orb, sprite } : null;
    }
    const id = this.spriteIds.get(orb);
    return id === undefined ? null : { id, sprite: orb };
  }

  private currentOrbRadius(): number {
    return this.store.orbRadius();
  }
}
