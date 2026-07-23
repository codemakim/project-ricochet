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
  charged: boolean;
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
  directDamageBonus = 0,
  chargedDamageBonus = 0,
  chargedKillPierces = false,
): HitResult {
  if (!Number.isFinite(directDamageBonus) || directDamageBonus < 0) {
    throw new RangeError('direct damage bonus must be finite and non-negative');
  }
  if (!Number.isFinite(chargedDamageBonus) || chargedDamageBonus < 0) {
    throw new RangeError('charged damage bonus must be finite and non-negative');
  }
  const charged = charges > 0;
  const damage = (charged ? 1.5 : 1)
    + directDamageBonus
    + (charged ? chargedDamageBonus : 0);
  const killed = enemyHp <= damage;
  const rewardPiercing = charged && killed && chargedKillPierces;

  return {
    charged,
    charges: charged ? charges - 1 : 0,
    damage,
    killed,
    reflect: piercing ? false : !(killed && (settings.passThroughOnKill || rewardPiercing)),
  };
}
