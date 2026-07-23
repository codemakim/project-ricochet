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
    this.effects.push({
      id: this.nextId,
      dueAt: nowMs + GAME_TUNING.relics.secondBoss.aftershockExplosion.delayMs,
      position: { ...position },
      radius,
      damage,
      kind: 'aftershock',
    });
    this.nextId += 1;
  }

  drainDue(nowMs: number): ScheduledAreaEffect[] {
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
}
