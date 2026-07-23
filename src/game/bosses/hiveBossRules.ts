import { GAME_TUNING } from '../config/gameTuning';

export type HivePartId =
  | 'core'
  | 'leftShooter'
  | 'rightShooter'
  | 'leftReflector'
  | 'rightReflector';

export type HivePhase =
  | 'shielded'
  | 'telegraph'
  | 'exposed'
  | 'permanentlyExposed'
  | 'defeated';

export interface HiveBossState {
  phase: HivePhase;
  phaseElapsedMs: number;
  parts: Record<HivePartId, number>;
  deploymentIndex: number;
}

const MODULE_IDS = [
  'leftShooter',
  'rightShooter',
  'leftReflector',
  'rightReflector',
] as const satisfies readonly HivePartId[];

function immutableState(
  phase: HivePhase,
  phaseElapsedMs: number,
  parts: Record<HivePartId, number>,
  deploymentIndex: number,
): HiveBossState {
  return Object.freeze({
    phase,
    phaseElapsedMs,
    parts: Object.freeze(parts),
    deploymentIndex,
  });
}

function copyState(
  state: HiveBossState,
  changes: Partial<Pick<HiveBossState, 'phase' | 'phaseElapsedMs' | 'deploymentIndex'>> = {},
  parts = state.parts,
): HiveBossState {
  return immutableState(
    changes.phase ?? state.phase,
    changes.phaseElapsedMs ?? state.phaseElapsedMs,
    { ...parts },
    changes.deploymentIndex ?? state.deploymentIndex,
  );
}

function validateNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be finite and non-negative`);
  }
}

export function createHiveBossState(): HiveBossState {
  return immutableState('shielded', 0, {
    core: GAME_TUNING.hiveBoss.core.hp,
    leftShooter: GAME_TUNING.hiveBoss.shooter.hp,
    rightShooter: GAME_TUNING.hiveBoss.shooter.hp,
    leftReflector: GAME_TUNING.hiveBoss.reflector.hp,
    rightReflector: GAME_TUNING.hiveBoss.reflector.hp,
  }, 0);
}

export function advanceHiveCycle(state: HiveBossState, deltaMs: number): HiveBossState {
  validateNonNegativeFinite(deltaMs, 'deltaMs');
  if (state.phase === 'defeated') return state;

  const elapsed = state.phaseElapsedMs + deltaMs;
  if (state.phase === 'permanentlyExposed') {
    if (elapsed < GAME_TUNING.hiveBoss.timing.exposedMs) {
      return copyState(state, { phaseElapsedMs: elapsed });
    }
    return copyState(state, {
      phaseElapsedMs: 0,
      deploymentIndex: state.deploymentIndex + 1,
    });
  }
  if (state.phase === 'shielded' && elapsed >= GAME_TUNING.hiveBoss.timing.shieldedMs) {
    return copyState(state, { phase: 'telegraph', phaseElapsedMs: 0 });
  }
  if (state.phase === 'telegraph' && elapsed >= GAME_TUNING.hiveBoss.timing.telegraphMs) {
    return copyState(state, {
      phase: 'exposed',
      phaseElapsedMs: 0,
      deploymentIndex: state.deploymentIndex + 1,
    });
  }
  if (state.phase === 'exposed' && elapsed >= GAME_TUNING.hiveBoss.timing.exposedMs) {
    return copyState(state, { phase: 'shielded', phaseElapsedMs: 0 });
  }
  return copyState(state, { phaseElapsedMs: elapsed });
}

export function damageHivePart(
  state: HiveBossState,
  partId: HivePartId,
  damage: number,
): HiveBossState {
  validateNonNegativeFinite(damage, 'damage');
  if (
    damage === 0
    || state.phase === 'defeated'
    || (partId === 'core' && !exposedHiveParts(state).includes('core'))
    || state.parts[partId] === 0
  ) {
    return state;
  }

  const parts = {
    ...state.parts,
    [partId]: Math.max(0, state.parts[partId] - damage),
  };
  if (parts.core === 0) {
    return copyState(state, { phase: 'defeated', phaseElapsedMs: 0 }, parts);
  }
  if (MODULE_IDS.every((moduleId) => parts[moduleId] === 0)) {
    return copyState(state, { phase: 'permanentlyExposed', phaseElapsedMs: 0 }, parts);
  }
  return copyState(state, {}, parts);
}

export function exposedHiveParts(state: HiveBossState): HivePartId[] {
  if (state.phase === 'defeated') return [];
  const exposed: HivePartId[] = aliveHiveModules(state);
  if (state.phase === 'exposed' || state.phase === 'permanentlyExposed') {
    exposed.push('core');
  }
  return exposed;
}

export function aliveHiveModules(state: HiveBossState): HivePartId[] {
  if (state.phase === 'defeated') return [];
  return MODULE_IDS.filter((partId) => state.parts[partId] > 0);
}
