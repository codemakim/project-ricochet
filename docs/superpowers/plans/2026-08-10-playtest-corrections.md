# Playtest Corrections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 구슬별 융합 격리와 2보스 충돌을 바로잡고, 반사 통로·빠른 첫 성장·실질적인 보조 피해·모바일 작업장 UI를 완성한다.

**Architecture:** 기존 `OrbStore → DirectHitEvent → CombatScene` 타입 흐름을 유지하고 발사원 추적만 보강한다. 편성은 기존 8열 격자 배치기에 예약 빈칸 마스크를 넣으며, 피해는 기존 중앙 튜닝과 피해 API를 재사용한다. 작업장은 `AppController`의 DOM 렌더링을 격자로 바꾸고 모바일 상세는 네이티브 `<dialog>`를 하단 시트로 스타일링한다.

**Tech Stack:** TypeScript 5.9, Phaser 3.90 Arcade Physics, Vite 8, Vitest 4, Playwright 1.61, native HTML/CSS `<dialog>`

## Global Constraints

- 새 런타임·개발 의존성을 추가하지 않는다.
- 저장 스키마와 발견·해금 조건을 바꾸지 않는다.
- 적 체력·밀도·하강 속도와 매끄러운 등속 하강은 유지한다.
- 첫 레벨업 XP만 `8 → 5`; 이후 `12 + level × 5`는 유지한다.
- 전투 수치는 `src/game/config/gameTuning.ts`에만 둔다. 장면 코드에 밸런스 숫자를 넣지 않는다.
- 보스 보조 피해는 `secondaryDamageScale: 0.5`, `maxSecondaryTargets: 1`을 유지한다.
- 모바일 작업장 상세는 카드 선택 직후 현재 뷰포트에 보여야 하며 자동 스크롤을 사용하지 않는다.
- 최종 래스터 아트, 사운드, 신규 적·보스·구슬은 범위 밖이다.

## File Map

| 파일 | 책임 |
| --- | --- |
| `src/game/orbs/OrbManager.ts` | 물리 구슬 ID·타입·레벨 격리 유지 |
| `src/game/scenes/combatSceneRules.ts` | 한 직접 타격에서 해당 구슬 타입의 효과만 계획 |
| `src/game/scenes/CombatScene.ts` | 발사원 표시 데이터, 보조 피해 피드백, 인게임 보상 연결 |
| `src/game/ui/LevelUpOverlay.ts` | 인게임 카드 실제 이름·효과 표시 |
| `src/game/ui/OrbFusionOverlay.ts` | 융합 재료 선택에서 실제 결과 표시 |
| `src/game/bosses/HiveBossManager.ts` | 2보스 구조물 영구 전개·충돌·이동 |
| `src/game/bosses/hiveBossGeometry.ts` | 2보스 전개 위치만 제공 |
| `src/game/encounters/formationGrid.ts` | 격자 좌표와 예약 통로 마스크 |
| `src/game/encounters/formationRules.ts` | 템플릿·절차 배치가 같은 통로를 회피 |
| `src/game/encounters/stageDefinitions.ts` | 편성 데이터 유효성 검사 |
| `src/game/config/gameTuning.ts` | 기본·융합·일반 보조 효과 수치와 피드백 상한 |
| `src/game/enemies/EnemyManager.ts` | 보조 피해 결과를 한 콜백으로 보고 |
| `src/game/meta/AppController.ts` | 작업장 탭·카드·상세·구매 동작 |
| `src/styles.css` | 작업장 스크롤, 데스크톱 패널, 모바일 하단 시트 |
| `e2e/combat.spec.ts`, `e2e/meta-loop.spec.ts` | 실제 브라우저 통합 계약 |
| `docs/TUNING.md`, `docs/WORKLOG.md` | 중앙 튜닝 위치와 완료 기록 |

---

### Task 1: 구슬별 융합 격리와 인게임 정보 공개

**Files:**
- Modify: `src/game/orbs/OrbManager.test.ts`
- Modify: `src/game/scenes/combatSceneRules.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `src/game/ui/LevelUpOverlay.ts`
- Modify: `src/game/ui/LevelUpOverlay.test.ts`
- Modify: `src/game/ui/OrbFusionOverlay.ts`
- Modify: `src/game/ui/OrbFusionOverlay.test.ts`
- Modify: `e2e/meta-loop.spec.ts`

**Interfaces:**
- Consumes: `OrbStore.fuseOrbs(firstId, secondId, fusionType): boolean`, `DirectHitEvent.sourceOrbId`, `DirectHitEvent.coreType`.
- Produces: 인게임 오버레이는 발견 여부 인자를 받지 않는다. 전도·광자 피드백 Phaser 오브젝트는 `sourceOrbId` 데이터를 가진다.

- [ ] **Step 1: 동일 전도 구슬 격리 회귀 테스트 작성**

```ts
it('fuses only the selected conduction orb and preserves its sibling', () => {
  const store = new OrbStore(EXPERIMENT_DEFAULTS);
  store.addOrb('conduction'); // id 1
  store.addOrb('conduction'); // id 2
  store.addOrb('inertia');    // id 3
  store.upgradeOrb(2, 'conduction');

  expect(store.fuseOrbs(3, 1, 'photon-orbit')).toBe(true);
  expect(store.getSnapshot().map(({ id, coreType, level }) => ({ id, coreType, level })))
    .toEqual([
      { id: 0, coreType: 'echo', level: 1 },
      { id: 2, coreType: 'conduction', level: 2 },
      { id: 3, coreType: 'photon-orbit', level: 1 },
    ]);
});
```

- [ ] **Step 2: 효과 계획이 이벤트 타입만 따르는 테스트 작성**

```ts
const conduction = planOrbCoreEffects({
  source: 'permanent', coreType: 'conduction', conductionTriggered: true,
}, false);
const photon = planFusionDirectHitEffects({
  source: 'permanent', coreType: 'photon-orbit', coreLevel: 1,
}, false);

