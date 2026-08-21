# Six-Column Combat Pressure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert combat to six columns, bound visible-enemy downtime, block offscreen damage, quantify stage pressure, and make intentional piercing distinguishable from collision failure.

**Architecture:** Existing `GAME_TUNING`, formation helpers, `EncounterDirector`, and `EnemyManager` remain the owners. Add one pure pressure calculator and one small telemetry tracker; do not add dynamic difficulty. `CombatScene` only wires snapshots, release requests, and visual feedback.

**Tech Stack:** TypeScript 5.9, Phaser 3.90 Arcade Physics, Vitest 4, Playwright 1.61, Vite 8

**Spec:** `docs/superpowers/specs/2026-08-20-six-column-production-art-pressure-design.md`

## Global Constraints

- Playfield remains exactly `450 × 800px`.
- Grid is `6` columns, `15px` side margins, `70 × 60px` cells, and `0px` physics gap.
- Player is `82 × 82px` with `28px` hurt radius; permanent orbs are `32px`; temporary orbs are `20px`.
- On-screen descent speed remains `8px/s` in the first pass.
- Visible-enemy downtime target is `2–3s`; hard maximum is `5s` during normal running combat.
- Offscreen enemies cannot take any direct, area, chain, segment, or damage-over-time damage before complete entry.
- Pressure is diagnostics only; it never modifies runtime difficulty.
- Balance numbers live in `GAME_TUNING`, stage definitions, or `docs/TUNING.md`, never scene literals.
- Use TDD for every behavior change and run only focused tests while implementing; run full gates once at the end.

---

### Task 1: Lock Six-Column Geometry

**Files:**
- Modify: `src/game/config/gameTuning.ts`
- Modify: `src/game/config/gameTuning.test.ts`
- Modify: `src/game/encounters/formationGrid.test.ts`
- Modify: `src/game/enemies/EnemyManager.test.ts`
- Modify: `src/game/enemies/splitterRules.test.ts`
- Modify: `src/game/orbs/OrbManager.test.ts`
- Modify: `src/game/orbs/TemporaryOrbManager.test.ts`

**Interfaces:**
- Consumes: existing `GAME_TUNING`, `FORMATION_COLUMNS`, `footprintWorldRect`, `PLAYER_RADIUS`, `ORB_RADIUS`.
- Produces: approved central geometry read by all later tasks.

- [ ] **Step 1: Change geometry expectations to the approved values**

```ts
expect(GAME_TUNING.encounter.grid).toEqual({
  columns: 6,
  left: 15,
  cellWidth: 70,
  cellHeight: 60,
  gap: 0,
});
expect(GAME_TUNING.player.visual).toEqual({ width: 82, height: 82, hurtRadius: 28 });
expect(GAME_TUNING.visual.friendly.permanentOrb).toMatchObject({ width: 32, height: 32 });
expect(GAME_TUNING.visual.friendly.temporaryOrb).toMatchObject({ width: 20, height: 20 });
expect(FORMATION_COLUMNS).toBe(6);
expect(footprintWorldRect(
  { column: 1, row: 2, width: 2, height: 1 },
  80,
)).toEqual({ x: 155, y: 230, width: 140, height: 60 });
```

