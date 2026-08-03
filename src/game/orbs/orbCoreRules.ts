import { GAME_TUNING } from '../config/gameTuning';
import type { ExplosionSpec, SplitSpec } from '../progression/BuildState';
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
    roleHint: '반사 축적형',
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
    roleHint: '지속 영역형',
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
    roleHint: '연쇄 전도형',
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
    roleHint: '고속 직격형',
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
    roleHint: '분열 생성형',
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
    roleHint: '확률 폭발형',
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
  roleHint: string;
  summary: string;
  color: number;
  maximumLevel: 5;
  levelEffects: readonly [string, string, string, string, string];
}>; 

export interface OrbCoreState {
  echoStacks: number;
  explosionFailures: number;
}

export interface CoreHitResolution {
  directDamageBonus: number;
  conductionTriggered: boolean;
  next: OrbCoreState;
}

export interface SplitProfile {
  chance: number;
  cooldownMs: number;
  count: number;
  extraBounces: number;
  lifetimeMs: number;
  inheritedOutputScale: number;
}

export interface ExplosionProfile {
  chance: number;
  cooldownMs: number;
  damage: number;
  radius: number;
  maximumFailures: number;
  centerBlast?: { radius: number; damage: number };
}

export interface CoreDirectEffectProfile {
  shockwave: { radius: number; damage: number } | null;
  replayPath: boolean;
  holdTopSpeedMs: number;
  pierce: boolean;
  kineticExplosion: { radius: number; damage: number } | null;
  chain: {
    targets: number;
    radius: number;
    damage: number;
    overchargeDamage: number;
  } | null;
}

export interface ConductionFlightProfile {
  targets: number;
  radius: number;
  tickMs: number;
  damage: number;
}

export function createOrbCoreState(): OrbCoreState {
  return {
    echoStacks: 0,
    explosionFailures: 0,
  };
}

function levelIndex(level: number): 0 | 1 | 2 | 3 | 4 {
  if (!Number.isInteger(level) || level < 1 || level > 5) {
    throw new RangeError('core level must be an integer from 1 through 5');
  }
  return level - 1 as 0 | 1 | 2 | 3 | 4;
}

export function applyCoreWallBounce(
  type: OrbCoreId,
  level: number,
  state: Readonly<OrbCoreState>,
): OrbCoreState {
  const index = levelIndex(level);
  if (type !== 'echo') return { ...state };
  return {
    ...state,
    echoStacks: Math.min(
      GAME_TUNING.orbCores.echo.maxStacksByLevel[index],
      state.echoStacks + 1,
    ),
  };
}

export function resolveCoreDirectHit(
  type: OrbCoreId,
  level: number,
  state: Readonly<OrbCoreState>,
  speedRatio = 1,
): CoreHitResolution {
  const index = levelIndex(level);
  const next = { ...state };
  let directDamageBonus = 0;

  if (type === 'echo') {
    directDamageBonus = state.echoStacks
      * GAME_TUNING.orbCores.echo.damageBonusPerStackByLevel[index];
    next.echoStacks = 0;
  } else if (type === 'inertia') {
    const steps = Math.floor(
      Math.max(0, speedRatio - 1 + Number.EPSILON)
      / GAME_TUNING.orbCores.inertia.speedStep,
    );
    directDamageBonus = Math.min(
      GAME_TUNING.orbCores.inertia.maximumDamageBonusByLevel[index],
      steps * GAME_TUNING.orbCores.inertia.damagePerSpeedStepByLevel[index],
    );
  }

  return { directDamageBonus, conductionTriggered: type === 'conduction', next };
}

export function resolveCoreRecovery(
  type: OrbCoreId,
  state: Readonly<OrbCoreState>,
  source: RecoverySource,
): OrbCoreState {
  const next = { ...state };
  if (type === 'echo') next.echoStacks = 0;
  void source;
  return next;
}

export function coreLaunchSpeedMultiplier(
  type: OrbCoreId,
  level: number,
): number {
  const index = levelIndex(level);
  if (type !== 'inertia') return 1;
  return GAME_TUNING.orbCores.inertia.baseSpeedMultiplierByLevel[index];
}

export function splitProfile(
  coreType: OrbCoreId,
  level: number,
  generic: SplitSpec | null,
): SplitProfile | null {
  const index = levelIndex(level);
  if (coreType !== 'split') {
    return generic ? {
      ...generic,
      extraBounces: 0,
      lifetimeMs: GAME_TUNING.temporaryOrbs.lifetimeMs,
      inheritedOutputScale: 0,
    } : null;
  }
  const tuning = GAME_TUNING.orbCores.split;
  return {
    chance: Math.min(1, Math.max(
      tuning.chanceByLevel[index] + (generic ? tuning.genericSynergy.chanceBonus : 0),
      generic?.chance ?? 0,
    )),
    cooldownMs: generic?.cooldownMs ?? GAME_TUNING.build.split.cooldownMs,
    count: tuning.countByLevel[index]
      + (generic ? tuning.genericSynergy.countBonus : 0),
    extraBounces: tuning.extraBouncesByLevel[index],
    lifetimeMs: tuning.lifetimeMsByLevel[index],
    inheritedOutputScale: level >= tuning.inheritedEffects.fromLevel
      ? tuning.inheritedEffects.outputScale
      : 0,
  };
}

