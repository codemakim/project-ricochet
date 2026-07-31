# Mixed Orb Level Progression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the separate stage core-supply flow with one XP level-up reward pool that mixes abilities, concrete Lv1 orb additions, and exact physical-orb upgrades, while completing six permanent core types through Lv5.

**Architecture:** Keep `ProgressionManager` as the single pending level-up owner, add one pure mixed-reward selector beside the existing ability rules, and let `CombatScene` mutate `OrbStore` only after validating the selected tagged choice. Keep core calculations in `orbCoreRules`, reuse existing temporary-orb, corrosion-field, laser, shockwave, and damage paths, and keep all balance values in `GAME_TUNING.orbCores`. Do not add a generic effect engine, strategy classes, JSON loading, fusion placeholders, or new dependencies.

**Tech Stack:** TypeScript 5.9, Phaser 3.90, Vitest 4.1, Playwright 1.61, Vite 8.1.

## Global Constraints

- Prefix every repository command with `rtk`.
- Use test-first RED/GREEN for every behavior task.
- Run focused Vitest files during implementation; run the full browser suite only in Task 10.
- General abilities and orb rewards share the same XP level-up and the same pause.
- `RunRewardChoice` has only `ability`, `orb-add`, and `orb-upgrade`; fusion is not part of this plan.
- Permanent orb capacity remains six and every physical orb has its own Lv1~Lv5.
- Adding an already-owned core type creates another physical Lv1 orb.
- Upgrading changes only the selected physical orb and preserves its flight/collision state.
- No duplicate core type may appear twice on one reward screen.
- Failed add/upgrade validation never consumes the pending level-up.
- Dedicated split/explosion cores and the generic split/explosion abilities produce one merged proc roll, never two independent rolls.
- `GAME_TUNING.orbCores` owns every probability, coefficient, count, duration, runtime cap, and level array. The shared core catalog owns the structural Lv5 maximum.
- Player-facing UI contains names and short effects, not pixels, raw coefficients, or implementation terms.
- Preserve `GAME_TUNING.rewardFlow.resumeGameplayMs` as the only post-reward resume delay.
- Keep `powerBand.expectedOrbCount` as encounter difficulty metadata; it does not grant or guarantee orbs.
- Preserve current workshop behavior for all six core IDs. Discovery masking and fusion remain separate work.

---

### Task 1: Centralize the six-core catalog and tuning

**Files:**
- Modify: `src/game/orbs/orbCoreRules.ts`
- Modify: `src/game/orbs/orbCoreRules.test.ts`
- Modify: `src/game/config/gameTuning.ts`
- Modify: `src/game/config/gameTuning.test.ts`
- Modify: `src/game/meta/metaTuning.ts`
- Modify: `src/game/meta/metaProgress.test.ts`
- Modify: `src/game/meta/AppController.ts`
- Modify: `src/game/ui/OrbLoadoutOverlay.ts`
- Modify: `src/game/ui/OrbLoadoutOverlay.test.ts`

**Interfaces:**

```ts
export const ORB_CORE_IDS = [
  'echo',
  'corrosion',
  'conduction',
  'inertia',
  'split',
  'explosion',
] as const;

export type OrbCoreId = typeof ORB_CORE_IDS[number];

export const ORB_CORE_DEFINITIONS: Record<OrbCoreId, {
  label: string;
  summary: string;
  color: number;
  maximumLevel: 5;
}>;
```

- [ ] **Step 1: Add failing catalog and tuning validation tests**

In `orbCoreRules.test.ts`, prove:

```ts
expect(ORB_CORE_IDS).toEqual([
  'echo', 'corrosion', 'conduction', 'inertia', 'split', 'explosion',
]);
expect(Object.keys(ORB_CORE_DEFINITIONS)).toEqual(ORB_CORE_IDS);
for (const id of ORB_CORE_IDS) {
  expect(ORB_CORE_DEFINITIONS[id].maximumLevel).toBe(5);
}
```

In `gameTuning.test.ts`, recursively assert that every `byLevel` array under `orbCores` has exactly five finite values. Also prove probability arrays stay within `[0, 1]`, counts are non-negative integers, and durations/radii are non-negative.

