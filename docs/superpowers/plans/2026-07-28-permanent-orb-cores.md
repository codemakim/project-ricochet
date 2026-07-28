# 영구 구슬 4종 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 반향·부식·전도·관성 코어를 실제 전투에 구현하고, 런 시작 3개와 추가 영구 구슬의 종류를 플레이어가 선택하게 한다.

**Architecture:** `orbCoreRules.ts`가 코어별 순수 상태 전이를 계산하고 `OrbStore`가 각 영구 구슬의 종류와 상태를 소유한다. 충돌 결과에 코어 발동 정보를 실어 기존 `CombatScene`의 직접 타격 진입점에서 부식 장판과 전도 피해를 적용한다. 시작/추가 선택은 하나의 전용 overlay를 재사용하며 범용 능력 프레임워크는 만들지 않는다.

**Tech Stack:** TypeScript 5.9, Phaser 3.90, Vitest 4.1, Playwright 1.61, Vite 8.1

## Global Constraints

- 모든 shell 명령은 `rtk`로 시작한다.
- 런 시작 영구 구슬은 정확히 3개, 동일 종류 중복을 허용한다.
- 최대 영구 구슬은 6개다.
- 반향: 벽 충돌당 1중첩, 최대 5, 다음 직접 타격 중첩당 `+8%`, 직접 타격·회수 시 소모.
- 부식: 영구 직접 타격마다 `15%`, 반경 `42px`, `2.5초`, `0.5초`마다 기본 직접 피해의 `20%`, 코어당 장판 최대 2개.
- 전도: 영구 직접 타격 4회마다 주 대상 외 가까운 대상 최대 2개에 기본 직접 피해의 `45%`.
- 관성: 영구 직접 타격당 1중첩, 최대 3, 근접 회수 시 다음 발사 속도 중첩당 `+10%`, 첫 직접 타격 뒤 종료. 강제 귀환은 중첩을 제거한다.
- 기본 충전 3회 `1.5배`, 즉시 재발사, 바닥 강제 귀환 동작은 유지한다.
- 임시 구슬과 보조 피해는 코어 효과를 발동하지 않는다.
- 구슬 종류 수치와 색은 `GAME_TUNING` 한 곳에서 정의한다.
- 새 의존성을 추가하지 않는다.
- Task 1~4는 focused Vitest만 실행한다. Task 5에서 production build 1회, focused desktop Playwright 1회, 전체 E2E 1회만 실행한다.
- 각 Task는 독립 검증과 커밋으로 끝내며 10~25분 안에 중단 가능해야 한다.

## 후속 계획 경계

이번 계획은 영구 구슬 4종과 종류 선택만 구현한다. 일반 능력 33종, 종류 12개 상한, 코어 전용 일반 능력, 신규 레이저·미사일·충격파, 새 보스 희귀 보상, 메타 해금은 각각 후속 계획이다. 현재 보스 유물의 영구 구슬 추가 선택에는 종류 선택을 붙이되 유물 풀 자체는 바꾸지 않는다.

---

## 파일 구조

