# Development Balance Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 개발 빌드에서 런 단위 밸런스 수치를 설정하고 같은 조건으로 즉시 반복 플레이하는 모드를 만든다.

**Architecture:** `GAME_TUNING`은 불변으로 두고 `RunConfig.developmentBalance`에 검증된 런 단위 배율을 넣는다. `EncounterDirector`, `EnemyManager`, 보스 매니저와 시작 구슬 구성 경계에만 설정을 주입하며, 개발자 UI와 저장은 별도 모듈이 소유한다.

**Tech Stack:** TypeScript 5.9, Phaser 3.90, Vite 8, Vitest 4, Playwright 1.61, native HTML form/localStorage

**Spec:** `docs/superpowers/specs/2026-08-25-development-balance-mode-design.md`

## Global Constraints

- 개발자 UI는 `import.meta.env.DEV`일 때만 표시한다.
- `GAME_TUNING`을 수정하거나 런마다 복제하지 않는다.
- 테스트 런은 부품, 해금, 발견, 정산 기록을 변경하지 않는다.
- 플레이어 피해 배율은 직접·지속·범위·임시·융합·보스 피해에 정확히 한 번 적용한다.
- 입력 범위는 HP/피해 `0.1~10`, 하강 속도 `0~5`, 적 수 `0.25~4`, 증원 간격 `0.1~4`, 시작 구슬 `1~6`, 시드 `0~4294967295`다.
- 새 의존성을 추가하지 않는다.

## File Map

- Create `src/game/dev/developmentBalanceSettings.ts`: 설정 타입, 범위 검증, 기본값, localStorage 직렬화.
- Create `src/game/dev/developmentBalanceSettings.test.ts`: 설정 파서와 저장 복구 단위 테스트.
- Create `src/game/dev/DevelopmentBalancePanel.ts`: 개발자 설정 폼 렌더링과 native validation.
- Modify `src/game/run/runContract.ts`: 선택적 개발자 설정 전달과 결과 복사.
- Modify `src/game/run/runContract.test.ts`: 일반/테스트 런 격리.
- Modify `src/game/encounters/EncounterDirector.ts`: 적 수와 증원 간격 배율.
- Modify `src/game/encounters/EncounterDirector.test.ts`: 동일 시드에서 배율 적용 검증.
- Modify `src/game/enemies/EnemyManager.ts`: 적 HP·하강 속도와 최종 플레이어 피해 배율.
- Modify `src/game/enemies/EnemyManager.test.ts`: 일반/특수 HP, 속도, 직접·보조 피해 검증.
- Modify `src/game/bosses/BossManager.ts`: Sentinel/Siege 최종 피해 배율과 직접 타격 예측 HP.
- Modify `src/game/bosses/BossManager.test.ts`: 직접·범위 피해 단일 배율 검증.
- Modify `src/game/bosses/HiveBossManager.ts`: Hive 최종 피해 배율과 직접 타격 예측 HP.
- Modify `src/game/bosses/HiveBossManager.test.ts`: 직접·범위 피해 단일 배율 검증.
- Modify `src/game/scenes/CombatScene.ts`: 런 설정 주입, 시작 구슬 수, 설정 스냅샷.
- Modify `src/game/meta/AppController.ts`: 개발자 모드 진입·시작·재시작·수정 흐름과 정산 차단.
- Modify `src/styles.css`: 데스크톱/모바일 설정 패널.
- Modify `e2e/meta-loop.spec.ts`: 개발자 설정·반복·메타 불변 브라우저 흐름.
- Modify `e2e/combat.spec.ts`: 고해상도 구슬 기대값과 개발 설정 전투 스냅샷.
- Modify `docs/WORKLOG.md`: 기능과 검증 기록.

---

### Task 1: 설정 계약과 저장

**Files:**
- Create: `src/game/dev/developmentBalanceSettings.ts`
- Create: `src/game/dev/developmentBalanceSettings.test.ts`
- Modify: `src/game/run/runContract.ts`
- Test: `src/game/run/runContract.test.ts`