In `metaProgress.test.ts`, prove the current purchase flow can unlock all five cores after the default `echo` without reading past `META_TUNING.corePrices`.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
rtk npm test -- src/game/orbs/orbCoreRules.test.ts src/game/config/gameTuning.test.ts src/game/meta/metaProgress.test.ts src/game/ui/OrbLoadoutOverlay.test.ts
```

Expected: FAIL because `split`, `explosion`, the shared catalog, five-level tuning, and five unlock prices do not exist.

- [ ] **Step 3: Add the shared catalog and initial centralized values**

Keep descriptions concise:

```ts
echo:       { label: '반향 구슬', summary: '벽 반사 공명을 다음 직격에 방출', ... },
corrosion:  { label: '부식 구슬', summary: '충돌 지점에 지속 피해 영역 생성', ... },
conduction: { label: '전도 구슬', summary: '직격 에너지를 가까운 적에게 전달', ... },
inertia:    { label: '관성 구슬', summary: '빠를수록 강해지는 정밀 직격', ... },
split:      { label: '분열 구슬', summary: '확률로 임시 구슬을 산개', ... },
explosion:  { label: '폭발 구슬', summary: '실패할수록 강해지는 충격 폭발', ... },
```

Use these initial tuning values. They are playtest baselines, not scattered defaults:

```ts
orbCores: {
  echo: {
    maxStacksByLevel: [5, 7, 7, 9, 9],
    damageBonusPerStackByLevel: [0.08, 0.1, 0.1, 0.12, 0.12],
    shockwave: { fromLevel: 3, radius: 44, damage: 0.5 },
    cutter: { fromLevel: 4, chance: 0.1, damage: 0.45, thickness: 10, cooldownMs: 120 },
    replay: { fromLevel: 5, damage: 0.65, thickness: 12 },
  },
  corrosion: {
    chanceByLevel: [0.15, 0.18, 0.18, 0.22, 0.22],
    radiusByLevel: [42, 50, 50, 58, 58],
    durationMsByLevel: [2500, 3000, 3000, 3500, 3500],
    tickMs: 500,
    damagePerTick: 0.2,
    fieldLimit: 2,
    attachedFromLevel: 3,
    vulnerability: { fromLevel: 4, damageBonusPerStack: 0.05, maximumStacks: 3 },
    deathSpread: { fromLevel: 5, radius: 32, durationMs: 1500, damagePerTick: 0.15 },
  },
  conduction: {
    targetCountByLevel: [1, 2, 2, 3, 3],
    radiusByLevel: [120, 150, 150, 180, 180],
    directDamageByLevel: [0.25, 0.3, 0.3, 0.35, 0.35],
    flight: {
      fromLevel: 3,
      targetCountByLevel: [0, 0, 1, 2, 2],
      tickMsByLevel: [0, 0, 600, 400, 400],
      damageByLevel: [0, 0, 0.08, 0.1, 0.1],
    },
    overcharge: { fromLevel: 5, damage: 0.35 },
  },
  inertia: {
    baseSpeedMultiplierByLevel: [1, 1.08, 1.08, 1.15, 1.15],
    damagePerSpeedStepByLevel: [0.04, 0.05, 0.05, 0.06, 0.06],
    maximumDamageBonusByLevel: [0.24, 0.32, 0.32, 0.42, 0.42],
    speedStep: 0.1,
    shockwave: { fromLevel: 3, radius: 42, damage: 0.5 },
    topSpeedHold: { fromLevel: 4, durationMs: 800 },
    pierce: { fromLevel: 5, enemyCount: 1, explosionRadius: 40, explosionDamage: 0.6 },
  },
  split: {
    chanceByLevel: [0.22, 0.3, 0.3, 0.35, 0.35],
    countByLevel: [2, 2, 2, 3, 3],
    extraBouncesByLevel: [0, 0, 1, 1, 1],
    lifetimeMsByLevel: [1500, 1500, 1500, 1900, 1900],
    inheritedEffects: { fromLevel: 5, outputScale: 0.35 },
    genericSynergy: { chanceBonus: 0.08, countBonus: 1 },
  },
  explosion: {
    chanceByLevel: [0.2, 0.2, 0.2, 0.2, 0.2],
    damageByLevel: [0.45, 0.6, 0.6, 0.75, 0.75],
    radiusByLevel: [48, 48, 48, 58, 58],
    pity: { fromLevel: 3, chancePerFailure: 0.05, maximumFailures: 4 },
    centerBlast: { fromLevel: 5, radius: 24, damageMultiplier: 2 },
    genericSynergy: { chanceBonus: 0.08, damageMultiplier: 1.2 },
  },
}
```

Add a small validator beside the existing tuning validation. Reuse its numeric helpers. Do not build a schema library.

- [ ] **Step 4: Remove duplicate UI/meta copies**

Delete `CORE_NAMES` from `AppController` and `CORE_COPY` from `OrbLoadoutOverlay`. Read label and summary from `ORB_CORE_DEFINITIONS`.

Extend:

```ts
corePrices: [40, 100, 160, 220, 280] as const
```

This only keeps the existing visible workshop flow functional for six IDs. Do not add `???`, discovery state, or a new unlock system.

- [ ] **Step 5: Verify GREEN and typecheck**

Run:

```bash
rtk npm test -- src/game/orbs/orbCoreRules.test.ts src/game/config/gameTuning.test.ts src/game/meta/metaProgress.test.ts src/game/ui/OrbLoadoutOverlay.test.ts
rtk npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
rtk git add src/game/orbs/orbCoreRules.ts src/game/orbs/orbCoreRules.test.ts src/game/config/gameTuning.ts src/game/config/gameTuning.test.ts src/game/meta/metaTuning.ts src/game/meta/metaProgress.test.ts src/game/meta/AppController.ts src/game/ui/OrbLoadoutOverlay.ts src/game/ui/OrbLoadoutOverlay.test.ts
rtk git commit -m "feat: centralize six orb core definitions"
```

---

### Task 2: Upgrade one physical orb safely

**Files:**
- Modify: `src/game/orbs/OrbManager.ts`
- Modify: `src/game/orbs/OrbManager.test.ts`

**Interfaces:**

```ts
upgradeOrb(id: number, expectedCoreType?: OrbCoreId): boolean
```

- [ ] **Step 1: Add failing physical-instance tests**

Create two same-type orbs, then prove:

```ts
expect(store.upgradeOrb(second.id, 'conduction')).toBe(true);
expect(store.getSnapshot().map(({ level }) => level)).toEqual([1, 2]);
```

Also prove:

- unknown ID returns `false`;
- a mismatched `expectedCoreType` returns `false`;
- Lv5 returns `false`;
- a successful upgrade changes only `level`;
- active `state`, `position`, `velocity`, `charges`, and collision flags remain unchanged;
- `addOrb('conduction')` still creates Lv1 after another conduction orb reaches Lv4.

- [ ] **Step 2: Run the test and verify RED**

```bash
rtk npm test -- src/game/orbs/OrbManager.test.ts
```

Expected: FAIL because `upgradeOrb` does not exist.

- [ ] **Step 3: Implement the minimum mutation**

Use `records.find`, validate the optional type and
`ORB_CORE_DEFINITIONS[record.coreType].maximumLevel`, increment only
`record.level`, and return a boolean. Do not reset `coreState` or
enqueue/relaunch the orb.

- [ ] **Step 4: Verify GREEN**

```bash
rtk npm test -- src/game/orbs/OrbManager.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/game/orbs/OrbManager.ts src/game/orbs/OrbManager.test.ts
rtk git commit -m "feat: upgrade individual permanent orbs"
```

---

### Task 3: Select deterministic mixed level-up rewards

**Files:**
- Create: `src/game/progression/runRewardRules.ts`
- Create: `src/game/progression/runRewardRules.test.ts`
- Modify: `src/game/config/gameTuning.ts`
- Modify: `src/game/config/gameTuning.test.ts`

**Interfaces:**

```ts
export type RunRewardChoice =
  | { kind: 'ability'; id: AbilityId }
  | { kind: 'orb-add'; coreType: OrbCoreId }
  | { kind: 'orb-upgrade'; coreType: OrbCoreId };

