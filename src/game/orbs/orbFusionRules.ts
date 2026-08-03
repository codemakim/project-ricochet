import {
  ORB_CORE_DEFINITIONS,
  ORB_CORE_IDS,
  type OrbCoreId,
} from './orbCoreRules';
import { GAME_TUNING } from '../config/gameTuning';

export const FUSION_ORB_IDS = [
  'photon-orbit',
  'resonant-swarm',
  'nano-proliferator',
  'mass-collapse',
  'reactor-orb',
  'cluster-bombardment',
  'mirror-circuit',
  'meltdown-core',
  'vector-blade',
] as const;

export type FusionOrbId = typeof FUSION_ORB_IDS[number];
export type OrbTypeId = OrbCoreId | FusionOrbId;

export const ORB_FUSION_DEFINITIONS = {
  'photon-orbit': {
    label: '광자 궤도',
    roleHint: '관통 궤적형',
    summary: '정밀 직격과 반사 궤적을 관통 광선으로 전환',
    color: GAME_TUNING.orbFusions.photonOrbit.fill,
    accent: GAME_TUNING.orbFusions.photonOrbit.accent,
    maximumLevel: 9,
    materials: ['inertia', 'conduction'],
    levelEffects: [
      '직격 방향으로 관통 광선을 발사',
      '광선 피해 증가',
      '광선 길이 증가',
      '벽 반사 궤적에 잔광 생성',
      '잔광 피해 증가',
      '광선 폭 증가',
      '동시에 유지되는 잔광 증가',
      '잔광 지속시간 증가',
      '잔광 교차점에서 광자 폭발',
    ],
  },
  'resonant-swarm': {
    label: '공명 군체',
    roleHint: '군체 연쇄형',
    summary: '분화한 공명체가 적 사이로 에너지를 왕복 전달',
    color: GAME_TUNING.orbFusions.resonantSwarm.fill,
    accent: GAME_TUNING.orbFusions.resonantSwarm.accent,
    maximumLevel: 9,
    materials: ['conduction', 'split'],
    levelEffects: [
      '직격 시 확률로 공명체 분화',
      '공명 전달 피해 증가',
      '분화 확률 증가',
      '공명체 수와 수명 증가',
      '가까운 공명체끼리 출력 증가',
      '공명 전달 거리 증가',
      '추가 대상에게 공명 전달',
      '마지막 공명파 피해 증가',
      '소멸 시 강한 마지막 공명파 방출',
    ],
  },
  'nano-proliferator': {
    label: '나노 증식체',
    roleHint: '지역 증식형',
    summary: '고정 피해 씨앗을 산개하고 처치 지점에서 증식',
    color: GAME_TUNING.orbFusions.nanoProliferator.fill,
    accent: GAME_TUNING.orbFusions.nanoProliferator.accent,
    maximumLevel: 9,
    materials: ['split', 'corrosion'],
    levelEffects: [
      '직격 시 확률로 나노 씨앗 산개',
      '씨앗 지속 피해 증가',
      '씨앗 생성 확률 증가',
      '씨앗 수와 범위 증가',
      '씨앗 지속시간 증가',
      '동시 유지 씨앗 증가',
      '씨앗 안에서 처치 시 한 세대 증식',
      '증식 씨앗 피해 증가',
      '최대 두 세대까지 연쇄 증식',
    ],
  },
  'mass-collapse': {
    label: '질량 붕괴탄',
    roleHint: '직격 붕괴형',
    summary: '고속 직격으로 구조 열화를 쌓고 임계점에서 붕괴',
    color: GAME_TUNING.orbFusions.massCollapse.fill,
    accent: GAME_TUNING.orbFusions.massCollapse.accent,
    maximumLevel: 9,
    materials: ['corrosion', 'inertia'],
    levelEffects: [
      '고속 직격으로 구조 열화를 축적',
      '붕괴 피해 증가',
      '필요 속도 감소',
      '정밀 직격 시 열화 추가',
      '붕괴 범위 증가',
      '붕괴 피해 증가',
      '인접 대상에 붕괴 충격 전달',
      '붕괴 임계치 감소',
      '최대 출력 질량 붕괴',
    ],
  },
  'reactor-orb': {
    label: '반응로 구슬',
    roleHint: '반사 충전형',
    summary: '벽 반사로 반응로를 충전하고 다음 적 충돌에서 방출',
    color: GAME_TUNING.orbFusions.reactorOrb.fill,
    accent: GAME_TUNING.orbFusions.reactorOrb.accent,
    maximumLevel: 9,
    materials: ['echo', 'explosion'],
    levelEffects: [
      '벽 반사 충전을 다음 적 충돌에서 폭발',
      '충전당 폭발 피해 증가',
      '최대 충전 증가',
      '충전당 폭발 범위 증가',
      '충전당 폭발 피해 증가',
      '최대 충전 증가',
      '최대 충전 시 외곽 충격파 생성',
      '충격파 범위 증가',
      '완전 충전 반응로 폭발 강화',
    ],
  },
  'cluster-bombardment': {
    label: '성단 폭격체',
    roleHint: '산개 폭격형',
    summary: '적 충돌 시 여섯 방향으로 폭발탄을 산개해 착탄',
    color: GAME_TUNING.orbFusions.clusterBombardment.fill,
    accent: GAME_TUNING.orbFusions.clusterBombardment.accent,
    maximumLevel: 9,
    materials: ['explosion', 'split'],
    levelEffects: [
      '직격 시 확률로 여섯 방향 폭발탄 산개',
      '착탄 피해 증가',
      '산개 확률 증가',
      '폭격 거리 증가',
      '착탄 범위 증가',
      '착탄 피해 증가',
      '착탄 지점에 짧은 충격 지대 생성',
      '충격 지대 지속시간 증가',
      '성단 폭격 피해와 발생 확률 강화',
    ],
  },
  'mirror-circuit': {
    label: '거울 회로', roleHint: '반사 연결형',
    summary: '벽 반사 지점의 거울을 광선으로 연결해 지속 피해',
    color: GAME_TUNING.orbFusions.mirrorCircuit.fill,
    accent: GAME_TUNING.orbFusions.mirrorCircuit.accent,
    maximumLevel: 9, materials: ['echo', 'conduction'],
    levelEffects: ['반사 지점에 거울 설치', '연결 피해 증가', '거울 지속시간 증가', '거울 수 증가', '광선 폭 증가', '연결 피해 증가', '거울 수 증가', '거울 지속시간 증가', '교차 광선 폭발'],
  },
  'meltdown-core': {
    label: '융해 코어', roleHint: '과열 중첩형',
    summary: '충돌 지점을 과열시키고 임계 온도에서 융해 폭발',
    color: GAME_TUNING.orbFusions.meltdownCore.fill,
    accent: GAME_TUNING.orbFusions.meltdownCore.accent,
    maximumLevel: 9, materials: ['explosion', 'corrosion'],
    levelEffects: ['확률로 과열 지역 생성', '지속 피해 증가', '발생 확률 증가', '과열 범위 증가', '열 중첩 피해 증가', '지역 지속시간 증가', '융해 임계치 감소', '융해 폭발 강화', '최대 출력 융해 폭발'],
  },
  'vector-blade': {
    label: '벡터 블레이드', roleHint: '궤적 절단형',
    summary: '반사 벡터를 저장하고 다음 직격에서 절단파로 재생',
    color: GAME_TUNING.orbFusions.vectorBlade.fill,
    accent: GAME_TUNING.orbFusions.vectorBlade.accent,
    maximumLevel: 9, materials: ['inertia', 'echo'],
    levelEffects: ['반사 벡터를 절단파로 방출', '절단 피해 증가', '절단 길이 증가', '경로 길이 보정 증가', '절단 폭 증가', '속도 보정 증가', '저장 벡터 증가', '절단 피해 증가', '최근 두 벡터 연속 재생'],
  },
} as const satisfies Record<FusionOrbId, {
  label: string;
  roleHint: string;
  summary: string;
  color: number;
  accent: number;
  maximumLevel: 9;
  materials: readonly [OrbCoreId, OrbCoreId];
  levelEffects: readonly [string, string, string, string, string, string, string, string, string];
}>;

