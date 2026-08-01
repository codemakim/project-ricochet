import { GAME_TUNING } from '../config/gameTuning';
import type { Vector } from '../math/vector';

export interface CorrosionFieldSnapshot {
  fieldId: number;
  orbId: number;
  position: Vector;
  expiresAtMs: number;
  nextTickAtMs: number;
  radius: number;
  damage: number;
  attachedEnemyId?: number;
  spreadsOnDeath?: boolean;
  vulnerabilityEnabled?: boolean;
}

export interface CorrosionTick {
  fieldId: number;
  position: Vector;
  radius: number;
  damage: number;
  attachedEnemyId?: number;
  vulnerabilityEnabled?: boolean;
}

interface DueTick extends CorrosionTick {
  dueAtMs: number;
}

export class CorrosionFieldState {
  private readonly fields: CorrosionFieldSnapshot[] = [];
  private nextFieldId = 0;

  spawn(
    orbId: number,
    position: Vector,
    nowMs: number,
    modifiers: Partial<Pick<CorrosionTick, 'radius' | 'damage'>>
      & {
        durationMs?: number;
        attachedEnemyId?: number;
        spreadsOnDeath?: boolean;
        vulnerabilityEnabled?: boolean;
      } = {},
  ): void {
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
      expiresAtMs: nowMs + (modifiers.durationMs ?? tuning.durationMs),
      nextTickAtMs: nowMs + tuning.tickMs,
      radius: modifiers.radius ?? tuning.radius,
      damage: modifiers.damage ?? tuning.damagePerTick,
      attachedEnemyId: modifiers.attachedEnemyId,
      spreadsOnDeath: modifiers.spreadsOnDeath,
      vulnerabilityEnabled: modifiers.vulnerabilityEnabled,
    });
    this.nextFieldId += 1;
    while (this.fields.length > tuning.globalFieldLimit) this.fields.shift();
  }

  drainDue(
    nowMs: number,
    resolveAttachedPosition: (enemyId: number) => Vector | null = () => null,
  ): CorrosionTick[] {
    const tuning = GAME_TUNING.orbCores.corrosion;
    const due: DueTick[] = [];
    for (let index = this.fields.length - 1; index >= 0; index -= 1) {
      const field = this.fields[index]!;
      if (field.attachedEnemyId !== undefined) {
        const position = resolveAttachedPosition(field.attachedEnemyId);
        if (!position) {
          this.fields.splice(index, 1);
          continue;
        }
        field.position = { ...position };
      }
      while (
        field.nextTickAtMs <= nowMs
        && field.nextTickAtMs <= field.expiresAtMs
      ) {
        due.push({
          fieldId: field.fieldId,
          position: { ...field.position },
          radius: field.radius,
          damage: field.damage,
          attachedEnemyId: field.attachedEnemyId,
          vulnerabilityEnabled: field.vulnerabilityEnabled,
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

  spreadAttachedOnDeath(
    enemyId: number,
    position: Vector,
    nowMs: number,
    spread: { radius: number; durationMs: number; damage: number },
  ): boolean {
    const attached = this.fields.filter((field) => (
      field.attachedEnemyId === enemyId && field.spreadsOnDeath
    ));
    if (attached.length === 0) return false;
    for (const field of attached) this.fields.splice(this.fields.indexOf(field), 1);
    this.spawn(attached[0]!.orbId, position, nowMs, spread);
    return true;
  }

  igniteOverlapping(
    center: Vector,
    radius: number,
    nowMs: number,
    fraction: number,
  ): CorrosionTick[] {
    const tickMs = GAME_TUNING.orbCores.corrosion.tickMs;
    const ignited: CorrosionTick[] = [];
    for (let index = this.fields.length - 1; index >= 0; index -= 1) {
      const field = this.fields[index]!;
      if (Math.hypot(field.position.x - center.x, field.position.y - center.y) > radius + field.radius) {
        continue;
      }
      const firstTick = Math.max(nowMs, field.nextTickAtMs);
      const ticks = firstTick > field.expiresAtMs
        ? 0
        : Math.floor((field.expiresAtMs - firstTick) / tickMs) + 1;
      ignited.push({
        fieldId: field.fieldId,
        position: { ...field.position },
        radius: field.radius,
        damage: field.damage * ticks * fraction,
      });
      this.fields.splice(index, 1);
    }
    return ignited.reverse();
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
