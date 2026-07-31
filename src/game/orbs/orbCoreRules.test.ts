import { describe, expect, it } from 'vitest';
import {
  ORB_CORE_DEFINITIONS,
  ORB_CORE_IDS,
  applyCoreWallBounce,
  coreLaunchSpeedMultiplier,
  createOrbCoreState,
  resolveCoreDirectHit,
  resolveCoreRecovery,
} from './orbCoreRules';

describe('orb core rules', () => {
  it('defines one complete catalog for all six permanent cores', () => {
    expect(ORB_CORE_IDS).toEqual([
      'echo',
      'corrosion',
      'conduction',
      'inertia',
      'split',
      'explosion',
    ]);
    expect(Object.keys(ORB_CORE_DEFINITIONS)).toEqual(ORB_CORE_IDS);
    expect(Object.values(ORB_CORE_DEFINITIONS)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: '분열 구슬', maximumLevel: 5 }),
        expect.objectContaining({ label: '폭발 구슬', maximumLevel: 5 }),
      ]),
    );
  });

  it('uses an overridden conduction hit requirement', () => {
    let state = createOrbCoreState();
    state = resolveCoreDirectHit('conduction', state, 3).next;
    state = resolveCoreDirectHit('conduction', state, 3).next;
    const third = resolveCoreDirectHit('conduction', state, 3);

    expect(third.conductionTriggered).toBe(true);
    expect(third.next.conductionHits).toBe(0);
  });
  it('caps and spends echo stacks on the next direct hit', () => {
    let state = createOrbCoreState();
    for (let bounce = 0; bounce < 7; bounce += 1) {
      state = applyCoreWallBounce('echo', state);
    }

    expect(resolveCoreDirectHit('echo', state)).toMatchObject({
      directDamageBonus: 0.4,
      conductionTriggered: false,
      next: { echoStacks: 0 },
    });
  });

  it('discharges conduction every fourth direct hit', () => {
    let state = createOrbCoreState();
    for (let hit = 0; hit < 3; hit += 1) {
      const result = resolveCoreDirectHit('conduction', state);
      expect(result.conductionTriggered).toBe(false);
      state = result.next;
    }

    expect(resolveCoreDirectHit('conduction', state)).toMatchObject({
      conductionTriggered: true,
      next: { conductionHits: 0 },
    });
  });

  it('converts inertia into launch speed only after proximity recovery', () => {
    let state = createOrbCoreState();
    for (let hit = 0; hit < 4; hit += 1) {
      state = resolveCoreDirectHit('inertia', state).next;
    }

    const proximity = resolveCoreRecovery('inertia', state, 'proximity');
    expect(proximity).toMatchObject({ inertiaStacks: 0, inertiaLaunchStacks: 3 });
    expect(coreLaunchSpeedMultiplier('inertia', proximity)).toBe(1.3);

    const floor = resolveCoreRecovery('inertia', state, 'floorRecall');
    expect(floor).toMatchObject({ inertiaStacks: 0, inertiaLaunchStacks: 0 });
    expect(coreLaunchSpeedMultiplier('inertia', floor)).toBe(1);
  });

  it('ends inertia launch speed after the first direct hit and starts a new stack', () => {
    const launched = {
      ...createOrbCoreState(),
      inertiaLaunchStacks: 3,
    };

    expect(resolveCoreDirectHit('inertia', launched).next).toMatchObject({
      inertiaStacks: 1,
      inertiaLaunchStacks: 0,
    });
  });

  it('clears echo resonance on every recovery source', () => {
    const resonating = {
      ...createOrbCoreState(),
      echoStacks: 4,
    };

    expect(resolveCoreRecovery('echo', resonating, 'proximity').echoStacks).toBe(0);
    expect(resolveCoreRecovery('echo', resonating, 'timeoutRecall').echoStacks).toBe(0);
  });
});
