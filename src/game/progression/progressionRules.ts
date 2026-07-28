import { GAME_TUNING } from '../config/gameTuning';
import type { EnemyKind } from '../enemies/enemyRules';

export const ABILITY_DEFINITIONS = {
  firepower: { label: '화력 증폭', summary: '영구·임시 직접 피해 증가', maxRank: 5, requires: [] },
  kinetic: { label: '운동 에너지', summary: '영구 구슬 기본 속도 증가', maxRank: 3, requires: [] },
  explosion: { label: '충격 폭발', summary: '영구 직접 타격 시 확률 폭발', maxRank: 1, requires: [] },
  split: { label: '분열 프로토콜', summary: '영구 직접 타격 시 확률 분열', maxRank: 1, requires: [] },
  'near-amplification': { label: '근접 증폭', summary: '가까운 적 직접 피해 증가', maxRank: 3, requires: [] },
  'precision-hit': { label: '정밀 직격', summary: '벽 충돌 전 직접 피해 증가', maxRank: 3, requires: [] },
  'kinetic-conversion': { label: '운동 변환', summary: '속도 초과분을 직접 피해로 변환', maxRank: 3, requires: [] },
  'wall-acceleration': { label: '벽 가속', summary: '벽 충돌마다 현재 비행 속도 증가', maxRank: 3, requires: [] },
} as const;

export type AbilityId = keyof typeof ABILITY_DEFINITIONS;
export const ABILITY_IDS = Object.keys(ABILITY_DEFINITIONS) as AbilityId[];
export type AbilityRanks = Record<AbilityId, number>;
export const MAX_ABILITY_KINDS = 12;

export const ABILITY_MAX_RANKS = Object.fromEntries(
  ABILITY_IDS.map((id) => [id, ABILITY_DEFINITIONS[id].maxRank]),
) as Record<AbilityId, number>;

export const MAX_BUILD_LEVEL = Object.values(ABILITY_MAX_RANKS)
  .reduce((total, rank) => total + rank, 0);

export function createEmptyAbilityRanks(): AbilityRanks {
  return Object.fromEntries(ABILITY_IDS.map((id) => [id, 0])) as AbilityRanks;
}

export function canAcquireNewAbility(ownedKindCount: number): boolean {
  return ownedKindCount < MAX_ABILITY_KINDS;
}

export function prerequisitesMet(
  required: readonly AbilityId[],
  ranks: Readonly<AbilityRanks>,
): boolean {
  return required.every((id) => ranks[id] > 0);
}

export function eligibleAbilityIds(ranks: Readonly<AbilityRanks>): AbilityId[] {
  const ownedKindCount = ABILITY_IDS.filter((id) => ranks[id] > 0).length;
  return ABILITY_IDS.filter((id) => (
    ranks[id] < ABILITY_MAX_RANKS[id]
    && (ranks[id] > 0 || canAcquireNewAbility(ownedKindCount))
    && prerequisitesMet(ABILITY_DEFINITIONS[id].requires, ranks)
  ));
}

export function xpForEnemy(kind: EnemyKind): number {
  switch (kind) {
    case 'armored': return 3;
    case 'shooter': return 2;
    case 'splitter': return GAME_TUNING.enemies.splitter.xp;
    case 'fragment': return GAME_TUNING.enemies.fragment.xp;
    case 'basic': return 1;
  }
}

export function xpRequiredForLevel(level: number): number {
  if (!Number.isInteger(level) || level < 0) {
    throw new RangeError('level must be a non-negative integer');
  }

  return 12 + level * 5;
}

function nextSeed(seed: number): number {
  return (Math.imul(seed, 1664525) + 1013904223) >>> 0;
}

export function selectAbilityOptions(
  ranks: Readonly<AbilityRanks>,
  level: number,
  seed: number,
): AbilityId[] {
  const eligible = eligibleAbilityIds(ranks);
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
