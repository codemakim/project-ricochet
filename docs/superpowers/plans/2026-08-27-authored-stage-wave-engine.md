# Authored Stage Wave Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace procedural reinforcement generation and score-gated bosses with thirty authored formations, kill-paced paragraph progression, denser rapid ingress, and a smaller fair player hitbox.

**Architecture:** Stage definitions own three ordered paragraphs and authored formation IDs. `formationRules.ts` converts catalog-backed grid slots into `EnemySpec` objects and deterministically shuffles only inside paragraph boundaries. `EnemyManager` reports per-formation surviving population; `EncounterDirector` releases the next authored formation at 35% survival subject to an active cap, then starts the boss after the tenth formation and all regular enemies are gone.

**Tech Stack:** TypeScript 5.9, Phaser 3.90, Vitest 4.1, Playwright 1.61, Vite 8.1

**Spec:** `docs/superpowers/specs/2026-08-27-authored-stage-wave-engine-design.md`

## Global Constraints

- Keep the existing six-column grid and catalog footprints: basic/shooter `1×1`, splitter `2×1`, armored `2×2`.
- Each stage has opening 3, pressure 4, climax 3 formations; all ten appear exactly once per run.
- Shuffle only inside a paragraph; keep the final climax formation fixed.
- Release the next formation when the most recently released formation has `remaining / initial <= 0.35` and the paragraph active cap can fit it.
- Empty-field reinforcements wait `350ms`; the first formation of a stage has no wait.
- Paragraph target depths are `0.30`, `0.40`, `0.50` from the top.
- Paragraph normal HP multipliers are `1.0`, `1.6`, `2.1`; elite multipliers are `1.0`, `1.4`, `1.8`.
- Active caps are stage 1 `16/22/26`, stage 2 `26/30/30`, stage 3 `28/32/34`.
- Enemy descent remains `9.6px/s`; do not add paragraph descent multipliers.
- Player visual size becomes `72×72`; hurt radius becomes `20`; movement, aim, and pickup radius stay unchanged.
- Reuse existing grid, HP, ingress, seed, split-population, boss, and reward rules. Add no dependency, parser, factory, compatibility path, or adaptive difficulty.
- All shell commands in this repository use the `rtk` prefix.

---

### Task 1: Authored formation and stage-script data

**Files:**
- Create: `src/game/encounters/authoredFormations.ts`
- Modify: `src/game/encounters/stageDefinitions.ts`
- Modify: `src/game/encounters/stageDefinitions.test.ts`

**Interfaces:**
- Consumes: `EnemyKind`, `BossKind`, `ENEMY_CATALOG`, `occupyFootprint()`.
- Produces: `ParagraphId`, `AuthoredFormation`, `StageParagraphDefinition`, `AUTHORED_FORMATIONS`, `STAGES`, `validateStageContent()`.

- [ ] **Step 1: Replace phase/profile assertions with failing authored-content tests**

Add tests that require the exact script shape and central tuning:

```ts
expect(STAGES.map((stage) => stage.paragraphs.map((paragraph) => ({
  id: paragraph.id,
  count: paragraph.formationIds.length,
  activeCap: paragraph.activeCap,
  targetDepthRatio: paragraph.targetDepthRatio,
  normalHpMultiplier: paragraph.normalHpMultiplier,
  eliteHpMultiplier: paragraph.eliteHpMultiplier,
})))).toEqual([
  [
    { id: 'opening', count: 3, activeCap: 16, targetDepthRatio: 0.30, normalHpMultiplier: 1, eliteHpMultiplier: 1 },
    { id: 'pressure', count: 4, activeCap: 22, targetDepthRatio: 0.40, normalHpMultiplier: 1.6, eliteHpMultiplier: 1.4 },
    { id: 'climax', count: 3, activeCap: 26, targetDepthRatio: 0.50, normalHpMultiplier: 2.1, eliteHpMultiplier: 1.8 },
  ],
  [
    { id: 'opening', count: 3, activeCap: 26, targetDepthRatio: 0.30, normalHpMultiplier: 1, eliteHpMultiplier: 1 },
    { id: 'pressure', count: 4, activeCap: 30, targetDepthRatio: 0.40, normalHpMultiplier: 1.6, eliteHpMultiplier: 1.4 },
    { id: 'climax', count: 3, activeCap: 30, targetDepthRatio: 0.50, normalHpMultiplier: 2.1, eliteHpMultiplier: 1.8 },
  ],
  [
    { id: 'opening', count: 3, activeCap: 28, targetDepthRatio: 0.30, normalHpMultiplier: 1, eliteHpMultiplier: 1 },
    { id: 'pressure', count: 4, activeCap: 32, targetDepthRatio: 0.40, normalHpMultiplier: 1.6, eliteHpMultiplier: 1.4 },
    { id: 'climax', count: 3, activeCap: 34, targetDepthRatio: 0.50, normalHpMultiplier: 2.1, eliteHpMultiplier: 1.8 },
  ],
]);
expect(AUTHORED_FORMATIONS).toHaveLength(30);
expect(new Set(AUTHORED_FORMATIONS.map(({ id }) => id)).size).toBe(30);
expect(STAGES.flatMap(({ paragraphs }) => paragraphs.flatMap(({ formationIds }) => formationIds)))
  .toHaveLength(30);
expect(() => validateStageContent()).not.toThrow();
```