expect(conduction).toEqual({ spawnCorrosion: false, dischargeConduction: true });
expect(photon.photonBeam).not.toBeNull();
expect(planFusionDirectHitEffects({
  source: 'permanent', coreType: 'conduction', coreLevel: 2,
}, false).photonBeam).toBeNull();
```

- [ ] **Step 3: 미발견 인게임 카드가 실제 정보를 보여야 하는 실패 테스트로 교체**

```ts
overlay.show([
  { kind: 'orb-add', coreType: 'conduction' },
  { kind: 'orb-fusion', fusionType: 'photon-orbit' },
], new BuildState(), [], vi.fn());

expect(objects.map(({ text }) => text)).toEqual(expect.arrayContaining([
  '1. 전도 구슬 Lv1',
  '2. 광자 궤도 융합',
]));
```

`OrbFusionOverlay.test.ts`에서도 `광자 궤도 재료 선택`과 `→ 광자 궤도 Lv5`를 발견 상태와 무관한 계약으로 바꾼다.

- [ ] **Step 4: 대상 테스트를 실행해 UI 계약 실패와 저장 격리 상태를 확인**

Run: `rtk npm test -- src/game/orbs/OrbManager.test.ts src/game/scenes/combatSceneRules.test.ts src/game/ui/LevelUpOverlay.test.ts src/game/ui/OrbFusionOverlay.test.ts`

Expected: 새 격리 테스트는 현재 코드에서 PASS할 수 있다. 기존 발견 마스킹 테스트를 교체한 UI 테스트는 FAIL한다. 격리 테스트가 PASS하면 저장소 타입 누출 수정은 만들지 않는다.

- [ ] **Step 5: 인게임 마스킹과 불필요한 발견 인자를 삭제**

```ts
show(
  choices: readonly RunRewardChoice[],
  build: BuildState,
  orbs: readonly OrbSnapshot[],
  onSelect: (choice: RunRewardChoice) => void,
): void
```

`LevelUpOverlay.cardLabel()`과 `choiceDetail()`은 항상 `orbDefinition()`/`ORB_FUSION_DEFINITIONS`의 실제 `label`, `summary`, 재료 이름을 사용한다. `OrbFusionOverlay.show()`의 `discovered` 인자와 `resultLabel` 분기를 삭제한다. `CombatScene.openNextLevelUp()`과 융합 선택 호출에서도 발견 인자를 제거하되, 성공 뒤 `recordDiscovery()`는 유지한다.

- [ ] **Step 6: 전도·광자 피드백에 발사원 ID를 부착**

```ts
private drawConductionFeedback(
  position: Vector,
  targets: readonly Vector[],
  sourceOrbId: number,
): void {
  const pulse = this.add.graphics()
    .setData('sourceOrbId', sourceOrbId)
    .lineStyle(3, GAME_TUNING.orbCores.conduction.accent, 0.95)
    .strokeCircle(position.x, position.y, 8)
    .setDepth(4)
    .setName('core-feedback-conduction');
  for (const target of targets) {
    pulse.beginPath().moveTo(position.x, position.y)
      .lineTo(target.x, target.y).strokePath();
  }
  this.time.delayedCall(
    GAME_TUNING.visual.coreFeedback.conductionDurationMs,
    () => pulse.destroy(),
  );
}
```

광자 빔에도 `.setData('sourceOrbId', event.sourceOrbId)`를 붙인다. `handlePostDirectHit`, `handleConductionFlight`, `applyResonantSwarmHit`은 이미 가진 물리 구슬 ID를 그대로 전달한다. 피드백 ID는 사용자 텍스트로 출력하지 않는다.

같은 물리 프레임에 같은 구슬이 여러 collider callback을 낸 경우 피해 처리는 모두 유지하고 시각 오브젝트만 한 번 만든다.

```ts
private readonly feedbackFrames = new Map<string, number>();

private acceptsFeedbackFrame(kind: string, sourceOrbId: number): boolean {
  const key = `${kind}:${sourceOrbId}`;
  const frame = this.game.loop.frame;
  if (this.feedbackFrames.get(key) === frame) return false;
  this.feedbackFrames.set(key, frame);
  return true;
}
```

전도와 광자 렌더링 진입부에서만 이 함수를 사용한다. `applyNearestSecondaryDamage()`와 `applySegmentDamage()`는 조건 밖에 두므로 정상 다중 타격 피해를 버리지 않는다. shutdown에서 map을 비운다.

- [ ] **Step 7: 단위 테스트와 메타 E2E 기대값 갱신**

`e2e/meta-loop.spec.ts`의 `1. ??? Lv1` 기대를 실제 `ORB_CORE_DEFINITIONS[acquiredCoreType].label`로 교체하고, 선택 전에는 발견 목록이 여전히 `['echo']`, 선택 뒤에만 새 ID가 생기는 것을 유지한다.

Run: `rtk npm test -- src/game/orbs/OrbManager.test.ts src/game/scenes/combatSceneRules.test.ts src/game/ui/LevelUpOverlay.test.ts src/game/ui/OrbFusionOverlay.test.ts`

Expected: PASS.

- [ ] **Step 8: 커밋**

```bash
rtk git add src/game/orbs/OrbManager.test.ts src/game/scenes/combatSceneRules.test.ts src/game/scenes/CombatScene.ts src/game/ui/LevelUpOverlay.ts src/game/ui/LevelUpOverlay.test.ts src/game/ui/OrbFusionOverlay.ts src/game/ui/OrbFusionOverlay.test.ts e2e/meta-loop.spec.ts
rtk git commit -m "fix: isolate fusion feedback and reveal run rewards"
```

### Task 2: 2보스 구조물 영구 전개와 물리 반사

**Files:**
- Modify: `src/game/bosses/HiveBossManager.ts`
- Modify: `src/game/bosses/HiveBossManager.test.ts`
- Modify: `src/game/bosses/hiveBossGeometry.ts`
- Modify: `src/game/bosses/hiveBossGeometry.test.ts`
- Modify: `src/game/config/gameTuning.ts`
- Modify: `src/game/config/gameTuning.test.ts`

**Interfaces:**
- Consumes: `advanceHiveCycle()`, `exposedHiveParts()`, 기존 사수·반사판 전개 좌표.
- Produces: 모든 살아 있는 반사판이 비격파 전 페이즈에서 이동·반사하며, 구조물 좌표는 페이즈 전환으로 초기화되지 않는다.

- [ ] **Step 1: 회수 계약을 영구 전개 계약으로 교체**

```ts
it('keeps modules deployed and moving through the whole shield cycle', () => {
  const boundary = createBoundary();
  const initial = boundary.manager.getSnapshot().partPositions!;

  expect(initial.leftShooter).toEqual({ x: 135, y: 56 });
  expect(initial.rightShooter).toEqual({ x: 315, y: 56 });
  boundary.updateAt(1000);
  const shielded = boundary.manager.getSnapshot().partPositions!;
  expect(shielded.leftReflector.x).not.toBe(initial.leftReflector.x);
  boundary.updateAt(5500);
  boundary.updateAt(12_500);
  const cycled = boundary.manager.getSnapshot().partPositions!;
  expect(cycled.leftShooter).toEqual(initial.leftShooter);
  expect(cycled.rightShooter).toEqual(initial.rightShooter);
});
```

기존 “recalled reflector는 피해만 받고 통과” 테스트는 `shielded`, `telegraph`, `exposed` 각각에서 permanent/temporary 구슬이 반사되고 `synchronizeOrb`/`synchronizeTemporary`가 호출되는 테스트로 바꾼다.

- [ ] **Step 2: 대상 테스트 실패 확인**

Run: `rtk npm test -- src/game/bosses/HiveBossManager.test.ts src/game/bosses/hiveBossGeometry.test.ts src/game/config/gameTuning.test.ts`

Expected: 초기 회수 좌표, shielded 이동, shielded 반사 계약에서 FAIL.

- [ ] **Step 3: 회수 좌표와 상태별 통과 분기 삭제**

```ts
const { core, shooters, reflectors } = HIVE_BOSS_GEOMETRY;
this.parts.leftShooter.setPosition(shooters.leftShooter.x, shooters.leftShooter.y);
this.parts.rightShooter.setPosition(shooters.rightShooter.x, shooters.rightShooter.y);
this.parts.leftReflector.setPosition(midpoint(reflectors.leftReflector.travel), reflectors.leftReflector.y);
this.parts.rightReflector.setPosition(midpoint(reflectors.rightReflector.travel), reflectors.rightReflector.y);