export interface FusionMaterialOrb {
  id: number;
  coreType: OrbTypeId;
  level: number;
}

export interface FusionMaterialPair {
  firstId: number;
  secondId: number;
  resultLevel: number;
}

export function isFusionOrbId(value: string): value is FusionOrbId {
  return FUSION_ORB_IDS.includes(value as FusionOrbId);
}

export function isBasicOrbCoreId(value: string): value is OrbCoreId {
  return ORB_CORE_IDS.includes(value as OrbCoreId);
}

export function orbDefinition(type: OrbTypeId) {
  return isFusionOrbId(type)
    ? ORB_FUSION_DEFINITIONS[type]
    : ORB_CORE_DEFINITIONS[type];
}

export function orbMaximumLevel(type: OrbTypeId): number {
  return orbDefinition(type).maximumLevel;
}

export function fusionLevel(firstLevel: number, secondLevel: number): number {
  for (const level of [firstLevel, secondLevel]) {
    if (!Number.isInteger(level) || level < 1 || level > 5) {
      throw new RangeError('material level must be an integer from 1 through 5');
    }
  }
  return Math.min(9, firstLevel + secondLevel - 1);
}

export function fusionMaterialPairs(
  orbs: readonly FusionMaterialOrb[],
  fusionType: FusionOrbId,
): FusionMaterialPair[] {
  if (orbs.some(({ coreType }) => coreType === fusionType)) return [];
  const [firstType, secondType] = ORB_FUSION_DEFINITIONS[fusionType].materials;
  const first = orbs.filter(({ coreType }) => coreType === firstType);
  const second = orbs.filter(({ coreType }) => coreType === secondType);
  return first.flatMap((left) => second
    .filter((right) => right.id !== left.id)
    .map((right) => ({
      firstId: left.id,
      secondId: right.id,
      resultLevel: fusionLevel(left.level, right.level),
    })));
}

export function availableFusionIds(
  orbs: readonly FusionMaterialOrb[],
): FusionOrbId[] {
  return FUSION_ORB_IDS.filter((fusionType) => (
    fusionMaterialPairs(orbs, fusionType).length > 0
  ));
}