Add focused invalid-data cases for duplicate IDs, missing references, overlap, out-of-grid slots, `fragment`, a stage-1 splitter, wrong paragraph counts, duplicate script references, and a climax final ID that is not its last entry. Each assertion checks an error containing the bad formation or stage ID.

- [ ] **Step 2: Run the content test and confirm failure**

Run: `rtk npm test -- src/game/encounters/stageDefinitions.test.ts`

Expected: FAIL because `AUTHORED_FORMATIONS` and `paragraphs` do not exist.

- [ ] **Step 3: Add the minimal authored types and thirty exact layouts**

Create these types in `authoredFormations.ts`:

```ts
export type ParagraphId = 'opening' | 'pressure' | 'climax';

export interface AuthoredFormationSlot {
  kind: Exclude<EnemyKind, 'fragment'>;
  column: number;
  row: number;
}

export interface AuthoredFormation {
  id: string;
  rows: number;
  role: 'corridor' | 'pockets' | 'crossfire' | 'wall';
  slots: readonly AuthoredFormationSlot[];
}
```

Encode the following layout table as slot arrays. This table is the source of truth for the first content pass. Rows are top-to-bottom, always six cells wide. `b` is basic, `s` shooter, `A` is an armored top-left anchor, `P` is a splitter left anchor, `x` is footprint continuation, and `.` is empty. Never create a slot for `x` or `.`.

| ID | Role | Layout rows |
| --- | --- | --- |
| `s1-opening-gate` | corridor | `b.b.s.` / `.b.b.b` / `b...bs` |
| `s1-opening-banks` | pockets | `bb..bb` / `s.b..s` / `.b.bb.` |
| `s1-opening-pocket` | pockets | `Axb.b.` / `xxb.bs` / `b.b..b` / `.s.bb.` |
| `s1-pressure-right-fort` | corridor | `b.s.Ax` / `.bb.xx` / `b..b.s` / `.sbb.b` |
| `s1-pressure-center-guard` | corridor | `b.b..s` / `.bAxb.` / `s.xx.b` / `bb..b.` |
| `s1-pressure-twin-fort` | pockets | `Axb.Ax` / `xxb.xx` / `b.s.b.` / `.bb.sb` |
| `s1-pressure-broken-wall` | wall | `bb.sbb` / `b..b.s` / `.sbb..` / `b.b.bb` |
| `s1-climax-zigzag` | corridor | `Axb.bs` / `xx.b.b` / `bsb.b.` / `.b.Ax.` / `sb.xx.` |
| `s1-climax-crossfire` | crossfire | `sbb.bs` / `b.Axb.` / `.bxx.b` / `bs..sb` / `.bb.b.` |
| `s1-climax-final` | wall | `AxbbAx` / `xx..xx` / `sbbbbs` / `b.Axb.` / `.bxx.b` |
| `s2-opening-split-lanes` | corridor | `Pxb..s` / `.b.Px.` / `s.b..b` / `.bb.b.` |
| `s2-opening-armored-gap` | corridor | `Axb.Px` / `xx..b.` / `b.s..b` / `.b.Px.` |
| `s2-opening-crossfire` | crossfire | `s.Px.s` / `bb..bb` / `.Axb..` / `.xx.bs` |
| `s2-pressure-left-pocket` | pockets | `Axb.Px` / `xxb..s` / `Pxb.b.` / `.s.bb.` / `b..Pxb` |
| `s2-pressure-split-gate` | corridor | `Pxs.Px` / `.b...b` / `b.Axb.` / `s.xx.s` / `.b..b.` |
| `s2-pressure-twin-armor` | pockets | `Axb.Ax` / `xx..xx` / `Pxs.b.` / `.b.Pxs` / `b..b..` |
| `s2-pressure-battery` | crossfire | `sbb.bs` / `Px..Px` / `.bAxb.` / `s.xx.b` / `.b.Px.` |
| `s2-climax-channel` | corridor | `Ax.Px.` / `xxb..s` / `Pxb.Ax` / `.s..xx` / `bb.Px.` |
| `s2-climax-overlap` | pockets | `Pxs.Ax` / `b..bxx` / `Axb.Px` / `xx.s.b` / `.b.Px.` |
| `s2-climax-final` | wall | `AxPxAx` / `xxbbxx` / `s.Px.s` / `Axb.b.` / `xx.Pxs` |
| `s3-opening-fork` | corridor | `Pxs.Px` / `b.Axb.` / `.bxx.s` / `Ax..Px` / `xxb.b.` |
| `s3-opening-pockets` | pockets | `Ax.Px.` / `xxs..b` / `Pxb.Ax` / `.b..xx` / `s.Pxb.` |
| `s3-opening-crossfire` | crossfire | `sPxPxs` / `b....b` / `Axb.Ax` / `xxs.xx` / `.b.Px.` |
| `s3-pressure-maze` | corridor | `Axb.Px` / `xx..s.` / `Pxb.Ax` / `.s..xx` / `bb.Pxb` |
| `s3-pressure-turrets` | crossfire | `s.Ax.s` / `b.xx.b` / `PxbbPx` / `Axs.Ax` / `xxb.xx` |
| `s3-pressure-fortress` | pockets | `AxPxAx` / `xx..xx` / `b.s.b.` / `Px.Ax.` / `sb.xx.` |
| `s3-pressure-broken-grid` | wall | `bPxPxs` / `Axb.Ax` / `xx..xx` / `sPxb.s` / `b..Pxb` |
| `s3-climax-serpent` | corridor | `Ax.Pxs` / `xxb...` / `Pxs.Ax` / `b...xx` / `s.Pxb.` |
| `s3-climax-killbox` | crossfire | `sAxAx.` / `bxxxxb` / `PxbbPx` / `Axs.Ax` / `xxb.xx` |
| `s3-climax-final` | wall | `AxPxAx` / `xxbbxx` / `sPxPxs` / `AxbbAx` / `xxssxx` |