if (this.state.phase !== 'defeated') this.moveReflectors(deltaMs);
```

`HIVE_BOSS_GEOMETRY.recalled`, `recallModules()`, `deployModules()`, `isRecalledReflector()`를 삭제한다. `gameTuning.ts`의 recalled 좌표·겹침 검증과 그 실패 테스트도 삭제하고, 전개된 shooter·reflector swept path·최소 corridor 검증은 유지한다. `processPermanentHit()`과 `processTemporaryHit()`은 살아 있는 반사판에서 항상 기존 collider의 반사를 사용한다. 코어만 `coreIsExposed()` 분기를 유지한다.

- [ ] **Step 4: 페이즈 전환은 공격 일정만 바꾸게 축소**

```ts
if (this.state.phase === 'exposed') this.restartShooterSchedules(now);
if (this.state.phase === 'shielded' && previousPhase === 'exposed') {
  this.cancelAllShooterWarnings();
  this.stopShooterSchedules();
  this.bulletGroup.clear(true, true);
}
```

좌표·`reflectorMotion` 초기화는 넣지 않는다. 구조물 파괴 시 기존 `synchronizeParts()`가 body와 visibility를 끄는 흐름은 유지한다.

- [ ] **Step 5: 단위 테스트 실행**

Run: `rtk npm test -- src/game/bosses/HiveBossManager.test.ts src/game/bosses/hiveBossGeometry.test.ts src/game/bosses/hiveBossRules.test.ts src/game/config/gameTuning.test.ts`

Expected: PASS. 살아 있는 반사판 좌표는 travel 범위 안이고, 파괴된 부위는 페이즈 전환 뒤에도 숨김·충돌 비활성이다.

- [ ] **Step 6: 정확성 묶음 커밋**

```bash
rtk git add src/game/bosses/HiveBossManager.ts src/game/bosses/HiveBossManager.test.ts src/game/bosses/hiveBossGeometry.ts src/game/bosses/hiveBossGeometry.test.ts src/game/config/gameTuning.ts src/game/config/gameTuning.test.ts
rtk git commit -m "fix: keep hive modules deployed"
```

### Task 3: 예약 반사 통로와 첫 XP 5

**Files:**
- Modify: `src/game/encounters/formationGrid.ts`
- Modify: `src/game/encounters/formationGrid.test.ts`
- Modify: `src/game/encounters/formationRules.ts`
- Modify: `src/game/encounters/formationRules.test.ts`
- Modify: `src/game/encounters/stageDefinitions.ts`
- Modify: `src/game/encounters/stageDefinitions.test.ts`
- Modify: `src/game/progression/progressionRules.ts`
- Modify: `src/game/progression/progressionRules.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `src/game/progression/ProgressionManager.test.ts`
- Modify: `e2e/combat.spec.ts`
- Modify: `e2e/meta-loop.spec.ts`

**Interfaces:**
- Consumes: `FORMATION_COLUMNS = 8`, `GridFootprint`, 편성 `sequence`와 `runSeed`.
- Produces: `reservedPassageCells(rows, sequence, runSeed): ReadonlySet<string>`; 템플릿·절차 배치가 동일 집합을 금지 셀로 사용한다.

- [ ] **Step 1: 통로 마스크와 연결성 실패 테스트 작성**

```ts
it('shares one connected passage for each consecutive formation pair', () => {
  for (const selected of FORMATION_PROFILES) {
    const recipeForProfile = { ...recipe(), profile: selected };
    for (let sequence = 0; sequence < 64; sequence += 2) {
      const first = createReinforcementFormation(recipeForProfile, sequence, 808).enemies;
      const second = createReinforcementFormation(recipeForProfile, sequence + 1, 808).enemies;
      expect(hasConnectedEmptyPassage(first)).toBe(true);
      expect(hasConnectedEmptyPassage(second)).toBe(true);
      expect(sharedBottomPassageColumns(first, second).length).toBeGreaterThan(0);
    }
  }
});
```

테스트의 BFS는 8열, 결과의 최대 행까지 상하좌우 빈 셀만 따라가며 아래 행에서 위 행 도달 여부를 판정한다. 별도 런타임 경로 탐색기는 만들지 않는다.

