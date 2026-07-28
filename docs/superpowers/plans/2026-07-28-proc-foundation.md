# 확률형 폭발·분열 기반 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 확정 폭발·분열을 결정적 확률 발동으로 바꾸고, 분열은 영구 구슬의 한 비행에서 한 번만 허용하며, 임시 구슬의 기본 재귀 발동을 차단한다.

**Architecture:** 순수 `CombatProcState`가 효과별 seeded RNG, 실패 보호, 구슬별 cooldown과 분열 비행 소비 상태를 소유한다. 기존 `BuildState`와 `GAME_TUNING`은 해금 효과의 고정 수치를 제공하고, `CombatScene`이 영구 직접 타격에서만 발동 판정을 수행한 뒤 기존 `planDirectHitEffects()`에 결과를 넘긴다.

**Tech Stack:** TypeScript 5.9, Phaser 3.90, Vitest 4.1, Playwright 1.61, Vite 8.1

## Global Constraints

- 모든 shell 명령은 `rtk`로 시작한다.
- 폭발 기본 확률 `20%`, 반경 `48px`, 보조 피해 `0.45`, 구슬별 cooldown `120ms`.
- 분열 기본 확률 `25%`, 임시 구슬 `2개`, 구슬별 cooldown `120ms`, 영구 구슬 한 비행당 최대 1회.
- 확률형 효과의 강제 성공 한계는 `ceil(2 / chance)`번째 적격 판정이다.
- 확률 판정은 run seed와 효과별 판정 순서로 결정적이어야 한다.
- 임시 구슬 기본 피해 `0.4`, 수명 `1.5초`, 동시 상한 `30개`.
- 임시 구슬은 일반 폭발과 분열을 발동하지 않는다.
- 기존 보스 희귀 보상 `chain-warhead`, `chain-split`의 명시적 예외는 이번 계획에서 유지한다.
- 폭발과 분열은 최대 1등급이다. 화력은 최대 5등급, 운동 에너지는 최대 3등급이다.
- 새 의존성을 추가하지 않는다.
- 각 Task는 focused unit test와 커밋으로 끝난다. Task 사이에는 안전하게 중단할 수 있어야 한다.

## 작업·검증 운영 정책

과거 큰 계획은 한 기능 안에서 Playwright를 여러 번 실행했다. `2026-07-14-level-up-power-growth.md`에는 브라우저 명령 지점이 9개, `2026-07-23-second-midboss-hive.md`에는 4개 있었다. 이 계획은 다음으로 제한한다.

- Task 1~3: Playwright 실행 금지. 변경 파일의 focused Vitest만 실행.
- Task 3: TypeScript 통합 확인을 위해 production build 1회.
- Task 4: focused desktop Playwright 1회.
- Task 4 최종 게이트: 전체 E2E 1회.
- 전체 unit suite와 build는 최종 게이트에서 각각 1회.
- Playwright가 관리하는 서버 외에 장시간 dev server를 띄우지 않는다.
- 직접 플레이는 전체 계획 완료 후 한 번만 요청한다.

따라서 정상 경로의 브라우저 실행은 2회다. 실패하면 해당 focused test만 고친 뒤 재실행하고, 전체 E2E는 수정이 끝난 최종 상태에서만 다시 실행한다. 각 Task 예상 작업 시간은 10~20분이다.

## 후속 계획 경계

이 계획만 실행한다. 다음 항목은 각각 별도 계획으로 작성한다.

1. 반향·부식·전도·관성 영구 구슬
2. 일반 능력 33종과 종류 12개 상한
3. 신규 보스 희귀 보상과 하이브 충돌·이동 수정
4. 4탭 메뉴, 부품, 연구와 로컬 저장
5. 기본 전장 세 번째 보스와 완전한 10~15분 사이클

기존 화력의 `+0.25` 직접 피해 공식과 보조 피해 연동은 이번 계획에서 바꾸지 않는다. 화력 `+12%`, 조건부 직격 합산 상한, `효과 출력` 분리는 일반 능력 계획에서 함께 교체한다.

---

## 파일 구조

