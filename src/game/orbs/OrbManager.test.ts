import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import { EXPERIMENT_DEFAULTS, ORB_SPEED, PLAYER_RADIUS } from '../constants';
import { OrbManager, OrbStore } from './OrbManager';

const player = { x: 100, y: 200 };
const up = { x: 0, y: -1 };

type WorldBoundsListener = (body: FakeBody, up: boolean, down: boolean, left: boolean, right: boolean) => void;

class FakeWorld {
  private readonly listeners = new Set<WorldBoundsListener>();

  on(event: string, listener: WorldBoundsListener): void {
    if (event === 'worldbounds') this.listeners.add(listener);
  }

  off(event: string, listener: WorldBoundsListener): void {
    if (event === 'worldbounds') this.listeners.delete(listener);
  }

  emit(body: FakeBody, down: boolean): void {
    for (const listener of this.listeners) listener(body, false, down, false, false);
  }

  listenerCount(): number {
    return this.listeners.size;
  }
}

class FakeBody {
  enable = true;
  onWorldBounds = false;
  velocity = { x: 0, y: 0 };
  center = { x: 0, y: 0 };

  constructor(readonly gameObject: FakeSprite | object) {}

  setVelocity(x: number, y: number): this {
    this.velocity = { x, y };
    return this;
  }
}

class FakeSprite {
  orbId = -1;
  x = 0;
  y = 0;
  visible = true;
  destroyed = false;
  readonly body = new FakeBody(this);

  setCircle(): this { return this; }
  setBounce(): this { return this; }
  setCollideWorldBounds(): this { return this; }
  setVisible(visible: boolean): this { this.visible = visible; return this; }
  setPosition(x: number, y: number): this { this.x = x; this.y = y; return this; }
  destroy(): void { this.destroyed = true; }
}

function createManager(
  homeOnBottomHit = true,
  hasFixedTerrainLineOfSight: () => boolean = () => false,
  autoReturnAfterMs: number | null = null,
) {
  const world = new FakeWorld();
  const sprites: FakeSprite[] = [];
  const scene = {
    physics: {
      world,
      add: {
        sprite: () => {
          const sprite = new FakeSprite();
          sprites.push(sprite);
          return sprite;
        },
      },
    },
  } as unknown as Phaser.Scene;
  const manager = new OrbManager(scene, {
    settings: { ...EXPERIMENT_DEFAULTS, homeOnBottomHit, autoReturnAfterMs },
    hasFixedTerrainLineOfSight,
  });
  return { manager, sprites, world };
}