**Interfaces:**
- Produces: `DevelopmentBalanceSettings`, `createDefaultDevelopmentBalanceSettings(seed)`, `parseDevelopmentBalanceSettings(value)`, `loadDevelopmentBalanceSettings(storage, seed)`, `saveDevelopmentBalanceSettings(storage, settings)`.
- Produces: `RunConfig.developmentBalance?: DevelopmentBalanceSettings`.

- [ ] **Step 1: Write failing settings tests**

```ts
it('loads defaults and persists a valid development balance', () => {
  const storage = new MemoryStorage();
  const defaults = loadDevelopmentBalanceSettings(storage, 17);
  expect(defaults).toMatchObject({
    normalEnemyHpMultiplier: 1,
    specialEnemyHpMultiplier: 1,
    descentSpeedMultiplier: 1,
    activePopulationMultiplier: 1,
    reinforcementIntervalMultiplier: 1,
    playerDamageMultiplier: 1,
    startingOrbCount: 1,
    seed: 17,
  });
  saveDevelopmentBalanceSettings(storage, { ...defaults, playerDamageMultiplier: 2 });
  expect(loadDevelopmentBalanceSettings(storage, 99).playerDamageMultiplier).toBe(2);
});

it('recovers from malformed or out-of-range storage', () => {
  const storage = new MemoryStorage();
  storage.setItem(DEVELOPMENT_BALANCE_STORAGE_KEY, '{bad');
  expect(loadDevelopmentBalanceSettings(storage, 23).seed).toBe(23);
  storage.setItem(DEVELOPMENT_BALANCE_STORAGE_KEY, JSON.stringify({
    ...createDefaultDevelopmentBalanceSettings(1), startingOrbCount: 9,
  }));
  expect(loadDevelopmentBalanceSettings(storage, 24).startingOrbCount).toBe(1);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `rtk npm test -- --run src/game/dev/developmentBalanceSettings.test.ts`

Expected: FAIL because the module and exports do not exist.

- [ ] **Step 3: Implement the minimal settings module**

```ts
export interface DevelopmentBalanceSettings {
  normalEnemyHpMultiplier: number;
  specialEnemyHpMultiplier: number;
  descentSpeedMultiplier: number;
  activePopulationMultiplier: number;
  reinforcementIntervalMultiplier: number;
  playerDamageMultiplier: number;
  startingOrbCount: number;
  seed: number;
}

export const DEVELOPMENT_BALANCE_STORAGE_KEY = 'project-ricochet.dev-balance';

export function createDefaultDevelopmentBalanceSettings(
  seed: number,
): DevelopmentBalanceSettings {
  return {
    normalEnemyHpMultiplier: 1, specialEnemyHpMultiplier: 1,
    descentSpeedMultiplier: 1, activePopulationMultiplier: 1,
    reinforcementIntervalMultiplier: 1, playerDamageMultiplier: 1,
    startingOrbCount: 1, seed,
  };
}
```

`parseDevelopmentBalanceSettings`는 record 여부, 모든 숫자의 유한성, 정수 필드와
명세 범위를 검사하고 실패 시 `RangeError`를 던진다. `load`는 JSON/검증 실패를
기본값으로 복구하고, `save`는 검증된 복사본만 저장한다.

- [ ] **Step 4: Add the optional run contract field and copy it**

```ts
export interface RunConfig {
  identity: RunIdentity;
  loadout: CoreLoadout;
  unlockedCoreTypes: OrbCoreId[];
  discoveredCoreTypes: OrbCoreId[];
  discoveredFusionTypes: FusionOrbId[];
  developmentBalance?: DevelopmentBalanceSettings;
}
```

`createRunResult`와 `CombatScene.setRunConfig`가 이 필드가 있을 때 새 객체로 복사하도록
테스트를 먼저 추가한다. 일반 `createRunConfig` 결과에는 필드가 없어야 한다.

- [ ] **Step 5: Run focused tests and commit**

Run: `rtk npm test -- --run src/game/dev/developmentBalanceSettings.test.ts src/game/run/runContract.test.ts`

Expected: PASS.

Commit: `feat(dev): add balance settings contract`

---

### Task 2: 적 밀도·체력·속도와 시작 구슬

**Files:**
- Modify: `src/game/encounters/EncounterDirector.ts`
- Test: `src/game/encounters/EncounterDirector.test.ts`
- Modify: `src/game/enemies/EnemyManager.ts`
- Test: `src/game/enemies/EnemyManager.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Test: `e2e/combat.spec.ts`