Every `P` has an immediate right-side `x` inside the same row. Treat any other `x` as the
continuation of the nearest `A` above/left. The test validator, not a runtime layout parser,
enforces the resulting slot geometry.

Define paragraph and stage types in `stageDefinitions.ts`:

```ts
export interface StageParagraphDefinition {
  id: ParagraphId;
  formationIds: readonly string[];
  activeCap: number;
  targetDepthRatio: number;
  normalHpMultiplier: number;
  eliteHpMultiplier: number;
}

export interface StageBossDefinition {
  kind: BossKind;
  warningMs: number;
}

export interface StageDefinition {
  id: StageId;
  number: number;
  battlefield: BattlefieldId;
  powerBand: StagePowerBand;
  descentSpeedMultiplier: number;
  paragraphs: readonly StageParagraphDefinition[];
  boss: StageBossDefinition;
}
```

Preserve existing stage power bands and boss kinds/warning durations. Replace `phases` and `scoreTarget` with the approved paragraphs. `validateStageContent()` derives each slot footprint from `ENEMY_CATALOG`, calls `occupyFootprint()`, and performs every invalid-data check from Step 1.

Use this validation boundary so tests can inject one invalid collection without mutating globals:

```ts
export function validateStageContent(
  stages: readonly StageDefinition[] = STAGES,
  formations: readonly AuthoredFormation[] = AUTHORED_FORMATIONS,
  catalog: readonly EnemyCatalogEntry[] = ENEMY_CATALOG,
): void;
```

- [ ] **Step 4: Run the content test and fix only data errors**

Run: `rtk npm test -- src/game/encounters/stageDefinitions.test.ts`

Expected: PASS with 30 valid unique formations and three valid scripts.

- [ ] **Step 5: Commit authored content**

```bash
rtk git add src/game/encounters/authoredFormations.ts src/game/encounters/stageDefinitions.ts src/game/encounters/stageDefinitions.test.ts
rtk git commit -m "feat(encounter): author stage formation scripts"
```

---

### Task 2: Deterministic order and authored formation emission

**Files:**
- Modify: `src/game/encounters/formationRules.ts`
- Modify: `src/game/encounters/formationRules.test.ts`

**Interfaces:**
- Consumes: `AuthoredFormation`, `StageDefinition`, `StageParagraphDefinition`, `ENEMY_CATALOG`, `footprintWorldRect()`.
- Produces: `ResolvedStageFormation`, `resolveStageFormationOrder(stage, runSeed)`, `createAuthoredFormation(stage, paragraph, formationId)`.

- [ ] **Step 1: Replace procedural-generation tests with failing authored-order and emission tests**

Require these signatures and behaviors:

