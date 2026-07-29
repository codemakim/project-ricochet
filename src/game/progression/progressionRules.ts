import { GAME_TUNING } from '../config/gameTuning';
import type { EnemyKind } from '../enemies/enemyRules';
import type { OrbCoreId } from '../orbs/orbCoreRules';

export const ABILITY_DEFINITIONS = {
  firepower: { label: '화력 증폭', summary: '영구·임시 직접 피해 증가', maxRank: 5, requires: [] },
  kinetic: { label: '운동 에너지', summary: '영구 구슬 기본 속도 증가', maxRank: 3, requires: [] },
  explosion: { label: '충격 폭발', summary: '영구 직접 타격 시 확률 폭발', maxRank: 1, requires: [] },
  split: { label: '분열 프로토콜', summary: '영구 직접 타격 시 확률 분열', maxRank: 1, requires: [] },
  'near-amplification': { label: '근접 증폭', summary: '가까운 적 직접 피해 증가', maxRank: 3, requires: [] },
  'precision-hit': { label: '정밀 직격', summary: '벽 충돌 전 직접 피해 증가', maxRank: 3, requires: [] },
  'kinetic-conversion': { label: '운동 변환', summary: '속도 초과분을 직접 피해로 변환', maxRank: 3, requires: [] },
  'wall-acceleration': { label: '벽 가속', summary: '벽 충돌마다 현재 비행 속도 증가', maxRank: 3, requires: [] },
  'horizontal-cutter': { label: '수평 절단선', summary: '직격 시 확률로 수평 레이저 발사', maxRank: 1, requires: [] },
  'vertical-cutter': { label: '수직 절단선', summary: '직격 시 확률로 수직 레이저 발사', maxRank: 1, requires: [] },
  'destruction-reaction': { label: '파괴 반응', summary: '직접 처치 시 확률 폭발', maxRank: 1, requires: [] },
  'micro-missile': { label: '미세 유도탄', summary: '직격 6회마다 유도탄 발사', maxRank: 1, requires: [] },
  'recovery-shockwave': { label: '회수 충격파', summary: '근접 회수 4회마다 충격파', maxRank: 2, requires: [] },
  'additional-core': { label: '추가 코어', summary: '영구 구슬 1개 추가', maxRank: 3, requires: [] },
  'core-expansion': { label: '코어 팽창', summary: '영구 구슬 크기 증가', maxRank: 2, requires: [] },
  'recovery-field': { label: '흡수장 확장', summary: '근접 회수 반경 증가', maxRank: 3, requires: [] },
  'mobility-motor': { label: '기동 모터', summary: '플레이어 이동 속도 증가', maxRank: 2, requires: [] },
  'armor-reinforcement': { label: '장갑 보강', summary: '최대 체력과 현재 체력 증가', maxRank: 3, requires: [] },
  'reload-overcharge': { label: '재장전 과충전', summary: '근접 회수 뒤 첫 직접 피해 증가', maxRank: 3, requires: [] },
  'consecutive-impact': { label: '연속 충돌', summary: '벽 없이 이어진 직접 타격 강화', maxRank: 3, requires: [] },
  'kill-overclock': { label: '처치 오버클럭', summary: '직접 처치 뒤 잠시 피해와 속도 증가', maxRank: 3, requires: [] },
  'collision-acceleration': { label: '충돌 가속', summary: '직접 타격 뒤 잠시 속도 증가', maxRank: 2, requires: [] },
  'tracking-magnet': { label: '추적 자석', summary: '첫 직접 타격 뒤 흡수 반경 증가', maxRank: 2, requires: [] },
  'high-speed-impact': { label: '고속 충격', summary: '고속 직접 타격 누적으로 충격파', maxRank: 1, requires: [] },
  'proc-optimization': { label: '발동 최적화', summary: '확률형 효과 발동률 증가', maxRank: 2, requires: [] },
  'effect-output': { label: '효과 출력', summary: '보조 효과 피해 증가', maxRank: 3, requires: [] },
  'area-expansion': { label: '영향권 확장', summary: '원형 보조 효과 반경 증가', maxRank: 3, requires: [] },
  'duration-module': { label: '잔류 장치', summary: '가스와 시간제 효과 지속시간 증가', maxRank: 2, requires: [] },
  'focusing-lens': { label: '집속 렌즈', summary: '수평·수직 레이저 두께 증가', maxRank: 2, requires: [] },
  'fragment-expansion': { label: '파편 증설', summary: '분열 임시 구슬 수 증가', maxRank: 2, requires: ['split'] },
  'fragment-output': { label: '파편 출력', summary: '임시 구슬 직접 피해 증가', maxRank: 3, requires: ['split'] },
  'fragment-stabilization': { label: '파편 안정화', summary: '임시 구슬 수명 증가', maxRank: 2, requires: ['split'] },
  'conduction-expansion': { label: '전도 확장', summary: '전도 연쇄 대상 수 증가', maxRank: 2, requires: [] },
} as const;