Update enemy and orb adapter expectations to `70 × 60`, `140 × 120`, `32px`, and `20px`. Keep the existing equality assertion between visible bounds and physics bounds.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
rtk npx vitest run src/game/config/gameTuning.test.ts src/game/encounters/formationGrid.test.ts src/game/enemies/EnemyManager.test.ts src/game/enemies/splitterRules.test.ts src/game/orbs/OrbManager.test.ts src/game/orbs/TemporaryOrbManager.test.ts
```

Expected: failures show the current five-column, `96px` player, `40px` permanent orb, and `24px` temporary orb values.

- [ ] **Step 3: Change only central tuning values**

```ts
player: { visual: { width: 82, height: 82, hurtRadius: 28 } },
encounter: {
  bossEntry: { cleanupMode: 'corridor', padding: 8 },
  grid: { columns: 6, left: 15, cellWidth: 70, cellHeight: 60, gap: 0 },
},
visual: {
  friendly: {
    permanentOrb: { fill: 0xffffff, accent: 0x4ddcff, width: 32, height: 32 },
    temporaryOrb: { fill: 0x8cf7ff, accent: 0x167d9a, width: 20, height: 20 },
  },
  // existing feedback and hostile tuning unchanged
},
```

Do not add per-manager size overrides. Existing runtime code must continue deriving geometry from tuning.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the Step 2 command. Expected: all selected files pass.

- [ ] **Step 5: Commit**

```bash
rtk git add src/game/config/gameTuning.ts src/game/config/gameTuning.test.ts src/game/encounters/formationGrid.test.ts src/game/enemies/EnemyManager.test.ts src/game/enemies/splitterRules.test.ts src/game/orbs/OrbManager.test.ts src/game/orbs/TemporaryOrbManager.test.ts
rtk git commit -m "feat: establish six-column combat geometry"
```

### Task 2: Migrate Formations And Restore Field Occupancy

**Files:**
- Modify: `src/game/encounters/stageDefinitions.ts`
- Modify: `src/game/encounters/stageDefinitions.test.ts`
- Modify: `src/game/encounters/formationGrid.ts`
- Modify: `src/game/encounters/formationGrid.test.ts`
- Modify: `src/game/encounters/formationRules.ts`
- Modify: `src/game/encounters/formationRules.test.ts`

**Interfaces:**
- Consumes: six-column grid from Task 1; existing seeded templates and procedural generator.
- Produces: six-column templates, six-column passage anchors, denser profile cell ranges, and formations with no wholly empty authored row.

- [ ] **Step 1: Write failing six-column formation contracts**

Add assertions covering all seeds used by the tests:

```ts
expect(result.enemies.every(({ column, width }) => (
  column >= 0 && column + width <= 6
))).toBe(true);

const occupiedRows = new Set(occupiedCells(result.enemies).map((cell) => Number(cell.split(':')[0])));
const rowCount = Math.max(...result.enemies.map(({ row, height }) => row + height));
expect([...Array(rowCount).keys()].every((row) => occupiedRows.has(row))).toBe(true);

expect(FORMATION_PROFILES.map(({ cellMinimum, cellMaximum }) => [cellMinimum, cellMaximum]))
  .toEqual([[7, 11], [10, 15], [13, 19], [16, 23]]);
```

Rewrite template expectations to use columns `0..5`, include at least one deliberate passage, and occupy every declared row.

- [ ] **Step 2: Run formation tests and verify RED**

```bash
rtk npx vitest run src/game/encounters/formationGrid.test.ts src/game/encounters/formationRules.test.ts src/game/encounters/stageDefinitions.test.ts
```

Expected: old anchors, templates, bounds, and profile density fail.

- [ ] **Step 3: Replace five-column data with explicit six-column data**

Set passage anchors to six-column-safe values:

```ts
const anchors = [1, 4, 2, 3, 0, 5] as const;
```

Rewrite every `FORMATION_TEMPLATES` slot explicitly for `0..5`; do not scale old columns at runtime. Update profiles to:

```ts
opening:   { cellMinimum: 7,  cellMaximum: 11, rowMinimum: 2, rowMaximum: 3 },
pressure:  { cellMinimum: 10, cellMaximum: 15, rowMinimum: 3, rowMaximum: 4 },
assault:   { cellMinimum: 13, cellMaximum: 19, rowMinimum: 3, rowMaximum: 5 },
onslaught: { cellMinimum: 16, cellMaximum: 23, rowMinimum: 4, rowMaximum: 5 },
```

In `createFormation`, reject a generated/template layout containing an empty row and deterministically fill one legal non-reserved cell in that row using the existing catalog and `addPlacement`. Do not add a second random generator or retry loop.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the Step 2 command. Then run:

```bash
rtk npx vitest run src/game/encounters/EncounterDirector.test.ts src/game/enemies/EnemyManager.test.ts
```

Expected: all selected tests pass and seeded results remain deterministic.

- [ ] **Step 5: Commit**

```bash
rtk git add src/game/encounters/stageDefinitions.ts src/game/encounters/stageDefinitions.test.ts src/game/encounters/formationGrid.ts src/game/encounters/formationGrid.test.ts src/game/encounters/formationRules.ts src/game/encounters/formationRules.test.ts
rtk git commit -m "feat: migrate formations to six columns"
```

### Task 3: Protect Entering Enemies From Offscreen Damage

**Files:**
- Modify: `src/game/enemies/enemyRules.ts`
- Modify: `src/game/enemies/enemyRules.test.ts`
- Modify: `src/game/enemies/EnemyManager.ts`
- Modify: `src/game/enemies/EnemyManager.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`

**Interfaces:**
- Consumes: enemy world position and `displayHeight`.
- Produces: `enemyFullyEntered(centerY: number, displayHeight: number): boolean`; `EnemySnapshot.damageable`; one `onEntryBlocked(position)` callback.

- [ ] **Step 1: Write failing entry-state and damage-path tests**

```ts
expect(enemyFullyEntered(29, 60)).toBe(false);
expect(enemyFullyEntered(30, 60)).toBe(true);
expect(enemyFullyEntered(59, 120)).toBe(false);
expect(enemyFullyEntered(60, 120)).toBe(true);
```

In `EnemyManager.test.ts`, place one basic enemy at `y=29` and one armored enemy at `y=59`. Assert:

- permanent and temporary process callbacks return `true` to preserve physical separation;
- `handleEnemyHit` is not called;
- direct, area, chain/nearest, segment, and damage-over-time entry points leave HP unchanged;
- moving each center to its half-height permits the same damage paths;
- `onEntryBlocked` fires at most once per orb/enemy contact cooldown.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
rtk npx vitest run src/game/enemies/enemyRules.test.ts src/game/enemies/EnemyManager.test.ts
```