- [ ] **Step 2: XP 계약을 5로 변경하는 실패 테스트 작성**

```ts
expect([0, 1, 2, 3, 4].map(xpRequiredForLevel)).toEqual([5, 17, 22, 27, 32]);
```

`ProgressionManager.test.ts`는 첫 보상에 `gainExperience(5)`를 사용하고 30 XP 잔여값 기대를 새 곡선에 맞춘다. `e2e/combat.spec.ts`와 `e2e/meta-loop.spec.ts`의 첫 보상 디버그 지급도 모두 `8 → 5`로 바꾼다.

- [ ] **Step 3: 대상 테스트 실패 확인**

Run: `rtk npm test -- src/game/encounters/formationGrid.test.ts src/game/encounters/formationRules.test.ts src/game/encounters/stageDefinitions.test.ts src/game/progression/progressionRules.test.ts src/game/progression/ProgressionManager.test.ts`

Expected: 통로 연결성과 첫 XP 기대에서 FAIL.

- [ ] **Step 4: 세 종류 예약 마스크를 격자 유틸에 추가**

```ts
export function reservedPassageCells(
  rows: number,
  sequence: number,
  runSeed: number,
): ReadonlySet<string> {
  const pair = Math.floor(sequence / 2);
  const anchors = [1, 4, 6, 3] as const;
  const column = anchors[(runSeed % anchors.length + pair) % anchors.length]!;
  const variant = pair % 3;
  const cells = new Set<string>();
  if (variant === 0) {
    for (let row = 0; row < rows; row += 1) cells.add(`${row}:${column}`);
  } else if (variant === 1) {
    const turnRow = Math.floor(rows / 2);
    const next = column < FORMATION_COLUMNS / 2 ? column + 1 : column - 1;
    for (let row = 0; row <= turnRow; row += 1) cells.add(`${row}:${column}`);
    for (let row = turnRow; row < rows; row += 1) cells.add(`${row}:${next}`);
  } else {
    const pocket = column < FORMATION_COLUMNS / 2 ? column + 1 : column - 1;
    for (let row = 0; row < rows; row += 1) cells.add(`${row}:${column}`);
    cells.add(`0:${pocket}`);
    if (rows > 2) cells.add(`1:${pocket}`);
  }
  return cells;
}
```

연속 두 sequence는 같은 `pair`를 사용한다. 다음 pair는 anchor가 반드시 바뀐다. 굽은 통로는 전환 행에서 두 열을 모두 비워 4방향 연결을 보장한다.

- [ ] **Step 5: 모든 배치 경로에 예약 셀 전달**

```ts
function canOccupy(
  occupied: ReadonlySet<string>,
  footprint: GridFootprint,
  rows: number,
  reserved: ReadonlySet<string>,
): boolean
```

`placeTemplate()`과 `fillProcedural()`이 같은 `reserved`를 받는다. 다칸 footprint의 셀 하나라도 `reserved.has(key)`면 거부한다. `createFormation()`은 source의 rows를 확정한 직후 `reservedPassageCells(rows, sequence, runSeed)`를 한 번 계산한다.

기존 fixed `split-gate` 테스트는 예약 셀과 겹치는 slot이 빠지는 정확한 결과로 갱신하고, 남은 slot의 kind·footprint가 원본 템플릿과 일치하는지 검사한다. fixed 템플릿에도 절차 filler는 추가하지 않는다.

- [ ] **Step 6: 편성 데이터 검증과 XP 구현**

```ts
export function xpRequiredForLevel(level: number): number {
  if (!Number.isInteger(level) || level < 0) {
    throw new RangeError('level must be a non-negative integer');
  }
  return level === 0 ? 5 : 12 + level * 5;
}
```

`validateStageContent()`은 각 profile의 `rowMinimum`에서 가장 큰 예약 마스크를 뺀 가용 셀이 `cellMinimum` 미만이면 `${profile.id} cannot fit its passage and minimum cells`로 거부한다. `CombatScene.getDebugSnapshot()`의 manager 부재 기본값도 `xpRequired: 5`로 맞춘다.

- [ ] **Step 7: 편성·성장 테스트 실행**

Run: `rtk npm test -- src/game/encounters/formationGrid.test.ts src/game/encounters/formationRules.test.ts src/game/encounters/stageDefinitions.test.ts src/game/progression/progressionRules.test.ts src/game/progression/ProgressionManager.test.ts`

Expected: PASS. 모든 profile×64 pair가 연결 통로, 금지 셀 미침범, 기존 cell 범위·HP·속도 계약을 함께 만족한다.

- [ ] **Step 8: 전투 구조 묶음 커밋**

```bash
rtk git add src/game/encounters/formationGrid.ts src/game/encounters/formationGrid.test.ts src/game/encounters/formationRules.ts src/game/encounters/formationRules.test.ts src/game/encounters/stageDefinitions.ts src/game/encounters/stageDefinitions.test.ts src/game/progression/progressionRules.ts src/game/progression/progressionRules.test.ts src/game/progression/ProgressionManager.test.ts src/game/scenes/CombatScene.ts e2e/combat.spec.ts e2e/meta-loop.spec.ts
rtk git commit -m "feat: reserve ricochet passages"
```

### Task 4: 보조 효과 피해 곡선과 처치 피드백

**Files:**
- Modify: `src/game/config/gameTuning.ts`
- Modify: `src/game/config/gameTuning.test.ts`
- Modify: `src/game/combat/CorrosionFieldState.ts`
- Modify: `src/game/combat/CorrosionFieldState.test.ts`
- Modify: `src/game/orbs/orbCoreRules.test.ts`
- Modify: `src/game/orbs/TemporaryOrbManager.test.ts`
- Modify: `src/game/combat/FusionCombatState.test.ts`
- Modify: `src/game/progression/BuildState.test.ts`
- Modify: `src/game/scenes/combatSceneRules.test.ts`
- Modify: `src/game/enemies/EnemyManager.ts`
- Modify: `src/game/enemies/EnemyManager.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `src/game/scenes/combatTextureRules.test.ts`

**Interfaces:**
- Consumes: `GAME_TUNING`, `BuildState.secondaryDamage()`, 기존 area/line/segment/nearest 피해 함수.
- Produces: `EnemySecondaryDamageEvent`; `GAME_TUNING.orbCores.corrosion.damagePerTickByLevel`; 최대 18개의 짧은 피해 라벨·처치 섬광.

- [ ] **Step 1: 피해 예산 실패 테스트 작성**

```ts
const basicHp = [3, 4.8, 7.2] as const;
const corrosionTotal = (level: 1 | 5) => {
  const index = level - 1;
  const ticks = GAME_TUNING.orbCores.corrosion.durationMsByLevel[index]!
    / GAME_TUNING.orbCores.corrosion.tickMs;
  return ticks * GAME_TUNING.orbCores.corrosion.damagePerTickByLevel[index]!;
};