describe('OrbStore', () => {
  it('queues the three permanent orbs once and releases them 100ms apart', () => {
    const store = new OrbStore(EXPERIMENT_DEFAULTS);

    expect(store.getSnapshot().map(({ id, state }) => ({ id, state }))).toEqual([
      { id: 0, state: 'stored' },
      { id: 1, state: 'stored' },
      { id: 2, state: 'stored' },
    ]);

    store.activateAim();
    store.activateAim();
    expect(store.getSnapshot().map((orb) => orb.state)).toEqual(['queued', 'queued', 'queued']);

    store.update(0, 0, player, up);
    expect(store.getSnapshot().map((orb) => orb.state)).toEqual(['active', 'queued', 'queued']);
    expect(store.getSnapshot()[0]).toMatchObject({
      position: { x: 100, y: 170 },
      velocity: { x: 0, y: -ORB_SPEED },
    });

    store.update(99, 99, player, up);
    expect(store.getSnapshot().map((orb) => orb.state)).toEqual(['active', 'queued', 'queued']);
    store.update(100, 1, player, up);
    expect(store.getSnapshot().map((orb) => orb.state)).toEqual(['active', 'active', 'queued']);
  });

  it('disables collision and damage when proximity recovery begins', () => {
    const store = new OrbStore(EXPERIMENT_DEFAULTS);
    store.activateAim();
    store.update(0, 0, player, up);

    expect(store.beginProximityRecovery(0)).toBe(true);
    expect(store.getSnapshot()[0]).toMatchObject({
      state: 'attracting',
      collisionEnabled: false,
      damageEnabled: false,
      lastRecoverySource: 'proximity',
    });
    expect(store.beginFloorRecall(0)).toBe(false);
  });

  it('ignores floor recall when the experiment is disabled', () => {
    const store = new OrbStore({ ...EXPERIMENT_DEFAULTS, homeOnBottomHit: false });
    store.activateAim();
    store.update(0, 0, player, up);

    expect(store.beginFloorRecall(0)).toBe(false);
    expect(store.getSnapshot()[0]).toMatchObject({
      state: 'active',
      collisionEnabled: true,
      damageEnabled: true,
    });
  });

  it('starts proximity attraction only inside 50px with fixed-terrain line of sight', () => {
    const blocked = new OrbStore(EXPERIMENT_DEFAULTS, undefined, () => false);
    blocked.activateAim();
    blocked.update(0, 0, player, { x: 1, y: 0 });
    blocked.synchronizeActive(0, { x: player.x + 50, y: player.y }, { x: 12, y: 34 });
    blocked.update(1, 1, player, up);
    expect(blocked.getSnapshot()[0]?.state).toBe('active');

    const visible = new OrbStore(EXPERIMENT_DEFAULTS, undefined, () => true);
    visible.activateAim();
    visible.update(0, 0, player, { x: 1, y: 0 });
    visible.synchronizeActive(0, { x: player.x + 50, y: player.y }, { x: 12, y: 34 });
    visible.update(1, 1, player, up);
    expect(visible.getSnapshot()[0]?.state).toBe('attracting');
  });

  it('finishes attraction after 100ms, restores charges, and relaunches using latest aim', () => {
    const onRecovery = vi.fn();
    const store = new OrbStore(EXPERIMENT_DEFAULTS, { onRecovery });
    store.activateAim();
    store.update(0, 0, player, up);
    store.update(100, 100, player, up);
    store.update(200, 100, player, up);
    store.beginProximityRecovery(0);

    store.update(250, 50, player, up);
    expect(store.getSnapshot()[0]?.state).toBe('attracting');
    store.update(300, 50, player, { x: 1, y: 0 });

    expect(onRecovery).toHaveBeenCalledOnce();
    expect(onRecovery).toHaveBeenCalledWith('proximity');
    expect(store.getSnapshot()[0]).toMatchObject({
      state: 'active',
      charges: 3,
      position: { x: player.x + PLAYER_RADIUS + 8 + 4, y: player.y },
      velocity: { x: ORB_SPEED, y: 0 },
    });
  });

  it('homes from any distance after floor recall', () => {
    const store = new OrbStore(EXPERIMENT_DEFAULTS);
    store.activateAim();
    store.update(0, 0, player, up);
    store.synchronizeActive(0, { x: 100, y: 700 }, { x: 0, y: ORB_SPEED });

    expect(store.beginFloorRecall(0)).toBe(true);
    store.update(1, 100, player, up);

    expect(store.getSnapshot()[0]).toMatchObject({
      state: 'floor-returning',
      collisionEnabled: false,
      damageEnabled: false,
    });
    expect(store.getSnapshot()[0]!.position.y).toBeLessThan(700);
  });

  it('enforces an 80ms per-orb/per-enemy hit cooldown and emits damage decisions', () => {
    const onEnemyDamage = vi.fn();
    const store = new OrbStore(EXPERIMENT_DEFAULTS, { onEnemyDamage });
    store.activateAim();
    store.update(0, 0, player, up);

    const first = store.handleEnemyHit(0, 7, 3, 1000, false);
    expect(first).toMatchObject({ damage: 1.5, reflect: true });
    expect(store.handleEnemyHit(0, 7, 3, 1079, false)).toBeNull();
    expect(store.handleEnemyHit(0, 8, 1, 1079, false)).not.toBeNull();
    expect(store.handleEnemyHit(0, 7, 1, 1080, true)).toMatchObject({ reflect: false });
    expect(onEnemyDamage).toHaveBeenCalledTimes(3);
  });

  it('accepts Phaser position and reflected velocity as active-orb state', () => {
    const store = new OrbStore(EXPERIMENT_DEFAULTS);
    store.activateAim();
    store.update(0, 0, player, up);

    store.synchronizeActive(0, { x: 42, y: 84 }, { x: -300, y: 200 });

    expect(store.getSnapshot()[0]).toMatchObject({
      position: { x: 42, y: 84 },
      velocity: { x: -300, y: 200 },
    });
  });
});

