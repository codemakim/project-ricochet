import type { EnemyKind, EnemySpec } from '../enemies/enemyRules';
import type { ThreatPhase } from './encounterRules';

type Entry = readonly [row: 0 | 1, column: number, kind: EnemyKind];

const PHASE_SIZES = [6, 8, 10] as const;
const ROW_Y = [-28, 14] as const;
const SPEED = 22;

const TEMPLATES: Readonly<Record<ThreatPhase, readonly Entry[]>> = {
  0: [
    [0, 0, 'basic'], [0, 3, 'armored'], [0, 6, 'basic'],
    [1, 1, 'basic'], [1, 4, 'basic'], [1, 7, 'basic'],
  ],
  1: [
    [0, 0, 'basic'], [0, 2, 'armored'], [0, 4, 'basic'], [0, 6, 'shooter'],
    [1, 1, 'basic'], [1, 3, 'armored'], [1, 5, 'basic'], [1, 7, 'basic'],
  ],
  2: [
    [0, 0, 'basic'], [0, 1, 'armored'], [0, 3, 'basic'], [0, 5, 'shooter'], [0, 7, 'basic'],
    [1, 0, 'basic'], [1, 2, 'shooter'], [1, 4, 'basic'], [1, 6, 'armored'], [1, 7, 'basic'],
  ],
};

export function createReinforcementFormation(
  phase: ThreatPhase,
  sequence: number,
): EnemySpec[] {
  if (!Number.isInteger(sequence) || sequence < 0) {
    throw new RangeError('sequence must be a non-negative integer');
  }
  const mirror = sequence % 2 === 1;
  const entries = TEMPLATES[phase];
  if (entries.length !== PHASE_SIZES[phase]) throw new Error('invalid reinforcement template');
  return entries.map(([row, rawColumn, kind]) => {
    const column = mirror ? 7 - rawColumn : rawColumn;
    return {
      kind,
      hp: kind === 'armored' ? 3 : 1,
      x: 36 + column * 54,
      y: ROW_Y[row],
      column,
      speed: SPEED,
    };
  });
}
