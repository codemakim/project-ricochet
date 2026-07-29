export type ProcId =
  | 'explosion'
  | 'split'
  | 'corrosion'
  | 'horizontal-cutter'
  | 'vertical-cutter'
  | 'destruction-reaction';

export interface ProcAttempt {
  triggered: boolean;
  nextFailures: number;
}

const PROC_SALTS: Record<ProcId, number> = {
  explosion: 0x4558_504c,
  split: 0x5350_4c54,
  corrosion: 0x434f_5252,
  'horizontal-cutter': 0x484f_5249,
  'vertical-cutter': 0x5645_5254,
  'destruction-reaction': 0x4445_5354,
};

function nextState(state: number): number {
  return (Math.imul(state, 1664525) + 1013904223) >>> 0;
}

function validateOrbId(orbId: number): void {
  if (!Number.isInteger(orbId) || orbId < 0) {
    throw new RangeError('orb ID must be a non-negative integer');
  }
}

export function resolveProcAttempt(
  chance: number,
  failures: number,
  roll: number,
): ProcAttempt {
  if (!Number.isFinite(chance) || chance < 0 || chance > 1) {
    throw new RangeError('chance must be from 0 through 1');
  }
  if (!Number.isInteger(failures) || failures < 0) {
    throw new RangeError('failures must be a non-negative integer');
  }
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) {
    throw new RangeError('roll must be from 0 up to 1');
  }
  if (chance === 0) return { triggered: false, nextFailures: failures };

  const triggered = failures + 1 >= Math.ceil(2 / chance) || roll < chance;
  return {
    triggered,
    nextFailures: triggered ? 0 : failures + 1,
  };
}

export class CombatProcState {
  private readonly states: Record<ProcId, {
    random: number;
    failures: number;
    lastTriggeredByOrb: Map<number, number>;
  }>;
  private readonly splitConsumed = new Set<number>();
  private microMissileHits = 0;
  private proximityRecoveries = 0;
  private highSpeedHits = 0;

  constructor(seed: number) {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff) {
      throw new RangeError('seed must be an unsigned 32-bit integer');
    }
    this.states = {
      explosion: {
        random: (seed ^ PROC_SALTS.explosion) >>> 0,
        failures: 0,
        lastTriggeredByOrb: new Map(),
      },
      split: {
        random: (seed ^ PROC_SALTS.split) >>> 0,
        failures: 0,
        lastTriggeredByOrb: new Map(),
      },
      corrosion: {
        random: (seed ^ PROC_SALTS.corrosion) >>> 0,
        failures: 0,
        lastTriggeredByOrb: new Map(),
      },
      'horizontal-cutter': {
        random: (seed ^ PROC_SALTS['horizontal-cutter']) >>> 0,
        failures: 0,
        lastTriggeredByOrb: new Map(),
      },
      'vertical-cutter': {
        random: (seed ^ PROC_SALTS['vertical-cutter']) >>> 0,
        failures: 0,
        lastTriggeredByOrb: new Map(),
      },
      'destruction-reaction': {
        random: (seed ^ PROC_SALTS['destruction-reaction']) >>> 0,
        failures: 0,
        lastTriggeredByOrb: new Map(),
      },
    };
  }

  tryProc(
    id: ProcId,
    orbId: number,
    gameplayElapsedMs: number,
    chance: number,
    cooldownMs: number,
  ): boolean {
    validateOrbId(orbId);
    if (!Number.isFinite(gameplayElapsedMs) || gameplayElapsedMs < 0) {
      throw new RangeError('gameplay elapsed time must be finite and non-negative');
    }
    if (!Number.isFinite(cooldownMs) || cooldownMs < 0) {
      throw new RangeError('cooldown must be finite and non-negative');
    }
    const state = this.states[id];
    const lastTriggeredAt = state.lastTriggeredByOrb.get(orbId);
    if (
      lastTriggeredAt !== undefined
      && gameplayElapsedMs - lastTriggeredAt < cooldownMs
    ) {
      return false;
    }
    state.random = nextState(state.random);
    const result = resolveProcAttempt(
      chance,
      state.failures,
      state.random / 0x1_0000_0000,
    );
    state.failures = result.nextFailures;
    if (result.triggered) {
      state.lastTriggeredByOrb.set(orbId, gameplayElapsedMs);
    }
    return result.triggered;
  }

  trySplit(
    orbId: number,
    gameplayElapsedMs: number,
    chance: number,
    cooldownMs: number,
  ): boolean {
    validateOrbId(orbId);
    if (this.splitConsumed.has(orbId)) return false;
    const triggered = this.tryProc('split', orbId, gameplayElapsedMs, chance, cooldownMs);
    if (triggered) this.splitConsumed.add(orbId);
    return triggered;
  }

  resetOrbFlight(orbId: number): void {
    validateOrbId(orbId);
    this.splitConsumed.delete(orbId);
    for (const state of Object.values(this.states)) {
      state.lastTriggeredByOrb.delete(orbId);
    }
  }

  recordMicroMissileHit(hitsRequired: number): boolean {
    this.microMissileHits += 1;
    if (this.microMissileHits < this.requirePositiveInteger(hitsRequired)) return false;
    this.microMissileHits = 0;
    return true;
  }

  recordProximityRecovery(recoveriesRequired: number): boolean {
    this.proximityRecoveries += 1;
    if (this.proximityRecoveries < this.requirePositiveInteger(recoveriesRequired)) return false;
    this.proximityRecoveries = 0;
    return true;
  }

  recordHighSpeedHit(hitsRequired: number): boolean {
    this.highSpeedHits += 1;
    if (this.highSpeedHits < this.requirePositiveInteger(hitsRequired)) return false;
    this.highSpeedHits = 0;
    return true;
  }

  private requirePositiveInteger(value: number): number {
    if (!Number.isInteger(value) || value < 1) {
      throw new RangeError('required count must be a positive integer');
    }
    return value;
  }
}
