import type Phaser from 'phaser';
import {
  LAUNCH_INTERVAL_MS,
  ORB_PICKUP_RADIUS,
  ORB_SPEED,
  PLAYER_RADIUS,
  STARTING_ORB_COUNT,
  type ExperimentSettings,
} from '../constants';
import { normalize, type Vector } from '../math/vector';
import { LaunchQueue } from './launchQueue';
import {
  directHit,
  transitionOrb,
  type HitResult,
  type OrbState,
  type RecoverySource,
} from './orbRules';

export const ORB_RADIUS = 8;

const SPAWN_CLEARANCE = PLAYER_RADIUS + ORB_RADIUS + 4;
const ATTRACTION_DURATION_MS = 100;
const RECALL_SPEED = ORB_SPEED;
const HIT_COOLDOWN_MS = 80;
const RESTORED_CHARGES = 3;

export interface OrbSnapshot {
  id: number;
  state: OrbState;
  charges: number;
  damageEnabled: boolean;
  collisionEnabled: boolean;
  position: Vector;
  velocity: Vector;
  lastRecoverySource: RecoverySource | null;
}

export interface OrbCallbacks {
  onEnemyDamage?: (enemyId: number, damage: number, reflect: boolean) => void;
  onRecovery?: (source: RecoverySource) => void;
}

export type FixedTerrainLineOfSight = (orbPosition: Vector, playerPosition: Vector) => boolean;

interface OrbRecord extends OrbSnapshot {
  activeSinceMs: number | null;
  attractionElapsedMs: number;
  attractionStart: Vector;
  enemyHits: Map<number, number>;
}

export class OrbStore {
  private readonly records: OrbRecord[];
  private readonly launchQueue = new LaunchQueue(LAUNCH_INTERVAL_MS);
  private aimActivated = false;

  constructor(
    private readonly settings: ExperimentSettings,
    private readonly callbacks: OrbCallbacks = {},
    private readonly hasFixedTerrainLineOfSight: FixedTerrainLineOfSight = () => false,
  ) {
    this.records = Array.from({ length: STARTING_ORB_COUNT }, (_, id) => ({
      id,
      state: 'stored',
      charges: RESTORED_CHARGES,
      damageEnabled: false,
      collisionEnabled: false,
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      lastRecoverySource: null,
      activeSinceMs: null,
      attractionElapsedMs: 0,
      attractionStart: { x: 0, y: 0 },
      enemyHits: new Map(),
    }));
  }

  activateAim(): void {
    if (this.aimActivated) return;
    this.aimActivated = true;
    for (const record of this.records) this.enqueue(record);
  }