**Interfaces:**
- Consumes: `DevelopmentBalanceSettings` from Task 1.
- Produces: `EncounterDirector(runSeed, balance?)` and `EnemyManagerOptions.developmentBalance?`.

- [ ] **Step 1: Write failing director tests**

```ts
it('scales reinforcement interval and active population cap per run', () => {
  const balance = {
    ...createDefaultDevelopmentBalanceSettings(7),
    reinforcementIntervalMultiplier: 0.5,
    activePopulationMultiplier: 2,
  };
  const director = new EncounterDirector(7, balance);
  const interval = STAGES[0].phases[0].spawnIntervalMs / 2;
  expect(director.update(interval, { activePopulation: 12, topmostEnemyY: 120 }).formation)
    .not.toBeNull();
});
```

또한 빈 전장 긴급 증원 `emptyRespawnMs`에도 같은 간격 배율이 적용되는 테스트를 추가한다.

- [ ] **Step 2: Verify director RED, implement and verify GREEN**

Run: `rtk npm test -- --run src/game/encounters/EncounterDirector.test.ts`

`spawnIntervalMs`, `emptyRespawnMs`는 간격 배율을 곱하고, `activeCap`은
`Math.max(1, Math.round(base * multiplier))`로 한 번 계산해 두 게이트에 같은 값을 쓴다.

- [ ] **Step 3: Write failing enemy spawn tests**

```ts
it('applies per-run HP classes and descent speed once at spawn', () => {
  const manager = createManager({
    developmentBalance: {
      ...createDefaultDevelopmentBalanceSettings(1),
      normalEnemyHpMultiplier: 2,
      specialEnemyHpMultiplier: 3,
      descentSpeedMultiplier: 0.5,
    },
  });
  manager.spawnFormation([
    spec('basic', 3, 8),
    spec('armored', 10, 8),
  ]);
  expect(manager.getSnapshot().enemies.map(({ hp, speed }) => ({ hp, speed })))
    .toEqual([{ hp: 6, speed: 4 }, { hp: 30, speed: 4 }]);
});
```

기본·슈터·분열·잔체는 일반 배율, 장갑은 특수 배율을 사용한다.

- [ ] **Step 4: Inject settings and create starting orbs**

`CombatScene.create`에서 `const balance = this.runConfig?.developmentBalance`를 잡아
`EncounterDirector`와 `EnemyManager`에 전달한다. 시작 코어 구성 성공 뒤 다음 로직을
실행한다.

```ts
const startingOrbCount = balance?.startingOrbCount ?? 1;
for (let count = 1; count < startingOrbCount; count += 1) {
  if (!this.orbManager.addOrb(this.runConfig.loadout[0])) {
    throw new Error('development starting orb count exceeds the runtime limit');
  }
}
```

- [ ] **Step 5: Add browser evidence and commit**

개발 설정이 있는 `RunConfig`로 게임을 시작하는 E2E 헬퍼를 추가하고 스냅샷에서
구슬 4개, 기본 적의 배율 HP, 절반 속도를 확인한다. 고해상도 전환 뒤 남은
`orb-*` 소스 크기 기대값도 `256×256`으로 바로잡는다.