```ts
export interface ResolvedStageFormation {
  id: string;
  paragraphId: ParagraphId;
  paragraphIndex: number;
  sequence: number;
}

const first = resolveStageFormationOrder(STAGES[0], 91);
const repeated = resolveStageFormationOrder(STAGES[0], 91);
expect(first).toEqual(repeated);
expect(first).toHaveLength(10);
expect(new Set(first.map(({ id }) => id)).size).toBe(10);
expect(first.slice(0, 3).every(({ paragraphId }) => paragraphId === 'opening')).toBe(true);
expect(first.slice(3, 7).every(({ paragraphId }) => paragraphId === 'pressure')).toBe(true);
expect(first.slice(7).every(({ paragraphId }) => paragraphId === 'climax')).toBe(true);
expect(first.at(-1)?.id).toBe('s1-climax-final');
expect(resolveStageFormationOrder(STAGES[0], 92)).not.toEqual(first);
```

For every emitted formation, assert catalog-derived footprints, unique occupied cells, correct world coordinates, `formationId` on every enemy, base speed `9.6`, and HP:

```ts
const paragraph = STAGES[1].paragraphs[1];
const result = createAuthoredFormation(STAGES[1], paragraph, paragraph.formationIds[0]);
expect(result.enemies.every((enemy) => enemy.formationId === result.id)).toBe(true);
expect(result.enemies.every((enemy) => enemy.speed === GAME_TUNING.enemies.descentSpeed))
  .toBe(true);
expect(result.enemies.every((enemy) => enemy.hp === GAME_TUNING.enemies.hp[enemy.kind] * (
  enemy.width * enemy.height >= 4
    ? STAGES[1].powerBand.eliteHpMultiplier * paragraph.eliteHpMultiplier
    : STAGES[1].powerBand.normalHpMultiplier * paragraph.normalHpMultiplier
))).toBe(true);
```

Also assert an unknown formation ID throws an error naming that ID and an invalid seed throws the existing unsigned-32-bit error.

- [ ] **Step 2: Run the formation-rule test and confirm failure**

Run: `rtk npm test -- src/game/encounters/formationRules.test.ts`

Expected: FAIL because authored order/emission exports do not exist.

- [ ] **Step 3: Reduce `formationRules.ts` to the authored path**

Keep the existing `validateSeed`, `mix`, `createRandom`, `shuffled`, catalog lookup, `footprintWorldRect`, and HP math. Delete weighted choice, style ordering, profile selection, procedural filling, template mutation, `createInitialFormation()`, and `createReinforcementFormation()`.

Implement:

```ts
export function resolveStageFormationOrder(
  stage: StageDefinition,
  runSeed: number,
): ResolvedStageFormation[];

export function createAuthoredFormation(
  stage: StageDefinition,
  paragraph: StageParagraphDefinition,
  formationId: string,
): FormationResult;
```

Redefine the result without the removed procedural style:

```ts
export interface FormationResult {
  id: string;
  enemies: FormationEnemySpec[];
  populationCost: number;
}
```

Use one seeded shuffle per paragraph with salt derived from `stage.number` and paragraph index. Shuffle all IDs except `climax`'s final ID, then append that final ID. `createAuthoredFormation()` finds the formation and catalog entry, derives width/height, emits above the viewport, applies stage × paragraph HP, and sets `formationId` on every `FormationEnemySpec`.

- [ ] **Step 4: Run focused formation tests**

