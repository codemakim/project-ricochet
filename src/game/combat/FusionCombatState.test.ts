import { describe, expect, it } from 'vitest';
import {
  ClusterFieldState,
  MassCollapseState,
  MeltdownZoneState,
  MirrorCircuitState,
  NanoSeedState,
  PhotonTrailState,
  ReactorChargeState,
  VectorBladeState,
  clusterBombardmentProfile,
  massCollapseProfile,
  meltdownCoreProfile,
  mirrorCircuitProfile,
  nanoFusionProfile,
  photonFusionProfile,
  reactorOrbProfile,
  resonantSwarmProfile,
  vectorBladeProfile,
} from './FusionCombatState';

describe('fusion combat profiles', () => {
  it('unlocks each fusion milestone from the central nine-level curve', () => {
    expect(photonFusionProfile(1)).toMatchObject({ trail: null, intersectionBlast: null });
    expect(photonFusionProfile(4).trail).not.toBeNull();
    expect(photonFusionProfile(9).intersectionBlast).toEqual({ radius: 42, damage: 0.8 });
    expect(resonantSwarmProfile(1)).toMatchObject({ count: 2, targets: 1 });
    expect(resonantSwarmProfile(9)).toMatchObject({ count: 4, targets: 3 });
    expect(nanoFusionProfile(6).maximumGeneration).toBe(0);
    expect(nanoFusionProfile(7).maximumGeneration).toBe(1);
    expect(nanoFusionProfile(9).maximumGeneration).toBe(2);
    expect(massCollapseProfile(9)).toMatchObject({
      precisionBonusStacks: 2,
      threshold: 3,
    });
    expect(reactorOrbProfile(9)).toMatchObject({ maximumCharges: 7 });
    expect(clusterBombardmentProfile(1)).toMatchObject({
      projectileCount: 6,
      lingering: null,
    });
    expect(clusterBombardmentProfile(9).lingering).not.toBeNull();
    expect(mirrorCircuitProfile(9)).toMatchObject({ maximumMirrors: 5 });
    expect(meltdownCoreProfile(9)).toMatchObject({ heatThreshold: 3 });
    expect(vectorBladeProfile(9)).toMatchObject({ replayCount: 2 });
  });

  it('rejects fusion levels outside one through nine', () => {
    expect(() => photonFusionProfile(0)).toThrow('fusion level');
    expect(() => resonantSwarmProfile(10)).toThrow('fusion level');
    expect(() => massCollapseProfile(10)).toThrow('fusion level');
    expect(() => mirrorCircuitProfile(0)).toThrow('fusion level');
  });
});

describe('final fusion state', () => {
  it('connects, ticks, expires, and bounds mirror segments', () => {
    const state = new MirrorCircuitState();
    const profile = { ...mirrorCircuitProfile(9), maximumMirrors: 2 };

    expect(state.add(1, { x: 0, y: 0 }, 0, profile).segment).toBeNull();
    expect(state.add(1, { x: 10, y: 10 }, 10, profile).segment).not.toBeNull();
    expect(state.add(1, { x: 0, y: 10 }, 20, profile).intersections).toEqual([]);
    expect(state.add(1, { x: 10, y: 0 }, 30, profile).intersections).toEqual([
      { x: 5, y: 5 },
    ]);
    expect(state.getSnapshot()).toHaveLength(2);
    expect(state.drainDue(30)).toHaveLength(2);
    expect(state.drainDue(31)).toEqual([]);
    state.update(10_000);
    expect(state.getSnapshot()).toEqual([]);
    state.clear();
  });

  it('heats overlapping zones, caps boss heat, erupts, ticks, and expires', () => {
    const state = new MeltdownZoneState();
    const profile = {
      ...meltdownCoreProfile(9), maximumZones: 1, heatThreshold: 3, bossHeatCap: 2,
    };

    expect(state.addHeat({ x: 10, y: 10 }, true, 0, profile).erupted).toBe(false);
    expect(state.addHeat({ x: 11, y: 11 }, true, 1, profile).zone?.heat).toBe(2);
    expect(state.addHeat({ x: 10, y: 10 }, false, 2, profile).erupted).toBe(true);
    expect(state.getSnapshot()).toEqual([]);
    state.addHeat({ x: 20, y: 20 }, false, 10, profile);
    expect(state.drainDue(10)[0]?.damage).toBe(profile.damage * profile.heatPerHit);
    expect(state.drainDue(11)).toEqual([]);
    state.update(10_000);
    expect(state.getSnapshot()).toEqual([]);
    state.clear();
  });

  it('stores normalized bounded vectors per orb and consumes clones', () => {
    const state = new VectorBladeState();
    const profile = { ...vectorBladeProfile(9), maximumVectors: 2 };
    state.recordBounce(1, { x: 2, y: 0 }, 120, profile);
    state.recordBounce(1, { x: 0, y: -3 }, 180, profile);
    state.recordBounce(1, { x: -4, y: 0 }, 240, profile);

    const vectors = state.consume(1);
    expect(vectors).toEqual([
      { direction: { x: 0, y: -1 }, pathLength: 180 },
      { direction: { x: -1, y: 0 }, pathLength: 240 },
    ]);
    vectors[0]!.direction.x = 99;
    expect(state.consume(1)).toEqual([]);
    state.recordBounce(2, { x: 1, y: 1 }, 10, profile);
    state.clear();
    expect(state.consume(2)).toEqual([]);
  });
});