- Create `src/game/orbs/orbCoreRules.ts`: 코어 ID, 런타임 상태, 반향·전도·관성 순수 전이
- Create `src/game/orbs/orbCoreRules.test.ts`: 코어별 상태와 회수 원인 검증
- Create `src/game/combat/CorrosionFieldState.ts`: 코어별 최대 2개 장판과 tick 일정
- Create `src/game/combat/CorrosionFieldState.test.ts`: 생성 상한, tick, pause-safe gameplay time 검증
- Create `src/game/ui/OrbLoadoutOverlay.ts`: 시작 3슬롯/추가 1슬롯 종류 선택
- Create `src/game/ui/OrbLoadoutOverlay.test.ts`: 선택 완료와 중복 선택 검증
- Modify `src/game/config/gameTuning.ts`: 코어 수치와 친군 구슬별 색
- Modify `src/game/config/gameTuning.test.ts`: 수치 검증
- Modify `src/game/combat/CombatProcState.ts`: `corrosion` 독립 확률 stream
- Modify `src/game/combat/CombatProcState.test.ts`: 부식 결정성/실패 보호
- Modify `src/game/enemies/EnemyManager.ts`: 전도용 가까운 적 제한 피해
- Modify `src/game/enemies/EnemyManager.test.ts`: 거리순 최대 대상 수 검증
- Modify `src/game/orbs/OrbManager.ts`: 구슬별 종류·상태, 벽 충돌, 코어 피해/속도
- Modify `src/game/orbs/OrbManager.test.ts`: 코어 통합 생명주기
- Modify `src/game/enemies/EnemyManager.ts`: 영구 직접 타격 event에 코어 결과 전달
- Modify `src/game/enemies/EnemyManager.test.ts`: event 계약
- Modify `src/game/bosses/bossEncounter.ts`: 보스 영구 직접 타격 event 계약
- Modify `src/game/bosses/BossManager.ts`: 코어 결과 전달
- Modify `src/game/bosses/BossManager.test.ts`: event 계약
- Modify `src/game/bosses/HiveBossManager.ts`: 코어 결과 전달
- Modify `src/game/bosses/HiveBossManager.test.ts`: event 계약
- Modify `src/game/combat/CombatPauseController.ts`: `loadout` pause reason
- Modify `src/game/combat/CombatPauseController.test.ts`: 시작 선택 pause
- Modify `src/game/scenes/CombatScene.ts`: 시작/추가 선택, 부식·전도 적용, debug snapshot
- Modify `src/game/scenes/combatSceneRules.ts`: 보조 피해 명령 생성
- Modify `src/game/scenes/combatSceneRules.test.ts`: 임시 구슬 비발동과 코어 명령
- Modify `src/game/scenes/combatTextureRules.ts`: 코어별 구슬 texture descriptor
- Modify `src/game/scenes/combatTextureRules.test.ts`: 4종 시각 구분
- Modify `e2e/combat.spec.ts`: 시작 구성, 중복 선택, 코어 효과, 추가 구슬 종류

---

### Task 1: 코어 정의와 순수 상태

**Files:**
- Create: `src/game/orbs/orbCoreRules.ts`
- Create: `src/game/orbs/orbCoreRules.test.ts`
- Modify: `src/game/config/gameTuning.ts`
- Modify: `src/game/config/gameTuning.test.ts`

**Interfaces:**
- Produces:

```ts
export const ORB_CORE_IDS = ['echo', 'corrosion', 'conduction', 'inertia'] as const;
export type OrbCoreId = typeof ORB_CORE_IDS[number];

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

export function createOrbCoreState(): OrbCoreState;
export function applyCoreWallBounce(
  type: OrbCoreId,
  state: Readonly<OrbCoreState>,
): OrbCoreState;
export function resolveCoreDirectHit(
  type: OrbCoreId,
  state: Readonly<OrbCoreState>,
): CoreHitResolution;
export function resolveCoreRecovery(
  type: OrbCoreId,
  state: Readonly<OrbCoreState>,
  source: RecoverySource,
): OrbCoreState;
export function coreLaunchSpeedMultiplier(
  type: OrbCoreId,
  state: Readonly<OrbCoreState>,
): number;
```

- [ ] **Step 1: 네 코어 상태의 failing test 작성**

```ts
it('spends five echo stacks on one hit', () => {
  let state = createOrbCoreState();
  for (let hit = 0; hit < 7; hit += 1) state = applyCoreWallBounce('echo', state);
  expect(resolveCoreDirectHit('echo', state)).toMatchObject({
    directDamageBonus: 0.4,
    conductionTriggered: false,
    next: { echoStacks: 0 },
  });
});

it('discharges conduction every fourth hit', () => {
  let state = createOrbCoreState();
  for (let hit = 0; hit < 3; hit += 1) {
    const result = resolveCoreDirectHit('conduction', state);
    expect(result.conductionTriggered).toBe(false);
    state = result.next;
  }
  expect(resolveCoreDirectHit('conduction', state).conductionTriggered).toBe(true);
});

it('converts inertia only on proximity recovery', () => {
  let state = createOrbCoreState();
  for (let hit = 0; hit < 3; hit += 1) {
    state = resolveCoreDirectHit('inertia', state).next;
  }
  const proximity = resolveCoreRecovery('inertia', state, 'proximity');
  expect(coreLaunchSpeedMultiplier('inertia', proximity)).toBe(1.3);
  expect(resolveCoreRecovery('inertia', state, 'floorRecall').inertiaLaunchStacks).toBe(0);
});
```

- [ ] **Step 2: 실패 확인**

Run:

```bash
rtk npm test -- src/game/orbs/orbCoreRules.test.ts
```

Expected: FAIL because `orbCoreRules.ts` does not exist.

- [ ] **Step 3: 중앙 수치와 최소 상태 전이 구현**

`GAME_TUNING.orbCores`에 다음 구조를 추가한다.