expect(corrosionTotal(1) / basicHp[0]).toBeGreaterThanOrEqual(0.3);
expect(GAME_TUNING.orbCores.explosion.damageByLevel[0]! / basicHp[0])
  .toBeGreaterThanOrEqual(0.3);
expect(photonFusionProfile(9).beam.damage).toBeGreaterThanOrEqual(2);
```

레벨 1·5 기본 코어와 레벨 1·9 융합의 대표 피해가 유한·양수이고 증가하는지도 검증한다.

- [ ] **Step 2: 보조 피해 콜백 실패 테스트 작성**

```ts
const onSecondaryDamage = vi.fn();
const boundary = createBoundary(formation, false, () => 0, { onSecondaryDamage });
boundary.manager.applyAreaDamage({ x: 100, y: 100 }, 60, 2, -1);
expect(onSecondaryDamage).toHaveBeenCalledWith(expect.objectContaining({
  position: { x: 100, y: 100 },
  damage: expect.any(Number),
  killed: expect.any(Boolean),
}));
```

테스트 boundary 인자는 기존 options 조립부에 선택 콜백 하나만 추가한다.

- [ ] **Step 3: 대상 테스트 실패 확인**

Run: `rtk npm test -- src/game/config/gameTuning.test.ts src/game/combat/CorrosionFieldState.test.ts src/game/orbs/orbCoreRules.test.ts src/game/orbs/TemporaryOrbManager.test.ts src/game/combat/FusionCombatState.test.ts src/game/progression/BuildState.test.ts src/game/enemies/EnemyManager.test.ts`

Expected: `damagePerTickByLevel` 부재와 낮은 피해 예산·콜백 부재로 FAIL.

- [ ] **Step 4: 중앙 피해값을 다음 1차 플레이 기준으로 교체**

```ts
corrosion.damagePerTickByLevel = [0.28, 0.34, 0.42, 0.5, 0.62]
conduction.directDamageByLevel = [0.9, 1.1, 1.35, 1.65, 2]
conduction.flightDamageByLevel = [0, 0, 0.32, 0.4, 0.5]
explosion.damageByLevel = [1.1, 1.35, 1.6, 1.9, 2.3]
temporaryOrbs.baseDamage = 0.65
```

기타 기본/일반 보조 피해는 다음 값으로 교체한다.

| 효과 | 새 피해 |
| --- | --- |
| 반향 shockwave / cutter / replay | `0.9 / 0.8 / 1.1` |
| 부식 deathSpread tick | `0.32` |
| 전도 overcharge | `0.8` |
| 관성 shockwave / pierce explosion | `0.9 / 1.1` |
| 일반 cutter / explosion / destruction | `1.0 / 1.0 / 1.2` |
| microMissile | `1.6` |
| recoveryShockwave rank 1·2 | `[1.0, 1.6]` |
| highSpeedImpact | `0.9` |

융합 9종 피해 배열은 다음 값으로 교체한다. 확률·범위·수명·개수는 유지한다.

| 융합 | 새 피해 배열/값 |
| --- | --- |
| 광자 궤도 beam | `[0.8,0.9,1,1.1,1.2,1.35,1.5,1.7,2]` |
| 광자 궤도 trail | `[0,0,0,0.22,0.26,0.3,0.36,0.42,0.5]`, intersection `1.6` |
| 공명 군체 link | `[0.36,0.4,0.44,0.48,0.54,0.6,0.68,0.78,0.9]` |
| 공명 군체 final | `[0.35,0.4,0.45,0.5,0.58,0.66,0.76,0.88,1.05]` |
| 나노 증식체 tick | `[0.22,0.24,0.27,0.3,0.34,0.38,0.43,0.5,0.6]` |
| 질량 붕괴 | `[1.5,1.7,1.9,2.1,2.4,2.7,3.1,3.6,4.4]` |
| 반응로 charge | `[0.36,0.4,0.44,0.48,0.54,0.6,0.66,0.72,0.82]` |
| 성단 폭격 | `[0.6,0.66,0.72,0.8,0.88,0.98,1.1,1.24,1.4]` |
| 성단 잔류 tick | `[0,0,0,0,0,0,0.18,0.22,0.28]` |
| 거울 회로 tick | `[0.22,0.24,0.27,0.31,0.36,0.41,0.47,0.55,0.65]`, intersection `1.4` |
| 융해 코어 tick | `[0.18,0.2,0.22,0.25,0.29,0.34,0.4,0.48,0.58]` |
| 융해 코어 eruption | `[1.6,1.8,2,2.2,2.5,2.8,3.2,3.7,4.4]` |
| 벡터 블레이드 | `[0.75,0.82,0.9,1,1.1,1.22,1.36,1.52,1.75]` |

- [ ] **Step 5: 부식 프로필이 레벨별 틱 피해를 사용하게 변경**

```ts
damage: this.build.secondaryDamage(
  corrosion.damagePerTickByLevel[corrosionLevelIndex]!,
)
```

`GameTuning` 타입의 단일 `damagePerTick`을 `damagePerTickByLevel: FiveLevelValues`로 교체하고 `CorrosionFieldState`의 기본값은 배열 첫 값으로 사용한다. 기존 5개 값 검증기가 자동 검사하게 이름을 `ByLevel`로 유지한다.

- [ ] **Step 6: EnemyManager에서 보조 피해 결과를 한 곳에서 보고**

```ts
export interface EnemySecondaryDamageEvent {
  enemyId: number;
  position: Vector;
  damage: number;
  killed: boolean;
  color?: number;
}