Run: `rtk npm test -- --run src/game/encounters/EncounterDirector.test.ts src/game/enemies/EnemyManager.test.ts`

Run: `rtk npx playwright test e2e/combat.spec.ts --project=desktop-chromium --grep "development balance|GBC opening"`

Expected: PASS.

Commit: `feat(dev): apply encounter balance overrides`

---

### Task 3: 모든 플레이어 피해의 단일 배율

**Files:**
- Modify: `src/game/enemies/EnemyManager.ts`
- Test: `src/game/enemies/EnemyManager.test.ts`
- Modify: `src/game/bosses/BossManager.ts`
- Test: `src/game/bosses/BossManager.test.ts`
- Modify: `src/game/bosses/HiveBossManager.ts`
- Test: `src/game/bosses/HiveBossManager.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`

**Interfaces:**
- Consumes: `DevelopmentBalanceSettings.playerDamageMultiplier`.
- Produces: `playerDamageMultiplier?: number` on enemy and boss manager options.

- [ ] **Step 1: Write failing enemy damage tests**

직접 구슬 타격과 `applyDirectDamage` 또는 범위 피해 각각에 2배 설정을 넣는다.
직접 타격은 반사/사망 판단도 배율 적용 HP와 일치하고, 보조 피해 이벤트가 보고하는
실제 피해가 2배인지 검증한다.

```ts
expect(snapshot.enemies[0]?.hp).toBe(baseHp - baseDamage * 2);
expect(secondaryDamage).toMatchObject({ damage: baseDamage * 2 });
```

- [ ] **Step 2: Implement the enemy final boundary**

`EnemyManager.damageEnemy`에서만 실제 피해에 배율을 곱한다. `processOrbHit`와
`processTemporaryOrbHit`는 반사·사망 예측을 맞추기 위해 매니저에 다음 HP를 전달한다.

```ts
const multiplier = this.options.playerDamageMultiplier ?? 1;
const predictiveHp = enemy.hp / multiplier;
```

실제 HP 차감에서는 `damage * multiplier`를 사용한다. 적 접촉·탄환·침입 피해는 이
함수를 통과하지 않으므로 변하지 않는다.

- [ ] **Step 3: Write failing Sentinel/Siege and Hive tests**

각 보스 매니저에 2배 설정을 전달한 뒤 직접 타격과 `applyAreaDamage`가 기본 대비
정확히 2배 HP를 차감하는지 검증한다. Siege 고유 `damageTakenScale`과 개발 배율은
각각 한 번 곱해져야 한다.

- [ ] **Step 4: Implement boss final boundaries**

`BossManager.damagePart`와 `HiveBossManager.damagePart`에서 개발 배율을 곱한다.
`processPermanentHit`와 `processTemporaryHit`가 구슬 매니저에 전달하는 파츠 HP는
`partHp / multiplier`로 바꿔 반사·사망 예측을 실제 차감과 맞춘다.

`CombatScene.startBoss`의 `commonOptions`와 `EnemyManager` 옵션에 같은
`balance?.playerDamageMultiplier ?? 1`을 전달한다.

- [ ] **Step 5: Run damage suites and commit**

Run: `rtk npm test -- --run src/game/enemies/EnemyManager.test.ts src/game/bosses/BossManager.test.ts src/game/bosses/HiveBossManager.test.ts`

Expected: PASS with direct, secondary, temporary and boss paths covered.

Commit: `feat(dev): scale all player-owned damage`

---

### Task 4: 개발자 설정 UI와 반복 런

**Files:**
- Create: `src/game/dev/DevelopmentBalancePanel.ts`
- Modify: `src/game/meta/AppController.ts`
- Modify: `src/styles.css`
- Test: `e2e/meta-loop.spec.ts`

**Interfaces:**
- Consumes: Task 1 settings load/save functions.
- Produces: `renderDevelopmentBalancePanel(root, settings, callbacks)` with `start`, `back`, `restoreDefaults` callbacks.