Run: `rtk npm test -- src/game/encounters/formationRules.test.ts src/game/encounters/stageDefinitions.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the authored emitter**

```bash
rtk git add src/game/encounters/formationRules.ts src/game/encounters/formationRules.test.ts
rtk git commit -m "feat(encounter): emit authored formations"
```

---

### Task 3: Preserve formation identity through enemy lifetime

**Files:**
- Modify: `src/game/enemies/enemyRules.ts`
- Modify: `src/game/enemies/splitterRules.ts`
- Modify: `src/game/enemies/splitterRules.test.ts`
- Modify: `src/game/enemies/EnemyManager.ts`
- Modify: `src/game/enemies/EnemyManager.test.ts`

**Interfaces:**
- Consumes: optional `EnemySpec.formationId`, `populationCostForEnemy()`.
- Produces: `EnemyManagerSnapshot.formationPopulations`, `EnemyManagerSnapshot.topmostEnemyTop`; preserves `formationId` on split fragments.

- [ ] **Step 1: Write failing identity and population tests**

Add `formationId?: string` to expected test specs, then require:

```ts
const boundary = createBoundary([
  { kind: 'splitter', hp: 1, x: 140, y: 120, column: 1, row: 0, width: 2, height: 1, speed: 9.6, formationId: 'wave-a' },
  { kind: 'armored', hp: 12, x: 280, y: 180, column: 3, row: 1, width: 2, height: 2, speed: 9.6, formationId: 'wave-b' },
]);
expect(boundary.manager.getSnapshot().formationPopulations).toEqual({
  'wave-a': 2,
  'wave-b': 4,
});
expect(boundary.manager.getSnapshot().topmostEnemyTop).toBeLessThan(120);
```

Kill the splitter through the existing collision helper and assert its two fragments both retain `formationId: 'wave-a'` and the map still reports `2`. Remove one fragment and assert `wave-a` becomes `1`; remove both and assert its key is absent. Enemies without a formation ID remain supported by unit/debug fixtures but are omitted from `formationPopulations`.

- [ ] **Step 2: Run enemy tests and confirm failure**

Run: `rtk npm test -- src/game/enemies/splitterRules.test.ts src/game/enemies/EnemyManager.test.ts`

Expected: FAIL because formation identity and population maps are not reported.

- [ ] **Step 3: Add identity at the existing enemy boundary**

Add `formationId?: string` to `EnemySpec`, `FragmentSpec`, `EnemySprite`, and `EnemySnapshot`. Copy it in `spawnFormation()`. Extend `fragmentSpecsFor()`'s parent pick to include `formationId` and copy it to both returned fragments.

Build the population map in the existing single active-enemy reduction; do not add a second enemy registry:

```ts
formationPopulations: Object.fromEntries(formationPopulations),
topmostEnemyTop: enemies.reduce((top, enemy) => {
  const body = enemy.body as Phaser.Physics.Arcade.Body;
  return Math.min(top, body.top);
}, Number.POSITIVE_INFINITY),
```

The value added per enemy is the same value currently used for `activePopulation`: footprint area for grid enemies and `populationCostForEnemy()` for detached rows.

- [ ] **Step 4: Run focused enemy tests**

Run: `rtk npm test -- src/game/enemies/splitterRules.test.ts src/game/enemies/EnemyManager.test.ts`

Expected: PASS, including existing rapid-ingress ghost/ejection behavior.

- [ ] **Step 5: Commit enemy identity reporting**

```bash
rtk git add src/game/enemies/enemyRules.ts src/game/enemies/splitterRules.ts src/game/enemies/splitterRules.test.ts src/game/enemies/EnemyManager.ts src/game/enemies/EnemyManager.test.ts
rtk git commit -m "feat(enemy): report formation survivors"
```

---

### Task 4: Scripted encounter director and rapid placement

**Files:**
- Modify: `src/game/config/gameTuning.ts`
- Modify: `src/game/config/gameTuning.test.ts`
- Modify: `src/game/encounters/encounterRules.ts`
- Modify: `src/game/encounters/encounterRules.test.ts`
- Modify: `src/game/encounters/encounterProgressionRules.ts`
- Modify: `src/game/encounters/encounterProgressionRules.test.ts`
- Modify: `src/game/encounters/EncounterDirector.ts`
- Modify: `src/game/encounters/EncounterDirector.test.ts`

**Interfaces:**
- Consumes: `resolveStageFormationOrder()`, `createAuthoredFormation()`, `formationPopulations`, `topmostEnemyTop`.
- Produces: `EncounterDirector.update(deltaMs, enemyState)`, scripted debug snapshot, rapid-ingress targets.

- [ ] **Step 1: Write failing pure rule tests**

Replace score/phase rules with two pure rules:

```ts
export function formationDepleted(initial: number, remaining: number): boolean {
  if (!Number.isFinite(initial) || initial <= 0) throw new RangeError('initial population must be finite and positive');
  if (!Number.isFinite(remaining) || remaining < 0) throw new RangeError('remaining population must be finite and non-negative');
  return remaining / initial <= GAME_TUNING.encounter.nextFormationRemainingRatio;
}

