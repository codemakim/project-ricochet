import { describe, expect, it } from 'vitest';
import { CombatProcState, resolveProcAttempt } from './CombatProcState';

describe('resolveProcAttempt', () => {
  it('forces a 25% proc on the eighth eligible attempt', () => {
    let failures = 0;
    for (let attempt = 1; attempt <= 7; attempt += 1) {
      const result = resolveProcAttempt(0.25, failures, 0.99);
      expect(result.triggered).toBe(false);
      failures = result.nextFailures;
    }

    expect(resolveProcAttempt(0.25, failures, 0.99)).toEqual({
      triggered: true,
      nextFailures: 0,
    });
  });

  it('resets failures on a normal success', () => {
    expect(resolveProcAttempt(0.2, 3, 0.1)).toEqual({
      triggered: true,
      nextFailures: 0,
    });
  });
});

describe('CombatProcState', () => {
  it('reproduces interleaved effect results for the same seed', () => {
    const baseline = new CombatProcState(1234);
    const interleaved = new CombatProcState(1234);
    const baselineExplosions = [
      baseline.tryProc('explosion', 0, 0, 0.2, 120),
      baseline.tryProc('explosion', 1, 200, 0.2, 120),
    ];

    const firstInterleavedExplosion = interleaved.tryProc('explosion', 0, 0, 0.2, 120);
    interleaved.tryProc('split', 0, 0, 0.25, 120);
    const secondInterleavedExplosion = interleaved.tryProc('explosion', 1, 200, 0.2, 120);

    expect([firstInterleavedExplosion, secondInterleavedExplosion]).toEqual(baselineExplosions);
  });

  it('splits once per flight and resets on recovery', () => {
    const state = new CombatProcState(0);
    let split = false;
    for (let hit = 0; hit < 8; hit += 1) {
      split ||= state.trySplit(2, hit * 120, 0.25, 120);
    }

    expect(split).toBe(true);
    expect(state.trySplit(2, 2_000, 1, 120)).toBe(false);
    state.resetOrbFlight(2);
    expect(state.trySplit(2, 2_000, 1, 120)).toBe(true);
  });

  it('blocks the same orb and effect until cooldown ends', () => {
    const state = new CombatProcState(0);

    expect(state.tryProc('explosion', 3, 100, 1, 120)).toBe(true);
    expect(state.tryProc('explosion', 3, 219, 1, 120)).toBe(false);
    expect(state.tryProc('explosion', 3, 220, 1, 120)).toBe(true);
  });
});