- Create `src/game/combat/CombatProcState.ts`: 결정적 확률, 실패 보호, cooldown, 분열 비행 소비 상태
- Create `src/game/combat/CombatProcState.test.ts`: 순수 발동 규칙
- Modify `src/game/config/gameTuning.ts`: 폭발·분열·임시 구슬 중앙 수치
- Modify `src/game/config/gameTuning.test.ts`: 새 수치 검증
- Modify `src/game/progression/progressionRules.ts`: 능력별 최대 등급
- Modify `src/game/progression/progressionRules.test.ts`: 선택지와 완료 등급
- Modify `src/game/progression/BuildState.ts`: 고정 폭발·분열 spec
- Modify `src/game/progression/BuildState.test.ts`: 새 수치와 등급 상한
- Modify `src/game/progression/ProgressionManager.ts`: 능력별 최대 등급으로 완료 판정
- Modify `src/game/progression/ProgressionManager.test.ts`: 총 최대 레벨 10
- Modify `src/game/ui/LevelUpOverlay.ts`: 확률과 고정 효과 설명
- Modify `src/game/ui/LevelUpOverlay.test.ts`: 카드 문구
- Modify `src/game/orbs/OrbManager.ts`: 회수 callback에 orb ID 전달
- Modify `src/game/orbs/OrbManager.test.ts`: 회수 callback 계약
- Modify `src/game/orbs/TemporaryOrbManager.ts`: 기본 피해 `0.4`
- Modify `src/game/orbs/TemporaryOrbManager.test.ts`: 기본 피해
- Modify `src/game/scenes/combatSceneRules.ts`: 발동 결정과 효과 생성을 분리
- Modify `src/game/scenes/combatSceneRules.test.ts`: 영구/임시 발동 경계
- Modify `src/game/scenes/CombatScene.ts`: `CombatProcState` 생성, 직접 타격 판정, 회수 reset
- Modify `e2e/combat.spec.ts`: 확정 첫 발동 가정을 bounded chance로 교체

---

### Task 1: 결정적 확률 상태

**Files:**
- Create: `src/game/combat/CombatProcState.ts`
- Create: `src/game/combat/CombatProcState.test.ts`

**Interfaces:**
- Consumes: unsigned 32-bit run seed, `ProcId`, orb ID, gameplay elapsed time, chance, cooldown
- Produces:

```ts
export type ProcId = 'explosion' | 'split';

export interface ProcAttempt {
  triggered: boolean;
  nextFailures: number;
}

export function resolveProcAttempt(
  chance: number,
  failures: number,
  roll: number,
): ProcAttempt;

export class CombatProcState {
  constructor(seed: number);
  tryProc(
    id: ProcId,
    orbId: number,
    gameplayElapsedMs: number,
    chance: number,
    cooldownMs: number,
  ): boolean;
  trySplit(
    orbId: number,
    gameplayElapsedMs: number,
    chance: number,
    cooldownMs: number,
  ): boolean;
  resetOrbFlight(orbId: number): void;
}
```

- [ ] **Step 1: 실패 보호의 failing unit test 작성**

`src/game/combat/CombatProcState.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CombatProcState, resolveProcAttempt } from './CombatProcState';

describe('resolveProcAttempt', () => {
  it('forces a 25% proc on the eighth eligible attempt', () => {
    let failures = 0;
    for (let attempt = 1; attempt <= 7; attempt += 1) {
      const result = resolveProcAttempt(0.25, failures, 0.99);
      expect(result.triggered).toBe(false);
      failures = result.nextFailures;
    }
    expect(resolveProcAttempt(0.25, failures, 0.99)).toEqual({
      triggered: true,
      nextFailures: 0,
    });
  });

  it('resets failures on a normal success', () => {
    expect(resolveProcAttempt(0.2, 3, 0.1)).toEqual({
      triggered: true,
      nextFailures: 0,
    });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run:

```bash
rtk npm test -- src/game/combat/CombatProcState.test.ts
```

Expected: FAIL because `CombatProcState.ts` does not exist.

- [ ] **Step 3: 최소 순수 규칙 구현**

`src/game/combat/CombatProcState.ts` 핵심:

```ts
export type ProcId = 'explosion' | 'split';

