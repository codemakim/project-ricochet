import { describe, expect, it } from 'vitest';
import { directHit, recoveryBonusAllowed, transitionOrb, type OrbState } from './orbRules';

describe('orb rules', () => {
  it('spends one charge and deals 1.5 direct damage', () => {
    expect(directHit(3, 1, { passThroughOnKill: false }, false)).toEqual({
      charged: true,
      charges: 2,
      damage: 1.5,
      killed: true,
      reflect: true,
      preserveChargedKinetics: false,
    });
  });

  it('adds the direct damage bonus without a charge', () => {
    expect(directHit(0, 2, { passThroughOnKill: false }, false, 0.25)).toEqual({
      charged: false,
      charges: 0,
      damage: 1.25,
      killed: false,
      reflect: true,
      preserveChargedKinetics: false,
    });
  });

  it('adds a finite non-negative direct damage bonus', () => {
    expect(directHit(1, 3, { passThroughOnKill: false }, false, 0.25)).toMatchObject({
      charged: true,
      charges: 0,
      damage: 1.75,
    });
  });

  it('adds the charged bonus only while a permanent orb has a charge', () => {
    expect(directHit(1, 9, { passThroughOnKill: false }, false, 0.25, 0.75)).toMatchObject({
      charged: true,
      charges: 0,
      damage: 2.5,
    });
    expect(directHit(0, 9, { passThroughOnKill: false }, false, 0.25, 0.75)).toMatchObject({
      charged: false,
      charges: 0,
      damage: 1.25,
    });
  });

  it('lets only a charged lethal reward hit pass through while consuming its charge', () => {
    expect(directHit(1, 1.5, { passThroughOnKill: false }, false, 0, 0, true)).toMatchObject({
      charged: true,
      charges: 0,
      killed: true,
      reflect: false,
      preserveChargedKinetics: true,
    });
    expect(directHit(1, 2, { passThroughOnKill: false }, false, 0, 0, true))
      .toMatchObject({ reflect: true, preserveChargedKinetics: false });
    expect(directHit(0, 1, { passThroughOnKill: false }, false, 0, 0, true))
      .toMatchObject({ reflect: true, preserveChargedKinetics: false });
  });

  it('does not preserve charged kinetics for experiment or ordinary piercing pass-through', () => {
    expect(directHit(1, 1, { passThroughOnKill: true }, false))
      .toMatchObject({ reflect: false, preserveChargedKinetics: false });
    expect(directHit(1, 99, { passThroughOnKill: false }, true))
      .toMatchObject({ reflect: false, preserveChargedKinetics: false });
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid direct damage bonus %s',
    (bonus) => {
      expect(() => directHit(0, 1, { passThroughOnKill: false }, false, bonus)).toThrow(RangeError);
    },
  );

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid charged damage bonus %s before calculating damage',
    (bonus) => {
      expect(() => directHit(
        1,
        1,
        { passThroughOnKill: false },
        false,
        0,
        bonus,
      )).toThrow(new RangeError('charged damage bonus must be finite and non-negative'));
    },
  );

  it('continues through a kill only when enabled', () => {
    expect(directHit(3, 1, { passThroughOnKill: true }, false).reflect).toBe(false);
    expect(directHit(3, 3, { passThroughOnKill: true }, false).reflect).toBe(true);
    expect(directHit(3, 3, { passThroughOnKill: false }, true).reflect).toBe(false);
  });

  it('lets piercing override reflection for a killing hit', () => {
    expect(directHit(0, 1, { passThroughOnKill: false }, true).reflect).toBe(false);
  });

  it('allows pickup bonuses only for proximity', () => {
    expect(recoveryBonusAllowed('proximity')).toBe(true);
    expect(recoveryBonusAllowed('floorRecall')).toBe(false);
    expect(recoveryBonusAllowed('timeoutRecall')).toBe(false);
  });

  it.each<[OrbState, OrbState]>([
    ['stored', 'queued'],
    ['queued', 'active'],
    ['active', 'attracting'],
    ['active', 'floor-returning'],
    ['active', 'timeout-returning'],
    ['attracting', 'stored'],
    ['floor-returning', 'stored'],
    ['timeout-returning', 'stored'],
  ])('allows %s -> %s', (from, to) => {
    expect(transitionOrb(from, to)).toBe(to);
  });

  it('rejects illegal state transitions', () => {
    expect(() => transitionOrb('stored', 'active')).toThrow(RangeError);
    expect(() => transitionOrb('active', 'stored')).toThrow(RangeError);
  });
});