export function canReleaseFormation(
  activePopulation: number,
  incomingPopulation: number,
  activeCap: number,
): boolean {
  return activePopulation + incomingPopulation <= activeCap;
}
```

Test exact boundaries `3/10 -> true`, `4/10 -> false`, and active `18 + 4 <= 22` versus `19 + 4 > 22`. Remove `bossProgressForKill()`, `bossEntryReady()`, `phaseAt()`, and time/top-Y reinforcement gate tests.

- [ ] **Step 2: Write failing director lifecycle tests**

Use an empty state helper:

```ts
const empty = {
  activePopulation: 0,
  topmostEnemyTop: Number.POSITIVE_INFINITY,
  formationPopulations: {},
};
```

Test all of these separately:

1. `update(0, empty)` immediately emits stage 1's first seeded opening formation.
2. While its surviving ratio is above 35%, no second formation appears regardless of elapsed time.
3. At 35% or below, the next formation emits immediately if the opening cap fits it.
4. At 35% or below, a cap overflow blocks until enough older enemies disappear; the cap belongs to the candidate formation's paragraph.
5. If the field becomes empty, `update(349, empty)` waits and the next `update(1, empty)` emits.
6. A non-empty release uses `min(targetDepthY, topmostEnemyTop - cellHeight)` as the emitted formation bottom.
7. Opening/pressure/climax transitions happen after indices `2` and `6`; all ten IDs are released once.
8. After the tenth release, live regular enemies prevent boss warning; an empty map starts warning.
9. Warning duration starts the correct boss; boss reward advances stage; the next `update(0, empty)` emits stage 2's first formation.
10. Third boss defeat completes the run.
11. Snapshot exposes `paragraphId`, `paragraphIndex`, `formationIndex`, `lastFormationId`, `lastFormationRemainingRatio`, `emptyElapsedMs`, `activePopulation`, and `activeCap`, with no `phase` or `bossScore`.

- [ ] **Step 3: Run rule and director tests and confirm failure**

Run: `rtk npm test -- src/game/encounters/encounterRules.test.ts src/game/encounters/encounterProgressionRules.test.ts src/game/encounters/EncounterDirector.test.ts`

Expected: FAIL on the new scripted interfaces.

- [ ] **Step 4: Add central encounter constants**

Change only the encounter tuning object:

```ts
encounter: {
  nextFormationRemainingRatio: 0.35,
  emptyRespawnMs: 350,
  emergencyIngress: { speed: 260 },
  bossEntry: { cleanupMode: 'corridor' as 'corridor' | 'all', padding: 8 },
  grid: { columns: 6, left: 15, cellWidth: 70, cellHeight: 60, gap: 0 },
},
```

Update validation: ratio must be finite and inside `(0, 1)`, empty delay finite/non-negative, ingress speed positive. Remove `targetDepthRatio` because paragraphs own it.

- [ ] **Step 5: Implement the scripted director minimally**

Replace score, phase, spawn interval, pending recipe, and procedural sequence state with:

```ts
private stageOrder: readonly ResolvedStageFormation[];
private formationIndex = -1;
private emptyElapsedMs = 0;
private lastFormationInitialPopulation = 0;
private lastFormationId: string | null = null;
private lastFormationRemainingRatio: number | null = null;
```

`update()` logic order:

1. Advance warning/boss states exactly as today.
2. If no stage formation was released, release index 0 immediately with the opening target depth.
3. Read the last formation's remaining population from the snapshot; missing key means zero.
4. If all ten formations were released, wait for `activePopulation === 0`, then start warning.
5. If the last formation is above 35%, reset `emptyElapsedMs` when enemies exist and return.
6. If empty, increment `emptyElapsedMs` and require `350ms × developmentBalance.reinforcementIntervalMultiplier`.
7. Build the next authored formation, reject cap overflow, then assign rapid target Y and release it.

For rapid target placement, calculate the formation's current bottom from its emitted enemy specs. The target bottom is the paragraph depth when empty, otherwise:

```ts
const targetBottom = Math.min(
  GAME_HEIGHT * paragraph.targetDepthRatio,
  enemyState.topmostEnemyTop - GAME_TUNING.encounter.grid.cellHeight,
);
```

Offset every `rapidIngressTargetY` by `Math.max(0, targetBottom - currentBottom)`. Keep ingress collision, invulnerability, firing suppression, and orb ejection in `EnemyManager` unchanged.

On stage advance, rebuild `stageOrder`, reset formation state, and let the next `update(0, empty)` emit immediately. Preserve global elapsed time, warning lifecycle, boss count, and run completion.

- [ ] **Step 6: Run focused encounter tests**

Run: `rtk npm test -- src/game/config/gameTuning.test.ts src/game/encounters/encounterRules.test.ts src/game/encounters/encounterProgressionRules.test.ts src/game/encounters/EncounterDirector.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit scripted progression**

```bash
rtk git add src/game/config/gameTuning.ts src/game/config/gameTuning.test.ts src/game/encounters/encounterRules.ts src/game/encounters/encounterRules.test.ts src/game/encounters/encounterProgressionRules.ts src/game/encounters/encounterProgressionRules.test.ts src/game/encounters/EncounterDirector.ts src/game/encounters/EncounterDirector.test.ts
rtk git commit -m "feat(encounter): pace stages by authored waves"
```

---

### Task 5: Combat-scene integration and legacy-path deletion

**Files:**
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `src/game/scenes/combatSceneRules.test.ts`
- Modify: `src/game/enemies/EnemyManager.ts`
- Modify: `src/game/enemies/EnemyManager.test.ts`
- Modify: `e2e/combat.spec.ts`

**Interfaces:**
- Consumes: new `EnemyManagerSnapshot` and `EncounterDirector` contracts.
- Produces: one runtime path where the director emits the first and every later formation.

- [ ] **Step 1: Write failing scene contract tests**

Update `CombatDebugSnapshot` expectations to require:

