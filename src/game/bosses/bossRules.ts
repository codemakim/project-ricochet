import { GAME_TUNING } from '../config/gameTuning';

export type BossPartId = 'leftWeakpoint' | 'rightWeakpoint' | 'core';
export type BossPhase = 'twoWeakpoints' | 'oneWeakpoint' | 'core' | 'defeated';
export type BossPattern = 'aimedShot' | 'supportDrop';

export interface BossState {
  leftWeakpointHp: number;
  rightWeakpointHp: number;
  coreHp: number;
  attackIndex: number;
}

export function createBossState(): BossState {
  return {
    leftWeakpointHp: GAME_TUNING.boss.weakpoint.hp,
    rightWeakpointHp: GAME_TUNING.boss.weakpoint.hp,
    coreHp: GAME_TUNING.boss.core.hp,
    attackIndex: 0,
  };
}

export function bossPhase(state: BossState): BossPhase {
  const activeWeakpoints = Number(state.leftWeakpointHp > 0) + Number(state.rightWeakpointHp > 0);
  if (activeWeakpoints === 2) return 'twoWeakpoints';
  if (activeWeakpoints === 1) return 'oneWeakpoint';
  return state.coreHp > 0 ? 'core' : 'defeated';
}

export function exposedBossParts(state: BossState): BossPartId[] {
  const phase = bossPhase(state);
  if (phase === 'core') return ['core'];
  if (phase === 'defeated') return [];

  const parts: BossPartId[] = [];
  if (state.leftWeakpointHp > 0) parts.push('leftWeakpoint');
  if (state.rightWeakpointHp > 0) parts.push('rightWeakpoint');
  return parts;
}

export function damageBossPart(state: BossState, part: BossPartId, damage: number): BossState {
  if (!Number.isFinite(damage) || damage <= 0) {
    throw new Error('damage must be finite and positive');
  }
  if (!exposedBossParts(state).includes(part)) {
    if (part === 'core' && bossPhase(state) !== 'core') {
      throw new Error('core is not exposed');
    }
    return state;
  }

  if (part === 'leftWeakpoint') {
    const next = { ...state, leftWeakpointHp: Math.max(0, state.leftWeakpointHp - damage) };
    return bossPhase(state) !== 'core' && bossPhase(next) === 'core'
      ? { ...next, attackIndex: 0 }
      : next;
  }
  if (part === 'rightWeakpoint') {
    const next = { ...state, rightWeakpointHp: Math.max(0, state.rightWeakpointHp - damage) };
    return bossPhase(state) !== 'core' && bossPhase(next) === 'core'
      ? { ...next, attackIndex: 0 }
      : next;
  }
  return { ...state, coreHp: Math.max(0, state.coreHp - damage) };
}

export function nextBossAttack(
  state: BossState,
): { patterns: BossPattern[]; intervalMs: number; state: BossState } {
  const phase = bossPhase(state);
  if (phase === 'defeated') {
    throw new Error('defeated boss cannot attack');
  }

  const attackNumber = state.attackIndex + 1;
  const patterns: BossPattern[] =
    phase === 'core'
      ? state.attackIndex % 3 === 0
        ? ['aimedShot']
        : state.attackIndex % 3 === 1
          ? ['supportDrop']
          : ['aimedShot', 'supportDrop']
      : [state.attackIndex % 2 === 0 ? 'aimedShot' : 'supportDrop'];
  const intervalMs = GAME_TUNING.boss.majorIntervalsMs[phase];

  return {
    patterns,
    intervalMs,
    state: { ...state, attackIndex: attackNumber },
  };
}