export type AbilityId = keyof typeof ABILITY_DEFINITIONS;
export const ABILITY_IDS = Object.keys(ABILITY_DEFINITIONS) as AbilityId[];
export type AbilityRanks = Record<AbilityId, number>;
export const MAX_ABILITY_KINDS = 12;

export interface AbilityEligibilityContext {
  coreTypes?: readonly OrbCoreId[];
}

const ABILITY_RELEVANCE: Partial<Record<AbilityId, {
  anyAbility?: readonly AbilityId[];
  anyCore?: readonly OrbCoreId[];
}>> = {
  'proc-optimization': {
    anyAbility: ['explosion', 'split', 'horizontal-cutter', 'vertical-cutter', 'destruction-reaction'],
    anyCore: ['corrosion'],
  },
  'effect-output': {
    anyAbility: [
      'explosion',
      'horizontal-cutter',
      'vertical-cutter',
      'destruction-reaction',
      'micro-missile',
      'recovery-shockwave',
      'high-speed-impact',
    ],
    anyCore: ['corrosion', 'conduction'],
  },
  'area-expansion': {
    anyAbility: ['explosion', 'destruction-reaction', 'recovery-shockwave', 'high-speed-impact'],
    anyCore: ['corrosion', 'conduction'],
  },
  'duration-module': {
    anyAbility: ['kill-overclock', 'collision-acceleration', 'tracking-magnet'],
    anyCore: ['corrosion'],
  },
  'focusing-lens': { anyAbility: ['horizontal-cutter', 'vertical-cutter'] },
  'conduction-expansion': { anyCore: ['conduction'] },
};

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

export function eligibleAbilityIds(
  ranks: Readonly<AbilityRanks>,
  context: AbilityEligibilityContext = {},
): AbilityId[] {
  const ownedKindCount = ABILITY_IDS.filter((id) => ranks[id] > 0).length;
  return ABILITY_IDS.filter((id) => (
    ranks[id] < ABILITY_MAX_RANKS[id]
    && (ranks[id] > 0 || canAcquireNewAbility(ownedKindCount))
    && prerequisitesMet(ABILITY_DEFINITIONS[id].requires, ranks)
    && relevanceMet(id, ranks, context)
  ));
}

function relevanceMet(
  id: AbilityId,
  ranks: Readonly<AbilityRanks>,
  context: AbilityEligibilityContext,
): boolean {
  const relevance = ABILITY_RELEVANCE[id];
  if (!relevance || ranks[id] > 0) return true;
  return Boolean(
    relevance.anyAbility?.some((required) => ranks[required] > 0)
    || relevance.anyCore?.some((required) => context.coreTypes?.includes(required)),
  );
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
  context: AbilityEligibilityContext = {},
): AbilityId[] {
  const eligible = eligibleAbilityIds(ranks, context);
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