Expected: offscreen enemies currently accept damage and `enemyFullyEntered` is missing.

- [ ] **Step 3: Implement one shared entry predicate and enforce it at damage boundaries**

```ts
export function enemyFullyEntered(centerY: number, displayHeight: number): boolean {
  return centerY - displayHeight / 2 >= 0;
}
```

Add to `EnemyManager`:

```ts
private damageable(enemy: EnemySprite): boolean {
  return enemyFullyEntered(enemy.y, enemy.displayHeight);
}
```

Use it before permanent/temporary `handleEnemyHit`, inside `damageEnemy`, and when collecting area, segment, and nearest targets. An entry-blocked direct collision returns `true` without creating a pending hit, consuming charges, recording cooldown, or firing procs. Wire `onEntryBlocked` in `CombatScene` to one restrained ring named `enemy-entry-shield`; gameplay values remain unchanged.

- [ ] **Step 4: Run focused tests and verify GREEN**

```bash
rtk npx vitest run src/game/enemies/enemyRules.test.ts src/game/enemies/EnemyManager.test.ts src/game/scenes/combatSceneRules.test.ts
```

Expected: all selected tests pass.

- [ ] **Step 5: Commit**

```bash
rtk git add src/game/enemies/enemyRules.ts src/game/enemies/enemyRules.test.ts src/game/enemies/EnemyManager.ts src/game/enemies/EnemyManager.test.ts src/game/scenes/CombatScene.ts
rtk git commit -m "fix: protect offscreen enemy entry"
```

### Task 4: Enforce The Five-Second Visible-Field Deadline

**Files:**
- Modify: `src/game/config/gameTuning.ts`
- Modify: `src/game/config/gameTuning.test.ts`
- Modify: `src/game/encounters/EncounterDirector.ts`
- Modify: `src/game/encounters/EncounterDirector.test.ts`
- Modify: `src/game/enemies/EnemyManager.ts`
- Modify: `src/game/enemies/EnemyManager.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`

**Interfaces:**
- Consumes: `EncounterEnemyState.visiblePopulation`; current active population and encounter state.
- Produces: `EncounterUpdate.releaseIncoming: boolean`; `EnemyManager.releaseOffscreenToEntryLine(): boolean`; snapshot `visiblePopulation`.

`visiblePopulation` counts an enemy as soon as any part of its display rectangle crosses `y = 0` (`centerY + displayHeight / 2 > 0`). This is deliberately different from Task 3 `damageable`, which requires the entire rectangle to enter.

- [ ] **Step 1: Write failing visible-population and deadline tests**

Add tuning expectations:

```ts
expect(GAME_TUNING.encounter.pressure).toMatchObject({
  targetEmptyMs: 2_500,
  maximumEmptyMs: 5_000,
});
```

Add manager tests:

```ts
expect(manager.getSnapshot().visiblePopulation).toBe(0);
expect(manager.releaseOffscreenToEntryLine()).toBe(true);
expect(Math.max(...manager.getSnapshot().enemies.map((enemy) => (
  enemy.position.y + enemy.footprint!.height * 60 / 2
)))).toBe(0);
```

Add director tests proving:

