import { GAME_TUNING } from '../config/gameTuning';
import type { Vector } from '../math/vector';

export interface CorrosionFieldSnapshot {
  fieldId: number;
  orbId: number;
  position: Vector;
  expiresAtMs: number;
  nextTickAtMs: number;
}

export interface CorrosionTick {
  fieldId: number;
  position: Vector;
  radius: number;
  damage: number;
}

interface DueTick extends CorrosionTick {
  dueAtMs: number;
}

export class CorrosionFieldState {
  private readonly fields: CorrosionFieldSnapshot[] = [];
  private nextFieldId = 0;

  spawn(orbId: number, position: Vector, nowMs: number): void {
    const tuning = GAME_TUNING.orbCores.corrosion;
    const owned = this.fields.filter((field) => field.orbId === orbId);
    if (owned.length >= tuning.fieldLimitPerOrb) {
      const oldest = owned.reduce((left, right) => (
        left.fieldId < right.fieldId ? left : right
      ));
      this.fields.splice(this.fields.indexOf(oldest), 1);
    }
    this.fields.push({
      fieldId: this.nextFieldId,
      orbId,
      position: { ...position },
      expiresAtMs: nowMs + tuning.durationMs,
      nextTickAtMs: nowMs + tuning.tickMs,
    });
    this.nextFieldId += 1;
  }

  drainDue(nowMs: number): CorrosionTick[] {
    const tuning = GAME_TUNING.orbCores.corrosion;
    const due: DueTick[] = [];
    for (const field of this.fields) {
      while (
        field.nextTickAtMs <= nowMs
        && field.nextTickAtMs <= field.expiresAtMs
      ) {
        due.push({
          fieldId: field.fieldId,
          position: { ...field.position },
          radius: tuning.radius,
          damage: tuning.damagePerTick,
          dueAtMs: field.nextTickAtMs,
        });
        field.nextTickAtMs += tuning.tickMs;
      }
    }
    for (let index = this.fields.length - 1; index >= 0; index -= 1) {
      if (nowMs >= this.fields[index]!.expiresAtMs) this.fields.splice(index, 1);
    }
    return due
      .sort((left, right) => left.dueAtMs - right.dueAtMs || left.fieldId - right.fieldId)
      .map(({ dueAtMs: _dueAtMs, ...tick }) => tick);
  }

  clear(): void {
    this.fields.length = 0;
  }

  getSnapshot(): readonly CorrosionFieldSnapshot[] {
    return this.fields.map((field) => ({
      ...field,
      position: { ...field.position },
    }));
  }
}