```ts
orbCores: {
  echo: { maxStacks: 5, damageBonusPerStack: 0.08, fill: 0x74c8ff, accent: 0xeaf8ff },
  corrosion: {
    chance: 0.15,
    cooldownMs: 120,
    radius: 42,
    durationMs: 2500,
    tickMs: 500,
    damagePerTick: 0.2,
    fieldLimitPerOrb: 2,
    fill: 0x9be564,
    accent: 0xe8ffc8,
  },
  conduction: {
    hitsRequired: 4,
    targetCount: 2,
    radius: 150,
    damage: 0.45,
    fill: 0xc58cff,
    accent: 0xf3e8ff,
  },
  inertia: {
    maxStacks: 3,
    speedBonusPerStack: 0.1,
    fill: 0xffbd59,
    accent: 0xfff0c2,
  },
},
```

`resolveCoreDirectHit()`는 타격 전 반향 보너스를 반환한 뒤 반향을 0으로 만든다. 전도는 네 번째 타격에 `conductionTriggered: true`와 카운터 0을 반환한다. 관성은 최대 3중첩을 쌓고, 활성화된 `inertiaLaunchStacks`는 첫 직접 타격 결과에서 0으로 만든다. `resolveCoreRecovery()`는 반향을 항상 지우며, 관성은 `proximity`에서만 현재 중첩을 발사 중첩으로 옮긴다.

- [ ] **Step 4: 설정 검증과 focused tests 통과**

`validateGameTuning()`에서 확률 `0..1`, 정수 상한, 양수 시간·거리, 친군/적군 색 조합 충돌을 검증한다.

Run:

```bash
rtk npm test -- src/game/orbs/orbCoreRules.test.ts src/game/config/gameTuning.test.ts
```

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
rtk git add src/game/orbs/orbCoreRules.ts src/game/orbs/orbCoreRules.test.ts src/game/config/gameTuning.ts src/game/config/gameTuning.test.ts
rtk git commit -m "feat: define permanent orb cores"
```

---

### Task 2: OrbManager 코어 생명주기

**Files:**
- Modify: `src/game/orbs/OrbManager.ts`
- Modify: `src/game/orbs/OrbManager.test.ts`
- Modify: `src/game/enemies/EnemyManager.ts`
- Modify: `src/game/enemies/EnemyManager.test.ts`
- Modify: `src/game/bosses/bossEncounter.ts`
- Modify: `src/game/bosses/BossManager.ts`
- Modify: `src/game/bosses/BossManager.test.ts`
- Modify: `src/game/bosses/HiveBossManager.ts`
- Modify: `src/game/bosses/HiveBossManager.test.ts`

**Interfaces:**
- Consumes: Task 1 `OrbCoreId`, `OrbCoreState`, 순수 전이 함수
- Produces:

```ts
export interface PermanentHitResult extends HitResult {
  coreType: OrbCoreId;
  conductionTriggered: boolean;
}

export interface OrbSnapshot {
  // 기존 필드 유지
  coreType: OrbCoreId;
  coreState: OrbCoreState;
}

export interface OrbManagerOptions {
  // 기존 필드 유지
  startingCoreTypes?: readonly [OrbCoreId, OrbCoreId, OrbCoreId];
}

addOrb(coreType: OrbCoreId): boolean;
configureStartingCores(types: readonly [OrbCoreId, OrbCoreId, OrbCoreId]): boolean;
```

`DirectHitEvent`와 `BossDirectHitEvent`에 영구 구슬에서만 채워지는 필드를 추가한다.

```ts
coreType?: OrbCoreId;
conductionTriggered?: boolean;
```

- [ ] **Step 1: OrbStore failing tests 작성**

검증:

```ts
expect(store.getSnapshot().map((orb) => orb.coreType))
  .toEqual(['echo', 'corrosion', 'inertia']);