export interface ProcAttempt {
  triggered: boolean;
  nextFailures: number;
}

export function resolveProcAttempt(
  chance: number,
  failures: number,
  roll: number,
): ProcAttempt {
  if (!Number.isFinite(chance) || chance < 0 || chance > 1) {
    throw new RangeError('chance must be from 0 through 1');
  }
  if (!Number.isInteger(failures) || failures < 0) {
    throw new RangeError('failures must be a non-negative integer');
  }
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) {
    throw new RangeError('roll must be from 0 up to 1');
  }
  if (chance === 0) return { triggered: false, nextFailures: failures };
  const forced = failures + 1 >= Math.ceil(2 / chance);
  const triggered = forced || roll < chance;
  return { triggered, nextFailures: triggered ? 0 : failures + 1 };
}
```

`CombatProcState`는 `explosion`과 `split`에 서로 다른 고정 salt를 사용한다. 각 효과는 독립 LCG state와 실패 횟수를 가져 다른 효과의 판정 횟수에 영향을 받지 않는다.

```ts
const PROC_SALTS: Record<ProcId, number> = {
  explosion: 0x4558504c,
  split: 0x53504c54,
};

function nextState(state: number): number {
  return (Math.imul(state, 1664525) + 1013904223) >>> 0;
}
```

`tryProc()`는 같은 effect/orb의 마지막 성공 뒤 cooldown 안이면 RNG와 실패 횟수를 진행하지 않는다. `trySplit()`은 성공한 orb ID를 소비 집합에 넣고 같은 비행에서는 즉시 `false`를 반환한다. `resetOrbFlight()`가 해당 orb의 split 소비와 cooldown을 제거한다.

- [ ] **Step 4: 결정성, cooldown, 비행 소비 test 추가 후 통과**

다음 검증을 같은 test 파일에 추가한다.

```ts
it('reproduces interleaved effect results for the same seed', () => {
  const left = new CombatProcState(1234);
  const right = new CombatProcState(1234);
  const sample = (state: CombatProcState) => [
    state.tryProc('explosion', 0, 0, 0.2, 120),
    state.tryProc('split', 0, 0, 0.25, 120),
    state.tryProc('explosion', 1, 200, 0.2, 120),
  ];
  expect(sample(left)).toEqual(sample(right));
});

it('does not consume attempts during cooldown and splits once per flight', () => {
  const state = new CombatProcState(0);
  let split = false;
  for (let hit = 0; hit < 8; hit += 1) {
    split ||= state.trySplit(2, hit * 120, 0.25, 120);
  }
  expect(split).toBe(true);
  expect(state.trySplit(2, 2_000, 1, 120)).toBe(false);
  state.resetOrbFlight(2);
  expect(state.trySplit(2, 2_000, 1, 120)).toBe(true);
});
```

Run:

```bash
rtk npm test -- src/game/combat/CombatProcState.test.ts
```

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
rtk git add src/game/combat/CombatProcState.ts src/game/combat/CombatProcState.test.ts
rtk git commit -m "feat: add deterministic proc state"
```

중단 가능 지점. 브라우저와 dev server는 실행되지 않은 상태여야 한다.

---

### Task 2: 중앙 수치와 능력별 최대 등급

**Files:**
- Modify: `src/game/config/gameTuning.ts`
- Modify: `src/game/config/gameTuning.test.ts`
- Modify: `src/game/progression/progressionRules.ts`
- Modify: `src/game/progression/progressionRules.test.ts`
- Modify: `src/game/progression/BuildState.ts`
- Modify: `src/game/progression/BuildState.test.ts`
- Modify: `src/game/progression/ProgressionManager.ts`
- Modify: `src/game/progression/ProgressionManager.test.ts`
- Modify: `src/game/ui/LevelUpOverlay.ts`
- Modify: `src/game/ui/LevelUpOverlay.test.ts`
- Modify: `src/game/scenes/combatSceneRules.ts`
- Modify: `src/game/scenes/combatSceneRules.test.ts`

