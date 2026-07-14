import type { EnemyKind } from '../enemies/enemyRules';

export const ABILITY_IDS = ['firepower', 'kinetic', 'explosion', 'split'] as const;
export type AbilityId = typeof ABILITY_IDS[number];
export type AbilityRanks = Record<AbilityId, number>;

export function xpForEnemy(kind: EnemyKind): number {
  return kind === 'armored' ? 3 : kind === 'shooter' ? 2 : 1;
}

export function xpRequiredForLevel(level: number): number {
  if (!Number.isInteger(level) || level < 0) {
    throw new RangeError('level must be a non-negative integer');
  }

  return 8 + level * 4;
}

function nextSeed(seed: number): number {
  return (Math.imul(seed, 1664525) + 1013904223) >>> 0;
}

export function selectAbilityOptions(
  ranks: Readonly<AbilityRanks>,
  level: number,
  seed: number,
): AbilityId[] {
  const eligible = ABILITY_IDS.filter((id) => ranks[id] < 5);
  let state = (seed ^ Math.imul(level + 1, 2654435761)) >>> 0;
  const shuffled = [...eligible];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state = nextSeed(state);
    const swap = state % (index + 1);
    [shuffled[index], shuffled[swap]] = [shuffled[swap]!, shuffled[index]!];
  }

  const options = shuffled.slice(0, 3);
  if (level === 0 && !options.some((id) => id === 'explosion' || id === 'split')) {
    const effect = shuffled.find((id) => id === 'explosion' || id === 'split');
    if (effect && options.length > 0) options[options.length - 1] = effect;
  }

  return [...new Set(options)];
}