expect(store.configureStartingCores(['inertia', 'inertia', 'echo'])).toBe(true);
expect(store.configureStartingCores(['echo', 'echo', 'echo'])).toBe(false);
expect(store.addOrb('conduction')).toBe(true);
```

활성화 전 한 번만 시작 구성을 바꿀 수 있고, 활성화 뒤 변경은 `false`여야 한다. `addOrb()`는 유효한 종류를 필수로 받는다.

- [ ] **Step 2: 실패 확인**

Run:

```bash
rtk npm test -- src/game/orbs/OrbManager.test.ts
```

Expected: FAIL on missing core fields and signatures.

- [ ] **Step 3: 코어 상태를 OrbRecord에 통합**

`createRecord(id, coreType)`가 `createOrbCoreState()`를 저장한다. `onWorldBounds`는 바닥이면 기존 귀환, 나머지 경계면 `applyCoreWallBounce()`를 한 번 호출한다. `handleEnemyHit()`는 타격 직전 `resolveCoreDirectHit()`를 계산해 반향 보너스를 기존 `directHit()`의 직접 피해 보너스에 더하고 `PermanentHitResult`를 반환한다. 관성 발사 속도는 `speedTarget(record)`에서 `coreLaunchSpeedMultiplier()`를 곱한다. `arrive()`는 `resolveCoreRecovery()` 후 재발사 queue에 넣는다.

- [ ] **Step 4: 일반 적·두 보스 event 계약 갱신**

영구 구슬 결과일 때만 `coreType`과 `conductionTriggered`를 `onDirectHit`에 복사한다. 임시 구슬 event에는 두 필드가 없어야 한다. 반사 지연 경로의 pending result도 `PermanentHitResult | HitResult`를 보존한다.

Run:

```bash
rtk npm test -- src/game/orbs/OrbManager.test.ts src/game/enemies/EnemyManager.test.ts src/game/bosses/BossManager.test.ts src/game/bosses/HiveBossManager.test.ts
```

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
rtk git add src/game/orbs/OrbManager.ts src/game/orbs/OrbManager.test.ts src/game/enemies/EnemyManager.ts src/game/enemies/EnemyManager.test.ts src/game/bosses/bossEncounter.ts src/game/bosses/BossManager.ts src/game/bosses/BossManager.test.ts src/game/bosses/HiveBossManager.ts src/game/bosses/HiveBossManager.test.ts
rtk git commit -m "feat: run orb core lifecycles"
```

---

### Task 3: 부식 장판과 전도 피해

**Files:**
- Create: `src/game/combat/CorrosionFieldState.ts`
- Create: `src/game/combat/CorrosionFieldState.test.ts`
- Modify: `src/game/combat/CombatProcState.ts`
- Modify: `src/game/combat/CombatProcState.test.ts`
- Modify: `src/game/enemies/EnemyManager.ts`
- Modify: `src/game/enemies/EnemyManager.test.ts`
- Modify: `src/game/scenes/combatSceneRules.ts`
- Modify: `src/game/scenes/combatSceneRules.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`

**Interfaces:**
- Consumes: 영구 직접 타격 event의 `coreType`, `conductionTriggered`
- Produces:

```ts
export interface CorrosionTick {
  fieldId: number;
  position: Vector;
  radius: number;
  damage: number;
}

export class CorrosionFieldState {
  spawn(orbId: number, position: Vector, nowMs: number): void;
  drainDue(nowMs: number): CorrosionTick[];
  clear(): void;
  getSnapshot(): readonly CorrosionFieldSnapshot[];
}

export type ProcId = 'explosion' | 'split' | 'corrosion';

// 살아 있는 일반 적을 거리순으로 고르고 excludedEnemyId를 제외한다.
EnemyManager.applyNearestSecondaryDamage(
  origin: Vector,
  excludedEnemyId: number,
  maximumTargets: number,
  damage: number,
): number[];
```

- [ ] **Step 1: 부식 일정 failing tests 작성**

```ts
it('keeps the newest two fields per permanent orb', () => {
  const fields = new CorrosionFieldState();
  fields.spawn(1, { x: 10, y: 10 }, 0);
  fields.spawn(1, { x: 20, y: 10 }, 1);
  fields.spawn(1, { x: 30, y: 10 }, 2);
  expect(fields.getSnapshot().map((field) => field.position.x)).toEqual([20, 30]);
});

it('emits five ticks from gameplay time and then expires', () => {
  const fields = new CorrosionFieldState();
  fields.spawn(0, { x: 10, y: 10 }, 0);
  expect(fields.drainDue(499)).toHaveLength(0);
  expect(fields.drainDue(2500)).toHaveLength(5);
  expect(fields.drainDue(3000)).toHaveLength(0);
});
```

- [ ] **Step 2: 실패 확인**

Run:

