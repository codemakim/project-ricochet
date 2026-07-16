import { describe, expect, it } from 'vitest';
import { CombatPauseController } from './CombatPauseController';

describe('CombatPauseController', () => {
  it('resumes only after the last reason is removed', () => {
    const pause = new CombatPauseController();
    pause.add('visibility');
    pause.add('levelUp');
    pause.remove('visibility');
    expect(pause.isPaused()).toBe(true);
    pause.remove('levelUp');
    expect(pause.isPaused()).toBe(false);
  });

  it('keeps boss rewards frozen while visibility and level-up reasons compose', () => {
    const pause = new CombatPauseController();
    pause.add('bossReward');
    pause.add('visibility');
    pause.add('levelUp');

    pause.remove('bossReward');
    expect(pause.isPaused()).toBe(true);
    expect(pause.consumeGameplayDelta(5_000)).toBe(0);
    pause.remove('visibility');
    expect(pause.isPaused()).toBe(true);
    pause.remove('levelUp');

    expect(pause.isPaused()).toBe(false);
    expect(pause.consumeGameplayDelta(5_000)).toBe(0);
    expect(pause.consumeGameplayDelta(16)).toBe(16);
  });

  it('discards the first delta after every paused interval', () => {
    const pause = new CombatPauseController();
    pause.add('visibility');
    expect(pause.consumeGameplayDelta(16)).toBe(0);
    pause.remove('visibility');
    expect(pause.consumeGameplayDelta(8_100)).toBe(0);
    expect(pause.consumeGameplayDelta(16)).toBe(16);
  });

  it('tracks reasons with idempotent add and remove operations', () => {
    const pause = new CombatPauseController();
    pause.add('defeated');
    pause.add('defeated');
    expect(pause.has('defeated')).toBe(true);
    pause.remove('visibility');
    expect(pause.isPaused()).toBe(true);
    pause.remove('defeated');
    pause.remove('defeated');
    expect(pause.has('defeated')).toBe(false);
    expect(pause.consumeGameplayDelta(16)).toBe(0);
    expect(pause.consumeGameplayDelta(16)).toBe(16);
  });
});
