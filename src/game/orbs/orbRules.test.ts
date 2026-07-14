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
    });
  });

  it('deals 1 direct damage without a charge', () => {
    expect(directHit(0, 1, { passThroughOnKill: false }, false)).toEqual({
      charged: false,
      charges: 0,
      damage: 1,
      killed: true,
      reflect: true,
    });
  });

  it('adds a finite non-negative direct damage bonus', () => {
    expect(directHit(1, 3, { passThroughOnKill: false }, false, 0.25)).toMatchObject({
      charged: true,
      charges: 0,
      damage: 1.75,
    });
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid direct damage bonus %s',
    (bonus) => {
      expect(() => directHit(0, 1, { passThroughOnKill: false }, false, bonus)).toThrow(RangeError);
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