```bash
rtk npm test -- src/game/combat/CorrosionFieldState.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: 최소 장판 상태와 독립 부식 RNG 구현**

`CorrosionFieldState`는 Phaser timer 대신 `gameplayElapsedMs`를 받아 pause 중 시간이 진행되지 않게 한다. `spawn()`은 같은 `orbId`의 가장 오래된 장판만 제거한다. `CombatProcState`의 `corrosion`은 별도 salt, 실패 횟수, 구슬별 cooldown을 사용한다.

- [ ] **Step 4: CombatScene에 두 코어 효과 연결**

영구 직접 타격에서만:

```ts
if (event.coreType === 'corrosion' && corrosionSpec
  && this.combatProcs?.tryProc('corrosion', event.sourceOrbId, now, chance, cooldownMs)) {
  this.corrosionFields.spawn(event.sourceOrbId, event.position, now);
}
if (event.coreType === 'conduction' && event.conductionTriggered) {
  if (excludedBossTargetId === undefined) {
    this.enemyManager?.applyNearestSecondaryDamage(
      event.position,
      excludedEnemyId,
      conduction.targetCount,
      conduction.damage,
    );
  } else {
    this.activeBoss?.applyAreaDamage(
      event.position,
      conduction.radius,
      conduction.damage,
      excludedBossTargetId,
    );
  }
}
```

일반 적 전도는 반경 안의 살아 있는 적을 거리순·ID순으로 정렬해 최대 2개만 피해를 준다. 보스에서는 기존 보스 보조 피해 상한을 재사용하므로 최대 1개 파츠만 맞으며 이는 “최대 2개”를 넘지 않는다. `update()`에서 `drainDue(gameplayElapsedMs)` 결과를 기존 `applyAreaEffects()`로 적용한다. 패배, 장면 종료, 보스 보상 진입 시 장판을 `clear()`한다. 임시 구슬 event는 코어 명령을 만들지 않는다.

Run:

```bash
rtk npm test -- src/game/combat/CorrosionFieldState.test.ts src/game/combat/CombatProcState.test.ts src/game/enemies/EnemyManager.test.ts src/game/scenes/combatSceneRules.test.ts
```

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
rtk git add src/game/combat/CorrosionFieldState.ts src/game/combat/CorrosionFieldState.test.ts src/game/combat/CombatProcState.ts src/game/combat/CombatProcState.test.ts src/game/enemies/EnemyManager.ts src/game/enemies/EnemyManager.test.ts src/game/scenes/combatSceneRules.ts src/game/scenes/combatSceneRules.test.ts src/game/scenes/CombatScene.ts
rtk git commit -m "feat: add corrosion and conduction effects"
```

---

### Task 4: 시작·추가 구슬 종류 선택과 시각 구분

**Files:**
- Create: `src/game/ui/OrbLoadoutOverlay.ts`
- Create: `src/game/ui/OrbLoadoutOverlay.test.ts`
- Modify: `src/game/combat/CombatPauseController.ts`
- Modify: `src/game/combat/CombatPauseController.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `src/game/scenes/combatTextureRules.ts`
- Modify: `src/game/scenes/combatTextureRules.test.ts`
- Modify: `src/game/orbs/OrbManager.ts`
- Modify: `src/game/orbs/OrbManager.test.ts`

**Interfaces:**
- Produces:

```ts
export class OrbLoadoutOverlay {
  showStarting(onConfirm: (
    types: readonly [OrbCoreId, OrbCoreId, OrbCoreId],
  ) => boolean): void;
  showAdditional(onConfirm: (type: OrbCoreId) => boolean): void;
  hide(): void;
  isVisible(): boolean;
  getSelection(): readonly OrbCoreId[];
  destroy(): void;
}
```

- [ ] **Step 1: 선택 모델 failing tests 작성**

Overlay 내부 선택 모델을 Phaser 객체 없이 export해 다음을 검증한다.

```ts
const selection = new OrbCoreSelection(3);
selection.add('echo');
selection.add('echo');
selection.add('inertia');
expect(selection.confirm()).toEqual(['echo', 'echo', 'inertia']);
expect(selection.add('conduction')).toBe(false);
```

`reset()`은 빈 배열로 돌아가며 3개 전 confirm은 `null`을 반환한다. 추가 선택 mode는 capacity 1이다.

- [ ] **Step 2: 실패 확인**

Run:

```bash
rtk npm test -- src/game/ui/OrbLoadoutOverlay.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: 시작 선택을 전투 시작에 연결**

