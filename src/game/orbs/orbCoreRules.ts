import { GAME_TUNING } from '../config/gameTuning';
import type { RecoverySource } from './orbRules';

export const ORB_CORE_IDS = [
  'echo',
  'corrosion',
  'conduction',
  'inertia',
  'split',
  'explosion',
] as const;
export type OrbCoreId = typeof ORB_CORE_IDS[number];

export const ORB_CORE_DEFINITIONS = {
  echo: {
    label: '반향 구슬',
    summary: '벽 반사 공명을 다음 직격에 방출',
    color: GAME_TUNING.orbCores.echo.fill,
    maximumLevel: 5,
    levelEffects: [
      '벽 반사 공명을 다음 직격에 방출',
      '공명 상한과 중첩 피해 증가',
      '공명 방출 시 충격파 생성',
      '벽 반사 시 확률로 절단선 발사',
      '최대 공명 방출 시 반사 경로 재생',
    ],
  },
  corrosion: {
    label: '부식 구슬',
    summary: '충돌 지점에 지속 피해 영역 생성',
    color: GAME_TUNING.orbCores.corrosion.fill,
    maximumLevel: 5,
    levelEffects: [
      '충돌 지점에 부식 영역 생성',
      '부식 범위와 지속시간 증가',
      '정밀 직격 대상에 부식 영역 부착',
      '부식 중첩이 받는 피해 증가',
      '부식된 적 처치 시 주변으로 확산',
    ],
  },
  conduction: {
    label: '전도 구슬',
    summary: '직격 에너지를 가까운 적에게 전달',
    color: GAME_TUNING.orbCores.conduction.fill,
    maximumLevel: 5,
    levelEffects: [
      '직격 에너지를 가까운 적에게 전달',
      '전달 거리와 대상 수 증가',
      '비행 중 가까운 적을 지속 공격',
      '비행 공격 대상과 속도 증가',
      '직격 시 연결된 적을 과충전',
    ],
  },
  inertia: {
    label: '관성 구슬',
    summary: '빠를수록 강해지는 정밀 직격',
    color: GAME_TUNING.orbCores.inertia.fill,
    maximumLevel: 5,
    levelEffects: [
      '속도가 빠를수록 직접 피해 증가',
      '기본 속도와 피해 상한 증가',
      '정밀 직격 시 운동 충격파 생성',
      '정밀 직격 뒤 최고 속도 유지',
      '정밀 직격이 적을 관통하고 폭발',
    ],
  },
  split: {
    label: '분열 구슬',
    summary: '확률로 임시 구슬을 산개',
    color: GAME_TUNING.orbCores.split.fill,
    maximumLevel: 5,
    levelEffects: [
      '직격 시 확률로 임시 구슬 생성',
      '분열 확률 증가',
      '임시 구슬의 추가 반사 허용',
      '임시 구슬 수와 유지시간 증가',
      '임시 구슬이 일부 공용 효과 계승',
    ],
  },
  explosion: {
    label: '폭발 구슬',
    summary: '실패할수록 강해지는 충격 폭발',
    color: GAME_TUNING.orbCores.explosion.fill,
    maximumLevel: 5,
    levelEffects: [
      '직격 시 확률로 충격 폭발',
      '폭발 피해 증가',
      '연속 실패마다 다음 확률 증가',
      '폭발 범위 증가',
      '최대 실패 누적 시 중심부 강타',
    ],
  },
} as const satisfies Record<OrbCoreId, {
  label: string;
  summary: string;
  color: number;
  maximumLevel: 5;
  levelEffects: readonly [string, string, string, string, string];
}>; 

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