**Interfaces:**
- Consumes: existing four `AbilityId`
- Produces:

```ts
export const ABILITY_MAX_RANKS = {
  firepower: 5,
  kinetic: 3,
  explosion: 1,
  split: 1,
} as const;

export const MAX_BUILD_LEVEL = 10;

interface ExplosionSpec {
  chance: number;
  cooldownMs: number;
  radius: number;
  damage: number;
}

interface SplitSpec {
  chance: number;
  cooldownMs: number;
  count: number;
}
```

- [ ] **Step 1: 새 수치와 rank cap failing test 작성**

`BuildState.test.ts`의 기존 5등급 폭발·분열 표 test를 다음 의미로 교체한다.

```ts
it('unlocks fixed explosion and split specs once', () => {
  const build = new BuildState();
  expect(build.explosion()).toBeNull();
  expect(build.split()).toBeNull();

  build.upgrade('explosion');
  build.upgrade('split');

  expect(build.explosion()).toEqual({
    chance: 0.2,
    cooldownMs: 120,
    radius: 48,
    damage: 0.45,
  });
  expect(build.split()).toEqual({
    chance: 0.25,
    cooldownMs: 120,
    count: 2,
  });
  expect(() => build.upgrade('explosion')).toThrow('explosion is already rank 1');
  expect(() => build.upgrade('split')).toThrow('split is already rank 1');
});
```

`progressionRules.test.ts`에 다음을 추가한다.

```ts
expect(ABILITY_MAX_RANKS).toEqual({
  firepower: 5,
  kinetic: 3,
  explosion: 1,
  split: 1,
});
expect(MAX_BUILD_LEVEL).toBe(10);
```

- [ ] **Step 2: 실패 확인**

Run:

```bash
rtk npm test -- src/game/progression/BuildState.test.ts src/game/progression/progressionRules.test.ts
```

Expected: FAIL because `split()`, `ABILITY_MAX_RANKS`, and new tuning do not exist.

- [ ] **Step 3: tuning과 `BuildState` 최소 구현**

`GAME_TUNING`에 추가한다.

```ts
build: {
  explosion: { chance: 0.2, cooldownMs: 120, radius: 48, damage: 0.45 },
  split: { chance: 0.25, cooldownMs: 120, count: 2 },
},
temporaryOrbs: {
  radius: 6,
  speed: 440,
  cap: 30,
  lifetimeMs: 1500,
  hitCooldownMs: 80,
  baseDamage: 0.4,
},
```

`GameTuning` interface에 같은 shape를 추가하고 `validateGameTuning()`의 구조 분해에 `build`를 포함한다.

```ts
for (const [id, effect] of Object.entries(build)) {
  if (effect.chance < 0 || effect.chance > 1) {
    throw new RangeError(`build.${id}.chance must be between zero and one`);
  }
  positive(effect.cooldownMs, `build.${id}.cooldownMs`);
}
positive(build.explosion.radius, 'build.explosion.radius');
nonNegative(build.explosion.damage, 'build.explosion.damage');
positiveInteger(build.split.count, 'build.split.count');
positive(temporaryOrbs.baseDamage, 'temporaryOrbs.baseDamage');
```

`gameTuning.test.ts`의 shipped configuration 기대값을 새 shape로 바꾸고 invalid table에 `build.explosion.chance = 1.1`, `build.split.count = 1.5`, `temporaryOrbs.baseDamage = 0`을 추가한다.

`BuildState`는 rank가 0이면 `null`, 1이면 tuning 복사본을 반환한다.

```ts
explosion(): ExplosionSpec | null {
  return this.ranks.explosion === 0 ? null : { ...GAME_TUNING.build.explosion };
}

split(): SplitSpec | null {
  return this.ranks.split === 0 ? null : { ...GAME_TUNING.build.split };
}
```

constructor와 `upgrade()`는 `ABILITY_MAX_RANKS[id]`를 사용한다. `chargedSpeed()`는 최대 3등급까지만 계산한다.

- [ ] **Step 4: 진행 완료와 UI를 능력별 상한에 맞춤**

`progressionRules.ts`:

