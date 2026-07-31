# Orb Supply Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace level-up-based extra orbs with stage-progress core supplies, preserve each physical orb as an independent levelled instance, and simplify reward selection for mobile.

**Architecture:** `EncounterDirector` owns deterministic stage-progress supply milestones and reports newly crossed milestones. `CombatScene` queues those rewards ahead of ordinary level-ups and reuses `OrbLoadoutOverlay` to add one Lv1 core. `OrbManager` remains the owner of physical permanent-orb instances; this phase records `level: 1` but deliberately postpones post-cap upgrades and fusion until the next plan.

**Tech Stack:** TypeScript 5.9, Phaser 3.90, Vitest 4.1, Playwright 1.61, Vite 8.1

## Global Constraints

- A run starts with exactly one permanent orb and supports at most six active permanent orbs.
- Stage 1 core-supply progress is exactly `[0.20, 0.55]`; Stage 2 is `[0.20, 0.45, 0.75]`.
- Stage 3 has no core-supply milestones in this foundation plan; capped-orb upgrades and fusion are implemented by the next plan.
- Every supplied basic orb is created at Lv1 and has its own `level` field.
- Core supply takes priority over a pending ordinary level-up.
- Closing one reward resumes at least `300ms` of gameplay before another queued reward opens.
- Ordinary level-up cards show only icon-equivalent numbering, name, and rank until selected.
- Player-facing reward copy must not contain `px`, `px/s`, engine search radii, or raw internal damage coefficients.
- Reuse `OrbLoadoutOverlay`; do not add a second core-selection overlay or a generic reward framework.
- Remove the ordinary ability `additional-core`; normal experience levels must no longer add physical orbs.
- Run all repository commands through `rtk`.
- Do not add dependencies.

---

### Task 1: Record Independent Orb Levels