- before `2_500ms`, normal interval/clearance rules apply;
- at `2_500ms` of an empty visible field with active offscreen enemies, `releaseIncoming` is `true`;
- with no active enemies, a formation is returned by `5_000ms` regardless of the `8_000ms` opening interval;
- warning, reward, boss, pause-owned states, and completion never request release.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
rtk npx vitest run src/game/config/gameTuning.test.ts src/game/encounters/EncounterDirector.test.ts src/game/enemies/EnemyManager.test.ts
```

Expected: pressure tuning, visible population, release action, and release method do not exist.

- [ ] **Step 3: Add central downtime tuning and the minimum state required**

Extend encounter tuning:

```ts
pressure: {
  targetEmptyMs: 2_500,
  maximumEmptyMs: 5_000,
  scoreWeights: { clear: 0.5, breach: 0.3, hostile: 0.2 },
  targetLoads: { clear: 1, breach: 1, hostile: 1 },
},
```

Track `visibleEmptyMs` only inside `EncounterDirector`. Reset it when `visiblePopulation > 0` or state leaves `running`. Return:

```ts
export interface EncounterUpdate {
  formation: EnemySpec[] | null;
  transition: EncounterTransition | null;
  releaseIncoming: boolean;
}
```

At `targetEmptyMs`, request `releaseIncoming` if active enemies exist but none are visible. If none exist, allow seeded formation generation no later than `maximumEmptyMs`, bypassing only time and top-clearance gates; retain capacity and lifecycle guards.

Implement `releaseOffscreenToEntryLine()` by translating every active offscreen enemy by the same Y delta so the greatest current bottom edge becomes `0`. Reset each body while preserving velocity. Return `false` if any enemy is already visible or none exist.

- [ ] **Step 4: Wire the release action and run focused tests**

In `CombatScene.advanceEncounter`, call `releaseOffscreenToEntryLine()` before spawning a returned formation. Pass `visiblePopulation` into the director.

Run the Step 2 command. Expected: all pass.

- [ ] **Step 5: Commit**

```bash
rtk git add src/game/config/gameTuning.ts src/game/config/gameTuning.test.ts src/game/encounters/EncounterDirector.ts src/game/encounters/EncounterDirector.test.ts src/game/enemies/EnemyManager.ts src/game/enemies/EnemyManager.test.ts src/game/scenes/CombatScene.ts
rtk git commit -m "feat: bound visible enemy downtime"
```

### Task 5: Add Pressure Estimation And Debug Telemetry

**Files:**
- Create: `src/game/encounters/combatPressure.ts`
- Create: `src/game/encounters/combatPressure.test.ts`
- Create: `src/game/combat/CombatTelemetry.ts`
- Create: `src/game/combat/CombatTelemetry.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `src/game/enemies/EnemyManager.ts`
- Modify: `src/game/enemies/EnemyManager.test.ts`

**Interfaces:**
- Produces: `estimateCombatPressure(input, tuning): PressureEstimate`; `CombatTelemetry.recordHit`, `recordPlayerDamage`, `recordEnemyHp`, `recordBreach`, `update`, and `snapshot`.
- Consumes: Task 4 `GAME_TUNING.encounter.pressure`; existing enemy/direct-hit callbacks and debug snapshot.

- [ ] **Step 1: Write failing pure pressure tests**

Use this exact public shape:

```ts
export interface PressureInput {
  orbCount: number;
  hitsPerSecondPerOrb: number;
  directDamage: number;
  expectedSecondaryDamagePerHit: number;
  enemyHpPerSecond: number;
  occupiedCellUrgency: number;
  hostileDamagePerSecond: number;
}

export interface PressureEstimate {
  playerDps: number;
  clearLoad: number;
  breachLoad: number;
  hostileLoad: number;
  score: number;
}
```

Assert a baseline input produces score `100` with target loads of `1`, doubling enemy HP inflow increases score, doubling orb count decreases it, and increasing hostile damage never lowers it. Reject negative, non-finite, or zero-divisor input.

- [ ] **Step 2: Write failing five-second rolling telemetry tests**

```ts
const telemetry = new CombatTelemetry(5_000);
telemetry.recordHit();
telemetry.recordPlayerDamage(3);
telemetry.recordEnemyHp(8);
telemetry.recordBreach();
telemetry.update(1_000, { visibleCells: 6, hostileProjectiles: 2 });
expect(telemetry.snapshot()).toMatchObject({
  hitsPerSecond: 1,
  playerDamagePerSecond: 3,
  enemyHpPerSecond: 8,
  visibleCells: 6,
  hostileProjectiles: 2,
  breachesPerMinute: 60,
});
```