`PauseReason`에 `loadout`을 추가한다. `CombatScene.create()` 끝에서 pause를 추가하고 `showStarting()`을 연다. 확인 성공 시 `orbManager.configureStartingCores(types)`, overlay hide, `loadout` pause 제거를 수행한다. 조준 입력은 overlay가 닫힌 뒤에만 첫 발사를 활성화한다. 종류를 고르기 전 적·보스·gameplay time은 진행되지 않는다.

- [ ] **Step 4: 추가 구슬 보상 선택을 같은 overlay로 연결**

`chooseBossReward()`가 `rewardAddsPermanentOrb(id)`를 만나면 즉시 `addOrb()`하지 않고 `showAdditional()`을 연다. 종류 선택 성공 시 `orbManager.addOrb(type)`을 호출한 뒤 기존 `resumeAfterBossReward()` 흐름을 정확히 한 번 실행한다. 일반 보상은 기존처럼 바로 진행한다.

- [ ] **Step 5: 코어별 texture와 snapshot 연결**

`combatTextureRules.ts`가 `orb-echo`, `orb-corrosion`, `orb-conduction`, `orb-inertia` descriptor를 `GAME_TUNING.orbCores` 색으로 만든다. `OrbManager.synchronizeSprites()`는 snapshot의 `coreType`에 맞춰 texture를 바꾼다. `CombatDebugSnapshot`에 `loadoutVisible`과 구슬별 `coreType`/`coreState`가 나타나야 한다.

Run:

```bash
rtk npm test -- src/game/ui/OrbLoadoutOverlay.test.ts src/game/combat/CombatPauseController.test.ts src/game/scenes/combatTextureRules.test.ts src/game/orbs/OrbManager.test.ts
```

Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
rtk git add src/game/ui/OrbLoadoutOverlay.ts src/game/ui/OrbLoadoutOverlay.test.ts src/game/combat/CombatPauseController.ts src/game/combat/CombatPauseController.test.ts src/game/scenes/CombatScene.ts src/game/scenes/combatTextureRules.ts src/game/scenes/combatTextureRules.test.ts src/game/orbs/OrbManager.ts src/game/orbs/OrbManager.test.ts
rtk git commit -m "feat: choose permanent orb cores"
```

---

### Task 5: 통합 검증

**Files:**
- Modify: `e2e/combat.spec.ts`

**Interfaces:**
- Consumes: 시작 overlay, debug snapshot, 기존 보스 보상 debug 경로
- Produces: 데스크톱·모바일 회귀 증거

- [ ] **Step 1: focused E2E 작성**

한 테스트에서 다음만 검증한다.

1. 시작 직후 `loadoutVisible === true`, encounter elapsed `0`
2. 반향·반향·관성을 선택하고 확인
3. snapshot의 구슬 종류가 `['echo', 'echo', 'inertia']`
4. 시작 선택 뒤 조준하여 구슬이 발사됨
5. debug enemy 배치로 반향 직접 피해와 관성 근접 회수 속도 증가 확인
6. 영구 구슬 추가 유물 debug 흐름에서 부식 선택 후 네 번째 구슬 종류가 `corrosion`

- [ ] **Step 2: production build**

Run:

```bash
rtk npm run build
```

Expected: TypeScript and Vite build pass. 기존 chunk-size warning만 허용한다.

- [ ] **Step 3: focused desktop Playwright 1회**

Run:

```bash
rtk npx playwright test e2e/combat.spec.ts --project=desktop --grep "permanent orb cores"
```

Expected: PASS.

- [ ] **Step 4: 전체 unit suite와 전체 E2E 최종 게이트**

Run:

```bash
rtk npm test
rtk npm run test:e2e
```

Expected: 모든 unit과 desktop/mobile E2E PASS.

- [ ] **Step 5: 커밋**

```bash
rtk git add e2e/combat.spec.ts
rtk git commit -m "test: verify permanent orb core loop"
```

- [ ] **Step 6: 작업 상태 확인**

Run:

```bash
rtk git status --short
rtk git log --oneline master..HEAD
```

Expected: clean worktree, Task별 5개 커밋.

---

## Self-Review 결과

- 설계 5장의 반향·부식·전도·관성 수치, 회수 원인, 시작 3개, 중복 선택, 최대 6개를 모두 Task 1~4에 연결했다.
- 임시 구슬 비발동, pause-safe 시간, 보스 직접 타격, 추가 구슬 종류 선택을 포함했다.
- 일반 능력 33종과 메타 해금은 이번 수직 단계의 명시적 후속 경계로 남겼다.
- 새 범용 이벤트 버스, 능력 DSL, 외부 JSON, 별도 scene router는 만들지 않는다.