onSecondaryDamage?: (event: EnemySecondaryDamageEvent) => void;
```

`EnemyAreaDamageEffect`에는 `feedbackColor?: number`를 추가한다. `applyNearestSecondaryDamage`, `applyLineDamage`, `applySegmentDamage`, `applyDirectDamage`에는 선택적 마지막 `feedbackColor?: number` 인자를 추가한다. `damageEnemy()`는 취약 스택 적용 후 실제 감소량을 반환하고, 각 보조 피해 함수는 피해 직후 실제 감소량·사망 여부·색을 콜백으로 보낸다. 구슬 직접 충돌의 `applyHit()`은 이 콜백을 사용하지 않는다.

`settlePlannedAreaEffects()`는 `feedbackColor`를 enemy batch에 보존한다. `CombatScene.applyAreaEffects()`는 선택적 색 인자를 받고 폭발·부식·충격파·각 융합의 기존 accent/fill을 전달한다. 색을 생략한 일반 보조 효과만 `GAME_TUNING.visual.triggerFeedback.shockwaveColor`를 기본값으로 쓴다.

- [ ] **Step 7: 기존 부식 숫자를 공용 피드백으로 일반화**

```ts
private readonly secondaryFeedback = new Set<Phaser.GameObjects.GameObject>();

private trackSecondaryFeedback(
  object: Phaser.GameObjects.GameObject,
  durationMs: number,
): void {
  while (
    this.secondaryFeedback.size
      >= GAME_TUNING.visual.coreFeedback.maximumDamageLabels
  ) {
    const oldest = this.secondaryFeedback.values().next().value!;
    oldest.destroy();
    this.secondaryFeedback.delete(oldest);
  }
  this.secondaryFeedback.add(object);
  this.time.delayedCall(durationMs, () => {
    object.destroy();
    this.secondaryFeedback.delete(object);
  });
}

private drawSecondaryDamage(event: EnemySecondaryDamageEvent): void {
  const color = event.color ?? GAME_TUNING.visual.triggerFeedback.shockwaveColor;
  const label = this.add.text(
    event.position.x,
    event.position.y - 14,
    `-${formatDisplayNumber(event.damage)}`,
    { color: `#${color.toString(16).padStart(6, '0')}`, fontSize: '12px', fontStyle: 'bold' },
  ).setOrigin(0.5).setDepth(5).setName('secondary-damage-feedback');
  this.trackSecondaryFeedback(
    label,
    GAME_TUNING.visual.coreFeedback.damageNumberDurationMs,
  );
  if (event.killed) {
    const flash = this.add.graphics()
      .lineStyle(3, color, 0.9)
      .strokeCircle(event.position.x, event.position.y, 12)
      .setDepth(5)
      .setName('secondary-kill-feedback');
    this.trackSecondaryFeedback(
      flash,
      GAME_TUNING.visual.triggerFeedback.durationMs,
    );
  }
}
```

상한 `18`과 숫자 수명 `260ms`는 `GAME_TUNING.visual.coreFeedback`에 `maximumDamageLabels`, `damageNumberDurationMs`로 둔다. 기존 `corrosionDamageNumberDurationMs`와 `drawCorrosionDamage()`는 삭제하고 `EnemyManagerOptions.onSecondaryDamage`에서 공용 렌더러를 호출한다. shutdown/lifecycle에서 남은 오브젝트를 파괴하고 Set을 비운다.

- [ ] **Step 8: 피해·피드백 테스트 실행**

Run: `rtk npm test -- src/game/config/gameTuning.test.ts src/game/combat/CorrosionFieldState.test.ts src/game/orbs/orbCoreRules.test.ts src/game/orbs/TemporaryOrbManager.test.ts src/game/combat/FusionCombatState.test.ts src/game/progression/BuildState.test.ts src/game/scenes/combatSceneRules.test.ts src/game/enemies/EnemyManager.test.ts src/game/scenes/combatTextureRules.test.ts`

Expected: PASS. 최대 랭크가 유한하고 boss secondary cap은 기존 `0.5`, `1 target`이다.

- [ ] **Step 9: 커밋**

```bash
rtk git add src/game/config/gameTuning.ts src/game/config/gameTuning.test.ts src/game/combat/CorrosionFieldState.ts src/game/combat/CorrosionFieldState.test.ts src/game/orbs/orbCoreRules.test.ts src/game/orbs/TemporaryOrbManager.test.ts src/game/combat/FusionCombatState.test.ts src/game/progression/BuildState.test.ts src/game/scenes/combatSceneRules.test.ts src/game/enemies/EnemyManager.ts src/game/enemies/EnemyManager.test.ts src/game/scenes/CombatScene.ts src/game/scenes/combatTextureRules.test.ts
rtk git commit -m "balance: strengthen secondary effects"
```

### Task 5: 반응형 작업장 A1

**Files:**
- Modify: `src/game/meta/AppController.ts`
- Modify: `src/styles.css`
- Modify: `e2e/meta-loop.spec.ts`

**Interfaces:**
- Consumes: `ORB_CORE_DEFINITIONS`, `ORB_FUSION_DEFINITIONS`, `META_TUNING.corePrices`, `purchaseCore()`.
- Produces: `[data-workshop-tab]`, `[data-workshop-card]`, `[data-workshop-detail]`, `<dialog data-workshop-sheet>` DOM 계약.

- [ ] **Step 1: 데스크톱·모바일 작업장 E2E 실패 테스트 작성**

```ts
test('@desktop workshop uses a card grid and side detail', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '코어 작업장' }).click();
  await expect(page.locator('[data-workshop-card]')).toHaveCount(6);
  await page.locator('[data-workshop-card]').first().click();
  await expect(page.locator('[data-workshop-detail]')).toBeVisible();
  await expect(page.locator('[data-workshop-sheet][open]')).toHaveCount(0);
  await page.getByRole('tab', { name: '융합 기록' }).click();
  await expect(page.locator('[data-workshop-card]')).toHaveCount(9);
});

