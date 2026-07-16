import { describe, expect, it } from 'vitest';
import {
  bossPhase,
  createBossState,
  damageBossPart,
  exposedBossParts,
  nextBossAttack,
} from './bossRules';

describe('boss part rules', () => {
  it('starts with two 14 HP weakpoints hiding a 36 HP core', () => {
    const state = createBossState();

    expect(state).toEqual({
      leftWeakpointHp: 14,
      rightWeakpointHp: 14,
      coreHp: 36,
      attackIndex: 0,
    });
    expect(bossPhase(state)).toBe('twoWeakpoints');
    expect(exposedBossParts(state)).toEqual(['leftWeakpoint', 'rightWeakpoint']);
  });

  it('rejects damage to the hidden core without mutating state', () => {
    const state = createBossState();

    expect(() => damageBossPart(state, 'core', 5)).toThrow('core is not exposed');
    expect(state).toEqual(createBossState());
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects non-finite or non-positive damage %s',
    (damage) => {
      expect(() => damageBossPart(createBossState(), 'leftWeakpoint', damage)).toThrow(
        'damage must be finite and positive',
      );
    },
  );

  it('returns new states, clamps damage, and advances through every phase', () => {
    const initial = createBossState();
    const oneWeakpoint = damageBossPart(initial, 'leftWeakpoint', 99);
    const core = damageBossPart(oneWeakpoint, 'rightWeakpoint', 14);
    const defeated = damageBossPart(core, 'core', 36);

    expect(initial.leftWeakpointHp).toBe(14);
    expect(oneWeakpoint.leftWeakpointHp).toBe(0);
    expect(bossPhase(oneWeakpoint)).toBe('oneWeakpoint');
    expect(exposedBossParts(oneWeakpoint)).toEqual(['rightWeakpoint']);
    expect(bossPhase(core)).toBe('core');
    expect(exposedBossParts(core)).toEqual(['core']);
    expect(bossPhase(defeated)).toBe('defeated');
    expect(exposedBossParts(defeated)).toEqual([]);
  });

  it('offers exposed parts in stable order so area damage selects only one part', () => {
    const state = createBossState();
    const areaTarget = exposedBossParts(state)[0];

    expect(areaTarget).toBe('leftWeakpoint');
    const damaged = damageBossPart(state, areaTarget!, 4);
    expect(damaged).toMatchObject({ leftWeakpointHp: 10, rightWeakpointHp: 14 });
  });
});

describe('boss attack schedule', () => {
  it('alternates weakpoint patterns and uses 2800ms with two weakpoints', () => {
    const first = nextBossAttack(createBossState());
    const second = nextBossAttack(first.state);

    expect(first).toMatchObject({ patterns: ['aimedShot'], intervalMs: 2800 });
    expect(second).toMatchObject({ patterns: ['supportDrop'], intervalMs: 2800 });
    expect(second.state.attackIndex).toBe(2);
  });

  it('uses 2300ms with one weakpoint', () => {
    const state = damageBossPart(createBossState(), 'leftWeakpoint', 14);

    expect(nextBossAttack(state)).toMatchObject({ patterns: ['aimedShot'], intervalMs: 2300 });
  });

  it.each([1, 2])(
    'starts the core cadence at aimedShot after %i prior weakpoint attacks',
    (priorAttackCount) => {
      let state = createBossState();
      for (let attack = 0; attack < priorAttackCount; attack += 1) {
        state = nextBossAttack(state).state;
      }
      state = damageBossPart(damageBossPart(state, 'leftWeakpoint', 14), 'rightWeakpoint', 14);

      expect(nextBossAttack(state)).toMatchObject({
        patterns: ['aimedShot'],
        intervalMs: 1900,
      });
    },
  );

  it('repeats aimedShot, supportDrop, and both across core attacks 1-6', () => {
    let state = damageBossPart(
      damageBossPart(createBossState(), 'leftWeakpoint', 14),
      'rightWeakpoint',
      14,
    );
    const attacks = [];
    for (let attack = 0; attack < 6; attack += 1) {
      const result = nextBossAttack(state);
      attacks.push(result.patterns);
      state = result.state;
    }

    expect(attacks).toEqual([
      ['aimedShot'],
      ['supportDrop'],
      ['aimedShot', 'supportDrop'],
      ['aimedShot'],
      ['supportDrop'],
      ['aimedShot', 'supportDrop'],
    ]);
    expect(state.attackIndex).toBe(6);
  });

  it('rejects attack scheduling after defeat', () => {
    let state = damageBossPart(
      damageBossPart(createBossState(), 'leftWeakpoint', 14),
      'rightWeakpoint',
      14,
    );
    state = damageBossPart(state, 'core', 36);

    expect(() => nextBossAttack(state)).toThrow('defeated boss cannot attack');
  });
});
