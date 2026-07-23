import { GAME_TUNING } from '../config/gameTuning';
import type { Vector } from '../math/vector';

export interface ScheduledAreaEffect {
  id: number;
  dueAt: number;
  position: Vector;
  radius: number;
  damage: number;
  kind: 'aftershock';
}

export class CombatEffectScheduler {
  private readonly effects: ScheduledAreaEffect[] = [];
  private nextId = 0;

  scheduleAftershock(nowMs: number, position: Vector, radius: number, damage: number): void {
    this.requireGameplayTime(nowMs);
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
      throw new RangeError('effect position must be finite');
    }
    this.requireNonNegativeFinite(radius, 'effect radius');
    this.requireNonNegativeFinite(damage, 'effect damage');
    const dueAt = nowMs + GAME_TUNING.relics.secondBoss.aftershockExplosion.delayMs;
    if (!Number.isFinite(dueAt)) throw new RangeError('effect due time must be finite');
    this.effects.push({
      id: this.nextId,
      dueAt,
      position: { ...position },
      radius,
      damage,
      kind: 'aftershock',
    });
    this.nextId += 1;
    this.effects.sort((left, right) => left.dueAt - right.dueAt || left.id - right.id);
  }

  drainDue(nowMs: number): ScheduledAreaEffect[] {
    this.requireGameplayTime(nowMs);
    const due: ScheduledAreaEffect[] = [];
    while (this.effects.length > 0 && this.effects[0]!.dueAt <= nowMs) {
      due.push(this.effects.shift()!);
    }
    return due.map((effect) => this.copy(effect));
  }

  clear(): void {
    this.effects.length = 0;
  }

  getSnapshot(): ScheduledAreaEffect[] {
    return this.effects.map((effect) => this.copy(effect));
  }

  private copy(effect: ScheduledAreaEffect): ScheduledAreaEffect {
    return { ...effect, position: { ...effect.position } };
  }

  private requireGameplayTime(value: number): void {
    this.requireNonNegativeFinite(value, 'gameplay time');
  }

  private requireNonNegativeFinite(value: number, name: string): void {
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError(`${name} must be finite and non-negative`);
    }
  }
}