export interface RunRewardContext {
  readonly orbs: readonly Pick<OrbSnapshot, 'coreType' | 'level'>[];
  readonly abilityRanks: Readonly<Record<AbilityId, number>>;
  readonly abilityEligibility: AbilityEligibilityContext;
}

export function selectRunRewardOptions(
  context: RunRewardContext,
  choiceLevel: number,
  seed: number,
): RunRewardChoice[];

export function runRewardChoiceKey(choice: RunRewardChoice): string;
```

- [ ] **Step 1: Add failing ratio and edge-case tests**

Use fixed seeds and assert:

- 1 and 2 orbs: two different `orb-add` core types plus one ability;
- 3, 4, and 5 orbs: one `orb-add` plus two abilities;
- 6 orbs: no `orb-add`, up to two different `orb-upgrade` types, and at least one ability;
- an already-owned type may be offered as `orb-add`;
- a core type appears at most once per screen;
- a type whose physical instances are all Lv5 is not offered for upgrade;
- all six Lv5 orbs produce ability-only choices;
- capped/ineligible abilities are filtered;
- two calls with identical context, level, and seed return identical choices;
- candidate shortage returns one or two valid cards instead of inventing duplicates.

- [ ] **Step 2: Run the test and verify RED**

```bash
rtk npm test -- src/game/progression/runRewardRules.test.ts src/game/config/gameTuning.test.ts
```

Expected: FAIL because mixed reward rules and reward-flow counts do not exist.

- [ ] **Step 3: Add centralized card counts**

Under `GAME_TUNING.rewardFlow` add:

```ts
mixedCards: {
  maximumCards: 3,
  early: { maximumOrbs: 2, orbCards: 2, abilityCards: 1 },
  growing: { maximumOrbs: 5, orbCards: 1, abilityCards: 2 },
  full: { orbUpgradeCards: 2, minimumAbilityCards: 1 },
}
```

Validate counts as non-negative integers and ensure each row totals at most `maximumCards`.

- [ ] **Step 4: Implement one pure selector**

Reuse `eligibleAbilityIds` and the existing seeded ordering logic from `selectAbilityOptions`; extract only the smallest shared seeded-index helper if duplication would otherwise diverge. Do not introduce a random-service class.

Build candidate lists, deterministically rotate/shuffle them from `seed + choiceLevel`, take the configured counts, concatenate, then apply a final deterministic order. Track used `coreType` values so add/upgrade cards never duplicate a type on the same screen.

- [ ] **Step 5: Verify GREEN**

```bash
rtk npm test -- src/game/progression/runRewardRules.test.ts src/game/config/gameTuning.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
rtk git add src/game/progression/runRewardRules.ts src/game/progression/runRewardRules.test.ts src/game/config/gameTuning.ts src/game/config/gameTuning.test.ts
rtk git commit -m "feat: select mixed level up rewards"
```

---

### Task 4: Make `ProgressionManager` own tagged rewards

**Files:**
- Modify: `src/game/progression/ProgressionManager.ts`
- Modify: `src/game/progression/ProgressionManager.test.ts`
- Modify: `src/game/scenes/combatSceneRules.ts`
- Modify: `src/game/scenes/combatSceneRules.test.ts`

**Interfaces:**

```ts
export interface ProgressionContext extends AbilityEligibilityContext {
  readonly orbs: readonly Pick<OrbSnapshot, 'coreType' | 'level'>[];
}

export interface ProgressionSnapshot {
  // existing fields
  choices: RunRewardChoice[];
}

