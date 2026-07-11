export type EnemyKind = 'basic' | 'armored';

export interface HealthState {
  current: number;
  maximum: number;
  shield: number;
  defeated: boolean;
}

export function createHealth(): HealthState {
  return { current: 10, maximum: 10, shield: 0, defeated: false };
}

export function applyDamage(state: HealthState, amount: number): HealthState {
  const absorbed = Math.min(state.shield, amount);
  const shield = state.shield - absorbed;
  const current = Math.max(0, state.current - (amount - absorbed));
  return { ...state, shield, current, defeated: current === 0 };
}

export function breachDamage(kind: EnemyKind): number {
  return kind === 'armored' ? 4 : 2;
}