Advance another `5_001ms` with no events and assert event rates expire without unbounded storage.

- [ ] **Step 3: Run both new tests and verify RED**

```bash
rtk npx vitest run src/game/encounters/combatPressure.test.ts src/game/combat/CombatTelemetry.test.ts
```

Expected: modules do not exist.

- [ ] **Step 4: Implement the two small pure owners**

Use the approved formulas:

```ts
const playerDps = input.orbCount
  * input.hitsPerSecondPerOrb
  * (input.directDamage + input.expectedSecondaryDamagePerHit);
const clearLoad = input.enemyHpPerSecond / playerDps;
const breachLoad = input.occupiedCellUrgency;
const hostileLoad = input.hostileDamagePerSecond;
const score = 100 * (
  weights.clear * clearLoad / targets.clear
  + weights.breach * breachLoad / targets.breach
  + weights.hostile * hostileLoad / targets.hostile
);
```

`CombatTelemetry` keeps one bounded array of timestamped aggregate events inside the five-second window. Do not add a dashboard, persistence, analytics dependency, or runtime adaptation.

- [ ] **Step 5: Wire telemetry into the existing debug snapshot**

Record direct/secondary player damage, spawned enemy HP, breaches, visible occupied cells, and current hostile projectile count at existing callbacks. Add:

```ts
pressure: {
  estimate: PressureEstimate;
  telemetry: CombatTelemetrySnapshot;
};
```

to `CombatDebugSnapshot`. The values are available through existing development-only debug access; do not render a panel.

- [ ] **Step 6: Run focused tests and verify GREEN**

```bash
rtk npx vitest run src/game/encounters/combatPressure.test.ts src/game/combat/CombatTelemetry.test.ts src/game/enemies/EnemyManager.test.ts src/game/scenes/combatSceneRules.test.ts
```

Expected: all selected tests pass.

- [ ] **Step 7: Commit**

```bash
rtk git add src/game/encounters/combatPressure.ts src/game/encounters/combatPressure.test.ts src/game/combat/CombatTelemetry.ts src/game/combat/CombatTelemetry.test.ts src/game/scenes/CombatScene.ts src/game/enemies/EnemyManager.ts src/game/enemies/EnemyManager.test.ts
rtk git commit -m "feat: measure combat pressure"
```

### Task 6: Distinguish Piercing From Collision Failure

**Files:**
- Modify: `src/game/orbs/orbRules.ts`
- Modify: `src/game/orbs/orbRules.test.ts`
- Modify: `src/game/enemies/EnemyManager.ts`
- Modify: `src/game/enemies/EnemyManager.test.ts`
- Modify: `src/game/bosses/BossManager.ts`
- Modify: `src/game/bosses/BossManager.test.ts`
- Modify: `src/game/bosses/HiveBossManager.ts`
- Modify: `src/game/bosses/HiveBossManager.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `e2e/combat.spec.ts`

**Interfaces:**
- Consumes: current `directHit(..., piercing, ...)` and `reflect` behavior.
- Produces: `HitResult.piercing: boolean`; `DirectHitEvent.piercing`; visible `orb-pierce-entry` and `orb-pierce-exit` feedback.

- [ ] **Step 1: Write failing semantic and real-browser collision tests**

Unit contract:

```ts
expect(directHit(3, 99, EXPERIMENT_DEFAULTS, true)).toMatchObject({
  reflect: false,
  piercing: true,
});
expect(directHit(3, 1, { passThroughOnKill: true }, false)).toMatchObject({
  reflect: false,
  piercing: false,
});
```

Browser contract creates one fully visible `2 × 2` armored enemy at the center, freezes enemies, and launches a non-inertia orb into its left, right, top, and bottom edge. For every case, assert velocity reverses on the collision axis and HP decreases once. A second case upgrades inertia to its approved pierce level and asserts velocity does not reverse while both named pierce effects appear.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
rtk npx vitest run src/game/orbs/orbRules.test.ts src/game/enemies/EnemyManager.test.ts src/game/bosses/BossManager.test.ts src/game/bosses/HiveBossManager.test.ts
rtk npx playwright test e2e/combat.spec.ts --project=desktop-chromium --grep "armored collision|piercing feedback"
```

