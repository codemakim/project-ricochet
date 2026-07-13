import type { ExperimentSettings } from '../constants';

export type OrbState =
  | 'stored'
  | 'queued'
  | 'active'
  | 'attracting'
  | 'floor-returning'
  | 'timeout-returning';

export type RecoverySource = 'proximity' | 'floorRecall' | 'timeoutRecall';

export interface HitResult {
  charges: number;
  damage: number;
  killed: boolean;
  reflect: boolean;
}

const LEGAL_TRANSITIONS: Record<OrbState, readonly OrbState[]> = {
  stored: ['queued'],
  queued: ['active'],
  active: ['attracting', 'floor-returning', 'timeout-returning'],
  attracting: ['stored'],
  'floor-returning': ['stored'],
  'timeout-returning': ['stored'],
};

export function transitionOrb(from: OrbState, to: OrbState): OrbState {
  if (!LEGAL_TRANSITIONS[from].includes(to)) {
    throw new RangeError(`illegal orb transition: ${from} -> ${to}`);
  }
  return to;
}

export function recoveryBonusAllowed(source: RecoverySource): boolean {
  return source === 'proximity';
}

export function directHit(
  charges: number,
  enemyHp: number,
  settings: Pick<ExperimentSettings, 'passThroughOnKill'>,
  piercing: boolean,
): HitResult {
  const charged = charges > 0;
  const damage = charged ? 1.5 : 1;
  const killed = enemyHp <= damage;

  return {
    charges: charged ? charges - 1 : 0,
    damage,
    killed,
    reflect: piercing ? false : !(killed && settings.passThroughOnKill),
  };
}
