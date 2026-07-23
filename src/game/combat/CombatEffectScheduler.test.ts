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
});
