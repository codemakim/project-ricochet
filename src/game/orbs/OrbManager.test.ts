import { describe, expect, it, vi } from 'vitest';
import { EXPERIMENT_DEFAULTS, ORB_SPEED, PLAYER_RADIUS } from '../constants';
import { OrbStore } from './OrbManager';

const player = { x: 100, y: 200 };
const up = { x: 0, y: -1 };

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