test('@mobile workshop opens a visible bottom sheet without scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: '코어 작업장' }).click();
  const card = page.locator('[data-workshop-card]').first();
  await card.click();
  const sheet = page.locator('[data-workshop-sheet][open]');
  await expect(sheet).toBeVisible();
  expect((await sheet.boundingBox())!.y).toBeLessThan(844);
  await page.mouse.click(10, 10);
  await expect(sheet).toHaveCount(0);
  await expect(card).toBeFocused();
  await card.click();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator('[data-workshop-detail]')).toContainText('반향 구슬');
  await expect(card).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await card.click();
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(card).toBeFocused();
});
```

- [ ] **Step 2: 작업장 E2E 실패 확인**

Run: `rtk npm run test:e2e -- e2e/meta-loop.spec.ts --grep workshop`

Expected: 새 data attribute와 dialog가 없어 FAIL.

- [ ] **Step 3: 카드 데이터와 마크업을 기존 렌더 함수 안에서 구성**

```html
<section class="meta-screen workshop-screen">
  <header class="workshop-header">
    <p class="eyebrow">CORE WORKSHOP</p>
    <h1>코어 작업장</h1>
    <div class="workshop-tabs" role="tablist">
      <button role="tab" data-workshop-tab="core">기본 구슬</button>
      <button role="tab" data-workshop-tab="fusion">융합 기록</button>
    </div>
  </header>
  <div class="workshop-layout">
    <div class="workshop-grid" data-workshop-grid></div>
    <aside class="workshop-detail" data-workshop-detail aria-live="polite"></aside>
  </div>
  <dialog class="workshop-sheet" data-workshop-sheet></dialog>
</section>
```

기본·융합 카드 HTML은 `renderWorkshop()` 내부의 두 배열 map을 재사용해 만든다. 별도 UI 프레임워크나 범용 컴포넌트 계층은 만들지 않는다. 카드에는 절차형 색·심볼 DOM 아이콘, 이름, 가격/해금 상태만 넣고 설명은 상세에만 넣는다.

- [ ] **Step 4: 선택·구매·탭 동작 연결**

```ts
const mobile = window.matchMedia('(max-width: 640px)');
const sheet = this.root.querySelector<HTMLDialogElement>('[data-workshop-sheet]')!;
let selectedCard: HTMLButtonElement | null = null;

card.addEventListener('click', () => {
  selectedCard = card;
  renderDetail(card.dataset.workshopKind!, card.dataset.workshopId!);
  if (mobile.matches) sheet.showModal();
});
sheet.addEventListener('close', () => selectedCard?.focus());
sheet.addEventListener('click', (event) => {
  if (event.target === sheet) sheet.close();
});
mobile.addEventListener('change', ({ matches }) => {
  if (!matches && sheet.open) sheet.close();
});
```

구매 버튼은 상세 내부에서 기존 `purchaseCore → save → renderWorkshop(message)` 흐름을 호출한다. 탭 변경은 grid 내용만 바꾸고 모바일 열린 dialog는 닫는다. 구매 실패는 기존 `role="status"`를 유지한다.

- [ ] **Step 5: 데스크톱 패널·모바일 하단 시트 CSS 작성**

```css
.workshop-screen { width: min(960px, 100%); max-height: 100%; overflow-y: auto; }
.workshop-layout { display: grid; grid-template-columns: minmax(0, 3fr) minmax(240px, 2fr); gap: 18px; }
.workshop-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.workshop-card { aspect-ratio: 1; min-width: 0; padding: 10px; }
.workshop-header { position: sticky; top: 0; z-index: 2; }

@media (max-width: 640px) {
  .workshop-layout { display: block; }
  .workshop-detail { display: none; }
  .workshop-sheet[open] {
    position: fixed;
    inset: auto 0 0;
    width: 100%;
    max-height: min(70vh, 560px);
    overflow-y: auto;
    margin: 0;
    border-radius: 20px 20px 0 0;
  }
}
```

`dialog::backdrop`으로 바깥 영역을 어둡게 한다. `#app-root`의 게임 화면 overflow 계약은 유지하고 `.workshop-screen`만 스크롤한다. 헤더·탭은 `position: sticky; top: 0`으로 둔다.

- [ ] **Step 6: 작업장 E2E 실행**

Run: `rtk npm run test:e2e -- e2e/meta-loop.spec.ts --grep workshop`

Expected: 데스크톱 3열+우측 상세, 모바일 3열+현재 뷰포트 하단 시트, Escape 포커스 복귀, 구매·돌아가기 PASS.

- [ ] **Step 7: 작업장 커밋**

```bash
rtk git add src/game/meta/AppController.ts src/styles.css e2e/meta-loop.spec.ts
rtk git commit -m "feat: rebuild the responsive workshop"
```

### Task 6: 통합 브라우저 검증과 기록

**Files:**
- Modify: `e2e/combat.spec.ts`
- Modify: `docs/TUNING.md`
- Modify: `docs/WORKLOG.md`

**Interfaces:**
- Consumes: 앞선 다섯 task의 개발 전용 debug API와 DOM data attribute.
- Produces: 2보스 전 주기, 구슬별 융합, 첫 XP, 통로, 작업장 모바일 흐름의 브라우저 회귀 계약.

- [ ] **Step 1: 전투 E2E에 핵심 통합 계약 추가**

```ts
test('@desktop keeps the unfused conduction orb and moving hive modules', async ({ page }) => {
  const { box } = await preparePhotonFusion(page);
  await choosePhotonFusionWithPointer(page, box, false);
  const fused = await snapshot(page);
  expect(fused.orbs.filter(({ coreType }) => coreType === 'conduction')).toHaveLength(1);
  expect(fused.orbs.filter(({ coreType }) => coreType === 'photon-orbit')).toHaveLength(1);
  const photon = fused.orbs.find(({ coreType }) => coreType === 'photon-orbit')!;
  const aim = clientPoint(box, { x: fused.player.x, y: fused.player.y - 100 });
  await page.mouse.move(aim.x, aim.y);
  await expect.poll(async () => (
    await snapshot(page)
  ).orbs.find(({ id }) => id === photon.id)?.state).toBe('active');

  await enterHiveByScore(page);
  const initial = (await snapshot(page)).boss.partPositions!;
  await sceneCall(page, (scene) => scene.debugAdvanceHiveCycle(1_000));
  const shielded = (await snapshot(page)).boss.partPositions!;
  expect(shielded.leftReflector.x).not.toBe(initial.leftReflector.x);
  expect(shielded.leftShooter).toEqual(initial.leftShooter);
  await sceneCall(page, (scene) => {
    scene.debugAdvanceHiveCycle(3_000);
    scene.debugAdvanceHiveCycle(1_500);
    scene.debugAdvanceHiveCycle(7_000);
  });
  const cycled = (await snapshot(page)).boss.partPositions!;
  expect(cycled.leftShooter).toEqual(initial.leftShooter);
  expect(cycled.rightShooter).toEqual(initial.rightShooter);

  await sceneCall(page, (scene, input) => {
    scene.debugPlaceOrb(input.orbId, {
      x: input.reflector.x + 28,
      y: input.reflector.y,
    });
    const sprite = scene.children.list.find(({ orbId }) => orbId === input.orbId)!;
    sprite.body!.setVelocity!(-200, 0);
  }, { orbId: photon.id, reflector: cycled.leftReflector });
  await expect.poll(async () => (
    await snapshot(page)
  ).orbs.find(({ id }) => id === photon.id)!.velocity.x).toBeGreaterThan(0);
});
```

