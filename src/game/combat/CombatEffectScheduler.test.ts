import { describe, expect, it } from 'vitest';
import { CombatEffectScheduler } from './CombatEffectScheduler';

describe('CombatEffectScheduler', () => {
  it('releases an aftershock at 350ms but not 349ms', () => {
    const scheduler = new CombatEffectScheduler();
    scheduler.scheduleAftershock(1_000, { x: 12, y: 34 }, 40, 0.5);

    expect(scheduler.drainDue(1_349)).toEqual([]);
    expect(scheduler.drainDue(1_350)).toEqual([{
      id: 0,
      dueAt: 1_350,
      position: { x: 12, y: 34 },
      radius: 40,
      damage: 0.5,
      kind: 'aftershock',
    }]);
  });

  it('advances only from passed gameplay time so a pause holds the effect', () => {
    const scheduler = new CombatEffectScheduler();
    scheduler.scheduleAftershock(500, { x: 1, y: 2 }, 8, 2);

    expect(scheduler.drainDue(500)).toEqual([]);
    expect(scheduler.drainDue(500)).toEqual([]);
    expect(scheduler.getSnapshot()).toHaveLength(1);
    expect(scheduler.drainDue(850)).toHaveLength(1);
  });

  it('clears every pending effect without reusing ids', () => {
    const scheduler = new CombatEffectScheduler();
    scheduler.scheduleAftershock(0, { x: 0, y: 0 }, 10, 1);
    scheduler.clear();

    expect(scheduler.getSnapshot()).toEqual([]);
    expect(scheduler.drainDue(1_000)).toEqual([]);

    scheduler.scheduleAftershock(1_000, { x: 0, y: 0 }, 10, 1);
    expect(scheduler.getSnapshot()[0]?.id).toBe(1);
  });

  it('drains effects by due time when they were scheduled out of order', () => {
    const scheduler = new CombatEffectScheduler();
    scheduler.scheduleAftershock(1_000, { x: 1, y: 1 }, 10, 1);
    scheduler.scheduleAftershock(100, { x: 2, y: 2 }, 20, 2);

    expect(scheduler.drainDue(450).map(({ id }) => id)).toEqual([1]);
    expect(scheduler.getSnapshot().map(({ id }) => id)).toEqual([0]);
    expect(scheduler.drainDue(1_350).map(({ id }) => id)).toEqual([0]);
  });

  it.each([
    ['time', Number.NaN, { x: 1, y: 2 }, 3, 4],
    ['negative time', -1, { x: 1, y: 2 }, 3, 4],
    ['position x', 0, { x: Number.POSITIVE_INFINITY, y: 2 }, 3, 4],
    ['position y', 0, { x: 1, y: Number.NaN }, 3, 4],
    ['radius', 0, { x: 1, y: 2 }, -1, 4],
    ['infinite radius', 0, { x: 1, y: 2 }, Number.POSITIVE_INFINITY, 4],
    ['damage', 0, { x: 1, y: 2 }, 3, -1],
    ['infinite damage', 0, { x: 1, y: 2 }, 3, Number.POSITIVE_INFINITY],
  ] as const)('rejects invalid schedule %s without corrupting the queue', (
    _label,
    nowMs,
    position,
    radius,
    damage,
  ) => {
    const scheduler = new CombatEffectScheduler();
    scheduler.scheduleAftershock(0, { x: 0, y: 0 }, 1, 1);

    expect(() => scheduler.scheduleAftershock(nowMs, position, radius, damage)).toThrow(RangeError);
    expect(scheduler.getSnapshot()).toHaveLength(1);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid drain time %s without removing pending effects',
    (nowMs) => {
      const scheduler = new CombatEffectScheduler();
      scheduler.scheduleAftershock(0, { x: 0, y: 0 }, 1, 1);

      expect(() => scheduler.drainDue(nowMs)).toThrow(
        new RangeError('gameplay time must be finite and non-negative'),
      );
      expect(scheduler.getSnapshot()).toHaveLength(1);
    },
  );
});
