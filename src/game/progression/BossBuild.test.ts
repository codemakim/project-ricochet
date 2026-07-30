import { describe, expect, it } from 'vitest';
import { BossBuild } from './BossBuild';

describe('BossBuild', () => {
  it('stores approved relics once in acquisition order', () => {
    const build = new BossBuild();
    build.acquire('auxiliary-link');
    build.acquire('cross-cut');

    expect(build.snapshot()).toEqual(['auxiliary-link', 'cross-cut']);
    expect(() => build.acquire('auxiliary-link')).toThrow('auxiliary-link is already owned');
    expect(() => build.acquire('expanded-magazine' as never)).toThrow('unknown boss reward');
    expect(() => build.acquire('auxiliary-orbit' as never)).toThrow('unknown boss reward');
  });

  it('scales temporary procs, cross cuts, gas ignition, and recursive split', () => {
    const build = new BossBuild();
    expect(build.temporaryProcChance(0.2)).toBe(0);
    expect(build.crossCutDamage(2)).toBe(0);
    expect(build.gasIgnitionFraction()).toBe(0);
    expect(build.recursiveSplit()).toBeNull();

    build.acquire('auxiliary-link');
    build.acquire('cross-cut');
    build.acquire('gas-ignition');
    build.acquire('recursive-split');

    expect(build.temporaryProcChance(0.2)).toBeCloseTo(0.05);
    expect(build.crossCutDamage(2)).toBeCloseTo(1.2);
    expect(build.gasIgnitionFraction()).toBe(0.5);
    expect(build.recursiveSplit()).toEqual({ chance: 0.2, childCount: 1 });
  });

  it('exposes direct-hit and core modifiers only while owned', () => {
    const build = new BossBuild();
    expect(build.inertiaHitLimit()).toBe(1);
    expect(build.completeCycleEnabled()).toBe(false);
    expect(build.reloadSecondaryBonus(0.6)).toBe(0);
    expect(build.conductionHitsRequired(4)).toBe(4);
    expect(build.conductionDamage(0.45)).toBe(0.45);
    expect(build.resonanceRupture(5, 5)).toBeNull();

    build.acquire('inertia-retention');
    build.acquire('complete-cycle');
    build.acquire('direct-link');
    build.acquire('superconducting-circuit');
    build.acquire('resonance-rupture');

    expect(build.inertiaHitLimit()).toBe(2);
    expect(build.completeCycleEnabled()).toBe(true);
    expect(build.reloadSecondaryBonus(0.6)).toBeCloseTo(0.18);
    expect(build.conductionHitsRequired(4)).toBe(3);
    expect(build.conductionDamage(0.45)).toBeCloseTo(0.54);
    expect(build.resonanceRupture(5, 4)).toBeNull();
    expect(build.resonanceRupture(5, 5)).toEqual({ radius: 44, damage: 0.65 });
  });
});