```ts
export const ABILITY_MAX_RANKS = {
  firepower: 5,
  kinetic: 3,
  explosion: 1,
  split: 1,
} as const satisfies Record<AbilityId, number>;

export const MAX_BUILD_LEVEL = Object.values(ABILITY_MAX_RANKS)
  .reduce((total, rank) => total + rank, 0);
```

`selectAbilityOptions()`와 `ProgressionManager.isBuildComplete()`는 `rank < ABILITY_MAX_RANKS[id]`를 사용한다. 완료 시 level을 `MAX_BUILD_LEVEL`로 맞춘다.

`LevelUpOverlay.nextEffect()`:

```ts
case 'explosion': {
  const effect = next.explosion()!;
  return `발동 ${effect.chance * 100}% · 반경 ${effect.radius}px · 피해 ${effect.damage}`;
}
case 'split': {
  const effect = next.split()!;
  return `발동 ${effect.chance * 100}% · 임시 구슬 ${effect.count}개`;
}
```

`planDirectHitEffects()`는 아직 확률을 적용하지 않지만 새 spec에서 `radius`, `damage`, `count`만 읽도록 고친다. `DirectHitEffectPlan.chargedSplitCount`는 `splitCount`로 이름을 바꾸고 `CombatScene`의 사용처도 함께 바꾼다. Task 2 커밋 시 기존 확정 동작은 유지되어야 한다.

Run:

```bash
rtk npm test -- src/game/config/gameTuning.test.ts src/game/progression src/game/ui/LevelUpOverlay.test.ts src/game/scenes/combatSceneRules.test.ts
```

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
rtk git add src/game/config/gameTuning.ts src/game/config/gameTuning.test.ts \
  src/game/progression src/game/ui/LevelUpOverlay.ts src/game/ui/LevelUpOverlay.test.ts \
  src/game/scenes/combatSceneRules.ts src/game/scenes/combatSceneRules.test.ts
rtk git commit -m "refactor: separate proc unlock values"
```

중단 가능 지점. 브라우저는 아직 실행하지 않는다.

---

### Task 3: 영구 직접 타격에 확률 판정 연결

**Files:**
- Modify: `src/game/orbs/OrbManager.ts`
- Modify: `src/game/orbs/OrbManager.test.ts`
- Modify: `src/game/scenes/combatSceneRules.ts`
- Modify: `src/game/scenes/combatSceneRules.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`

**Interfaces:**
- Consumes: `CombatProcState`, `BuildState.explosion()`, `BuildState.split()`
- Produces:

```ts
export interface ProcDecision {
  explosion: boolean;
  split: boolean;
}

export interface OrbCallbacks {
  onEnemyDamage?: (enemyId: number, damage: number, reflect: boolean) => void;
  onRecovery?: (orbId: number, source: RecoverySource) => void;
}
```

- [ ] **Step 1: effect planner와 회수 callback failing test 작성**

`combatSceneRules.test.ts`:

```ts
it('uses explicit permanent proc decisions and keeps temporary defaults inert', () => {
  const build = new BuildState({ explosion: 1, split: 1 });
  const bossBuild = new BossBuild();

  expect(planDirectHitEffects(
    { source: 'permanent', charged: true },
    build,
    bossBuild,
    { explosion: false, split: false },
  )).toMatchObject({
    immediateAreas: [],
    splitCount: 0,
  });

  expect(planDirectHitEffects(
    { source: 'permanent', charged: false },
    build,
    bossBuild,
    { explosion: true, split: true },
  )).toMatchObject({
    immediateAreas: [{ kind: 'explosion', radius: 48, damage: 0.45 }],
    splitCount: 2,
  });

  expect(planDirectHitEffects(
    { source: 'temporary', charged: false },
    build,
    bossBuild,
    { explosion: true, split: true },
  )).toMatchObject({
    immediateAreas: [],
    splitCount: 0,
  });
});
```

`OrbManager.test.ts`의 회수 test 예상값:

```ts
expect(onRecovery).toHaveBeenCalledWith(0, 'proximity');
```

- [ ] **Step 2: 실패 확인**

Run:

```bash
rtk npm test -- src/game/scenes/combatSceneRules.test.ts src/game/orbs/OrbManager.test.ts
```

Expected: FAIL because planner has no `ProcDecision` and callback omits orb ID.

- [ ] **Step 3: planner와 회수 계약 구현**

`planDirectHitEffects()`에 `decision: ProcDecision`을 추가한다.

```ts
const permanentExplosion = event.source === 'permanent' && decision.explosion;
const temporaryExplosion = event.source === 'temporary'
  && bossBuild.temporaryExplosionEnabled();
