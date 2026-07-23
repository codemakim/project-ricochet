import { describe, expect, it } from 'vitest';
import { BossBuild } from './BossBuild';

describe('BossBuild', () => {
  it('raises the permanent orb limit from three to four with expanded magazine', () => {
    const build = new BossBuild();
    expect(build.orbLimit()).toBe(3);
    build.acquire('expanded-magazine');
    expect(build.orbLimit()).toBe(4);
  });

  it('restores five charges only after proximity recovery with capacitor', () => {
    const build = new BossBuild();
    build.acquire('recovery-capacitor');

    expect(build.restoredCharges('proximity')).toBe(5);
    expect(build.restoredCharges('floorRecall')).toBe(3);
    expect(build.restoredCharges('timeoutRecall')).toBe(3);
  });

  it('adds one opening damage only to a pending proximity hit', () => {
    const build = new BossBuild();
    build.acquire('opening-amplifier');

    expect(build.openingHitBonus('proximity', true)).toBe(1);
    expect(build.openingHitBonus('proximity', false)).toBe(0);
    expect(build.openingHitBonus('floorRecall', true)).toBe(0);
    expect(build.openingHitBonus('timeoutRecall', true)).toBe(0);
  });

  it('enables temporary explosions only with chain warhead', () => {
    const build = new BossBuild();
    expect(build.temporaryExplosionEnabled()).toBe(false);
    build.acquire('chain-warhead');
    expect(build.temporaryExplosionEnabled()).toBe(true);
  });

  it('rejects duplicate acquisition and snapshots acquisition order', () => {
    const build = new BossBuild();
    build.acquire('opening-amplifier');
    build.acquire('expanded-magazine');

    expect(build.owns('opening-amplifier')).toBe(true);
    expect(build.snapshot()).toEqual(['opening-amplifier', 'expanded-magazine']);
    expect(() => build.acquire('opening-amplifier')).toThrow('opening-amplifier is already owned');
  });

  it('applies auxiliary orbit while capping the permanent orb limit at six', () => {
    const build = new BossBuild();
    build.acquire('expanded-magazine');
    build.acquire('auxiliary-orbit');
    expect(build.orbLimit()).toBe(5);
    expect(build.orbLimit()).toBeLessThanOrEqual(6);
  });

  it('adds two temporary orbs only to proximity recovery with recovery salvo', () => {
    const build = new BossBuild();
    build.acquire('recovery-salvo');
    expect(build.recoverySalvoCount('proximity')).toBe(2);
    expect(build.recoverySalvoCount('floorRecall')).toBe(0);
    expect(build.recoverySalvoCount('timeoutRecall')).toBe(0);
  });

  it('triggers siege resonance on the hit after ten accumulated permanent hits', () => {
    const build = new BossBuild();
    build.acquire('siege-resonance');
    expect(Array.from({ length: 10 }, () => build.recordPermanentDirectHit())).toEqual(
      Array(10).fill(false),
    );
    expect(build.recordPermanentDirectHit()).toBe(true);
    expect(build.recordPermanentDirectHit()).toBe(false);
  });

  it('does not accumulate siege hits until the relic is owned', () => {
    const build = new BossBuild();
    for (let hit = 0; hit < 20; hit += 1) expect(build.recordPermanentDirectHit()).toBe(false);
    build.acquire('siege-resonance');
    for (let hit = 0; hit < 10; hit += 1) expect(build.recordPermanentDirectHit()).toBe(false);
    expect(build.recordPermanentDirectHit()).toBe(true);
  });

  it('resets transient siege state on restart without removing ownership', () => {
    const build = new BossBuild();
    build.acquire('siege-resonance');
    for (let hit = 0; hit < 10; hit += 1) build.recordPermanentDirectHit();
    build.resetTransientState();

    expect(build.owns('siege-resonance')).toBe(true);
    expect(build.recordPermanentDirectHit()).toBe(false);
  });

  it('exposes all four ability evolution effects only while owned', () => {
    const build = new BossBuild();
    expect(build.chargedDamageBonus()).toBe(0);
    expect(build.chargedKillPierces()).toBe(false);
    expect(build.aftershock()).toBeNull();
    expect(build.chainSplitEnabled()).toBe(false);

    build.acquire('hyperpressure-core');
    build.acquire('inertial-penetration');
    build.acquire('aftershock-explosion');
    build.acquire('chain-split');

    expect(build.chargedDamageBonus()).toBe(0.75);
    expect(build.chargedKillPierces()).toBe(true);
    expect(build.aftershock()).toEqual({ delayMs: 350, radiusScale: 0.8, damageScale: 0.5 });
    expect(build.chainSplitEnabled()).toBe(true);
  });

  it('stores second-tier reward ids in acquisition order', () => {
    const build = new BossBuild();
    build.acquire('auxiliary-orbit');
    build.acquire('recovery-salvo');
    build.acquire('siege-resonance');

    expect(build.snapshot()).toEqual([
      'auxiliary-orbit',
      'recovery-salvo',
      'siege-resonance',
    ]);
  });
});