canChoose(choice: RunRewardChoice): boolean;
consume(choice: RunRewardChoice): boolean;
```

- [ ] **Step 1: Add failing manager tests**

Prove:

- a generated snapshot contains tagged choices;
- `consume({ kind: 'ability', ... })` upgrades the `BuildState` and removes one pending level;
- `consume({ kind: 'orb-add', ... })` and `consume({ kind: 'orb-upgrade', ... })` only consume after the caller has successfully mutated `OrbStore`;
- a stale/non-current choice returns `false`;
- choice comparison is structural via `runRewardChoiceKey`, not object identity;
- build completion does not clear pending rewards while a valid orb reward exists;
- when abilities are complete and all six orbs are Lv5, XP becomes complete as before.
- consuming orb rewards never lowers `level` back to the sum of ability ranks.

Keep `choose(ability)` only if a current test-only caller still needs it; otherwise replace it with `consume`.

- [ ] **Step 2: Run and verify RED**

```bash
rtk npm test -- src/game/progression/ProgressionManager.test.ts src/game/scenes/combatSceneRules.test.ts
```

- [ ] **Step 3: Generate tagged choices from live context**

Replace `AbilityId[]` storage with `RunRewardChoice[]`. For ability rewards, apply `build.upgrade` inside `consume`. For orb rewards, `ProgressionManager` only validates and consumes; it never owns `OrbStore`.

Replace `isBuildComplete` with “no eligible mixed reward” by checking the same
ability/add/upgrade candidate sources used by the selector. Constructor
compatibility may still initialize from ability ranks, but completion
normalization must keep the current run level; do not derive it from orb levels
or lower it back to the ability-rank sum.

- [ ] **Step 4: Simplify reward priority**

Change `pendingRunRewardKind` to need only:

```ts
pendingRunRewardKind(pendingLevelUps: number, canOpen: boolean): 'levelUp' | null
```

There is no core-supply priority after Task 6, but changing the pure rule here makes the intended final interface explicit.

- [ ] **Step 5: Verify GREEN**

```bash
rtk npm test -- src/game/progression/ProgressionManager.test.ts src/game/scenes/combatSceneRules.test.ts
```

- [ ] **Step 6: Commit**

```bash
rtk git add src/game/progression/ProgressionManager.ts src/game/progression/ProgressionManager.test.ts src/game/scenes/combatSceneRules.ts src/game/scenes/combatSceneRules.test.ts
rtk git commit -m "refactor: store tagged level up rewards"
```

---

### Task 5: Render mixed cards and exact upgrade targets

**Files:**
- Modify: `src/game/ui/LevelUpOverlay.ts`
- Modify: `src/game/ui/LevelUpOverlay.test.ts`
- Create: `src/game/ui/OrbUpgradeOverlay.ts`
- Create: `src/game/ui/OrbUpgradeOverlay.test.ts`
- Modify: `src/game/ui/OrbLoadoutOverlay.ts`
- Modify: `src/game/ui/OrbLoadoutOverlay.test.ts`

**Interfaces:**

```ts
LevelUpOverlay.show(
  choices: readonly RunRewardChoice[],
  build: BuildState,
  orbs: readonly OrbSnapshot[],
  onSelect: (choice: RunRewardChoice) => void,
): void;

OrbUpgradeOverlay.show(
  coreType: OrbCoreId,
  orbs: readonly OrbSnapshot[],
  onConfirm: (orbId: number) => void,
  onCancel: () => void,
): void;
```

- [ ] **Step 1: Add failing overlay tests**

For `LevelUpOverlay`, assert text and selection callbacks for:

```text
전도 구슬 Lv1
전도 구슬 강화
```

The detail panel appears only after focus. Ability rank text remains. Orb-add details use the catalog summary. Orb-upgrade details show the next-level short effect without raw tuning units.

For `OrbUpgradeOverlay`, assert:

- only matching Lv1~Lv4 physical orbs appear;
- duplicate types appear as separate `슬롯 N · 전도 구슬 LvM` rows;
- one candidate is preselected but still requires confirm;
- multiple candidates require a row selection and then confirm;
- confirm returns the exact physical `orbId`;
- no valid candidates invokes `onCancel` and does not confirm;
- keyboard 1~6 and pointer controls call the same focus path.

- [ ] **Step 2: Run and verify RED**

```bash
rtk npm test -- src/game/ui/LevelUpOverlay.test.ts src/game/ui/OrbUpgradeOverlay.test.ts src/game/ui/OrbLoadoutOverlay.test.ts
```

- [ ] **Step 3: Extend `LevelUpOverlay` without a card framework**

Use a local `switch (choice.kind)` for label/detail. Keep existing card creation, focus, enter-confirm, and cleanup mechanics. Store `selected?: RunRewardChoice` and compare by `runRewardChoiceKey`.

Add level-effect copy to the shared core definition only if it is static text. Do not derive player copy from raw tuning.

- [ ] **Step 4: Add the small target overlay**

Copy the proven lifecycle pattern from `LevelUpOverlay`: arrays of created objects, one selected ID, keyboard cleanup, and one confirm callback. It is a dedicated overlay, not a generic modal base.

- [ ] **Step 5: Remove obsolete additional-core picker**

Delete `OrbLoadoutOverlay.showAdditional` and its tests. Keep only starting loadout selection.

- [ ] **Step 6: Verify GREEN**

```bash
rtk npm test -- src/game/ui/LevelUpOverlay.test.ts src/game/ui/OrbUpgradeOverlay.test.ts src/game/ui/OrbLoadoutOverlay.test.ts
```

- [ ] **Step 7: Commit**

```bash
rtk git add src/game/ui/LevelUpOverlay.ts src/game/ui/LevelUpOverlay.test.ts src/game/ui/OrbUpgradeOverlay.ts src/game/ui/OrbUpgradeOverlay.test.ts src/game/ui/OrbLoadoutOverlay.ts src/game/ui/OrbLoadoutOverlay.test.ts
rtk git commit -m "feat: add mixed reward and orb target UI"
```

---

### Task 6: Integrate the mixed flow and delete stage core supplies

**Files:**
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `src/game/scenes/combatSceneRules.ts`
- Modify: `src/game/scenes/combatSceneRules.test.ts`
- Modify: `src/game/encounters/stageDefinitions.ts`
- Modify: `src/game/encounters/stageDefinitions.test.ts`
- Modify: `src/game/encounters/encounterProgressionRules.ts`
- Modify: `src/game/encounters/encounterProgressionRules.test.ts`
- Modify: `src/game/encounters/EncounterDirector.ts`
- Modify: `src/game/encounters/EncounterDirector.test.ts`
- Modify: `e2e/combat.spec.ts`
- Modify: `e2e/meta-loop.spec.ts`

**Flow:**

```text
level-up pending
  -> show tagged cards
  -> ability: validate -> apply/consume
  -> orb-add: OrbStore.addOrb(type) -> consume only on true
  -> orb-upgrade: show matching physical targets
       -> OrbStore.upgradeOrb(id, type) -> consume only on true
  -> existing 300 ms resume gap
  -> next pending level-up
