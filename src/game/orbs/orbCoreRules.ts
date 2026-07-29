import { GAME_TUNING } from '../config/gameTuning';
import type { RecoverySource } from './orbRules';

export const ORB_CORE_IDS = ['echo', 'corrosion', 'conduction', 'inertia'] as const;
export type OrbCoreId = typeof ORB_CORE_IDS[number];

export interface OrbCoreState {
  echoStacks: number;
  conductionHits: number;
  inertiaStacks: number;
  inertiaLaunchStacks: number;
}

export interface CoreHitResolution {
  directDamageBonus: number;
  conductionTriggered: boolean;
  next: OrbCoreState;
}

export function createOrbCoreState(): OrbCoreState {
  return {
    echoStacks: 0,
    conductionHits: 0,
    inertiaStacks: 0,
    inertiaLaunchStacks: 0,
  };
}

export function applyCoreWallBounce(
  type: OrbCoreId,
  state: Readonly<OrbCoreState>,
): OrbCoreState {
  if (type !== 'echo') return { ...state };
  return {
    ...state,
    echoStacks: Math.min(
      GAME_TUNING.orbCores.echo.maxStacks,
      state.echoStacks + 1,
    ),
  };
}

export function resolveCoreDirectHit(
  type: OrbCoreId,
  state: Readonly<OrbCoreState>,
  conductionHitsRequired: number = GAME_TUNING.orbCores.conduction.hitsRequired,
): CoreHitResolution {
  const next = { ...state };
  let directDamageBonus = 0;
  let conductionTriggered = false;

  if (type === 'echo') {
    directDamageBonus = state.echoStacks
      * GAME_TUNING.orbCores.echo.damageBonusPerStack;
    next.echoStacks = 0;
  } else if (type === 'conduction') {
    next.conductionHits += 1;
    if (next.conductionHits >= conductionHitsRequired) {
      next.conductionHits = 0;
      conductionTriggered = true;
    }
  } else if (type === 'inertia') {
    next.inertiaStacks = Math.min(
      GAME_TUNING.orbCores.inertia.maxStacks,
      next.inertiaStacks + 1,
    );
    next.inertiaLaunchStacks = 0;
  }

  return { directDamageBonus, conductionTriggered, next };
}

export function resolveCoreRecovery(
  type: OrbCoreId,
  state: Readonly<OrbCoreState>,
  source: RecoverySource,
): OrbCoreState {
  const next = { ...state };
  if (type === 'echo') next.echoStacks = 0;
  if (type === 'inertia') {
    next.inertiaLaunchStacks = source === 'proximity' ? next.inertiaStacks : 0;
    next.inertiaStacks = 0;
  }
  return next;
}

export function coreLaunchSpeedMultiplier(
  type: OrbCoreId,
  state: Readonly<OrbCoreState>,
): number {
  if (type !== 'inertia') return 1;
  return 1 + state.inertiaLaunchStacks
    * GAME_TUNING.orbCores.inertia.speedBonusPerStack;
}