const explosionTriggered = Boolean(explosion && (permanentExplosion || temporaryExplosion));

return {
  immediateAreas: explosionTriggered
    ? [{ kind: 'explosion', radius: explosion!.radius, damage: explosion!.damage }]
    : [],
  aftershock: event.source === 'permanent' && explosionTriggered
    ? scaledAftershock(explosion!, bossBuild.aftershock())
    : null,
  spawnChildren: event.source === 'temporary' && bossBuild.chainSplitEnabled(),
  splitCount: event.source === 'permanent' && decision.split
    ? build.split()?.count ?? 0
    : 0,
};
```

기존 siege resonance area는 위 explosion 배열 앞에 그대로 유지한다.

`OrbStore.arrive()`:

```ts
this.callbacks.onRecovery?.(record.id, source!);
```

- [ ] **Step 4: `CombatScene`에 run-scoped 상태 연결**

필드와 create:

```ts
private combatProcs?: CombatProcState;

// create()
this.combatProcs = new CombatProcState(runSeed);
```

회수:

```ts
onRecovery: (orbId, source) => {
  this.combatProcs?.resetOrbFlight(orbId);
  this.handleOrbRecovery(source);
},
```

직접 타격:

```ts
const explosion = this.build.explosion();
const split = this.build.split();
const permanent = event.source === 'permanent';
const decision = {
  explosion: Boolean(permanent && explosion && this.combatProcs?.tryProc(
    'explosion',
    event.sourceOrbId,
    this.gameplayElapsedMs,
    explosion.chance,
    explosion.cooldownMs,
  )),
  split: Boolean(permanent && split && this.combatProcs?.trySplit(
    event.sourceOrbId,
    this.gameplayElapsedMs,
    split.chance,
    split.cooldownMs,
  )),
};
const plan = planDirectHitEffects(event, this.build, this.bossBuild, decision);
```

`handleShutdown()`에서 `combatProcs = undefined`로 정리한다. boss reward 전환에서는 유지한다.

Run:

```bash
rtk npm test -- src/game/combat/CombatProcState.test.ts \
  src/game/scenes/combatSceneRules.test.ts src/game/orbs/OrbManager.test.ts
rtk npm run build
```

Expected: focused tests PASS, build exits 0.

- [ ] **Step 5: 커밋**

```bash
rtk git add src/game/orbs/OrbManager.ts src/game/orbs/OrbManager.test.ts \
  src/game/scenes/combatSceneRules.ts src/game/scenes/combatSceneRules.test.ts \
  src/game/scenes/CombatScene.ts
rtk git commit -m "feat: gate permanent hit procs"
```

중단 가능 지점. production build가 끝났고 실행 중 서버가 없어야 한다.

---

### Task 4: 임시 구슬 수치와 브라우저 수용 검증

**Files:**
- Modify: `src/game/orbs/TemporaryOrbManager.ts`
- Modify: `src/game/orbs/TemporaryOrbManager.test.ts`
- Modify: `e2e/combat.spec.ts`

**Interfaces:**
- Consumes: `GAME_TUNING.temporaryOrbs.baseDamage`, 확률형 영구 직접 타격
- Produces: base temporary hit damage `0.4`, cap `30`, bounded chance browser proof

- [ ] **Step 1: 임시 구슬 피해 failing test 작성**

`TemporaryOrbManager.test.ts`의 direct hit 검증을 다음 값으로 바꾼다.

```ts
expect(manager.handleEnemyHit(orb, 7, 1, 100)).toMatchObject({
  charged: false,
  damage: 0.4,
  reflect: true,
});
```

화력 보너스 `0.25` callback을 쓰는 test는 `0.65`를 기대한다.

- [ ] **Step 2: 최소 구현과 focused unit test**

`TemporaryOrbManager.handleEnemyHit()`:

```ts
const damage = GAME_TUNING.temporaryOrbs.baseDamage
  + this.options.getDirectDamageBonus();