  update(nowMs: number, deltaMs: number, playerPosition: Vector, aim: Vector): void {
    for (const record of this.records) {
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

  handleEnemyHit(
    id: number,
    enemyId: number,
    enemyHp: number,
    nowMs: number,
    piercing: boolean,
  ): HitResult | null {
    const record = this.requireRecord(id);
    if (record.state !== 'active' || !record.damageEnabled) return null;
    const lastHitMs = record.enemyHits.get(enemyId);
    if (lastHitMs !== undefined && nowMs - lastHitMs < HIT_COOLDOWN_MS) return null;

    record.enemyHits.set(enemyId, nowMs);
    const result = directHit(record.charges, enemyHp, this.settings, piercing);
    record.charges = result.charges;
    this.callbacks.onEnemyDamage?.(enemyId, result.damage, result.reflect);
    return result;
  }

  getSnapshot(): OrbSnapshot[] {
    return this.records.map((record) => ({
      id: record.id,
      state: record.state,
      charges: record.charges,
      damageEnabled: record.damageEnabled,
      collisionEnabled: record.collisionEnabled,
      position: { ...record.position },
      velocity: { ...record.velocity },
      lastRecoverySource: record.lastRecoverySource,
    }));
  }

  destroy(): void {
    this.launchQueue.clear();
  }

  private updateActive(record: OrbRecord, nowMs: number, playerPosition: Vector): void {
    if (
      this.settings.autoReturnAfterMs !== null
      && record.activeSinceMs !== null
      && nowMs - record.activeSinceMs >= this.settings.autoReturnAfterMs
    ) {
      this.beginDirectReturn(record.id, 'timeout-returning', 'timeoutRecall');
      return;
    }

    const distance = Math.hypot(record.position.x - playerPosition.x, record.position.y - playerPosition.y);
    if (distance <= ORB_PICKUP_RADIUS && this.hasFixedTerrainLineOfSight(record.position, playerPosition)) {
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
    record.charges = RESTORED_CHARGES;
    record.velocity = { x: 0, y: 0 };
    this.callbacks.onRecovery?.(source!);
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
    record.position = {
      x: playerPosition.x + direction.x * SPAWN_CLEARANCE,
      y: playerPosition.y + direction.y * SPAWN_CLEARANCE,
    };
    record.velocity = { x: direction.x * ORB_SPEED, y: direction.y * ORB_SPEED };
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
}

export type OrbSprite = Phaser.Physics.Arcade.Sprite & { orbId: number };

export interface OrbManagerOptions extends OrbCallbacks {
  settings: ExperimentSettings;
  hasFixedTerrainLineOfSight: FixedTerrainLineOfSight;
  textureKey?: string;
}

export class OrbManager {
  private readonly store: OrbStore;
  private readonly sprites: OrbSprite[];

  constructor(scene: Phaser.Scene, options: OrbManagerOptions) {
    this.store = new OrbStore(options.settings, options, options.hasFixedTerrainLineOfSight);
    const textureKey = options.textureKey ?? 'orb';
    this.sprites = this.store.getSnapshot().map(({ id }) => {
      const sprite = scene.physics.add.sprite(0, 0, textureKey) as OrbSprite;
      sprite.orbId = id;
      sprite.setCircle(ORB_RADIUS).setBounce(1, 1).setCollideWorldBounds(true).setVisible(false);
      return sprite;
    });
    this.synchronizeSprites();
  }

  activateAim(): void {
    this.store.activateAim();
  }

  update(nowMs: number, deltaMs: number, playerPosition: Vector, aim: Vector): void {
    for (const sprite of this.sprites) {
      const state = this.store.getSnapshot()[sprite.orbId];
      if (state?.state === 'active') {
        const body = sprite.body as Phaser.Physics.Arcade.Body;
        this.store.synchronizeActive(sprite.orbId, sprite, body.velocity);
      }
    }
    this.store.update(nowMs, deltaMs, playerPosition, aim);
    this.synchronizeSprites();
  }

  beginProximityRecovery(orb: OrbSprite | number): boolean {
    return this.store.beginProximityRecovery(this.orbId(orb));
  }

  beginFloorRecall(orb: OrbSprite | number): boolean {
    return this.store.beginFloorRecall(this.orbId(orb));
  }

  handleEnemyHit(
    orb: OrbSprite | number,
    enemyId: number,
    enemyHp: number,
    nowMs: number,
    piercing: boolean,
  ): HitResult | null {
    return this.store.handleEnemyHit(this.orbId(orb), enemyId, enemyHp, nowMs, piercing);
  }

  getSprites(): readonly OrbSprite[] {
    return this.sprites;
  }

  getSnapshot(): OrbSnapshot[] {
    return this.store.getSnapshot();
  }

  destroy(): void {
    this.store.destroy();
    for (const sprite of this.sprites) sprite.destroy();
  }

  private synchronizeSprites(): void {
    for (const state of this.store.getSnapshot()) {
      const sprite = this.sprites[state.id];
      if (!sprite) continue;
      const visible = state.state !== 'stored' && state.state !== 'queued';
      sprite.setVisible(visible).setPosition(state.position.x, state.position.y);
      const body = sprite.body as Phaser.Physics.Arcade.Body;
      body.enable = state.collisionEnabled;
      if (state.collisionEnabled) body.setVelocity(state.velocity.x, state.velocity.y);
      else body.setVelocity(0, 0);
    }
  }

  private orbId(orb: OrbSprite | number): number {
    return typeof orb === 'number' ? orb : orb.orbId;
  }
}
