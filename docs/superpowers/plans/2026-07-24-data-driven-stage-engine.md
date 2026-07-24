# Data-Driven Stage Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fixed section/phase tables with typed stage data, while preserving procedural formations and ending the run after the last configured boss reward.

**Architecture:** `StageDefinition` owns timed phases, formation pressure, enemy eligibility, and the mandatory boss gate. `EncounterDirector` remains the runtime state machine. Existing procedural layout algorithms remain unchanged and receive a recipe instead of reading phase-indexed globals.

**Tech Stack:** TypeScript 5.9, Phaser 3.90, Vitest 4, Playwright 1.61

## Global Constraints

- Preserve deterministic output for the same run seed, stage, phase, and spawn sequence.
- Use only current enemy kinds: `basic`, `armored`, `shooter`, `splitter`, `fragment`.
- `fragment` remains spawned by splitters, not selected for formations.
- Descent speed multiplier defaults to `1` and never scales automatically.
- Every stage has exactly one boss. Missing next stage after its reward means run completion.
- Reuse current procedural formation algorithms. No coordinate lists or external JSON.
- Keep `GAME_TUNING` for global mechanics only; stage-specific content lives in one typed module.
- Run focused tests after each task; run full verification only after integration.

---

## Task 1: Define and validate stage content

**Files:**
- Create: `src/game/encounters/stageDefinitions.ts`
- Test: `src/game/encounters/stageDefinitions.test.ts`
- Modify: `src/game/config/gameTuning.ts`
- Test: `src/game/config/gameTuning.test.ts`

- [ ] Write failing tests for two configured stages, mandatory bosses, ordered phase start times, valid enemy pools, positive weights, legal caps, and default descent multiplier `1`.

- [ ] Run `npm test -- src/game/encounters/stageDefinitions.test.ts` and confirm failure because the module does not exist.

- [ ] Add the minimum public types:

```ts
export type BattlefieldId = 'default';
export type StageId = 'default-1' | 'default-2';

export interface EnemyCatalogEntry {
  kind: Exclude<EnemyKind, 'fragment'>;
  minStage: number;
  battlefields: readonly BattlefieldId[];
  tags: readonly string[];
  weight: number;
  maxPerFormation?: number;
}

export interface FormationProfile {
  id: string;
  styleWeights: Readonly<Partial<Record<FormationStyle, number>>>;
  minimum: number;
  maximum: number;
}

export interface StagePhaseDefinition {
  startsAtMs: number;
  activeCap: number;
  spawnIntervalMs: number;
  formationProfileId: string;
  enemyWeightMultipliers?: Readonly<Partial<Record<EnemyKind, number>>>;
  maxPerFormationOverrides?: Readonly<Partial<Record<EnemyKind, number>>>;
}

export interface StageBossDefinition {
  kind: BossKind;
  minimumMs: number;
  scoreTarget: number;
  hardMaximumMs: number;
  warningMs: number;
}

export interface StageDefinition {
  id: StageId;
  number: number;
  battlefield: BattlefieldId;
  hpMultiplier: number;
  descentSpeedMultiplier: number;
  phases: readonly StagePhaseDefinition[];
  boss: StageBossDefinition;
}
```

- [ ] Export `ENEMY_CATALOG`, `FORMATION_PROFILES`, and `STAGES`. Migrate the current two boss sections without changing their current timings, caps, formation ranges, or enemy mix.

- [ ] Implement `validateStageContent()` and call it at module initialization. Validate unique IDs/numbers, first phase at `0`, strictly increasing phase times, positive numbers, referenced profiles, eligible non-empty pools, boss presence, and non-negative overrides.

- [ ] Remove only the migrated fixed `encounter.phases` and `encounter.bossSchedule` data/types from `gameTuning.ts`. Retain global release Y, origins, HP, speed, and projectile tuning.

- [ ] Run `npm test -- src/game/encounters/stageDefinitions.test.ts src/game/config/gameTuning.test.ts` and confirm pass.

- [ ] Commit: `git add src/game/encounters/stageDefinitions.ts src/game/encounters/stageDefinitions.test.ts src/game/config/gameTuning.ts src/game/config/gameTuning.test.ts && git commit -m "feat: define typed stage content"`

---

## Task 2: Feed recipes into the existing procedural generator

**Files:**
- Modify: `src/game/encounters/formationRules.ts`
- Test: `src/game/encounters/formationRules.test.ts`
- Modify: `src/game/encounters/stageDefinitions.ts`
- Test: `src/game/encounters/stageDefinitions.test.ts`

- [ ] Add failing tests proving:
  - same recipe and seed produce identical results;
  - weighted styles avoid immediate repeats when another weighted style exists;
  - catalog `minStage` and `battlefields` filter enemy kinds;
  - catalog caps and phase overrides merge with the phase override winning;
  - formation size stays within the selected profile range.

- [ ] Run `npm test -- src/game/encounters/formationRules.test.ts` and confirm the new API fails.

- [ ] Replace `createReinforcementFormation(phase, sequence, runSeed)` with:

```ts
export interface FormationRecipe {
  stageNumber: number;
  battlefield: BattlefieldId;
  profile: FormationProfile;
  enemyWeightMultipliers?: Readonly<Partial<Record<EnemyKind, number>>>;
  maxPerFormationOverrides?: Readonly<Partial<Record<EnemyKind, number>>>;
  hpMultiplier: number;
  descentSpeedMultiplier: number;
}

export function createReinforcementFormation(
  recipe: FormationRecipe,
  sequence: number,
  runSeed: number,
): FormationResult;
```

- [ ] Keep `clusterOrder`, `pocketsOrder`, `bandsOrder`, `scatterOrder`, `gridOrder`, cell spacing, seed mixing, and organic-shape repair unchanged.