**Files:**
- Modify: `src/game/orbs/OrbManager.ts`
- Modify: `src/game/orbs/OrbManager.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `e2e/combat.spec.ts`

**Interfaces:**
- Consumes: existing `OrbStore.addOrb(coreType)` and `OrbManager.getSnapshot()`
- Produces: `OrbSnapshot.level: number`; starting and newly supplied orbs both report `level: 1`

- [ ] **Step 1: Write failing store tests for independent Lv1 instances**

Add to `OrbManager.test.ts`:

```ts
it('stores an independent level on every permanent orb', () => {
  const store = new OrbStore(EXPERIMENT_DEFAULTS);

  expect(store.getSnapshot()).toMatchObject([
    { id: 0, coreType: 'echo', level: 1 },
  ]);

  expect(store.addOrb('conduction')).toBe(true);
  expect(store.addOrb('conduction')).toBe(true);
  expect(store.getSnapshot()).toMatchObject([
    { id: 0, coreType: 'echo', level: 1 },
    { id: 1, coreType: 'conduction', level: 1 },
    { id: 2, coreType: 'conduction', level: 1 },
  ]);
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```bash
rtk npm test -- src/game/orbs/OrbManager.test.ts
```

Expected: FAIL because `OrbSnapshot` does not contain `level`.

- [ ] **Step 3: Add the minimal level field**

In `OrbManager.ts`, extend the snapshot and initialize records:

```ts
export interface OrbSnapshot {
  id: number;
  coreType: OrbCoreId;
  level: number;
  coreState: OrbCoreState;
  // existing fields remain unchanged
}
```

```ts
private createRecord(id: number, coreType: OrbCoreId): OrbRecord {
  return {
    id,
    coreType,
    level: 1,
    coreState: createOrbCoreState(),
    // existing initialization remains unchanged
  };
}
```

Do not add `upgradeOrb()` yet. Until core effects receive approved Lv1–Lv5 behavior, no reward may change this value.

In `CombatScene.getDebugSnapshot()`, copy `level: orb.level` with the other orb snapshot fields. Extend the local `OrbSnapshot` interface in `e2e/combat.spec.ts` with `level: number`.

- [ ] **Step 4: Run orb tests**

Run:

```bash
rtk npm test -- src/game/orbs/OrbManager.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/game/orbs/OrbManager.ts src/game/orbs/OrbManager.test.ts src/game/scenes/CombatScene.ts e2e/combat.spec.ts
rtk git commit -m "feat: track permanent orb levels"
```

---

### Task 2: Emit Deterministic Stage Core Supplies

**Files:**
- Modify: `src/game/encounters/stageDefinitions.ts`
- Modify: `src/game/encounters/stageDefinitions.test.ts`
- Modify: `src/game/encounters/encounterProgressionRules.ts`
- Modify: `src/game/encounters/encounterProgressionRules.test.ts`
- Modify: `src/game/encounters/EncounterDirector.ts`
- Modify: `src/game/encounters/EncounterDirector.test.ts`

**Interfaces:**
- Consumes: `StageBossDefinition`, `EncounterDirector.update(deltaMs, enemyState)`
- Produces:
  - `StageDefinition.coreSupplyProgress: readonly number[]`
  - `stageProgress(entry, elapsedMs, score): number`
  - `coreSupplyCountAt(progress, milestones): number`
  - `EncounterUpdate.coreSuppliesDue: number`
  - `EncounterDirector.getSnapshot().coreSuppliesClaimed: number`

- [ ] **Step 1: Write failing pure progression tests**

Add to `encounterProgressionRules.test.ts`:

```ts
import {
  coreSupplyCountAt,
  stageProgress,
} from './encounterProgressionRules';

const boss = {
  kind: 'sentinel',
  minimumMs: 120_000,
  scoreTarget: 70,
  hardMaximumMs: 210_000,
  warningMs: 2_000,
} as const;

it('combines active play and hard-time fallback into stage progress', () => {
  expect(stageProgress(boss, 0, 0)).toBe(0);
  expect(stageProgress(boss, 60_000, 35)).toBeCloseTo(0.5);
  expect(stageProgress(boss, 105_000, 0)).toBeCloseTo(0.5);
  expect(stageProgress(boss, 120_000, 70)).toBe(1);
  expect(stageProgress(boss, 210_000, 0)).toBe(1);
});

it('counts every crossed core-supply milestone exactly once', () => {
  const milestones = [0.2, 0.55] as const;
  expect(coreSupplyCountAt(0.19, milestones)).toBe(0);
  expect(coreSupplyCountAt(0.2, milestones)).toBe(1);
  expect(coreSupplyCountAt(0.8, milestones)).toBe(2);
});
```

The progress formula is:

```ts
Math.min(
  1,
  Math.max(
    elapsedMs / entry.hardMaximumMs,
    Math.min(elapsedMs / entry.minimumMs, score / entry.scoreTarget),
  ),
)
```

- [ ] **Step 2: Run the pure test and verify failure**

Run:

```bash
rtk npm test -- src/game/encounters/encounterProgressionRules.test.ts
```

Expected: FAIL because both functions are missing.

- [ ] **Step 3: Implement and validate the pure rules**

Add to `encounterProgressionRules.ts`:

```ts
export function stageProgress(
  entry: StageBossDefinition,
  elapsedMs: number,
  score: number,
): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    throw new RangeError('elapsedMs must be finite and non-negative');
  }
  if (!Number.isFinite(score) || score < 0) {
    throw new RangeError('score must be finite and non-negative');
  }
  return Math.min(
    1,
    Math.max(
      elapsedMs / entry.hardMaximumMs,
      Math.min(elapsedMs / entry.minimumMs, score / entry.scoreTarget),
    ),
  );
}

export function coreSupplyCountAt(
  progress: number,
  milestones: readonly number[],
): number {
  if (!Number.isFinite(progress) || progress < 0 || progress > 1) {
    throw new RangeError('progress must be from 0 through 1');
  }
  return milestones.filter((milestone) => milestone <= progress).length;
}
```

The existing stage-content validator remains responsible for milestone values, so `coreSupplyCountAt` does not revalidate the array on every frame.

- [ ] **Step 4: Write failing stage-data tests**

In `stageDefinitions.test.ts`, assert:

```ts
expect(STAGES.map(({ coreSupplyProgress }) => coreSupplyProgress)).toEqual([
  [0.2, 0.55],
  [0.2, 0.45, 0.75],
  [],
]);

expect(STAGES.map(({ powerBand }) => powerBand.expectedOrbCount)).toEqual([3, 6, 6]);
```

Add invalid-content cases that expect `validateStageContent()` to reject:

```ts
{ ...STAGES[0], coreSupplyProgress: [0.55, 0.2] }
```

with `default-1 core supplies must be strictly increasing`, and:

```ts
{ ...STAGES[0], coreSupplyProgress: [0, 1] }
```

with `default-1 core supply progress must stay between 0 and 1`.

- [ ] **Step 5: Add stage data and validation**

Extend `StageDefinition`:

```ts
export interface StageDefinition {
  // existing fields
  coreSupplyProgress: readonly number[];
}
```

Set:

```ts
// default-1
coreSupplyProgress: [0.2, 0.55],

// default-2
coreSupplyProgress: [0.2, 0.45, 0.75],

// default-3
coreSupplyProgress: [],
```

Set `expectedOrbCount` to `3`, `6`, and `6`. In `validateStageContent`, require every milestone to be finite, greater than `0`, less than `1`, and strictly greater than the prior milestone.

- [ ] **Step 6: Write failing director tests**

Add to `EncounterDirector.test.ts`:

```ts
it('emits each stage core supply once when progress crosses its milestone', () => {
  const director = new EncounterDirector(1234);

  const first = director.update(42_000, clearTop);
  expect(first.coreSuppliesDue).toBe(1);
  expect(director.update(0, clearTop).coreSuppliesDue).toBe(0);

  const second = director.update(73_500, clearTop);
  expect(second.coreSuppliesDue).toBe(1);
  expect(director.getSnapshot().coreSuppliesClaimed).toBe(2);
});

it('reports every skipped milestone when a large update reaches the boss gate', () => {
  const director = new EncounterDirector(1234);
  for (let index = 0; index < STAGES[0].boss.scoreTarget; index += 1) {
    director.recordEnemyKill('basic');
  }

  const update = director.update(STAGES[0].boss.minimumMs, clearTop);
  expect(update.coreSuppliesDue).toBe(2);
  expect(update.transition?.type).toBe('bossWarningStarted');
});
```

Update existing exact `EncounterUpdate` expectations to include `coreSuppliesDue: 0`.

- [ ] **Step 7: Implement director supply emission**

Change:

```ts
export interface EncounterUpdate {
  formation: EnemySpec[] | null;
  transition: EncounterTransition | null;
  coreSuppliesDue: number;
}

const NO_UPDATE: EncounterUpdate = {
  formation: null,
  transition: null,
  coreSuppliesDue: 0,
};
```

Add:

```ts
private coreSuppliesClaimed = 0;
```

While state is `running`, after advancing `stageElapsedMs`, calculate:

```ts
const availableCoreSupplies = coreSupplyCountAt(
  stageProgress(stage.boss, this.stageElapsedMs, this.bossScore),
  stage.coreSupplyProgress,
);
const coreSuppliesDue = availableCoreSupplies - this.coreSuppliesClaimed;
this.coreSuppliesClaimed = availableCoreSupplies;
```

Carry `coreSuppliesDue` through the boss-warning, formation, and no-formation returns from that update. Reset `coreSuppliesClaimed = 0` in `resumeAfterBossReward()`. Include it in `getSnapshot()`.

- [ ] **Step 8: Run encounter tests**

Run:

```bash
rtk npm test -- src/game/encounters/encounterProgressionRules.test.ts src/game/encounters/stageDefinitions.test.ts src/game/encounters/EncounterDirector.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
rtk git add src/game/encounters
rtk git commit -m "feat: schedule stage core supplies"
```

---

### Task 3: Integrate Core Supplies and Remove Additional-Core

**Files:**
- Modify: `src/game/config/gameTuning.ts`
- Modify: `src/game/config/gameTuning.test.ts`
- Modify: `src/game/progression/progressionRules.ts`
- Modify: `src/game/progression/progressionRules.test.ts`
- Modify: `src/game/progression/BuildState.ts`
- Modify: `src/game/progression/BuildState.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `src/game/scenes/combatSceneRules.test.ts`
- Modify: `src/game/ui/LevelUpOverlay.ts`
- Modify: `e2e/combat.spec.ts`

**Interfaces:**
- Consumes: `EncounterUpdate.coreSuppliesDue`, `OrbLoadoutOverlay.showAdditional()`, `OrbManager.addOrb()`
- Produces:
  - `GAME_TUNING.rewardFlow.resumeGameplayMs = 300`
  - `CombatDebugSnapshot.pendingCoreSupplies: number`
  - core-supply-first pending reward flow
  - ordinary ability registry without `additional-core`

- [ ] **Step 1: Write failing registry and BuildState tests**

Update `progressionRules.test.ts`:

```ts
it('keeps physical orb acquisition outside ordinary abilities', () => {
  expect(ABILITY_IDS).not.toContain('additional-core');
  expect(MAX_BUILD_LEVEL).toBe(73);
  expect(selectAbilityOptions(
    createEmptyAbilityRanks(),
    0,
    123,
    { coreTypes: ['echo'] },
  )).toHaveLength(3);
});
```

Delete tests for first-level guaranteed `additional-core`, shortage weighting, and orb-count exclusion.

Update `BuildState.test.ts` so the basic-growth test no longer supplies `additional-core` and no longer calls `orbLimit()`.

- [ ] **Step 2: Run focused tests and verify failure**

Run:

```bash
rtk npm test -- src/game/progression/progressionRules.test.ts src/game/progression/BuildState.test.ts
```

Expected: FAIL while `additional-core` remains registered.

- [ ] **Step 3: Remove the obsolete ability path**

In `progressionRules.ts`:

- Delete the `additional-core` definition.
- Remove `orbCount` and `expectedOrbCount` from `AbilityEligibilityContext`.
- Delete special relevance, first-choice guarantee, and shortage weighting for `additional-core`.
- Keep deterministic shuffling and every other ability unchanged.

In `BuildState.ts`, delete:

```ts
orbLimit(baseLimit: number): number
```

In `LevelUpOverlay.ts`, delete its `additional-core` detail case and the unused `STARTING_ORB_COUNT` import.

In `CombatScene.ts`, replace the runtime limit callback with:

```ts
getOrbLimit: () => GAME_TUNING.build.basicGrowth.maximumOrbs,
```

Delete the `chooseAbility()` branch that opened `OrbLoadoutOverlay` for `additional-core`. Every ordinary ability now finishes through `completeAbilityChoice()`.

Also reduce the `ProgressionManager` eligibility callback in `CombatScene.create()` to:

```ts
() => ({
  coreTypes: this.orbManager?.getSnapshot().map(({ coreType }) => coreType) ?? [],
})
```

- [ ] **Step 4: Add the centralized reward-resume value**

Extend the `GameTuning` type and `GAME_TUNING` value:

```ts
rewardFlow: {
  resumeGameplayMs: number;
};
```

```ts
rewardFlow: {
  resumeGameplayMs: 300,
},
```

Add validation coverage in `gameTuning.test.ts` that `resumeGameplayMs` must be finite and non-negative, matching existing tuning validation style.

- [ ] **Step 5: Add failing CombatScene integration expectations**

Extend `CombatDebugSnapshot` and the E2E-local snapshot type:

```ts
pendingCoreSupplies: number;
```

In `combatSceneRules.test.ts`, keep the existing `shouldFinalizeBossReward` truth table but rename the third conceptual input from “level-up visible” to “run reward pending”. Its behavior remains:

```ts
expect(shouldFinalizeBossReward(true, false, true)).toBe(false);
expect(shouldFinalizeBossReward(true, false, false)).toBe(true);
```

This prevents a boss reward from skipping a queued core supply or level-up even while its overlay is between screens.

- [ ] **Step 6: Implement the core-supply-first reward queue in CombatScene**

Add fields:

```ts
private pendingCoreSupplies = 0;
private nextRunRewardAtMs = 0;
```

Reset both in `create()` and expose `pendingCoreSupplies` in `getDebugSnapshot()`.

In `advanceEncounter()`:

```ts
const { formation, transition, coreSuppliesDue } =
  this.encounterDirector.update(deltaMs, encounterState);
this.pendingCoreSupplies += coreSuppliesDue;
```

Change `handleEnemyKilled()` to gain XP and update the HUD without immediately opening a level-up.

At the end of the unpaused `update()` frame, after `advanceEncounter(gameplayDelta)`, call:

```ts
this.openPendingRunReward();
```

Implement:

```ts
private openPendingRunReward(): void {
  if (
    this.defeated
    || this.pause.isPaused()
    || this.gameplayElapsedMs < this.nextRunRewardAtMs
  ) return;

  if (this.pendingCoreSupplies > 0) {
    this.pause.add('loadout');
    this.syncPauseState();
    this.orbLoadoutOverlay?.showAdditional(ORB_CORE_IDS, (type) => {
      if (!this.orbManager?.addOrb(type)) return false;
      this.pendingCoreSupplies -= 1;
      this.pause.remove('loadout');
      this.nextRunRewardAtMs =
        this.gameplayElapsedMs + GAME_TUNING.rewardFlow.resumeGameplayMs;
      this.syncPauseState();
      return true;
    });
    return;
  }

  this.openNextLevelUp();
}
```

All in-run core types are passed through `ORB_CORE_IDS`, not `runConfig.unlockedCoreTypes`; meta unlock controls the starting core only.

Change `completeAbilityChoice()` so every chosen level-up:

1. hides `LevelUpOverlay`;
2. removes the `levelUp` pause;
3. sets `nextRunRewardAtMs = gameplayElapsedMs + 300ms`;
4. resumes gameplay even when another level-up is pending.

The next queued level-up opens from `openPendingRunReward()` after gameplay advances by 300ms.

For boss finalization, calculate:

```ts
const hasPendingRunReward =
  this.pendingCoreSupplies > 0
  || (this.progression?.getSnapshot().pendingChoices ?? 0) > 0
  || (this.levelUpOverlay?.isVisible() ?? false)
  || (this.orbLoadoutOverlay?.isVisible() ?? false);
```

Pass `hasPendingRunReward` as the third argument to `shouldFinalizeBossReward`.

Keep `debugGrantXp()` useful by calling `openPendingRunReward()` after granting XP. Add a development-only `debugGrantCoreSupply()` that only increments `pendingCoreSupplies`; expose it only in DEV and clear it during shutdown. This lets a test queue a core supply, then grant XP and verify that `openPendingRunReward()` chooses the core supply first.

Extend the development-only encounter jump to:

```ts
debugAdvanceEncounter(deltaMs: number, resolveCoreSupplies = true): void
```

After `advanceEncounter(deltaMs)`, its default test-setup behavior repeatedly adds an `echo` orb and decrements `pendingCoreSupplies` until the queue is empty. Throw if a pending supply cannot add an orb before the six-orb cap. Existing boss and formation E2E setup calls therefore stay fast and do not stop at five new reward screens. A core-supply E2E passes `false`; the next real update frame then opens the actual selection overlay.

- [ ] **Step 7: Update unit and existing E2E contracts**

In `e2e/combat.spec.ts`:

- Add `debugGrantCoreSupply(): void` to `DevelopmentScene`.
- Change `debugAdvanceEncounter(deltaMs)` to `debugAdvanceEncounter(deltaMs, resolveCoreSupplies?: boolean)`.
- Replace the old mobile test that expected `['additional-core']` with an ordinary level-up assertion.
- Remove `confirmAdditionalCore()` if no remaining caller uses it.
- Assert a debug-granted core supply pauses with `loadoutVisible`, selecting a core creates a second orb with `level: 1`, and gameplay resumes.

Do not run Playwright yet; this task ends with unit/build validation only.

- [ ] **Step 8: Run unit tests and build**

Run:

```bash
rtk npm test
rtk npm run build
```

Expected: all unit tests pass and production build succeeds. The existing Vite chunk-size warning is allowed.

- [ ] **Step 9: Commit**

```bash
rtk git add src e2e/combat.spec.ts
rtk git commit -m "feat: move orb acquisition to core supplies"
```

---

### Task 4: Simplify Reward Cards and Add Explicit Confirmation

**Files:**
- Modify: `src/game/ui/LevelUpOverlay.ts`
- Modify: `src/game/ui/LevelUpOverlay.test.ts`
- Modify: `src/game/ui/OrbLoadoutOverlay.ts`
- Modify: `src/game/ui/OrbLoadoutOverlay.test.ts`
- Modify: `e2e/combat.spec.ts`

**Interfaces:**
- Consumes: existing `ABILITY_DEFINITIONS`, `BuildState`, `CORE_COPY`
- Produces:
  - level-up first tap selects without acquiring
  - `Enter` or the visible `획득` button confirms
  - core cards show names only; selected core detail appears below

- [ ] **Step 1: Rewrite LevelUpOverlay tests first**

Replace immediate-selection assertions with:

```ts
it('shows compact cards and confirms only after a selected card', () => {
  const { scene, objects, keys } = makeScene();
  const overlay = new LevelUpOverlay(scene as never);
  const onSelect = vi.fn();

  overlay.show(['firepower', 'explosion', 'split'], new BuildState(), onSelect);

  const cards = objects.filter(
    (object) => object.kind === 'rectangle' && object.width === 360,
  );
  expect(objects.flatMap(({ text }) => text ?? []).join(' ')).not.toContain('px');

  cards[1]!.emit('pointerup');
  expect(onSelect).not.toHaveBeenCalled();
  expect(objects.some(({ text }) => text?.includes('직격 시 20% 확률로 충격 폭발')))
    .toBe(true);

  keys.get(13)!.emit('down');
  expect(onSelect).toHaveBeenCalledOnce();
  expect(onSelect).toHaveBeenCalledWith('explosion');
});
```

Add:

```ts
it('does not render a detail panel before selection', () => {
  const { scene, objects } = makeScene();
  const overlay = new LevelUpOverlay(scene as never);
  overlay.show(['kinetic'], new BuildState(), vi.fn());

  expect(objects.some(({ text }) => text === '획득')).toBe(false);
  expect(objects.flatMap(({ text }) => text ?? []).join(' ')).not.toContain('px/s');
});
```

Update the fake Phaser object only with methods actually required by the implementation, such as `setFillStyle()` if card highlighting uses it.

- [ ] **Step 2: Run overlay tests and verify failure**

Run:

```bash
rtk npm test -- src/game/ui/LevelUpOverlay.test.ts
```

Expected: FAIL because pointer selection still immediately invokes `onSelect`.

- [ ] **Step 3: Implement two-step LevelUpOverlay**

Use:

```ts
const CARD_Y = [210, 310, 410] as const;
const DETAIL_Y = 545;
const CONFIRM_Y = 625;
```

Store:

```ts
private selected?: AbilityId;
private onSelect?: (id: AbilityId) => void;
```

Card pointer and number keys call `focus(id)`. `focus()` updates the selected card color, creates or replaces the detail objects, and adds the `획득` button. `confirm()` invokes the callback once only when `selected` exists.

The visible card label is exactly:

```ts
`${index + 1}. ${ABILITY_DEFINITIONS[id].label}  ${rank} → ${rank + 1}`
```

Bind `Enter` to `confirm()`. Calling `hide()` removes all pointer and keyboard callbacks, resets `selected`, and prevents stale confirmation.

Keep existing `nextEffect()` calculations but replace player-facing internal-unit cases with:

```ts
case 'kinetic':
  return `구슬 속도 ${next.rank(id) * 7}% 증가`;
case 'explosion':
  return '직격 시 20% 확률로 충격 폭발';
case 'split':
  return `직격 시 25% 확률로 임시 구슬 ${next.split()!.count}개 생성`;
case 'core-expansion':
  return `구슬 크기 ${next.rank(id) * 8}% 증가`;
case 'recovery-field':
  return '근접 회수 범위 증가';
case 'mobility-motor':
  return `이동 속도 ${next.rank(id) * 8}% 증가`;
case 'near-amplification':
  return `가까운 적 직접 피해 ${next.rank(id) * 15}% 증가`;
case 'tracking-magnet':
  return '첫 직격 후 잠시 회수 범위 증가';
case 'high-speed-impact':
  return `고속 직격 ${next.highSpeedImpact()!.hitsRequired}회마다 충격파`;
case 'horizontal-cutter':
  return '직격 시 15% 확률로 수평 레이저';
case 'vertical-cutter':
  return '직격 시 15% 확률로 수직 레이저';
case 'destruction-reaction':
  return '직접 처치 시 25% 확률로 폭발';
case 'recovery-shockwave':
  return `근접 회수 ${next.recoveryShockwave()!.recoveriesRequired}회마다 충격파`;
```

Keep existing percentage, duration, count, and meaningful hit-counter copy for every other case.

- [ ] **Step 4: Simplify OrbLoadoutOverlay tests**

Change the core overlay expectation so unselected cards contain only number and core name. After tapping `전도`, assert:

```ts
expect(objects.some(({ text }) => text === '전도')).toBe(true);
expect(objects.some(({ text }) => text?.includes('4회 직격마다 주변 연쇄 피해')))
  .toBe(true);
```

Confirm still calls `onConfirm('conduction')` once. Before selection, the effect description must not exist.

- [ ] **Step 5: Move core descriptions into the selected detail area**

In `OrbLoadoutOverlay.ts`:

- Render card text as `${index + 1}. ${copy.label}` only.
- Selecting a card resets the one-slot selection, stores that core, and shows `copy.effect` below the cards.
- Keep the existing explicit `확정` button.
- Remove the visible `선택 0/1` implementation detail.
- Remove `다시 선택`; every current picker has capacity one, and tapping another card replaces the prior selection by calling `selection.reset()` before `selection.add(type)`.

Do not create a shared base overlay class.

- [ ] **Step 6: Update mobile E2E coordinates**

In the ordinary level-up mobile test:

1. tap the first card at canvas coordinates `{ x: 225, y: 210 }`;
2. assert combat remains paused and the ability rank is unchanged;
3. tap `획득` at `{ x: 225, y: 625 }`;
4. assert the selected rank increments and combat resumes.

In the core-supply test, keep the existing core-card and `확정` coordinates produced by `OrbLoadoutOverlay`.

- [ ] **Step 7: Run UI unit tests**

Run:

```bash
rtk npm test -- src/game/ui/LevelUpOverlay.test.ts src/game/ui/OrbLoadoutOverlay.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
rtk git add src/game/ui e2e/combat.spec.ts
rtk git commit -m "feat: simplify reward selection"
```

---

### Task 5: Verify the Foundation as One Playable Slice

**Files:**
- Modify: `e2e/combat.spec.ts`
- Modify: `docs/WORKLOG.md`

**Interfaces:**
- Consumes: all interfaces produced by Tasks 1–4
- Produces: deterministic browser coverage for supply priority, milestone counts, mobile confirmation, and a recorded worklog result

- [ ] **Step 1: Add a milestone E2E test**

Add a desktop test that uses `debugAdvanceEncounter()` and the debug snapshot:

```ts
test('@desktop grants two stage-one core supplies before the first boss', async ({ page }) => {
  await page.clock.install();
  await loadCanvas(page);

  await sceneCall(page, (scene) => scene.debugAdvanceEncounter(42_000, false));
  await expect.poll(async () => (await snapshot(page)).loadoutVisible).toBe(true);
  await chooseFirstCoreSupply(page);

  expect((await snapshot(page)).orbs).toHaveLength(2);

  await page.clock.runFor(320);
  await sceneCall(page, (scene) => scene.debugAdvanceEncounter(73_500, false));
  await expect.poll(async () => (await snapshot(page)).loadoutVisible).toBe(true);
  await chooseFirstCoreSupply(page);

  const current = await snapshot(page);
  expect(current.orbs).toHaveLength(3);
  expect(current.orbs.every(({ level }) => level === 1)).toBe(true);
  expect(current.encounter.state).toBe('running');
});
```

Implement `chooseFirstCoreSupply(page)` with the current canvas-coordinate helper: tap the first visible core card, then the overlay `확정` button.

- [ ] **Step 2: Add reward-priority coverage**

Call `debugGrantCoreSupply()` first, then call `debugGrantXp(8)`. The XP call invokes `openPendingRunReward()` while both rewards are pending. Assert:

1. `loadoutVisible === true`;
2. `levelUpVisible === false`;
3. after choosing a core, both overlays remain hidden while gameplay advances for less than 300ms;
4. after gameplay advances beyond 300ms, `levelUpVisible === true`.

This test must inspect game state, not sleep on wall-clock time; use `page.clock.runFor()` and polling.

- [ ] **Step 3: Run only the two affected browser projects**

Run:

```bash
rtk npm run test:e2e -- --project=desktop-chromium --grep "core suppl|reward priority"
rtk npm run test:e2e -- --project=mobile-chromium --grep "visible level-up card"
```

Expected: focused desktop and mobile tests pass.

- [ ] **Step 4: Run final regression once**

Run:

```bash
rtk npm test
rtk npm run build
rtk npm run test:e2e
```

Expected:

- all Vitest tests pass;
- TypeScript strict check and Vite production build pass;
- desktop and mobile Playwright suites pass;
- only the existing Vite chunk-size warning may remain.

- [ ] **Step 5: Append the worklog**

Add a `2026-07-31 — 진행도 기반 핵 보급 기반 구현` entry to `docs/WORKLOG.md` recording:

- permanent orb snapshots now include independent Lv1 data;
- `additional-core` was removed from normal level-ups;
- Stage 1 supplies two orbs and Stage 2 supplies three;
- core supply takes priority over level-up with a 300ms gameplay gap;
- level-up and core cards now reveal concise detail after selection;
- exact Vitest, build, desktop E2E, and mobile E2E results from Step 4;
- post-cap orb upgrades, six completed core behaviors, fusion, and discovery remain for later plans.

- [ ] **Step 6: Commit**

```bash
rtk git add e2e/combat.spec.ts docs/WORKLOG.md
rtk git commit -m "test: verify core supply foundation"
```

---

## Deferred to the Next Plans

- Basic-orb Lv2–Lv5 combat behavior and selecting one duplicate orb to upgrade
- New basic types `split` and `explosion`
- Fusion inventory removal and stable IDs after consuming material orbs
- First fusion vertical slice: 광자 궤도, 공명 군체, 나노 증식체
- Remaining six fusion orbs
- `???` discovery, codex persistence, and starting-core unlock prices
- First-boss 45–60 second balance pass

The foundation intentionally leaves Stage 3 without core supplies so it never offers a level increase before level-dependent combat behavior exists.