- [ ] **Step 1: Write the failing desktop E2E**

```ts
test('@desktop starts and repeats an isolated development balance run', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '밸런스 테스트' }).click();
  await page.getByLabel('플레이어 피해 배율').fill('2');
  await page.getByLabel('시작 구슬 수').fill('4');
  await page.getByRole('button', { name: '테스트 시작' }).click();
  await expect.poll(async () => (await combatSnapshot(page)).orbs.length).toBe(4);
  // Emit a development run result, then verify no meta settlement screen appears.
  await expect(page.getByRole('button', { name: '같은 설정 재시작' })).toBeVisible();
});
```

`localStorage['project-ricochet.meta']`를 전후 비교해 완전히 같음을 확인한다.

- [ ] **Step 2: Verify E2E RED and build the panel**

패널은 `<input type="number">`의 `min`, `max`, `step`, `required`를 사용한다.
각 입력에는 원본 수치 도움말을 붙인다. submit 시 `form.reportValidity()`를 통과한
값만 `parseDevelopmentBalanceSettings`로 재검증한다.

- [ ] **Step 3: Integrate the AppController flow**

`renderDeploy`는 DEV일 때만 버튼을 추가한다. `startDevelopmentRun(settings)`은 현재
선택 코어로 `createRunConfig`를 만든 뒤 `developmentBalance` 복사본을 붙이고 게임을
시작한다. 종료 콜백은 `settleRun`을 호출하지 않고 전용 결과 화면을 렌더한다.

전용 결과 화면 버튼 동작:

```ts
same settings -> startDevelopmentRun(lastDevelopmentSettings)
edit settings -> renderDevelopmentBalance(lastDevelopmentSettings)
normal screen -> renderDeploy()
```

- [ ] **Step 4: Add mobile layout and validation E2E**

390×844 뷰포트에서 패널이 세로 스크롤되고 `테스트 시작`이 화면 안으로 접근
가능한지 캡처한다. 범위 밖 값을 넣으면 시작되지 않고 해당 input이 `:invalid`인지
확인한다.

Run: `rtk npx playwright test e2e/meta-loop.spec.ts --project=desktop-chromium --grep "development balance"`

Run: `rtk npx playwright test e2e/meta-loop.spec.ts --project=mobile-chromium --grep "development balance"`

Expected: PASS with desktop and mobile screenshots.

- [ ] **Step 5: Commit**

Commit: `feat(dev): add balance test panel`

---

### Task 5: 통합 검증과 기록

**Files:**
- Modify: `docs/WORKLOG.md`

**Interfaces:**
- Consumes: Tasks 1~4 completed behavior.
- Produces: reproducible verification evidence and worklog entry.

- [ ] **Step 1: Run the full automated suite**

Run: `rtk npm test`

Expected: all Vitest files pass with zero failures.

- [ ] **Step 2: Run production build and full relevant browser flows**

Run: `rtk npm run build`

Run: `rtk npx playwright test e2e/meta-loop.spec.ts`

Run: `rtk npx playwright test e2e/combat.spec.ts --project=desktop-chromium --grep "development balance|GBC opening"`

Expected: build exits 0; all selected desktop/mobile tests pass.

- [ ] **Step 3: Inspect screenshots**

데스크톱과 390×844 모바일 캡처에서 입력 라벨, 현재값 도움말, 시작 버튼, 세로
스크롤, 플레이 영역 전환을 직접 확인한다. 캔버스가 설정 패널과 동시에 남지 않아야
한다.

- [ ] **Step 4: Update the worklog**

`docs/WORKLOG.md`에 개발자 모드 항목, 런 격리, 배율 경계와 실제 통과한 테스트 수를
기록한다.

- [ ] **Step 5: Final verification and commit**

Run: `rtk git diff --check`

Run: `rtk git status --short`

Commit: `docs: record development balance mode`