export function explosionProfile(
  coreType: OrbCoreId,
  level: number,
  generic: ExplosionSpec | null,
  failures: number,
): ExplosionProfile | null {
  const index = levelIndex(level);
  if (coreType !== 'explosion') {
    return generic ? { ...generic, maximumFailures: 0 } : null;
  }
  const tuning = GAME_TUNING.orbCores.explosion;
  const pityFailures = level >= tuning.pity.fromLevel
    ? Math.min(tuning.pity.maximumFailures, Math.max(0, Math.trunc(failures)))
    : 0;
  const damage = tuning.damageByLevel[index]
    * (generic ? tuning.genericSynergy.damageMultiplier : 1);
  return {
    chance: Math.min(1, Math.max(
      tuning.chanceByLevel[index]
        + pityFailures * tuning.pity.chancePerFailure
        + (generic ? tuning.genericSynergy.chanceBonus : 0),
      generic?.chance ?? 0,
    )),
    cooldownMs: generic?.cooldownMs ?? GAME_TUNING.build.explosion.cooldownMs,
    damage,
    radius: tuning.radiusByLevel[index],
    maximumFailures: level >= tuning.pity.fromLevel ? tuning.pity.maximumFailures : 0,
    ...(level >= tuning.centerBlast.fromLevel && pityFailures >= tuning.pity.maximumFailures
      ? {
        centerBlast: {
          radius: tuning.centerBlast.radius,
          damage: damage * tuning.centerBlast.damageMultiplier,
        },
      }
      : {}),
  };
}

export function resolveExplosionOutcome(
  coreType: OrbCoreId,
  state: Readonly<OrbCoreState>,
  triggered: boolean,
): OrbCoreState {
  if (coreType !== 'explosion') return { ...state };
  return {
    ...state,
    explosionFailures: triggered
      ? 0
      : Math.min(
        GAME_TUNING.orbCores.explosion.pity.maximumFailures,
        state.explosionFailures + 1,
      ),
  };
}

export function coreDirectEffectProfile(
  coreType: OrbCoreId,
  level: number,
  precisionHit: boolean,
  echoStacks: number,
): CoreDirectEffectProfile {
  const index = levelIndex(level);
  const echo = GAME_TUNING.orbCores.echo;
  const inertia = GAME_TUNING.orbCores.inertia;
  const conduction = GAME_TUNING.orbCores.conduction;
  const echoShockwave = coreType === 'echo'
    && level >= echo.shockwave.fromLevel
    && echoStacks > 0;
  const inertiaShockwave = coreType === 'inertia'
    && level >= inertia.shockwave.fromLevel
    && precisionHit;
  return {
    shockwave: echoShockwave
      ? { radius: echo.shockwave.radius, damage: echo.shockwave.damage }
      : inertiaShockwave
        ? { radius: inertia.shockwave.radius, damage: inertia.shockwave.damage }
        : null,
    replayPath: coreType === 'echo'
      && level >= echo.replay.fromLevel
      && echoStacks >= echo.maxStacksByLevel[index],
    holdTopSpeedMs: coreType === 'inertia'
      && level >= inertia.topSpeedHold.fromLevel
      && precisionHit
      ? inertia.topSpeedHold.durationMs
      : 0,
    pierce: coreType === 'inertia'
      && level >= inertia.pierce.fromLevel
      && precisionHit,
    kineticExplosion: coreType === 'inertia'
      && level >= inertia.pierce.fromLevel
      && precisionHit
      ? {
        radius: inertia.pierce.explosionRadius,
        damage: inertia.pierce.explosionDamage,
      }
      : null,
    chain: coreType === 'conduction' ? {
      targets: conduction.targetCountByLevel[index],
      radius: conduction.radiusByLevel[index],
      damage: conduction.directDamageByLevel[index],
      overchargeDamage: level >= conduction.overcharge.fromLevel
        ? conduction.overcharge.damage
        : 0,
    } : null,
  };
}

export function conductionFlightProfile(level: number): ConductionFlightProfile | null {
  const index = levelIndex(level);
  const flight = GAME_TUNING.orbCores.conduction.flight;
  if (level < flight.fromLevel) return null;
  return {
    targets: flight.targetCountByLevel[index],
    radius: GAME_TUNING.orbCores.conduction.radiusByLevel[index],
    tickMs: flight.tickMsByLevel[index],
    damage: flight.damageByLevel[index],
  };
}
