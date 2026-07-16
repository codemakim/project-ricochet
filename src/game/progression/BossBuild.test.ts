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
});