Expected: `piercing` semantic field and browser cases are absent.

- [ ] **Step 3: Propagate the existing piercing decision**

Add `piercing` to `HitResult` and return the input flag unchanged. Propagate it through enemy and boss direct-hit events. Do not infer piercing from `reflect === false`, because kill pass-through is a separate rule.

In `CombatScene`, draw a short additive entry flash at the hit point and an exit streak along the orb direction only when `event.piercing` is true. Name them exactly `orb-pierce-entry` and `orb-pierce-exit` for browser assertions.

If the non-piercing armored test fails, fix the shared Arcade body/collider path before proceeding. Do not special-case armored HP or teleport the orb.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the Step 2 commands. Expected: all selected unit and browser tests pass.

- [ ] **Step 5: Commit**

```bash
rtk git add src/game/orbs/orbRules.ts src/game/orbs/orbRules.test.ts src/game/enemies/EnemyManager.ts src/game/enemies/EnemyManager.test.ts src/game/bosses/BossManager.ts src/game/bosses/BossManager.test.ts src/game/bosses/HiveBossManager.ts src/game/bosses/HiveBossManager.test.ts src/game/scenes/CombatScene.ts e2e/combat.spec.ts
rtk git commit -m "fix: clarify orb piercing collisions"
```

### Task 7: Tune Pressure, Document Controls, And Run Final Gates

**Files:**
- Modify: `src/game/encounters/stageDefinitions.ts`
- Modify: `src/game/encounters/stageDefinitions.test.ts`
- Modify: `src/game/encounters/combatPressure.test.ts`
- Modify: `docs/TUNING.md`
- Modify: `docs/WORKLOG.md`
- Modify: `e2e/combat.spec.ts`

**Interfaces:**
- Consumes: six-column formations, deadline, pressure estimate, and telemetry from Tasks 1–6.
- Produces: centrally tuned stage pressure and final regression evidence.

- [ ] **Step 1: Add deterministic stage-pressure acceptance tests**

For seeds `0..31`, estimate every stage phase at its `expectedOrbCount`. Assert:

```ts
expect(opening.score).toBeGreaterThanOrEqual(80);
expect(normalPhaseScores.every((score) => score >= 80 && score <= 120)).toBe(true);
expect(latePhaseScores.every((score) => score <= 135)).toBe(true);
expect(maximumObservedVisibleEmptyMs).toBeLessThanOrEqual(5_000);
```

Add one browser assertion that advancing a normal stage clock never leaves `visiblePopulation === 0` for more than five simulated seconds.

- [ ] **Step 2: Run pressure and encounter tests and verify RED if tuning misses the band**

```bash
rtk npx vitest run src/game/encounters/stageDefinitions.test.ts src/game/encounters/combatPressure.test.ts src/game/encounters/EncounterDirector.test.ts
rtk npx playwright test e2e/combat.spec.ts --project=desktop-chromium --grep "visible enemy deadline"
```

- [ ] **Step 3: Tune only centralized stage inputs**

Adjust in this order until tests pass:

1. formation cell ranges and active caps;
2. HP multipliers;
3. shooter weights and maxima;
4. special-enemy weights;
5. keep descent speed at `8px/s`.

Do not add difficulty branches to `CombatScene` or managers.

- [ ] **Step 4: Update tuning and worklog documentation**

Record exact lookup paths for geometry, downtime, score weights, stage density, HP, shooters, and intentional piercing in `docs/TUNING.md`. Add a dated worklog entry summarizing the six-column migration, offscreen protection, pressure diagnostics, and test scope.

- [ ] **Step 5: Run final verification once**

```bash
rtk bash scripts/verify_gbc_combat_art.sh
rtk npm test
rtk npm run build
rtk npm run test:e2e
rtk git diff --check
```

Expected: asset verifier passes; all unit tests pass; build passes with only the existing chunk-size warning if still present; all Playwright tests pass; diff check is clean.

- [ ] **Step 6: Commit**

```bash
rtk git add src/game/encounters/stageDefinitions.ts src/game/encounters/stageDefinitions.test.ts src/game/encounters/combatPressure.test.ts docs/TUNING.md docs/WORKLOG.md e2e/combat.spec.ts
rtk git commit -m "balance: sustain six-column combat pressure"
```