describe('second fusion state', () => {
  it('collapses at threshold, resets that target, and evicts the oldest target at cap', () => {
    const state = new MassCollapseState();
    const profile = { ...massCollapseProfile(9), threshold: 3, maximumTrackedTargets: 2 };

    expect(state.record('enemy:7', 2, profile)).toEqual({ collapsed: false, stacks: 2 });
    expect(state.record('enemy:7', 1, profile)).toEqual({ collapsed: true, stacks: 0 });
    state.record('enemy:8', 1, profile);
    state.record('enemy:9', 1, profile);
    state.record('enemy:10', 1, profile);
    expect(state.getSnapshot()).toEqual([
      { targetKey: 'enemy:9', stacks: 1 },
      { targetKey: 'enemy:10', stacks: 1 },
    ]);
  });

  it('caps and consumes reactor charges per orb', () => {
    const state = new ReactorChargeState();
    const profile = { ...reactorOrbProfile(1), maximumCharges: 2 };

    expect(state.add(4, profile)).toBe(1);
    expect(state.add(4, profile)).toBe(2);
    expect(state.add(4, profile)).toBe(2);
    expect(state.consume(4)).toBe(2);
    expect(state.consume(4)).toBe(0);
  });

  it('ticks bounded cluster fields and expires them on gameplay time', () => {
    const state = new ClusterFieldState();
    const profile = {
      ...clusterBombardmentProfile(9),
      maximumFields: 2,
      lingering: { durationMs: 1_000, tickMs: 200, damage: 0.1 },
    };

    state.add({ x: 10, y: 10 }, 0, profile);
    state.add({ x: 20, y: 20 }, 0, profile);
    state.add({ x: 30, y: 30 }, 0, profile);
    expect(state.getSnapshot().map(({ position }) => position)).toEqual([
      { x: 20, y: 20 },
      { x: 30, y: 30 },
    ]);
    expect(state.drainDue(0)).toHaveLength(2);
    expect(state.drainDue(199)).toEqual([]);
    expect(state.drainDue(200)).toHaveLength(2);
    expect(state.drainDue(1_000)).toEqual([]);
  });
});

describe('PhotonTrailState', () => {
  it('ticks bounded live trails and emits only interior crossing blasts', () => {
    const state = new PhotonTrailState();
    const profile = photonFusionProfile(9);

    expect(state.add(1, { x: 0, y: 0 }, { x: 10, y: 10 }, 0, profile)).toEqual([]);
    expect(state.add(1, { x: 0, y: 10 }, { x: 10, y: 0 }, 10, profile))
      .toEqual([{ x: 5, y: 5 }]);
    expect(state.add(1, { x: 10, y: 0 }, { x: 20, y: 0 }, 20, profile)).toEqual([]);
    expect(state.drainDue(20)).toHaveLength(3);
    expect(state.drainDue(21)).toEqual([]);
    state.update(10_000);
    expect(state.getSnapshot()).toEqual([]);
  });

  it('evicts the oldest trail at the per-orb cap', () => {
    const state = new PhotonTrailState();
    const profile = photonFusionProfile(7);
    for (let index = 0; index <= profile.trail!.maximumSegments; index += 1) {
      state.add(2, { x: index, y: 0 }, { x: index, y: 10 }, index, profile);
    }
    expect(state.getSnapshot()).toHaveLength(profile.trail!.maximumSegments);
    expect(state.getSnapshot()[0]!.start.x).toBe(1);
  });
});

describe('NanoSeedState', () => {
  it('scatters bounded fixed seeds, ticks them, and replicates one generation on a covered kill', () => {
    const state = new NanoSeedState();
    const profile = nanoFusionProfile(7);
    expect(state.spawn(3, { x: 100, y: 100 }, { x: 1, y: 0 }, 0, profile))
      .toBe(profile.count);
    expect(state.drainDue(0)).toHaveLength(profile.count);
    expect(state.spreadOnDeath({ x: 100, y: 100 }, 100, profile)).toBe(true);
    expect(state.getSnapshot().some(({ generation }) => generation === 1)).toBe(true);
    expect(state.spreadOnDeath({ x: 999, y: 999 }, 100, profile)).toBe(false);
  });

  it('stops replication at the configured generation and global cap', () => {
    const state = new NanoSeedState();
    const profile = { ...nanoFusionProfile(9), maximumSeeds: 2, count: 1 };
    state.spawn(1, { x: 0, y: 0 }, { x: 1, y: 0 }, 0, profile);
    expect(state.spreadOnDeath({ x: 0, y: 0 }, 1, profile)).toBe(true);
    expect(state.spreadOnDeath({ x: 0, y: 0 }, 2, profile)).toBe(false);
    expect(state.getSnapshot()).toHaveLength(2);
  });
});