```ts
encounter: {
  paragraphId: 'opening' | 'pressure' | 'climax';
  paragraphIndex: number;
  formationIndex: number;
  spawnSequence: number;
  lastFormationId: string | null;
  lastFormationRemainingRatio: number | null;
  emptyElapsedMs: number;
  activePopulation: number;
  activeCap: number;
}
```

Delete `phase`, `bossScore`, and `debugRecordEnemyKill` from test interfaces. Add one scene-level test proving a kill still grants progression XP but no longer calls an encounter kill-score method.

- [ ] **Step 2: Run scene tests and confirm failure**

Run: `rtk npm test -- src/game/scenes/combatSceneRules.test.ts src/game/enemies/EnemyManager.test.ts`

Expected: FAIL on old initial formation and snapshot fields.

- [ ] **Step 3: Route startup and updates through the director**

In `EnemyManager`, remove the import and default fallback to `createInitialFormation(0)`; omitted `formation` means an empty initial array.

In `CombatScene.create()`:

1. Construct `EncounterDirector`.
2. Construct `EnemyManager` with no hand-created initial formation.
3. Call `advanceEncounter(0)` once after both exist so the director emits stage formation 1.

Pass this state on every later update:

```ts
const { formation, transition } = this.encounterDirector.update(deltaMs, {
  activePopulation: enemies.activePopulation,
  topmostEnemyTop: enemies.topmostEnemyTop,
  formationPopulations: enemies.formationPopulations,
});
```

Remove `recordEnemyKill()` from `handleEnemyKilled()` and remove the DEV `debugRecordEnemyKill` hook. Keep `progression.gainEnemyKill()` unchanged. Update fallback snapshots and E2E TypeScript interfaces to the new fields.

- [ ] **Step 4: Replace score-driven E2E setup with real scripted advancement**

Add one local E2E helper only:

```ts
async function clearCurrentFormationAndAdvance(page: Page): Promise<CombatSnapshot> {
  return sceneCall(page, (scene) => {
    const before = scene.getDebugSnapshot();
    scene.debugRemoveEnemies(before.enemies.map(({ id }) => id));
    scene.debugAdvanceEncounter(350);
    return scene.getDebugSnapshot();
  });
}
```

Replace loops that call `debugRecordEnemyKill()` with at most ten calls to this helper and assertions on `formationIndex`/boss state. Replace the procedural-variation E2E with authored guarantees: paragraph-local ID membership, distinct consecutive IDs, and fixed `*-climax-final` at index 9. Same-seed determinism remains a unit test because a normal restart intentionally creates a new run seed.

Add two focused runtime cases:

1. Remove every enemy, advance `349ms`, assert no replacement yet; advance `1ms`, assert a rapid-ingress formation exists and its `lastFormationId` changed. This proves an empty interval cannot approach the five-second playtest ceiling.
2. Leave the newest formation at or below 35%, keep one older survivor, advance `0ms`, and assert both the survivor and a new formation ID are present. Repeat at formation indices `3` and `7` to prove pressure/climax paragraph transitions do not create a gap.

- [ ] **Step 5: Run scene and focused browser tests**

Run: `rtk npm test -- src/game/scenes/combatSceneRules.test.ts src/game/enemies/EnemyManager.test.ts`

Run: `rtk npm run build`

Run: `rtk npx playwright test e2e/combat.spec.ts --project=chromium --grep "authored|reinforcement|boss warning"`

Expected: all PASS.

- [ ] **Step 6: Commit the single runtime path**

```bash
rtk git add src/game/scenes/CombatScene.ts src/game/scenes/combatSceneRules.test.ts src/game/enemies/EnemyManager.ts src/game/enemies/EnemyManager.test.ts e2e/combat.spec.ts
rtk git commit -m "refactor(combat): use scripted formations end to end"
```

---

### Task 6: Player geometry and boss-spread fairness

**Files:**
- Modify: `src/game/config/gameTuning.ts`
- Modify: `src/game/config/gameTuning.test.ts`
- Modify: `e2e/combat.spec.ts`

**Interfaces:**
- Consumes: existing `GAME_TUNING.player.visual`, `PLAYER_RADIUS`, Phaser player circle body, sentinel projectile snapshots.
- Produces: `72×72` player visual, `20px` hurt radius, actual three-way-gap browser proof.

- [ ] **Step 1: Write failing geometry tests**

Pin only the approved values and unchanged controls:

```ts
expect(GAME_TUNING.player.visual).toEqual({ width: 72, height: 72, hurtRadius: 20 });
expect(PLAYER_SPEED).toBe(420);
expect(ORB_PICKUP_RADIUS).toBe(50);
expect(GAME_TUNING.projectiles.bossAimed).toMatchObject({
  speed: 220,
  count: 3,
  spreadDegrees: 24,
});
```

Add a browser assertion that the rendered player is `72×72` and its circular physics body is `40×40`.

