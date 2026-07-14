import { describe, expect, it } from 'vitest';
import { ProgressionManager } from './ProgressionManager';

describe('ProgressionManager', () => {
  it('preserves overflow and queues multiple choices', () => {
    const manager = new ProgressionManager(7);
    manager.gainExperience(21);
    expect(manager.getSnapshot()).toMatchObject({ level: 2, xp: 1, pendingChoices: 2 });
  });

  it('applies one valid choice and rejects stale or invalid choices', () => {
    const manager = new ProgressionManager(7);
    manager.gainExperience(8);
    const choice = manager.getChoices()[0]!;
    expect(manager.choose(choice)).toBe(true);
    expect(manager.getSnapshot().pendingChoices).toBe(0);
    expect(manager.choose(choice)).toBe(false);
  });

  it('stops gaining XP when all abilities reach rank five', () => {
    const manager = new ProgressionManager(7, {
      firepower: 5, kinetic: 5, explosion: 5, split: 5,
    });
    manager.gainExperience(100);
    expect(manager.getSnapshot()).toMatchObject({ level: 20, xp: 0, pendingChoices: 0 });
  });
});