```

- [ ] **Step 1: Add failing scene integration tests**

Add a small `applyRunRewardChoice` coordinator to `combatSceneRules` with injected
`addOrb`, `upgradeOrb`, and `consume` functions. Prove:

- a concrete add card creates exactly that Lv1 core and consumes once;
- an add failure at six slots keeps the level-up pending and regenerates choices;
- an upgrade card opens `OrbUpgradeOverlay` without consuming;
- target confirmation upgrades exactly one duplicate-type orb and then consumes;
- a stale target failure keeps the reward pending and refreshes the target list;
- combat stays paused across the secondary target screen;
- after success the existing resume delay is used;
- queued level-ups reopen the mixed flow.

- [ ] **Step 2: Run and verify RED**

```bash
rtk npm test -- src/game/scenes/combatSceneRules.test.ts
```

- [ ] **Step 3: Wire `ProgressionManager` to live orb snapshots**

Pass a context callback that reads:

```ts
{
  coreTypes: snapshots.map(({ coreType }) => coreType),
  orbs: snapshots,
}
```

Compute `snapshots` once inside the callback. This extends the existing
`coreTypes` eligibility construction rather than adding a second source.

For `orb-add`, call `addOrb(choice.coreType)` first. For `orb-upgrade`, instantiate/show `OrbUpgradeOverlay`, then call `upgradeOrb(orbId, choice.coreType)`. Call `progression.consume(choice)` only after a successful store mutation.

- [ ] **Step 4: Delete the separate supply system**

Remove:

- `StageDefinition.coreSupplyProgress`;
- `coreSupplyCountAt`;
- `EncounterDirector.coreSuppliesDue` and claimed counters;
- `CombatScene.pendingCoreSupplies`;
- `debugGrantCoreSupply`;
- core-supply debug auto-resolution;
- core-supply branch in `pendingRunRewardKind`;
- stage supply fixtures and dedicated E2E calls.

Do not remove or reinterpret `powerBand.expectedOrbCount`.

- [ ] **Step 5: Update E2E types, but do not run full Playwright yet**

Replace supply-only helpers with a narrowly-scoped debug helper that grants XP or opens the existing level-up flow. Do not add a production cheat API.

Run:

```bash
rtk npm test -- src/game/scenes/combatSceneRules.test.ts src/game/encounters/stageDefinitions.test.ts src/game/encounters/encounterProgressionRules.test.ts src/game/encounters/EncounterDirector.test.ts
rtk npm run build
```

Expected: PASS and no `coreSupply` runtime references:

```bash
rtk rg -n "coreSupply|pendingCoreSupplies|debugGrantCoreSupply|showAdditional" src e2e
```

Expected: no matches.

- [ ] **Step 6: Commit**

```bash
rtk git add src/game/scenes/CombatScene.ts src/game/encounters/stageDefinitions.ts src/game/encounters/stageDefinitions.test.ts src/game/encounters/encounterProgressionRules.ts src/game/encounters/encounterProgressionRules.test.ts src/game/encounters/EncounterDirector.ts src/game/encounters/EncounterDirector.test.ts src/game/scenes/combatSceneRules.ts src/game/scenes/combatSceneRules.test.ts e2e/combat.spec.ts e2e/meta-loop.spec.ts
rtk git commit -m "feat: replace core supplies with mixed level ups"
```

---

### Task 7: Make core profiles level-aware and merge split/explosion once

**Files:**
- Modify: `src/game/orbs/orbCoreRules.ts`
- Modify: `src/game/orbs/orbCoreRules.test.ts`
- Modify: `src/game/orbs/OrbManager.ts`
- Modify: `src/game/orbs/OrbManager.test.ts`
- Modify: `src/game/progression/progressionRules.ts`
- Modify: `src/game/progression/progressionRules.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `src/game/scenes/combatSceneRules.ts`
- Modify: `src/game/scenes/combatSceneRules.test.ts`

**Interfaces:**

```ts
export interface SplitProfile {
  chance: number;
  count: number;
  extraBounces: number;
  lifetimeMs: number;
  inheritedOutputScale: number;
}

export interface ExplosionProfile {
  chance: number;
  damage: number;
  radius: number;
  maximumFailures: number;
  centerBlast?: { radius: number; damage: number };
}

export function splitProfile(
  coreType: OrbCoreId,
  level: number,
  generic: ReturnType<BuildState['split']>,
): SplitProfile | null;

export function explosionProfile(
  coreType: OrbCoreId,
  level: number,
  generic: ReturnType<BuildState['explosion']>,
  failures: number,
): ExplosionProfile | null;
```