describe('OrbManager Phaser adapter', () => {
  it('owns bottom world-bound recall and disables the body immediately from the exact contact position', () => {
    const { manager, sprites, world } = createManager();
    manager.activateAim();
    manager.update(0, 0, player, up);
    const sprite = sprites[0]!;
    expect(sprite.body.onWorldBounds).toBe(true);
    sprite.setPosition(47, 700);
    sprite.body.center = { x: 47, y: 798 };
    sprite.body.setVelocity(20, 400);

    world.emit(sprite.body, true);

    expect(manager.getSnapshot()[0]).toMatchObject({
      state: 'floor-returning',
      position: { x: 47, y: 798 },
      damageEnabled: false,
      collisionEnabled: false,
    });
    expect(sprite.body.enable).toBe(false);
  });

  it('retains bottom bounce when floor recall is disabled', () => {
    const { manager, sprites, world } = createManager(false);
    manager.activateAim();
    manager.update(0, 0, player, up);
    const sprite = sprites[0]!;

    world.emit(sprite.body, true);

    expect(manager.getSnapshot()[0]?.state).toBe('active');
    expect(sprite.body.enable).toBe(true);
  });

  it('synchronizes public recovery starts and applies body state immediately', () => {
    const { manager, sprites } = createManager();
    manager.activateAim();
    manager.update(0, 0, player, up);
    manager.update(100, 100, player, up);
    const sprite = sprites[0]!;
    sprite.setPosition(61, 222);
    sprite.body.setVelocity(-30, 90);

    expect(manager.beginProximityRecovery(sprite as unknown as Phaser.Physics.Arcade.Sprite & { orbId: number })).toBe(true);

    expect(manager.getSnapshot()[0]).toMatchObject({ state: 'attracting', position: { x: 61, y: 222 } });
    expect(sprite.body.enable).toBe(false);

    const second = sprites[1]!;
    second.setPosition(77, 798);
    expect(manager.beginFloorRecall(1)).toBe(true);
    expect(manager.getSnapshot()[1]).toMatchObject({ state: 'floor-returning', position: { x: 77, y: 798 } });
    expect(second.body.enable).toBe(false);
  });

  it('preserves reflected Phaser velocity during update', () => {
    const { manager, sprites } = createManager();
    manager.activateAim();
    manager.update(0, 0, player, up);
    const sprite = sprites[0]!;
    sprite.setPosition(88, 99);
    sprite.body.center = { x: 88, y: 99 };
    sprite.body.setVelocity(-222, 123);

    manager.update(1, 1, player, up);

    expect(manager.getSnapshot()[0]).toMatchObject({
      position: { x: 88, y: 99 },
      velocity: { x: -222, y: 123 },
    });
  });

  it('uses private sprite identity instead of mutable orbId during update ingestion', () => {
    const { manager, sprites } = createManager();
    manager.activateAim();
    manager.update(0, 0, player, up);
    manager.update(100, 100, player, up);
    const first = sprites[0]!;
    const second = sprites[1]!;
    first.setPosition(11, 22);
    first.body.center = { x: 11, y: 22 };
    first.body.setVelocity(33, 44);
    second.setPosition(55, 66);
    second.body.center = { x: 55, y: 66 };
    second.body.setVelocity(77, 88);
    second.orbId = 0;

    manager.update(101, 1, player, up);

    expect(manager.getSnapshot()[0]).toMatchObject({ position: { x: 11, y: 22 }, velocity: { x: 33, y: 44 } });
    expect(manager.getSnapshot()[1]).toMatchObject({ position: { x: 55, y: 66 }, velocity: { x: 77, y: 88 } });
  });

  it('uses current body center so stale sprite coordinates do not trigger proximity recovery', () => {
    const { manager, sprites } = createManager(true, () => true);
    manager.activateAim();
    manager.update(0, 0, player, up);
    const sprite = sprites[0]!;
    sprite.setPosition(100, 170);
    sprite.body.center = { x: 300, y: 400 };
    sprite.body.setVelocity(-222, 123);
    sprite.orbId = 2;

    manager.update(1, 1, player, up);

    expect(manager.getSnapshot()[0]).toMatchObject({
      state: 'active',
      position: { x: 300, y: 400 },
      velocity: { x: -222, y: 123 },
    });
  });

  it('starts timeout return from current body center instead of stale sprite coordinates', () => {
    const { manager, sprites } = createManager(true, () => false, 1);
    manager.activateAim();
    manager.update(0, 0, player, up);
    const sprite = sprites[0]!;
    sprite.setPosition(100, 170);
    sprite.body.center = { x: 320, y: 500 };
    sprite.body.setVelocity(40, -300);
    sprite.orbId = 2;

    manager.update(1, 1, player, up);

    expect(manager.getSnapshot()[0]).toMatchObject({
      state: 'timeout-returning',
      position: { x: 320, y: 500 },
      lastRecoverySource: 'timeoutRecall',
    });
  });

  it('ignores foreign and malformed physics objects without mutation or exceptions', () => {
    const { manager, sprites, world } = createManager();
    manager.activateAim();
    manager.update(0, 0, player, up);
    const before = manager.getSnapshot();
    const foreign = new FakeSprite();
    foreign.orbId = 0;

    expect(() => world.emit(foreign.body, true)).not.toThrow();
    expect(() => world.emit(new FakeBody({ orbId: 0 }), true)).not.toThrow();
    expect(manager.beginFloorRecall(foreign as unknown as Phaser.Physics.Arcade.Sprite & { orbId: number })).toBe(false);
    expect(manager.beginFloorRecall(999)).toBe(false);
    expect(manager.handleEnemyHit(foreign as unknown as Phaser.Physics.Arcade.Sprite & { orbId: number }, 1, 3, 1, false)).toBeNull();
    expect(manager.getSnapshot()).toEqual(before);
    expect(sprites[0]!.body.enable).toBe(true);
  });

  it('removes the worldbounds listener and destroys owned sprites', () => {
    const { manager, sprites, world } = createManager();
    expect(world.listenerCount()).toBe(1);

    manager.destroy();

    expect(world.listenerCount()).toBe(0);
    expect(sprites.every((sprite) => sprite.destroyed)).toBe(true);
  });
});
