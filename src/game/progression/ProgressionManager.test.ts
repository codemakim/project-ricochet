import { describe, expect, it } from 'vitest';
import { BuildState } from './BuildState';
import { ProgressionManager } from './ProgressionManager';

describe('ProgressionManager', () => {
  it('preserves overflow and queues multiple choices', () => {
    const manager = new ProgressionManager(7);
    manager.gainExperience(30);
    expect(manager.getSnapshot()).toMatchObject({ level: 2, xp: 5, pendingChoices: 2 });
  });

  it('applies one valid choice and rejects stale or invalid choices', () => {
    const build = new BuildState();
    const manager = new ProgressionManager(7, build);
    manager.gainExperience(12);
    const choice = manager.getChoices()[0]!;
    expect(manager.choose(choice)).toBe(true);
    expect(build.rank(choice)).toBe(1);
    expect(manager.getSnapshot().pendingChoices).toBe(0);
    expect(manager.choose(choice)).toBe(false);
  });

  it('stops gaining XP when all abilities reach their individual caps', () => {
    const build = new BuildState({
      firepower: 5,
      kinetic: 3,
      explosion: 1,
      split: 1,
      'near-amplification': 3,
      'precision-hit': 3,
      'kinetic-conversion': 3,
      'wall-acceleration': 3,
      'horizontal-cutter': 1,
      'vertical-cutter': 1,
      'destruction-reaction': 1,
      'recovery-shockwave': 2,
    });
    const manager = new ProgressionManager(7, build);
    manager.gainExperience(100);
    expect(manager.getSnapshot()).toMatchObject({ level: 27, xp: 0, pendingChoices: 0 });
  });
});