- [ ] **Step 1: Add failing profile tests**

Prove:

- dedicated split/explosion works at Lv1 without the generic ability;
- another core gets the existing generic profile only when owned;
- dedicated core plus generic ability receives the central synergy values;
- the final proc probability is evaluated once;
- probability is clamped to one;
- level is clamped/rejected consistently at the rule boundary;
- Lv2 uses the second array values.

Add an explosion failure counter to `OrbCoreState`. Prove a successful explosion clears it and a failure increments it only for the dedicated explosion core.

- [ ] **Step 2: Run and verify RED**

```bash
rtk npm test -- src/game/orbs/orbCoreRules.test.ts src/game/orbs/OrbManager.test.ts src/game/scenes/combatSceneRules.test.ts
```

- [ ] **Step 3: Replace legacy core constants with level profiles**

Pass `record.level` into wall/direct-hit resolution. Remove the old fixed conduction hit threshold and old inertia recovery-stack model. Keep only state fields still required by approved Lv3~Lv5 behavior.

Compute the final split/explosion profile before random resolution. `CombatScene` must not separately call both “native” and “generic” branches.

- [ ] **Step 4: Keep general modifiers relevant to dedicated cores**

Update `ABILITY_RELEVANCE` and its tests so the new native behaviors expose
the existing compatible ability cards:

- `proc-optimization`: corrosion, split, explosion, and echo cores;
- `effect-output`: corrosion, conduction, split, explosion, echo, and inertia cores;
- `area-expansion`: corrosion, conduction, explosion, echo, and inertia cores;
- `duration-module`: corrosion, split, and inertia cores;
- `focusing-lens`: echo core;
- fragment upgrades: generic `split` ability **or** a permanent split core.

Do not make an ability eligible for a core whose behavior it cannot change.

- [ ] **Step 5: Preserve boss relic meaning without dead methods**

Adapt only the two relics invalidated by the new base behavior:

- `superconducting-circuit`: replace hit-threshold reduction with `targetBonus: 1`; retain `damageBonus: 0.2`.
- `inertia-retention`: keep the precision/top-speed state through two direct hits instead of one.

Rename `BossBuild.conductionHitsRequired` to `conductionTargetBonus`. Keep `conductionDamage`. Update `BossRewardOverlay` copy to “전도 대상·피해 증가”.

Do not redesign the other relics here. `resonance-rupture` and gas/split relic integration is handled in the relevant core tasks below.

- [ ] **Step 6: Verify GREEN**

```bash
rtk npm test -- src/game/orbs/orbCoreRules.test.ts src/game/orbs/OrbManager.test.ts src/game/progression/progressionRules.test.ts src/game/progression/BossBuild.test.ts src/game/ui/BossRewardOverlay.test.ts src/game/scenes/combatSceneRules.test.ts
rtk npm run build
```

- [ ] **Step 7: Commit**

```bash
rtk git add src/game/orbs/orbCoreRules.ts src/game/orbs/orbCoreRules.test.ts src/game/orbs/OrbManager.ts src/game/orbs/OrbManager.test.ts src/game/progression/progressionRules.ts src/game/progression/progressionRules.test.ts src/game/scenes/CombatScene.ts src/game/scenes/combatSceneRules.ts src/game/scenes/combatSceneRules.test.ts src/game/progression/BossBuild.ts src/game/progression/BossBuild.test.ts src/game/config/gameTuning.ts src/game/config/gameTuning.test.ts src/game/ui/BossRewardOverlay.ts src/game/ui/BossRewardOverlay.test.ts
rtk git commit -m "feat: make orb core procs level aware"
```

---

### Task 8: Complete inertia, echo, and conduction Lv3~Lv5

**Files:**
- Modify: `src/game/orbs/orbCoreRules.ts`
- Modify: `src/game/orbs/orbCoreRules.test.ts`
- Modify: `src/game/orbs/OrbManager.ts`
- Modify: `src/game/orbs/OrbManager.test.ts`
- Modify: `src/game/enemies/EnemyManager.ts`
- Modify: `src/game/enemies/EnemyManager.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `src/game/scenes/combatSceneRules.ts`
- Modify: `src/game/scenes/combatSceneRules.test.ts`
- Modify: `src/game/progression/BossBuild.ts`
- Modify: `src/game/progression/BossBuild.test.ts`

**Minimum result commands:**

```ts
type CoreCombatCommand =
  | { kind: 'shockwave'; origin: Vector; radius: number; damage: number }
  | { kind: 'cutter'; axis: 'horizontal' | 'vertical'; origin: Vector; damage: number; thickness: number }
  | { kind: 'path-replay'; points: readonly Vector[]; damage: number; thickness: number }
  | { kind: 'chain'; sourceEnemyId: number; targets: number; radius: number; damage: number }
  | { kind: 'flight-link'; orbId: number; targets: number; radius: number; damage: number };
