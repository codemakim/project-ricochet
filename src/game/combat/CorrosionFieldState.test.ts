import { describe, expect, it } from 'vitest';
import { CorrosionFieldState } from './CorrosionFieldState';

describe('CorrosionFieldState', () => {
  it('ignites and removes overlapping fields for a fraction of remaining damage', () => {
    const fields = new CorrosionFieldState();
    fields.spawn(1, { x: 10, y: 10 }, 0);
    fields.spawn(2, { x: 200, y: 200 }, 0);

    const ignited = fields.igniteOverlapping({ x: 20, y: 10 }, 20, 500, 0.5);

    expect(ignited).toEqual([expect.objectContaining({
      position: { x: 10, y: 10 },
      damage: 0.5,
    })]);
    expect(fields.getSnapshot()).toHaveLength(1);
    expect(fields.getSnapshot()[0]!.position).toEqual({ x: 200, y: 200 });
  });
  it('keeps only the newest two fields for each permanent orb', () => {
    const fields = new CorrosionFieldState();
    fields.spawn(1, { x: 10, y: 10 }, 0);
    fields.spawn(1, { x: 20, y: 10 }, 1);
    fields.spawn(1, { x: 30, y: 10 }, 2);
    fields.spawn(2, { x: 40, y: 10 }, 3);

    expect(fields.getSnapshot().map((field) => ({
      orbId: field.orbId,
      x: field.position.x,
    }))).toEqual([
      { orbId: 1, x: 20 },
      { orbId: 1, x: 30 },
      { orbId: 2, x: 40 },
    ]);
  });

  it('emits five fixed ticks from gameplay time and then expires', () => {
    const fields = new CorrosionFieldState();
    fields.spawn(0, { x: 10, y: 10 }, 0);

    expect(fields.drainDue(499)).toEqual([]);
    expect(fields.drainDue(2_500)).toHaveLength(5);
    expect(fields.getSnapshot()).toEqual([]);
    expect(fields.drainDue(3_000)).toEqual([]);
  });

  it('does not repeat already drained ticks', () => {
    const fields = new CorrosionFieldState();
    fields.spawn(0, { x: 10, y: 10 }, 0);

    expect(fields.drainDue(1_000)).toHaveLength(2);
    expect(fields.drainDue(1_000)).toEqual([]);
    expect(fields.drainDue(1_500)).toHaveLength(1);
  });

  it('keeps per-field modified duration, radius, and damage', () => {
    const fields = new CorrosionFieldState();
    fields.spawn(0, { x: 10, y: 10 }, 0, {
      durationMs: 3_250,
      radius: 54.6,
      damage: 0.29,
    });

    expect(fields.getSnapshot()[0]).toMatchObject({ expiresAtMs: 3_250, radius: 54.6, damage: 0.29 });
    expect(fields.drainDue(500)[0]).toMatchObject({ radius: 54.6, damage: 0.29 });
  });

  it('clears every pending field', () => {
    const fields = new CorrosionFieldState();
    fields.spawn(0, { x: 10, y: 10 }, 0);
    fields.spawn(1, { x: 20, y: 10 }, 0);

    fields.clear();

    expect(fields.getSnapshot()).toEqual([]);
    expect(fields.drainDue(3_000)).toEqual([]);
  });

  it('follows an attached enemy and removes the field when the target disappears', () => {
    const fields = new CorrosionFieldState();
    fields.spawn(0, { x: 10, y: 10 }, 0, { attachedEnemyId: 7, spreadsOnDeath: true });

    expect(fields.drainDue(500, (id) => id === 7 ? { x: 40, y: 50 } : null)[0])
      .toMatchObject({ position: { x: 40, y: 50 }, attachedEnemyId: 7 });
    fields.drainDue(1_000, () => null);
    expect(fields.getSnapshot()).toEqual([]);
  });

  it('replaces an attached field with one death-spread field', () => {
    const fields = new CorrosionFieldState();
    fields.spawn(0, { x: 10, y: 10 }, 0, { attachedEnemyId: 7, spreadsOnDeath: true });

    expect(fields.spreadAttachedOnDeath(7, { x: 30, y: 40 }, 200, {
      radius: 32,
      durationMs: 1500,
      damage: 0.15,
    })).toBe(true);
    expect(fields.getSnapshot()).toEqual([expect.objectContaining({
      position: { x: 30, y: 40 },
      radius: 32,
      damage: 0.15,
      expiresAtMs: 1700,
      attachedEnemyId: undefined,
    })]);
  });

  it('enforces the global field cap', () => {
    const fields = new CorrosionFieldState();
    for (let index = 0; index <= 12; index += 1) {
      fields.spawn(index, { x: index, y: 0 }, index);
    }
    expect(fields.getSnapshot()).toHaveLength(12);
    expect(fields.getSnapshot()[0]!.orbId).toBe(1);
  });
});
