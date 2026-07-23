import { describe, expect, it } from 'vitest';
import { GAME_TUNING } from '../config/gameTuning';
import {
  advanceHiveCycle,
  aliveHiveModules,
  createHiveBossState,
  damageHivePart,
  exposedHiveParts,
} from './hiveBossRules';

describe('hive boss rules', () => {
  it.each([
    [3_999, 'shielded'],
    [4_000, 'telegraph'],
  ] as const)('uses the exact shield boundary at %i ms', (deltaMs, phase) => {
    expect(advanceHiveCycle(createHiveBossState(), deltaMs).phase).toBe(phase);
  });

  it.each([
    [1_499, 'telegraph'],
    [1_500, 'exposed'],
  ] as const)('uses the exact telegraph boundary at %i ms', (deltaMs, phase) => {
    const telegraph = advanceHiveCycle(createHiveBossState(), 4_000);
    expect(advanceHiveCycle(telegraph, deltaMs).phase).toBe(phase);
  });

  it.each([
    [6_999, 'exposed'],
    [7_000, 'shielded'],
  ] as const)('uses the exact exposure boundary at %i ms', (deltaMs, phase) => {
    const telegraph = advanceHiveCycle(createHiveBossState(), 4_000);
    const exposed = advanceHiveCycle(telegraph, 1_500);
    expect(advanceHiveCycle(exposed, deltaMs).phase).toBe(phase);
  });

  it('advances at most one phase and discards excess elapsed time', () => {
    expect(advanceHiveCycle(createHiveBossState(), 60_000)).toMatchObject({
      phase: 'telegraph',
      phaseElapsedMs: 0,
    });
  });

  it('keeps destroyed modules at zero and exposes the core permanently when all are gone', () => {
    let state = createHiveBossState();
    state = damageHivePart(state, 'leftShooter', 100);
    state = damageHivePart(state, 'leftShooter', 1);
    expect(state.parts.leftShooter).toBe(0);

    state = damageHivePart(state, 'rightShooter', 100);
    state = damageHivePart(state, 'leftReflector', 100);
    state = damageHivePart(state, 'rightReflector', 100);
    expect(state.phase).toBe('permanentlyExposed');
    expect(aliveHiveModules(state)).toEqual([]);
    expect(exposedHiveParts(state)).toEqual(['core']);
    expect(advanceHiveCycle(state, 60_000)).toMatchObject({
      phase: 'permanentlyExposed',
      phaseElapsedMs: 0,
      deploymentIndex: 1,
    });
  });

  it('ignores shielded core damage, accepts exposed damage, and defeats at zero', () => {
    const shielded = createHiveBossState();
    expect(damageHivePart(shielded, 'core', 10)).toEqual(shielded);

    const exposed = advanceHiveCycle(advanceHiveCycle(shielded, 4_000), 1_500);
    const damaged = damageHivePart(exposed, 'core', 10);
    expect(damaged.parts.core).toBe(GAME_TUNING.hiveBoss.core.hp - 10);
    const defeated = damageHivePart(damaged, 'core', 1_000);
    expect(defeated.phase).toBe('defeated');
    expect(aliveHiveModules(defeated)).toEqual([
      'leftShooter',
      'rightShooter',
      'leftReflector',
      'rightReflector',
    ]);
    expect(exposedHiveParts(defeated)).toEqual([]);
  });

  it('does not mutate prior state or its parts', () => {
    const initial = createHiveBossState();
    const next = damageHivePart(initial, 'leftShooter', 1);
    expect(initial.parts.leftShooter).toBe(GAME_TUNING.hiveBoss.shooter.hp);
    expect(next).not.toBe(initial);
    expect(next.parts).not.toBe(initial.parts);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])(
    'rejects invalid elapsed time %s',
    (deltaMs) => expect(() => advanceHiveCycle(createHiveBossState(), deltaMs)).toThrow(RangeError),
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])(
    'rejects invalid damage %s',
    (damage) => expect(() => damageHivePart(createHiveBossState(), 'leftShooter', damage)).toThrow(RangeError),
  );
});