```

Use a union only if it reduces the existing callback sprawl. If current hit-event fields cover a result cleanly, extend them instead. Do not add a command bus.

- [ ] **Step 1: Add failing inertia tests**

Prove:

- direct bonus scales from actual speed ratio and respects the per-level cap;
- Lv3 precision hit before the first wall emits one rear shockwave;
- after a wall collision it does not;
- Lv4 precision hit holds the current top speed for the configured gameplay time;
- pause time does not consume the hold;
- Lv5 precision hit ignores the next enemy collision once, cannot damage the same enemy twice during the same pierce, and creates at most two kinetic explosions;
- `inertia-retention` extends the eligible direct-hit count to two.

- [ ] **Step 2: Add failing echo tests**

Prove:

- Lv2 uses its stack cap and damage;
- Lv3 emits one shockwave when stored stacks are spent;
- Lv4 cutter uses one seeded roll, honors cooldown, and chooses one axis;
- Lv5 at maximum stacks replays the stored previous wall path once;
- path storage has a fixed small point cap from tuning;
- `resonance-rupture` augments the same shockwave once instead of spawning a duplicate.

- [ ] **Step 3: Add failing conduction tests**

Prove:

- Lv1 chains on every direct collision;
- Lv2 uses increased targets and radius;
- Lv3 flight links tick against the nearest valid enemy;
- Lv4 increases target count and tick rate;
- Lv5 direct hit overcharges only currently linked targets;
- dead/out-of-range targets disappear on the next tick;
- one enemy or boss part is damaged at most once per chain/overcharge event;
- `superconducting-circuit` adds one target and damage once.

- [ ] **Step 4: Run focused tests and verify RED**

```bash
rtk npm test -- src/game/orbs/orbCoreRules.test.ts src/game/orbs/OrbManager.test.ts src/game/enemies/EnemyManager.test.ts src/game/progression/BossBuild.test.ts src/game/scenes/combatSceneRules.test.ts
```

- [ ] **Step 5: Implement by reusing existing combat effects**

- Use existing shockwave and laser/cutter damage helpers.
- Store only the bounded previous-bounce points needed for echo replay.
- Select conduction targets with the existing nearest-enemy query; add one query method only if no current method can return IDs and positions.
- Drive flight ticks from `gameplayElapsedMs`, not wall clock.
- Deduplicate enemy/boss-part IDs before applying an area/chain batch.

- [ ] **Step 6: Verify GREEN**

```bash
rtk npm test -- src/game/orbs/orbCoreRules.test.ts src/game/orbs/OrbManager.test.ts src/game/enemies/EnemyManager.test.ts src/game/progression/BossBuild.test.ts src/game/scenes/combatSceneRules.test.ts
rtk npm run build
```

- [ ] **Step 7: Commit**

```bash
rtk git add src/game/orbs/orbCoreRules.ts src/game/orbs/orbCoreRules.test.ts src/game/orbs/OrbManager.ts src/game/orbs/OrbManager.test.ts src/game/enemies/EnemyManager.ts src/game/enemies/EnemyManager.test.ts src/game/scenes/CombatScene.ts src/game/scenes/combatSceneRules.ts src/game/scenes/combatSceneRules.test.ts src/game/progression/BossBuild.ts src/game/progression/BossBuild.test.ts
rtk git commit -m "feat: complete kinetic echo and conduction cores"
```

---

### Task 9: Complete corrosion, split, and explosion Lv3~Lv5

**Files:**
- Modify: `src/game/combat/CorrosionFieldState.ts`
- Modify: `src/game/combat/CorrosionFieldState.test.ts`
- Modify: `src/game/orbs/TemporaryOrbManager.ts`
- Modify: `src/game/orbs/TemporaryOrbManager.test.ts`
- Modify: `src/game/orbs/orbCoreRules.ts`
- Modify: `src/game/orbs/orbCoreRules.test.ts`
- Modify: `src/game/enemies/EnemyManager.ts`
- Modify: `src/game/enemies/EnemyManager.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `src/game/scenes/combatSceneRules.ts`
- Modify: `src/game/scenes/combatSceneRules.test.ts`

- [ ] **Step 1: Add failing corrosion tests**

Prove:

- Lv3 precision hit creates one field attached to the hit enemy and follows its current position;
- death/removal safely removes or resolves an attached field;
- Lv4 applies at most three vulnerability stacks and the shared damage entry point reads the bonus once;
- Lv5 death spread creates one smaller field and respects the existing global field cap;
- gas ignition consumes the correct remaining damage once for both fixed and attached fields;
- boss parts intersecting one field are deduplicated per tick.

- [ ] **Step 2: Add failing split tests**

Prove:

- Lv3 children receive one extra allowed bounce;
- Lv4 count and lifetime use central values;
- Lv5 children inherit only the explicit allowlist:
  - explosion profile at `outputScale`;
  - horizontal/vertical cutter damage at `outputScale`;
- children never inherit split and cannot recursively split through the core;
- the existing `recursive-split` boss relic remains the only allowed one-generation recursive exception and still respects its lineage guard;
- total creation respects `GAME_TUNING.temporaryOrbs.cap`.

- [ ] **Step 3: Add failing explosion tests**

Prove:

- Lv3 failed rolls increase only that physical orb's next chance;
- a success clears failures;
- Lv4 uses its larger radius;
- at maximum failures, Lv5 adds one center blast and clears the counter;
- generic explosion synergy modifies the one native roll;
- overlapping boss parts are deduplicated per explosion.

- [ ] **Step 4: Run focused tests and verify RED**

```bash
rtk npm test -- src/game/combat/CorrosionFieldState.test.ts src/game/orbs/TemporaryOrbManager.test.ts src/game/orbs/orbCoreRules.test.ts src/game/enemies/EnemyManager.test.ts src/game/scenes/combatSceneRules.test.ts
```

- [ ] **Step 5: Implement on existing managers**

- Extend `CorrosionFieldState` records with optional attached enemy ID; do not create a second field manager.
- Extend temporary-orb records with remaining bounce count and a compact inherited-effect snapshot; do not copy full `BuildState`.
- Keep explosion pity on the permanent orb's `OrbCoreState`.
- Route vulnerability through the existing shared enemy-damage calculation so all valid sources benefit without caller duplication.
- Use the existing proc RNG seam and gameplay clock.