- [ ] **Step 2: Add the failing spread-gap browser test**

Start the sentinel with `scene.startBoss('sentinel')`, advance the clock until one `bossAimed` three-projectile volley exists, and select the two adjacent projectile snapshots with the largest downward velocity. Move `scene.player` to the horizontal midpoint of their projected x positions at player y. Advance in `16ms` steps until both pass player y. Assert health is unchanged and the player x stayed between their x positions throughout. Fail if the volley never reaches player y within `4_000ms`.

- [ ] **Step 3: Run tests and confirm failure on old size**

Run: `rtk npm test -- src/game/config/gameTuning.test.ts`

Run: `rtk npx playwright test e2e/combat.spec.ts --project=chromium --grep "spread gap"`

Expected: geometry test FAIL with `82/28`; browser test may fail because the old body is too wide.

- [ ] **Step 4: Change only player visual geometry**

```ts
player: { visual: { width: 72, height: 72, hurtRadius: 20 } },
```

Do not change `PLAYER_SPEED`, `ORB_PICKUP_RADIUS`, boss projectile count, speed, damage, radius, or spread.

- [ ] **Step 5: Run geometry and browser fairness tests**

Run: `rtk npm test -- src/game/config/gameTuning.test.ts`

Run: `rtk npx playwright test e2e/combat.spec.ts --project=chromium --grep "spread gap|player visual"`

Expected: PASS.

- [ ] **Step 6: Commit player fairness**

```bash
rtk git add src/game/config/gameTuning.ts src/game/config/gameTuning.test.ts e2e/combat.spec.ts
rtk git commit -m "fix(player): fit between boss spread shots"
```

---

### Task 7: Remove dead procedural code, update tuning documentation, and verify

**Files:**
- Modify: `src/game/encounters/formationGrid.ts`
- Modify: `src/game/encounters/formationGrid.test.ts`
- Modify: `docs/TUNING.md`
- Modify: `docs/WORKLOG.md`
- Test: `src/**/*.test.ts`
- Test: `e2e/combat.spec.ts`
- Test: `e2e/meta-loop.spec.ts`

**Interfaces:**
- Consumes: completed authored runtime.
- Produces: no live/dead procedural split, accurate tuning index, full regression proof.

- [ ] **Step 1: Prove legacy symbols have no callers**

Run:

```bash
rtk rg -n "createInitialFormation|createReinforcementFormation|FormationStyle|FormationProfile|FORMATION_PROFILES|FORMATION_TEMPLATES|reservedPassageCells|startsAtScore|scoreTarget|bossScore|phaseAt|bossProgressForKill|debugRecordEnemyKill" src e2e
```

Expected: no production callers. Any remaining hit must be deleted or renamed to the new paragraph/script concept; do not retain compatibility exports.

- [ ] **Step 2: Delete procedural-only grid code and tests**

Delete `reservedPassageCells()` and its tests. Preserve `FORMATION_COLUMNS`, `validateFootprint()`, `occupyFootprint()`, and world-rectangle conversion. Run:

`rtk npm test -- src/game/encounters/formationGrid.test.ts src/game/encounters/formationRules.test.ts`

Expected: PASS.

- [ ] **Step 3: Update the tuning index and worklog**

In `docs/TUNING.md`, replace score/phase/spawn-interval guidance with:

- Layouts and paragraph order: `authoredFormations.ts`, `stageDefinitions.ts`
- Release threshold and empty delay: `GAME_TUNING.encounter`
- Paragraph depth, HP, active cap: `STAGES[].paragraphs[]`
- Player size/hitbox: `GAME_TUNING.player.visual`

Add a dated `2026-08-27` entry to `docs/WORKLOG.md`: procedural formations and kill-score boss gates were replaced by 30 authored formations, 35% overlap release, 30/40/50% ingress depths, and the 72/20 player geometry. State that more authored content is a data-only follow-up, not deferred runtime work.

- [ ] **Step 4: Run the complete verification gate once**

Run:

```bash
rtk npm test
rtk npm run build
rtk npx playwright test --project=chromium
```

Expected: all unit tests PASS, TypeScript/Vite build PASS, all Chromium E2E PASS.

- [ ] **Step 5: Inspect final diff and commit cleanup**

Run:

```bash
rtk git diff --check
rtk git status --short
rtk git diff --stat
```

Commit:

```bash
rtk git add src/game/encounters/formationGrid.ts src/game/encounters/formationGrid.test.ts docs/TUNING.md docs/WORKLOG.md
rtk git commit -m "docs(encounter): record authored stage tuning"
```

- [ ] **Step 6: Stop after reporting evidence**

Report the exact unit-test count, build result, Chromium E2E count, commit list, and any intentionally deferred content. Do not merge or push unless the user asks.
