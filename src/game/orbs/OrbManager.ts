import type Phaser from 'phaser';
import {
  LAUNCH_INTERVAL_MS,
  MAX_ORB_COUNT,
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

const SPAWN_CLEARANCE = Math.max(PLAYER_RADIUS + ORB_RADIUS + 4, ORB_PICKUP_RADIUS + 1);
const ATTRACTION_DURATION_MS = 100;
const RECALL_SPEED = ORB_SPEED;
const HIT_COOLDOWN_MS = 80;
const DEFAULT_RESTORED_CHARGES = 3;

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
  firstHitPending: boolean;
}

export class OrbStore {
  private readonly records: OrbRecord[];
  private readonly launchQueue = new LaunchQueue(LAUNCH_INTERVAL_MS);
  private aimActivated = false;

  constructor(
    private readonly settings: ExperimentSettings,
    private readonly callbacks: OrbCallbacks = {},
    private readonly hasFixedTerrainLineOfSight: FixedTerrainLineOfSight = () => false,
    private readonly getDirectDamageBonus: () => number = () => 0,
    private readonly getChargedSpeed: () => number = () => ORB_SPEED,
    private readonly getRestoredCharges: (source: RecoverySource) => number = () => DEFAULT_RESTORED_CHARGES,
    private readonly getOpeningHitBonus: (source: RecoverySource, firstHitPending: boolean) => number = () => 0,
  ) {
    this.records = Array.from({ length: STARTING_ORB_COUNT }, (_, id) => this.createRecord(id));
  }

  addOrb(): boolean {
    if (this.records.length >= MAX_ORB_COUNT) return false;
    const record = this.createRecord(this.records.length);
    this.records.push(record);
    if (this.aimActivated) this.enqueue(record);
    return true;
  }

  private createRecord(id: number): OrbRecord {
    return {
      id,
      state: 'stored',
      charges: DEFAULT_RESTORED_CHARGES,
      damageEnabled: false,
      collisionEnabled: false,
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      lastRecoverySource: null,
      activeSinceMs: null,
      attractionElapsedMs: 0,
      attractionStart: { x: 0, y: 0 },
      enemyHits: new Map(),
      firstHitPending: false,
    };
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
    const source = record.lastRecoverySource;
    const openingBonus = source === null ? 0 : this.getOpeningHitBonus(source, record.firstHitPending);
    const result = directHit(
      record.charges,
      enemyHp,
      this.settings,
      piercing,
      this.getDirectDamageBonus() + openingBonus,
    );
    record.firstHitPending = false;
    record.charges = result.charges;
    this.normalizeActiveSpeed(record);
    this.callbacks.onEnemyDamage?.(enemyId, result.damage, result.reflect);
    return result;
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
    record.charges = this.getRestoredCharges(source!);
    record.firstHitPending = source === 'proximity';
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
    const speed = this.speedTarget(record);
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
  }

  private speedTarget(record: OrbRecord): number {
    return record.charges > 0 ? this.getChargedSpeed() : ORB_SPEED;
  }
}

export type OrbSprite = Phaser.Physics.Arcade.Sprite & { orbId: number };

export interface OrbManagerOptions extends OrbCallbacks {
  settings: ExperimentSettings;
  hasFixedTerrainLineOfSight: FixedTerrainLineOfSight;
  getDirectDamageBonus(): number;
  getChargedSpeed(): number;
  getRestoredCharges?(source: RecoverySource): number;
  getOpeningHitBonus?(source: RecoverySource, firstHitPending: boolean): number;
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
  private readonly onWorldBounds = (
    body: Phaser.Physics.Arcade.Body,
    _up: boolean,
    down: boolean,
  ): void => {
    if (!down) return;
    const sprite = body?.gameObject as OrbSprite | undefined;
    if (!sprite || sprite.body !== body) return;
    const id = this.spriteIds.get(sprite);
    if (id === undefined) return;
    this.store.synchronizeActive(id, body.center, body.velocity);
    if (this.store.beginFloorRecall(id)) this.synchronizeSprites();
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
      options.getRestoredCharges,
      options.getOpeningHitBonus,
    );
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

  addOrb(): boolean {
    if (!this.store.addOrb()) return false;
    const id = this.sprites.length;
    this.sprites.push(this.createSprite(id));
    this.synchronizeSprites();
    return true;
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

  handleEnemyHit(
    orb: OrbSprite | number,
    enemyId: number,
    enemyHp: number,
    nowMs: number,
    piercing: boolean,
  ): HitResult | null {
    const owned = this.resolveOwnedOrb(orb);
    if (!owned) return null;
    this.synchronizeOwnedBody(owned.sprite, owned.id);
    const result = this.store.handleEnemyHit(owned.id, enemyId, enemyHp, nowMs, piercing);
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

  destroy(): void {
    this.world.off('worldbounds', this.onWorldBounds);
    this.store.destroy();
    for (const sprite of this.sprites) sprite.destroy();
    this.spriteIds.clear();
  }

  private synchronizeSprites(): void {
    for (const state of this.store.getSnapshot()) {
      const sprite = this.sprites[state.id];
      if (!sprite) continue;
      const visible = state.state !== 'stored' && state.state !== 'queued';
      const body = sprite.body as Phaser.Physics.Arcade.Body;
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
    sprite.setCircle(ORB_RADIUS).setBounce(1, 1).setCollideWorldBounds(true).setVisible(false);
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
}