- [ ] **Step 6: Verify GREEN**

```bash
rtk npm test -- src/game/combat/CorrosionFieldState.test.ts src/game/orbs/TemporaryOrbManager.test.ts src/game/orbs/orbCoreRules.test.ts src/game/enemies/EnemyManager.test.ts src/game/scenes/combatSceneRules.test.ts
rtk npm run build
```

- [ ] **Step 7: Commit**

```bash
rtk git add src/game/combat/CorrosionFieldState.ts src/game/combat/CorrosionFieldState.test.ts src/game/orbs/TemporaryOrbManager.ts src/game/orbs/TemporaryOrbManager.test.ts src/game/orbs/orbCoreRules.ts src/game/orbs/orbCoreRules.test.ts src/game/enemies/EnemyManager.ts src/game/enemies/EnemyManager.test.ts src/game/scenes/CombatScene.ts src/game/scenes/combatSceneRules.ts src/game/scenes/combatSceneRules.test.ts
rtk git commit -m "feat: complete corrosion split and explosion cores"
```

---

### Task 10: Add readable feedback, browser coverage, and documentation

**Files:**
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `src/game/scenes/combatTextureRules.ts`
- Modify: `src/game/scenes/combatTextureRules.test.ts`
- Modify: `src/game/scenes/combatSceneRules.ts`
- Modify: `src/game/scenes/combatSceneRules.test.ts`
- Modify: `e2e/combat.spec.ts`
- Modify: `docs/TUNING.md`
- Modify: `docs/WORKLOG.md`

- [ ] **Step 1: Add failing visual contract tests**

In the pure texture/feedback rules, prove:

- six permanent cores render distinct catalog colors and internal symbols;
- level is visible through ring/notch count without changing physics radius;
- conduction direct chain and flight link create line feedback between source and targets;
- split, explosion, corrosion, echo, and inertia Lv3/Lv5 triggers use distinct feedback colors;
- no player orb/effect uses the enemy projectile's confusing purple-red color as its sole identifier.

- [ ] **Step 2: Run scene tests and verify RED**

```bash
rtk npm test -- src/game/scenes/combatTextureRules.test.ts src/game/scenes/combatSceneRules.test.ts
```

- [ ] **Step 3: Implement lightweight procedural feedback**

Use Phaser shapes already created in `CombatScene`. No image-generation task, texture pipeline, particles framework, or audio work in this plan.

- [ ] **Step 4: Add end-to-end mixed reward coverage**

Add one serial browser scenario that uses deterministic debug state to verify:

1. first level-up shows two different orb-add cards and one ability;
2. selecting a concrete orb card adds the named Lv1 orb;
3. at three owned orbs, only one orb-add card appears;
4. at six slots, no add card appears and an upgrade card does;
5. two same-type physical orbs appear as separate targets;
6. confirming one target upgrades only its displayed slot;
7. mobile-sized pointer input can select card, target, and final confirm;
8. one representative Lv3 and one Lv5 core effect visibly/structurally fires.

Do not create six separate browser tests for the six cores; unit tests own the matrix.

- [ ] **Step 5: Document tuning and worklog**

In `docs/TUNING.md`, list:

- `GAME_TUNING.rewardFlow.mixedCards`;
- `ORB_CORE_DEFINITIONS[*].maximumLevel`;
- each core's `byLevel` arrays;
- split/explosion generic synergy;
- temporary-orb and corrosion global caps;
- relic compatibility values.

In `docs/WORKLOG.md`, add a dated entry covering:

- separate stage core supplies removed;
- mixed XP rewards introduced;
- physical per-orb leveling introduced;
- six base cores completed through Lv5;
- fusion/discovery explicitly deferred.

- [ ] **Step 6: Run final verification once**

Run:

```bash
rtk npm test
rtk npm run build
rtk npm run test:e2e
rtk ./node_modules/.bin/tsc --noEmit --noUnusedLocals --noUnusedParameters
rtk rg -n "coreSupply|pendingCoreSupplies|debugGrantCoreSupply|showAdditional|hitsRequired" src e2e
rtk git status --short
```

Expected:

- all Vitest files pass;
- build passes;
- all Playwright tests pass;
- strict unused check passes;
- legacy supply and old conduction threshold names have no runtime matches;
- only intended files are modified.

- [ ] **Step 7: Commit**

```bash
rtk git add src/game/scenes/CombatScene.ts src/game/scenes/combatTextureRules.ts src/game/scenes/combatTextureRules.test.ts src/game/scenes/combatSceneRules.ts src/game/scenes/combatSceneRules.test.ts e2e/combat.spec.ts docs/TUNING.md docs/WORKLOG.md
rtk git commit -m "test: verify mixed orb progression loop"
```

---

## Completion Criteria

- One XP level-up screen mixes abilities and concrete orb growth cards at the approved ratios.
- The stage-progress core-supply queue and all its debug/test hooks are gone.
- New orb cards add a named physical Lv1 orb; full slots offer named upgrade cards.
- Duplicate same-type orbs are upgraded individually through an explicit second confirmation.
- Six base core types work from Lv1 through Lv5 using centralized tuning.
- Generic and dedicated split/explosion behavior resolves through one merged proc.
- Existing boss relics remain meaningful under the new core rules.
- Unit, build, unused-code, and browser suites all pass.
- Fusion, discovery masking, codex, real art, and sound remain untouched.
