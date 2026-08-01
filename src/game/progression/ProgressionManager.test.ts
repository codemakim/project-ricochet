import { describe, expect, it } from 'vitest';
import type { OrbSnapshot } from '../orbs/OrbManager';
import { BuildState } from './BuildState';
import { ProgressionManager, type ProgressionContext } from './ProgressionManager';
import { ABILITY_MAX_RANKS } from './progressionRules';

type RewardOrb = Pick<OrbSnapshot, 'coreType' | 'level'>;

function liveContext(orbs: RewardOrb[]): () => ProgressionContext {
  return () => ({
    orbs,
    coreTypes: orbs.map(({ coreType }) => coreType),
  });
}

const fullMaxedOrbs = (): RewardOrb[] => [
  { coreType: 'echo', level: 5 },
  { coreType: 'corrosion', level: 5 },
  { coreType: 'conduction', level: 5 },
  { coreType: 'inertia', level: 5 },
  { coreType: 'split', level: 5 },
  { coreType: 'explosion', level: 5 },
];

describe('ProgressionManager', () => {
  it('preserves overflow and queues multiple tagged choices', () => {
    const manager = new ProgressionManager(7);
    manager.gainExperience(30);

    expect(manager.getSnapshot()).toMatchObject({ level: 2, xp: 5, pendingChoices: 2 });
    expect(manager.getChoices().every(({ kind }) => (
      kind === 'ability' || kind === 'orb-add' || kind === 'orb-upgrade'
    ))).toBe(true);
  });

  it('applies one structurally equal ability choice and rejects it when stale', () => {
    const build = new BuildState();
    const manager = new ProgressionManager(7, build);
    manager.gainExperience(12);
    const choice = manager.getChoices().find((candidate) => candidate.kind === 'ability')!;

    expect(manager.consume({ ...choice })).toBe(true);
    expect(build.rank(choice.id)).toBe(1);
    expect(manager.getSnapshot().pendingChoices).toBe(0);
    expect(manager.consume(choice)).toBe(false);
  });

  it('consumes orb rewards without mutating ability ranks', () => {
    const build = new BuildState();
    const orbs: RewardOrb[] = [{ coreType: 'echo', level: 1 }];
    const manager = new ProgressionManager(0, build, liveContext(orbs));
    manager.gainExperience(8);
    const choice = manager.getChoices().find((candidate) => candidate.kind === 'orb-add')!;
    orbs.push({ coreType: choice.coreType, level: 1 });

    expect(manager.consume({ ...choice })).toBe(true);
    expect(build.getRanks()).toEqual(new BuildState().getRanks());
    expect(manager.getSnapshot().pendingChoices).toBe(0);
  });

  it('keeps level-up progression alive when abilities are capped but orb growth remains', () => {
    const build = new BuildState({ ...ABILITY_MAX_RANKS });
    const manager = new ProgressionManager(
      7,
      build,
      liveContext([{ coreType: 'echo', level: 1 }]),
    );

    manager.gainExperience(1_000);

    expect(manager.getSnapshot().pendingChoices).toBeGreaterThan(0);
    expect(manager.getChoices().every(({ kind }) => kind === 'orb-add')).toBe(true);
  });

  it('stops gaining XP only when abilities and all physical orbs are complete', () => {
    const build = new BuildState({ ...ABILITY_MAX_RANKS });
    const manager = new ProgressionManager(7, build, liveContext(fullMaxedOrbs()));
    const startingLevel = manager.getSnapshot().level;

    manager.gainExperience(100);

    expect(manager.getSnapshot()).toMatchObject({
      level: startingLevel,
      xp: 0,
      pendingChoices: 0,
      xpRequired: null,
    });
  });

  it('does not lower the run level after consuming an orb reward', () => {
    const orbs: RewardOrb[] = [{ coreType: 'echo', level: 1 }];
    const manager = new ProgressionManager(4, new BuildState(), liveContext(orbs));
    manager.gainExperience(30);
    const level = manager.getSnapshot().level;
    const choice = manager.getChoices().find((candidate) => candidate.kind === 'orb-add')!;
    orbs.push({ coreType: choice.coreType, level: 1 });

    expect(manager.consume(choice)).toBe(true);
    expect(manager.getSnapshot().level).toBe(level);
  });
});