- [ ] Replace the fixed `BAG`, `ORGANIC`, and exact armored/shooter/splitter counts with deterministic weighted selection from the recipe. Enforce caps after weighting; fill remaining slots from eligible uncapped kinds.

- [ ] Apply `hpMultiplier` when assigning HP and `descentSpeedMultiplier` when assigning speed. Do not invent per-kind stat objects.

- [ ] Keep `createInitialFormation()` by expressing its existing composition as one internal recipe, preserving current behavior.

- [ ] Run `npm test -- src/game/encounters/formationRules.test.ts src/game/encounters/stageDefinitions.test.ts` and confirm pass.

- [ ] Commit: `git commit -am "refactor: drive formations from stage recipes"`

---

## Task 3: Make EncounterDirector stage-driven

**Files:**
- Modify: `src/game/encounters/encounterRules.ts`
- Test: `src/game/encounters/encounterRules.test.ts`
- Modify: `src/game/encounters/encounterProgressionRules.ts`
- Test: `src/game/encounters/encounterProgressionRules.test.ts`
- Modify: `src/game/encounters/EncounterDirector.ts`
- Test: `src/game/encounters/EncounterDirector.test.ts`

- [ ] Write failing tests for arbitrary phase counts, exact time boundaries, stage-local boss gates, reward advancing to stage 2, and final reward returning run completion.

- [ ] Run the three focused suites and confirm failure against section-based behavior.

- [ ] Replace `ThreatPhase` and `threatPhaseForSection()` with stage-local phase lookup:

```ts
export function phaseAt(
  stage: StageDefinition,
  elapsedMs: number,
): { index: number; definition: StagePhaseDefinition };
```

- [ ] Change boss lookup to read `stage.boss`; retain `bossEntryReady()` and kill-score rules.

- [ ] Add:

```ts
export type EncounterState =
  | 'running'
  | 'bossWarning'
  | 'boss'
  | 'bossRewardPaused'
  | 'runComplete';

export type StageAdvance =
  | { type: 'stageStarted'; stageId: StageId; stageNumber: number }
  | { type: 'runCompleted' };
```

- [ ] Replace `section` with `stageIndex`. Make `resumeAfterBossReward(): StageAdvance` advance when another stage exists; otherwise set `runComplete` and return `{ type: 'runCompleted' }`.

- [ ] Build the formation recipe from the active stage and phase. Preserve pending-formation caching, spawn gates, score accumulation, and global elapsed time.

- [ ] Keep a temporary read-only `section: stageIndex` field in snapshots only if existing debug/E2E consumers require it; otherwise remove it and update callers.

- [ ] Run `npm test -- src/game/encounters/encounterRules.test.ts src/game/encounters/encounterProgressionRules.test.ts src/game/encounters/EncounterDirector.test.ts` and confirm pass.

- [ ] Commit: `git commit -am "feat: run encounters from stage definitions"`

---

## Task 4: End the run after the final boss reward

**Files:**
- Create: `src/game/ui/RunCompleteOverlay.ts`
- Test: `src/game/ui/RunCompleteOverlay.test.ts`
- Modify: `src/game/combat/CombatPauseController.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `src/game/scenes/combatSceneRules.ts`
- Test: `src/game/scenes/combatSceneRules.test.ts`
- Modify: `e2e/combat.spec.ts`

- [ ] Write failing unit tests for a visible run-complete overlay with a restart action and for `runComplete` remaining paused.

- [ ] Add `runComplete` to `PauseReason` and `PAUSE_REASONS`.

- [ ] Implement a minimal `RunCompleteOverlay` matching existing overlay construction, visibility, input, resize, and destroy patterns. Text: `RUN COMPLETE`; action: `RESTART`.

- [ ] In `chooseBossReward()`, consume `StageAdvance`. For `stageStarted`, close reward and resume exactly as today. For `runCompleted`, close reward, finalize hostile actions, add the permanent `runComplete` pause, and show the new overlay.

- [ ] Remove the obsolete `sectionAfterBossReward()` assertion. Replace it with stage ID/number validation from the returned event.

- [ ] Wire restart through the existing scene restart lifecycle. Do not add a results/statistics system.

- [ ] Extend the debug snapshot only with `runCompleteVisible` and the active stage ID/number needed by E2E.

- [ ] Add E2E coverage that defeats both bosses through the existing debug controls, selects the final reward, sees `RUN COMPLETE`, verifies gameplay time is frozen, and restarts.

- [ ] Run `npm test -- src/game/ui/RunCompleteOverlay.test.ts src/game/scenes/combatSceneRules.test.ts && npm run test:e2e -- e2e/combat.spec.ts`.

- [ ] Commit: `git add src/game/ui/RunCompleteOverlay.ts src/game/ui/RunCompleteOverlay.test.ts src/game/combat/CombatPauseController.ts src/game/scenes/CombatScene.ts src/game/scenes/combatSceneRules.ts src/game/scenes/combatSceneRules.test.ts e2e/combat.spec.ts && git commit -m "feat: complete runs after final boss reward"`

---

## Task 5: Remove fixed-stage leftovers and verify

**Files:**
- Modify only files identified by the searches below.

- [ ] Run `rg -n "ThreatPhase|threatPhaseForSection|bossSchedule|encounter\\.phases|sectionAfterBossReward" src e2e` and remove obsolete production references.

- [ ] Run `npm test`.

- [ ] Run `npm run build`.

- [ ] Run `npm run test:e2e`.

- [ ] Start `npm run dev -- --host 127.0.0.1`, play through both stages in the browser, and verify pause/reward/stage transitions and final completion.

- [ ] Commit any verification fixes as `fix: integrate data-driven stage flow`.