기존 광자 빔 E2E는 `DevelopmentScene.children` 항목에 `getData?(key: string): unknown`을 추가하고 실제 빔의 `getData('sourceOrbId') === photon.id`를 검사한다.

편성 브라우저 표본은 기존 `debugRemoveEnemies`와 `debugAdvanceEncounter`만 사용한다.

```ts
test('@desktop emits a connected empty passage in a reinforcement', async ({ page }) => {
  await loadCanvas(page);
  await sceneCall(page, (scene) => {
    const ids = scene.getDebugSnapshot().enemies.map(({ id }) => id);
    scene.debugRemoveEnemies(ids);
    scene.debugAdvanceEncounter(9_000);
  });
  const enemies = (await snapshot(page)).enemies;
  expect(enemies.length).toBeGreaterThan(0);
  expect(hasConnectedEmptyPassage(enemies)).toBe(true);
});
```

`hasConnectedEmptyPassage()`는 다음 8열 BFS를 E2E 파일 안에 둔다. 결정적 seed 한 개만 브라우저에서 검사하고 다수 seed는 Task 3 단위 테스트가 담당한다.

```ts
function hasConnectedEmptyPassage(enemies: CombatSnapshot['enemies']): boolean {
  const footprints = enemies.flatMap(({ footprint }) => footprint ? [footprint] : []);
  const rows = Math.max(2, ...footprints.map(({ row, height }) => row + height));
  const occupied = new Set(footprints.flatMap(({ column, row, width, height }) => (
    Array.from({ length: width * height }, (_, index) => (
      `${row + Math.floor(index / width)}:${column + index % width}`
    ))
  )));
  const queue = Array.from({ length: 8 }, (_, column) => ({ row: rows - 1, column }))
    .filter(({ row, column }) => !occupied.has(`${row}:${column}`));
  const visited = new Set(queue.map(({ row, column }) => `${row}:${column}`));
  for (let index = 0; index < queue.length; index += 1) {
    const cell = queue[index]!;
    if (cell.row === 0) return true;
    for (const next of [
      { row: cell.row - 1, column: cell.column },
      { row: cell.row + 1, column: cell.column },
      { row: cell.row, column: cell.column - 1 },
      { row: cell.row, column: cell.column + 1 },
    ]) {
      const key = `${next.row}:${next.column}`;
      if (next.row < 0 || next.row >= rows || next.column < 0 || next.column >= 8
        || occupied.has(key) || visited.has(key)) continue;
      visited.add(key);
      queue.push(next);
    }
  }
  return false;
}
```

보조 피해 단독 처치는 이미 있는 부식 debug 진입점을 사용한다.

```ts
test('@desktop lets corrosion finish an enemy without another direct hit', async ({ page }) => {
  await loadCanvas(page);
  const enemyId = await sceneCall(page, (scene) => {
    scene.debugFreezeEnemies();
    const [target, ...others] = scene.getDebugSnapshot().enemies;
    scene.debugRemoveEnemies(others.map(({ id }) => id));
    scene.debugSetEnemy(target!.id, { x: 225, y: 320 }, 0.2);
    scene.debugShowCoreFeedback('corrosion', { x: 225, y: 320 });
    return target!.id;
  });
  await expect.poll(async () => (
    await snapshot(page)
  ).enemies.some(({ id }) => id === enemyId)).toBe(false);
  expect(await activeSceneNames(page)).toContain('secondary-damage-feedback');
});
```

- [ ] **Step 2: 전체 단위 테스트 실행**

Run: `rtk npm test`

Expected: 모든 Vitest 파일 PASS.

- [ ] **Step 3: 타입 검사와 프로덕션 빌드 실행**

Run: `rtk npm run build`

Expected: `tsc --noEmit`과 Vite build PASS. 기존 500KB 번들 경고만 허용한다.

- [ ] **Step 4: 전체 Chromium E2E 한 번 실행**

Run: `rtk npm run test:e2e`

Expected: desktop/mobile 전체 PASS. 자동화가 다루지 못한 플레이 감각은 수치 결함이 아니라 실제 플레이 조정 항목으로 기록한다.

- [ ] **Step 5: 튜닝 문서와 워크로그 갱신**

`docs/TUNING.md`에 `damagePerTickByLevel`, 융합 피해 배열, 피드백 상한, 첫 XP 위치를 추가한다. `docs/WORKLOG.md`에 다음 네 항목과 실제 테스트 개수를 기록한다.

```md
### 2026-08-10 — 스테이지 1~3 플레이 피드백 수정

#### 작업
- 구슬별 융합 효과 격리와 인게임 보상 정보 공개
- 2보스 구조물 영구 전개·전 페이즈 반사
- 예약 반사 통로와 첫 XP 5
- 보조 피해 상향과 반응형 작업장 A1
```

- [ ] **Step 6: 문서·E2E 커밋**

```bash
rtk git add e2e/combat.spec.ts docs/TUNING.md docs/WORKLOG.md
rtk git commit -m "test: cover playtest corrections"
```

- [ ] **Step 7: 최종 상태 확인**

Run: `rtk git status --short`

Expected: 출력 없음. 구현 브랜치는 merge/push 요청 전까지 보존한다.