```

Run:

```bash
rtk npm test -- src/game/orbs/TemporaryOrbManager.test.ts src/game/enemies/EnemyManager.test.ts
```

Expected: PASS.

- [ ] **Step 3: 기존 E2E의 확정 발동 가정 교체**

`e2e/combat.spec.ts`에서 다음을 수정한다.

- 폭발을 5등급까지 올리는 loop 제거. 1회만 `debugUpgradeAbility('explosion')`.
- 분열을 5등급까지 올리는 loop 제거. 1회만 `debugUpgradeAbility('split')`.
- 완성 build 기대값을 `{ firepower: 5, kinetic: 3, explosion: 1, split: 1 }`로 변경.
- 첫 충돌 직후 폭발·분열을 강제 기대하지 않는다.
- 같은 영구 구슬에 적격 직접 타격을 반복 배치하고 폭발은 10번째, 분열은 8번째 이내에 한 번 이상 관찰한다.
- 분열이 발생한 뒤 같은 비행에서 추가 적격 타격을 만들어도 임시 구슬 수가 새 분열만큼 다시 늘지 않음을 확인한다.
- 근접 회수 후 다음 비행에서는 분열이 다시 가능함을 확인한다.
- 보스 희귀 보상 `chain-warhead`, `chain-split` test는 명시적 임시 구슬 예외로 유지한다.

새 test 이름:

```ts
test('@desktop bounds permanent explosion and split procs per flight', async ({ page }) => {
  // 고정 run seed에서 직접 타격을 반복한다.
  // 폭발은 10회, 분열은 8회 강제 성공 한계 안에 관찰한다.
  // 같은 비행의 두 번째 분열은 없고 근접 회수 뒤 다시 가능하다.
});
```

- [ ] **Step 4: 브라우저 실행 1 — focused desktop**

Run:

```bash
rtk npm run test:e2e -- --project=desktop-chromium \
  --grep "bounds permanent explosion and split procs per flight"
```

Expected: 1 focused desktop test PASS.

실패하면 이 focused test만 수정·재실행한다. 다른 Playwright test를 동시에 반복하지 않는다.

- [ ] **Step 5: 최종 게이트와 커밋**

Run exactly once after the focused test passes:

```bash
rtk npm test
rtk npm run test:e2e
rtk npm run build
rtk git diff --check
rtk git status --short
```

Expected:

- unit tests: zero failures
- desktop and mobile Playwright: zero failures
- production build: exit 0
- diff check: no whitespace errors
- status: only this Task's intended files modified

Commit:

```bash
rtk git add src/game/orbs/TemporaryOrbManager.ts \
  src/game/orbs/TemporaryOrbManager.test.ts e2e/combat.spec.ts
rtk git commit -m "test: verify bounded combat procs"
```

계획 종료. dev server와 Playwright worker가 남아 있지 않아야 한다.

---

## 완료 기준

- 폭발은 영구 직접 타격에서 20%로 발동하며 최대 10번째 적격 판정 안에 발생한다.
- 분열은 영구 직접 타격에서 25%로 발동하며 최대 8번째 적격 판정 안에 발생한다.
- 분열은 영구 구슬 하나의 비행에서 한 번만 발생하고 회수 뒤 다시 가능하다.
- 임시 구슬은 보스 희귀 보상 예외가 없으면 폭발과 분열을 발동하지 않는다.
- 폭발과 분열은 1등급 해금이며 피해·범위·생성 수가 함께 성장하지 않는다.
- 임시 구슬 기본 피해는 0.4, 동시 상한은 30이다.
- 같은 seed와 직접 타격 순서는 같은 발동 결과를 만든다.
- 전체 브라우저 suite는 계획 전체에서 마지막 한 번만 실행한다.
