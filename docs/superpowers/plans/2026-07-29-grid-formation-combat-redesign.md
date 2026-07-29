# Grid Formation Combat Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the small independent enemy swarm with an 8-column, multi-cell, smoothly descending formation system and start each run with one selected permanent orb followed by a guaranteed early second orb.

**Architecture:** Extend the existing seeded formation generator instead of introducing a tilemap engine. A pure grid module validates rectangular footprints and converts them to world rectangles; `formationRules` uses it to build reusable 2–5 row chunks, while `EnemyManager` keeps Phaser sprites moving at one shared constant descent speed. Existing stage, boss, run and meta data migrate only after a stage-one vertical slice passes.

**Tech Stack:** TypeScript 5.9, Phaser 3.90 Arcade Physics, Vitest 4, Playwright 1.61, Vite 8.

## Global Constraints

- Logical battlefield width is exactly 8 columns.
- Grid coordinates are only for placement, occupancy, split positions and boss movement bounds.
- Rendering, collision and movement use world coordinates.
- Normal formations descend continuously at constant pixel velocity; no row stepping or snapping.
- Formation chunks are 2–5 rows high and use seeded generation.
- Normal footprint sizes are `1×1`, `2×1`, `1×2`, `2×2`, and `3×2`; boss maximum is `6×4`.
- Default run start is exactly one unlocked permanent core.
- The first level-up guarantees a second permanent orb and lets the player select its type from unlocked cores.
- Enemy HP never scales from observed live player DPS.
- Descent speed stays `8 px/s` unless a later playtest explicitly changes it.
- No tilemap dependency, formation editor, new enemy kind, new weapon, graphics pass or sound pass.
- Browser checks run after Task 4 and Task 8, not after every task.

---

## File Map

- Create `src/game/encounters/formationGrid.ts`: footprint validation, occupancy and world rectangle conversion.
- Create `src/game/encounters/formationGrid.test.ts`: pure grid behavior.
- Modify `src/game/enemies/enemyRules.ts`: add row and rectangular footprint to `EnemySpec`.
- Modify `src/game/encounters/formationRules.ts`: generate seeded multi-cell chunks with existing formation styles.
- Modify `src/game/encounters/formationRules.test.ts`: chunk size, footprint and seed coverage.
- Modify `src/game/encounters/stageDefinitions.ts`: footprint catalog, chunk cell ranges and power bands.
- Modify `src/game/encounters/stageDefinitions.test.ts`: validate new data.
- Modify `src/game/enemies/EnemyManager.ts`: size sprites and Arcade bodies from footprints while preserving smooth descent.
- Modify `src/game/enemies/EnemyManager.test.ts`: runtime body size, descent and snapshot coverage.
- Modify `src/game/enemies/splitterRules.ts`: split a `2×1` footprint into two bounded `1×1` fragments.
- Modify `src/game/enemies/splitterRules.test.ts`: split footprint coverage.
- Modify `src/game/encounters/EncounterDirector.ts`: supply 2–5 row chunks and stop pending supply at boss warning.
- Modify `src/game/encounters/EncounterDirector.test.ts`: seeded chunk supply and boss cutoff.
- Modify `src/game/config/gameTuning.ts`: central grid geometry, preliminary HP and power-band numbers.
- Modify `src/game/config/gameTuning.test.ts`: tuning validation.
- Modify `src/game/scenes/CombatScene.ts`: pass footprint data, expose it in debug snapshots and apply one-orb start.
- Modify `src/game/scenes/combatTextureRules.ts`: generate tile-friendly enemy textures at neutral source sizes.
- Modify `src/game/scenes/combatTextureRules.test.ts`: texture descriptor coverage.
- Modify `src/game/bosses/bossGeometry.ts`: express sentinel/siege outer bounds in grid-sized world rectangles.
- Modify `src/game/bosses/bossGeometry.test.ts`: boss footprint and world-bound coverage.
- Modify `src/game/bosses/bossMovementRules.ts`: retain enemy-obstacle-limited boss movement with larger footprints.
- Modify `src/game/bosses/bossMovementRules.test.ts`: movement range expands after nearby enemies disappear.
- Modify `src/game/bosses/hiveBossGeometry.ts`: enlarge hive body and ensure every visible gun has a hitbox.
- Modify `src/game/bosses/hiveBossGeometry.test.ts`: hive part hitbox coverage.
- Modify `src/game/bosses/BossManager.ts`: use revised part geometry.
- Modify `src/game/bosses/HiveBossManager.ts`: use revised part geometry.
- Modify `src/game/constants.ts`: set `STARTING_ORB_COUNT` to `1`.
- Modify `src/game/orbs/OrbManager.ts`: accept one starting core and retain runtime additions.
- Modify `src/game/orbs/OrbManager.test.ts`: one-orb configuration and second-orb addition.
- Modify `src/game/run/runContract.ts`: one-core run loadout.
- Modify `src/game/run/runContract.test.ts`: one-core contract.
- Modify `src/game/meta/metaProgress.ts`: one-core loadout operations.
- Modify `src/game/meta/metaProgress.test.ts`: one-core selection.
- Modify `src/game/meta/MetaStore.ts`: migrate schema 1 three-core saves to schema 2 one-core saves.
- Modify `src/game/meta/MetaStore.test.ts`: migration and corrupt data coverage.
- Modify `src/game/meta/AppController.ts`: render one starting-core selector.
- Modify `src/game/progression/progressionRules.ts`: first level-up only offers `additional-core`.
- Modify `src/game/progression/progressionRules.test.ts`: guaranteed first core reward.
- Modify `src/game/progression/BuildState.ts`: calculate orb limit from a one-orb base.
- Modify `src/game/progression/BuildState.test.ts`: revised limit.
- Modify `src/game/progression/BossBuild.ts`: expose boss orb-limit bonus rather than a three-orb absolute limit.
- Modify `src/game/progression/BossBuild.test.ts`: revised bonus.
- Modify `src/game/ui/OrbLoadoutOverlay.ts`: starting selection capacity one and unlocked-core filtering.
- Modify `src/game/ui/OrbLoadoutOverlay.test.ts`: filtered starting and additional choices.
- Modify `e2e/combat.spec.ts`: grid formation and early second orb.
- Modify `e2e/meta-loop.spec.ts`: one-core deploy and persistence.

---

### Task 1: Pure 8-Column Footprint Grid

**Files:**
- Create: `src/game/encounters/formationGrid.ts`
- Create: `src/game/encounters/formationGrid.test.ts`
- Modify: `src/game/config/gameTuning.ts`
- Modify: `src/game/config/gameTuning.test.ts`

**Interfaces:**
- Produces: `GridFootprint`, `WorldRect`, `FORMATION_COLUMNS`, `validateFootprint()`, `occupyFootprint()`, `footprintWorldRect()`.
- Consumes: `GAME_TUNING.encounter.grid`.

- [ ] **Step 1: Add failing grid tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  FORMATION_COLUMNS,
  footprintWorldRect,
  occupyFootprint,
  validateFootprint,
} from './formationGrid';

describe('formation grid', () => {
  it('occupies every cell in a multi-cell rectangle and rejects overlap', () => {
    const occupied = new Set<string>();
    occupyFootprint(occupied, { column: 2, row: 1, width: 2, height: 2 }, 4);
    expect([...occupied].sort()).toEqual(['1:2', '1:3', '2:2', '2:3']);
    expect(() => occupyFootprint(
      occupied,
      { column: 3, row: 2, width: 1, height: 1 },
      4,
    )).toThrow('formation footprints overlap');
  });

  it('rejects footprints outside eight columns or the chunk rows', () => {
    expect(FORMATION_COLUMNS).toBe(8);
    expect(() => validateFootprint(
      { column: 7, row: 0, width: 2, height: 1 },
      3,
    )).toThrow('formation footprint is outside the grid');
  });

  it('converts adjacent cells to one gap-aware world rectangle', () => {
    expect(footprintWorldRect(
      { column: 1, row: 2, width: 2, height: 1 },
      80,
    )).toEqual({ x: 121, y: 200, width: 100, height: 44 });
  });
});
```

- [ ] **Step 2: Verify the tests fail**

Run: `rtk npm test -- src/game/encounters/formationGrid.test.ts`

Expected: FAIL because `formationGrid.ts` does not exist.

- [ ] **Step 3: Add central grid tuning and the minimal pure module**

Add to `GAME_TUNING.encounter`:

```ts
grid: {
  columns: 8,
  left: 17,
  cellWidth: 52,
  cellHeight: 48,
  gap: 4,
},
```

Create the module with these signatures:

```ts
export interface GridFootprint {
  column: number;
  row: number;
  width: number;
  height: number;
}

export interface WorldRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const FORMATION_COLUMNS = GAME_TUNING.encounter.grid.columns;

export function validateFootprint(footprint: GridFootprint, rows: number): void;
export function occupyFootprint(
  occupied: Set<string>,
  footprint: GridFootprint,
  rows: number,
): void;
export function footprintWorldRect(
  footprint: GridFootprint,
  originY: number,
): WorldRect;
```

Use `x = left + column * cellWidth + width * cellWidth / 2`, `y = originY + row * cellHeight + height * cellHeight / 2`, and subtract `gap` once from the rendered width and height.

- [ ] **Step 4: Validate tuning and run focused tests**

Add assertions that columns, cell sizes and gap are positive integers, columns equal 8, and gap is smaller than both cell sizes.

Run: `rtk npm test -- src/game/encounters/formationGrid.test.ts src/game/config/gameTuning.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/game/encounters/formationGrid.ts src/game/encounters/formationGrid.test.ts src/game/config/gameTuning.ts src/game/config/gameTuning.test.ts
rtk git commit -m "feat: add multi-cell formation grid"
```

### Task 2: Seeded Multi-Cell Formation Chunks

**Files:**
- Modify: `src/game/enemies/enemyRules.ts`
- Modify: `src/game/encounters/formationRules.ts`
- Modify: `src/game/encounters/formationRules.test.ts`
- Modify: `src/game/encounters/stageDefinitions.ts`
- Modify: `src/game/encounters/stageDefinitions.test.ts`

**Interfaces:**
- Consumes: `GridFootprint`, `occupyFootprint()`, `footprintWorldRect()`.
- Produces: footprint-aware `EnemySpec`, `FormationTemplate`, `FormationProfile.cellMinimum`, `FormationProfile.cellMaximum`, `FormationProfile.rowMinimum`, `FormationProfile.rowMaximum`, and seeded `FormationResult`.

- [ ] **Step 1: Write failing footprint-aware formation tests**

Add tests that assert:

```ts
const first = createReinforcementFormation(recipe, 0, 91);
const repeated = createReinforcementFormation(recipe, 0, 91);

expect(first).toEqual(repeated);
expect(first.enemies.every(({ row, width, height }) =>
  Number.isInteger(row) && width >= 1 && height >= 1)).toBe(true);
expect(first.enemies.some(({ width, height }) => width > 1 || height > 1)).toBe(true);
expect(Math.max(...first.enemies.map(({ row, height }) => row + height))).toBeLessThanOrEqual(5);
```

Build an occupied-cell set from every returned enemy and assert no cell repeats. Assert a splitter is always `2×1`, armored is `2×2`, and basic/shooter are `1×1`.

- Add one fixed-template assertion whose footprint list is returned unchanged.
- Add one mixed-template assertion whose skeleton stays the same while optional slots and eligible kinds vary by seed.
- Keep the existing procedural-style assertion to cover rule-only generation.

- [ ] **Step 2: Verify focused failure**

Run: `rtk npm test -- src/game/encounters/formationRules.test.ts src/game/encounters/stageDefinitions.test.ts`

Expected: FAIL because `EnemySpec` has no row, width or height.

- [ ] **Step 3: Extend enemy and catalog data**

Change `EnemySpec` to:

```ts
export interface EnemySpec {
  kind: EnemyKind;
  hp: number;
  x: number;
  y: number;
  column: number;
  row: number;
  width: number;
  height: number;
  speed: number;
  side?: FragmentSide;
}
```

Add `width` and `height` to `EnemyCatalogEntry`. Use:

```ts
basic: 1×1
shooter: 1×1
splitter: 2×1
armored: 2×2
```

Replace profile enemy-count ranges with occupied-cell and row ranges:

```ts
export interface FormationProfile {
  id: string;
  styleWeights: Readonly<Partial<Record<FormationStyle, number>>>;
  cellMinimum: number;
  cellMaximum: number;
  rowMinimum: number;
  rowMaximum: number;
  allowedTags: readonly EnemyTag[];
  excludedKinds?: readonly EnemyKind[];
}
```

Add the minimum reusable template contract:

```ts
export interface FormationTemplateSlot extends GridFootprint {
  kind?: Exclude<EnemyKind, 'fragment'>;
  optional?: boolean;
}

export interface FormationTemplate {
  id: string;
  mode: 'fixed' | 'mixed';
  rows: number;
  slots: readonly FormationTemplateSlot[];
  minStage: number;
  weight: number;
}
```

Create four battlefield-wide templates in `stageDefinitions.ts`, not copies per stage:

- `staggered-lanes`: mixed, three rows, alternating dense groups and a two-column lane;
- `side-fort`: mixed, four rows, one `2×2` anchor and open opposite side;
- `split-gate`: fixed, three rows, one `2×1` splitter between `1×1` guards;
- `broken-wall`: mixed, five rows, two separated clusters with a wide center gap.

Profiles reference eligible template IDs plus a `proceduralWeight`. `fixed` preserves every slot and explicit kind. `mixed` mirrors the skeleton from the seed, drops each optional slot with a 25% seeded chance, and assigns unspecified kinds from the stage catalog. Procedural selection continues to use the existing style weights.

Use preliminary profiles:

```ts
opening: 8–12 cells, 2–3 rows
pressure: 11–16 cells, 3–4 rows
assault: 14–20 cells, 3–5 rows
onslaught: 17–24 cells, 4–5 rows
```

- [ ] **Step 4: Replace point selection with footprint placement**

Keep the existing seeded RNG and style ordering. For each ordered anchor:

1. Choose an eligible kind using existing weights and caps.
2. Read its catalog footprint.
3. Skip the anchor if the rectangle exceeds chunk bounds or overlaps occupied cells.
4. Occupy the rectangle and emit one `EnemySpec`.
5. Stop when occupied cells reach the profile target.

Use `footprintWorldRect()` for `x` and `y`. Remove row-offset jitter because it breaks visible tile alignment. Preserve seeded mirror selection and non-repeating style bags.

Choose a source from the profile's weighted template IDs plus `proceduralWeight`. Template and procedural sources share the same occupancy validator and kind assignment; do not create separate runtime paths after `EnemySpec[]` is emitted.

- [ ] **Step 5: Update stage validation**

Validate `rowMinimum >= 2`, `rowMaximum <= 5`, ordered cell ranges, positive footprints, and footprint widths no larger than 8. Capacity checks must use occupied cells rather than enemy count.

Run: `rtk npm test -- src/game/encounters/formationRules.test.ts src/game/encounters/stageDefinitions.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
rtk git add src/game/enemies/enemyRules.ts src/game/encounters/formationRules.ts src/game/encounters/formationRules.test.ts src/game/encounters/stageDefinitions.ts src/game/encounters/stageDefinitions.test.ts
rtk git commit -m "feat: generate seeded multi-cell formations"
```

### Task 3: Runtime Size, Smooth Descent and Splitting

**Files:**
- Modify: `src/game/enemies/enemyRules.ts`
- Modify: `src/game/enemies/EnemyManager.ts`
- Modify: `src/game/enemies/EnemyManager.test.ts`
- Modify: `src/game/enemies/splitterRules.ts`
- Modify: `src/game/enemies/splitterRules.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `src/game/scenes/combatTextureRules.ts`
- Modify: `src/game/scenes/combatTextureRules.test.ts`

**Interfaces:**
- Consumes: footprint-aware `EnemySpec`, `footprintWorldRect()`.
- Produces: footprint-sized Arcade bodies and `EnemySnapshot.footprint`.

- [ ] **Step 1: Write failing EnemyManager runtime tests**

Spawn a `2×2` armored spec at speed 8 and assert:

```ts
expect(snapshot.enemies[0]).toMatchObject({
  kind: 'armored',
  footprint: { column: 1, row: 0, width: 2, height: 2 },
  speed: 8,
});
expect(sprite.displayWidth).toBe(100);
expect(sprite.displayHeight).toBe(92);
expect((sprite.body as Phaser.Physics.Arcade.Body).width).toBe(100);
expect((sprite.body as Phaser.Physics.Arcade.Body).height).toBe(92);
```

Advance the Phaser clock by 1,000 ms and assert the enemy y position increases by approximately 8 px, not 48 px.

- [ ] **Step 2: Verify runtime tests fail**

Run: `rtk npm test -- src/game/enemies/EnemyManager.test.ts src/game/enemies/splitterRules.test.ts`

Expected: FAIL because snapshots and bodies do not expose footprints.

- [ ] **Step 3: Size sprites and bodies from emitted world rectangles**

Extend `EnemySprite` and `EnemySnapshot` with `column`, `row`, `width`, and `height`. In `spawnFormation()`:

```ts
enemy.setDisplaySize(spec.widthPx, spec.heightPx);
enemy.body.setSize(spec.widthPx, spec.heightPx, true);
enemy.setImmovable(true).setVelocity(0, spec.speed);
```

Do not add an update-time grid snap. Every enemy in one chunk receives the same stage descent speed.

To avoid duplicating pixel dimensions, add `pixelWidth` and `pixelHeight` to `EnemySpec` when the formation is emitted and use those exact fields here.

- [ ] **Step 4: Convert splitter fragments to bounded `1×1` footprints**

Change the splitter helper to:

```ts
export function fragmentSpecsFor(
  parent: Pick<EnemySpec, 'x' | 'y' | 'column' | 'row' | 'speed'>,
): readonly [EnemySpec, EnemySpec];
```

Emit left at `column`, right at `column + 1`, both with `width: 1`, `height: 1`, and world centers calculated from the grid. Preserve left/right texture markers. Clamp only against the battlefield wall; do not search unrelated empty cells.

- [ ] **Step 5: Use neutral tile textures**

Keep the existing generated texture pipeline. Generate each regular enemy texture at one-cell source size, then rely on `setDisplaySize()` for larger enemies. Do not create separate textures for every footprint.

Run: `rtk npm test -- src/game/enemies/EnemyManager.test.ts src/game/enemies/splitterRules.test.ts src/game/scenes/combatTextureRules.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
rtk git add src/game/enemies/enemyRules.ts src/game/enemies/EnemyManager.ts src/game/enemies/EnemyManager.test.ts src/game/enemies/splitterRules.ts src/game/enemies/splitterRules.test.ts src/game/scenes/CombatScene.ts src/game/scenes/combatTextureRules.ts src/game/scenes/combatTextureRules.test.ts
rtk git commit -m "feat: render smooth multi-cell enemies"
```

### Task 4: First-Stage Vertical Slice and Continuous Chunk Supply

**Files:**
- Modify: `src/game/encounters/EncounterDirector.ts`
- Modify: `src/game/encounters/EncounterDirector.test.ts`
- Modify: `src/game/encounters/encounterRules.ts`
- Modify: `src/game/encounters/encounterRules.test.ts`
- Modify: `src/game/encounters/stageDefinitions.ts`
- Modify: `src/game/config/gameTuning.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `e2e/combat.spec.ts`

**Interfaces:**
- Consumes: `FormationResult.populationCost`, footprint-aware `EnemySpec`.
- Produces: stage-one 2–5 row continuous supply and boss-warning cutoff.

- [ ] **Step 1: Add failing encounter tests**

Test these transitions:

```ts
director.update(8_000, {
  activePopulation: 0,
  topmostEnemyY: 80,
});
```

returns one footprint-aware formation; repeated updates before `spawnIntervalMs` return `null`; a boss warning clears `pendingFormation`; no formation is returned in `bossWarning`, `boss`, `bossRewardPaused`, or `runComplete`.

Assert that two consecutive formations from one seed have different IDs but replay identically in a second director with the same seed.

- [ ] **Step 2: Verify encounter failure**

Run: `rtk npm test -- src/game/encounters/EncounterDirector.test.ts src/game/encounters/encounterRules.test.ts`

Expected: FAIL where old population and profile assumptions remain.

- [ ] **Step 3: Adapt supply rules to occupied population**

Keep the existing release condition: a new chunk enters only after the previous topmost enemy passes `reinforcementReleaseY` and the phase interval elapsed. Count `populationCost` from logical occupied cells:

```ts
populationCost = enemies.reduce(
  (sum, enemy) => sum + enemy.width * enemy.height,
  0,
);
```

Splitter fragments retain population cost one each. Boss warning must discard pending chunks and stop generation.

- [ ] **Step 4: Configure stage one vertical slice**

Use:

```ts
descentSpeed: 8
stage 1 hpMultiplier: 1
stage 1 phase active caps: 24, 30, 36 occupied cells
stage 1 spawn intervals: 9_000, 8_000, 7_000 ms
```

Set preliminary base HP:

```ts
basic: 3
shooter: 4
armored: 10
splitter: 7
fragment: 2
```

Keep stages two and three at their existing HP and timing values for this checkpoint. They use the new footprint generator, but Task 5 supplies their final occupied-cell caps and power bands.

- [ ] **Step 5: Run unit and build checks**

Run:

```bash
rtk npm test
rtk npm run build
```

Expected: all unit tests and TypeScript build pass.

- [ ] **Step 6: Run one browser checkpoint**

Run: `rtk npm run test:e2e -- e2e/combat.spec.ts`

Verify:

- stage one contains visible `1×1`, `2×1` and `2×2` targets;
- empty lanes remain between clusters;
- every enemy moves smoothly at 8 px/s;
- large enemy visual bounds match collision bounds;
- stage one reaches its boss without a stuck reinforcement.

- [ ] **Step 7: Commit vertical slice**

```bash
rtk git add src/game/encounters src/game/config/gameTuning.ts src/game/scenes/CombatScene.ts e2e/combat.spec.ts
rtk git commit -m "feat: ship grid formation vertical slice"
```

### Task 5: Migrate All Stages and Power Bands

**Files:**
- Modify: `src/game/encounters/stageDefinitions.ts`
- Modify: `src/game/encounters/stageDefinitions.test.ts`
- Modify: `src/game/encounters/formationRules.ts`
- Modify: `src/game/encounters/formationRules.test.ts`
- Modify: `src/game/config/gameTuning.ts`
- Modify: `src/game/config/gameTuning.test.ts`

**Interfaces:**
- Produces: `StagePowerBand` attached to every stage and no legacy point-only formation path.
- Consumes: multi-cell formation generator from Task 2.

- [ ] **Step 1: Add failing power-band and migration tests**

```ts
expect(STAGES.map(({ powerBand }) => powerBand)).toEqual([
  { expectedOrbCount: 2, normalHpMultiplier: 1, eliteHpMultiplier: 1, largeEnemyRatio: 0.12 },
  { expectedOrbCount: 3, normalHpMultiplier: 1.6, eliteHpMultiplier: 1.8, largeEnemyRatio: 0.22 },
  { expectedOrbCount: 4, normalHpMultiplier: 2.4, eliteHpMultiplier: 2.8, largeEnemyRatio: 0.32 },
]);
expect(STAGES.every(({ descentSpeedMultiplier }) => descentSpeedMultiplier === 1)).toBe(true);
```

Assert every stage phase can fill its minimum occupied-cell target from eligible footprints.

- [ ] **Step 2: Verify tests fail**

Run: `rtk npm test -- src/game/encounters/stageDefinitions.test.ts src/game/encounters/formationRules.test.ts`

Expected: FAIL because stages have no `powerBand`.

- [ ] **Step 3: Add and apply `StagePowerBand`**

```ts
export interface StagePowerBand {
  expectedOrbCount: number;
  normalHpMultiplier: number;
  eliteHpMultiplier: number;
  largeEnemyRatio: number;
}
```

Use `normalHpMultiplier` for `1×1` and `2×1`; use `eliteHpMultiplier` for `2×2` and `3×2`. Use `largeEnemyRatio` as a seeded target ratio, not a forced exact count. Keep all descent multipliers at 1.

- [ ] **Step 4: Finalize stage-two and stage-three formation data**

Replace stage-two and stage-three enemy-count caps with occupied-cell caps and their final profile pools. Assert `createInitialFormation()` and `createReinforcementFormation()` both return footprint-aware specs. Delete the obsolete count-based `generateWithPressure()` helper and row-jitter constants if Task 2 left them temporarily for test migration.

- [ ] **Step 5: Run focused and full tests**

Run:

```bash
rtk npm test -- src/game/encounters
rtk npm test
rtk npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
rtk git add src/game/encounters src/game/config/gameTuning.ts src/game/config/gameTuning.test.ts
rtk git commit -m "feat: migrate stages to power-band formations"
```

### Task 6: One Starting Core and Save Migration

**Files:**
- Modify: `src/game/constants.ts`
- Modify: `src/game/orbs/OrbManager.ts`
- Modify: `src/game/orbs/OrbManager.test.ts`
- Modify: `src/game/run/runContract.ts`
- Modify: `src/game/run/runContract.test.ts`
- Modify: `src/game/meta/metaProgress.ts`
- Modify: `src/game/meta/metaProgress.test.ts`
- Modify: `src/game/meta/MetaStore.ts`
- Modify: `src/game/meta/MetaStore.test.ts`
- Modify: `src/game/meta/AppController.ts`
- Modify: `src/game/ui/OrbLoadoutOverlay.ts`
- Modify: `src/game/ui/OrbLoadoutOverlay.test.ts`

**Interfaces:**
- Produces: `CoreLoadout = [OrbCoreId]`, schema version 2, one-orb `OrbStore`.
- Consumes: existing unlocked-core list.

- [ ] **Step 1: Write failing one-core contract tests**

```ts
const config = createRunConfig(['echo'], 7, 'run-1');
expect(config.loadout).toEqual(['echo']);
expect(() => createRunConfig([], 7, 'run-2')).toThrow(
  'run loadout must contain exactly one core',
);
```

Add an `OrbStore` assertion that initial snapshots have length one, configuring `['inertia']` changes that orb, and `addOrb('echo')` creates a second orb.

- [ ] **Step 2: Add failing schema migration test**

Store this schema 1 value:

```ts
{
  schemaVersion: 1,
  parts: 40,
  unlockedCores: ['echo', 'inertia'],
  loadout: ['inertia', 'echo', 'echo'],
  claimedRunIds: [],
  firstBossKills: [],
  firstValidRunClaimed: true
}
```

Expect `load()` to return schema 2 with `loadout: ['inertia']`, preserving every other field, and to save the migrated value back under `project-ricochet.meta`.

- [ ] **Step 3: Verify focused failures**

Run:

```bash
rtk npm test -- src/game/run/runContract.test.ts src/game/orbs/OrbManager.test.ts
rtk npm test -- src/game/meta/MetaStore.test.ts src/game/meta/metaProgress.test.ts
```

Expected: FAIL on three-core assumptions.

- [ ] **Step 4: Change the run and orb contract**

Set `STARTING_ORB_COUNT = 1` and:

```ts
export type CoreLoadout = [OrbCoreId];
```

Change starting-core arguments to `readonly [OrbCoreId]`. Keep `addOrb(coreType)` unchanged. Runtime orb limit must accept one as its minimum.

- [ ] **Step 5: Migrate meta progress to schema 2**

Change `MetaProgress.schemaVersion` to 2 and default loadout to `['echo']`. `parseProgress()` accepts:

- schema 2 only when loadout has one unlocked core;
- schema 1 only when loadout has three unlocked cores, returning the first entry as schema 2;
- no other schema.

Malformed saves still use the existing corrupt backup path. Change `setLoadout()` to require exactly one unlocked core.

- [ ] **Step 6: Simplify deploy UI to one selector**

Keep the existing `loadout` array rendering; because it now has one item, no new component is needed. Change labels from `구슬 1` to `시작 코어`. Filter `OrbLoadoutOverlay` cards by an explicit `availableTypes: readonly OrbCoreId[]` argument so locked cores cannot be selected in the first or additional selection.

- [ ] **Step 7: Run focused and full tests**

Run:

```bash
rtk npm test -- src/game/run src/game/meta src/game/orbs/OrbManager.test.ts src/game/ui/OrbLoadoutOverlay.test.ts
rtk npm test
rtk npm run build
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
rtk git add src/game/constants.ts src/game/orbs/OrbManager.ts src/game/orbs/OrbManager.test.ts src/game/run src/game/meta src/game/ui/OrbLoadoutOverlay.ts src/game/ui/OrbLoadoutOverlay.test.ts
rtk git commit -m "feat: start runs with one permanent core"
```

### Task 7: Guaranteed First-Level Second Orb

**Files:**
- Modify: `src/game/progression/progressionRules.ts`
- Modify: `src/game/progression/progressionRules.test.ts`
- Modify: `src/game/progression/BuildState.ts`
- Modify: `src/game/progression/BuildState.test.ts`
- Modify: `src/game/progression/BossBuild.ts`
- Modify: `src/game/progression/BossBuild.test.ts`
- Modify: `src/game/encounters/EncounterDirector.ts`
- Modify: `src/game/encounters/EncounterDirector.test.ts`
- Modify: `src/game/run/runContract.ts`
- Modify: `src/game/run/runContract.test.ts`
- Modify: `src/game/meta/AppController.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `src/game/ui/LevelUpOverlay.ts`
- Modify: `src/game/ui/LevelUpOverlay.test.ts`

**Interfaces:**
- Produces: guaranteed `additional-core` at choice level zero, later shortage weighting, and correct one-orb-based maximum.
- Consumes: one-orb loadout and unlocked core IDs from run configuration.

- [ ] **Step 1: Write failing first-choice tests**

```ts
expect(selectAbilityOptions(
  createEmptyAbilityRanks(),
  0,
  123,
  { coreTypes: ['echo'], orbCount: 1 },
)).toEqual(['additional-core']);
```

At level one, assert three normal seeded choices return and are not forcibly replaced by `additional-core`.

Across seeds 0–99, compare contexts `{ orbCount: 2, expectedOrbCount: 4 }` and `{ orbCount: 4, expectedOrbCount: 4 }`. Assert `additional-core` appears more often in the shortage context but not in all 100 results.

- [ ] **Step 2: Write failing orb-limit tests**

```ts
const build = new BuildState();
expect(build.orbLimit(1)).toBe(1);
build.upgrade('additional-core');
expect(build.orbLimit(1)).toBe(2);
expect(new BossBuild().orbLimitBonus()).toBe(0);
```

Acquire `expanded-magazine` and assert `orbLimitBonus()` becomes 1.

- [ ] **Step 3: Verify focused failures**

Run:

```bash
rtk npm test -- src/game/progression/progressionRules.test.ts
rtk npm test -- src/game/progression/BuildState.test.ts src/game/progression/BossBuild.test.ts
```

Expected: FAIL on old first-choice and three-orb base behavior.

- [ ] **Step 4: Guarantee `additional-core` at the first choice**

At the top of `selectAbilityOptions()` after eligibility calculation:

```ts
if (
  level === 0
  && context.orbCount === 1
  && eligible.includes('additional-core')
) return ['additional-core'];
```

Remove the old first-level explosion/split guarantee. Those effects re-enter the normal pool from level two.

Add `expectedOrbCount?: number` to `AbilityEligibilityContext`. For later levels, place eligible IDs in the seeded option bag once, but place `additional-core` three times when `orbCount < expectedOrbCount`. Shuffle the weighted bag, then collect the first three unique IDs. Use one copy when the expected count is met.

- [ ] **Step 5: Calculate limits from one base orb**

Change `BossBuild.orbLimit()` to:

```ts
orbLimitBonus(): number {
  return Number(this.owns('expanded-magazine'))
    + Number(this.owns('auxiliary-orbit'));
}
```

In `CombatScene`, use:

```ts
getOrbLimit: () => Math.min(
  GAME_TUNING.build.basicGrowth.maximumOrbs,
  build.orbLimit(STARTING_ORB_COUNT)
    + (this.bossBuild?.orbLimitBonus() ?? 0),
),
```

Keep `additional-core` selection flow: the level card is selected, then `OrbLoadoutOverlay.showAdditional()` chooses one of the run's unlocked cores and calls `orbManager.addOrb(type)`.

- [ ] **Step 6: Expose unlocked core choices to combat**

Add `unlockedCoreTypes: readonly OrbCoreId[]` to `RunConfig`. Validate that the selected starting core is included. Copy it into `RunResult`. Pass it to `showAdditional()` so locked permanent cores never appear.

The no-meta debug launch uses `ORB_CORE_IDS` to preserve the existing local testing overlay.

Expose the active stage `powerBand.expectedOrbCount` from `EncounterDirector.getSnapshot()` and pass it through the progression eligibility callback:

```ts
expectedOrbCount: this.encounterDirector?.getSnapshot().expectedOrbCount ?? 2,
```

- [ ] **Step 7: Tune first level to 20–30 seconds**

Set level-zero XP requirement to 8 while retaining later growth:

```ts
export function xpRequiredForLevel(level: number): number {
  if (!Number.isInteger(level) || level < 0) {
    throw new RangeError('level must be a non-negative integer');
  }
  return level === 0 ? 8 : 12 + level * 5;
}
```

The stage-one opening chunk contains at least 8 XP worth of enemies but its 8 px/s descent speed remains unchanged.

- [ ] **Step 8: Run focused and full tests**

Run:

```bash
rtk npm test -- src/game/progression src/game/scenes/combatSceneRules.test.ts src/game/ui
rtk npm test
rtk npm run build
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
rtk git add src/game/progression src/game/encounters/EncounterDirector.ts src/game/encounters/EncounterDirector.test.ts src/game/run src/game/meta/AppController.ts src/game/scenes/CombatScene.ts src/game/ui/LevelUpOverlay.ts src/game/ui/LevelUpOverlay.test.ts
rtk git commit -m "feat: guarantee an early second orb"
```

### Task 8: Boss Scale, Collider Audit and Final Integration

**Files:**
- Modify: `src/game/bosses/bossGeometry.ts`
- Modify: `src/game/bosses/bossGeometry.test.ts`
- Modify: `src/game/bosses/bossMovementRules.ts`
- Modify: `src/game/bosses/bossMovementRules.test.ts`
- Modify: `src/game/bosses/hiveBossGeometry.ts`
- Modify: `src/game/bosses/hiveBossGeometry.test.ts`
- Modify: `src/game/bosses/BossManager.ts`
- Modify: `src/game/bosses/BossManager.test.ts`
- Modify: `src/game/bosses/HiveBossManager.ts`
- Modify: `src/game/bosses/HiveBossManager.test.ts`
- Modify: `src/game/config/gameTuning.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `e2e/combat.spec.ts`
- Modify: `e2e/meta-loop.spec.ts`

**Interfaces:**
- Consumes: grid world geometry and one-core run config.
- Produces: large boss layouts, collider parity and final end-to-end coverage.

- [ ] **Step 1: Add failing boss geometry assertions**

Assert:

```ts
expect(BOSS_GEOMETRY.collisionHalfWidth * 2).toBeGreaterThanOrEqual(204);
expect(BOSS_GEOMETRY.collisionHalfHeight * 2).toBeGreaterThanOrEqual(92);
```

For hive, iterate core, both shooters and both reflectors. Assert every visible part has positive `width` and `height`, stays within `GAME_WIDTH`, and appears in the manager's target snapshot.

Add a boss movement assertion with an enemy rectangle blocking the right side, then remove that rectangle and assert the returned right movement bound increases. Movement remains continuous and does not snap to grid columns.

- [ ] **Step 2: Add the regression for pass-through hive guns**

Place a permanent orb trajectory through each lower gun body. Assert `applyDirectDamage(partId, 1)` is reached once and the reflected orb leaves with collision enabled. This test must fail if a gun is rendered but omitted from the Arcade collider group.

- [ ] **Step 3: Verify boss tests fail**

Run:

```bash
rtk npm test -- src/game/bosses/bossGeometry.test.ts src/game/bosses/hiveBossGeometry.test.ts
rtk npm test -- src/game/bosses/bossMovementRules.test.ts src/game/bosses/BossManager.test.ts src/game/bosses/HiveBossManager.test.ts
```

Expected: at least the hive gun collider regression fails.

- [ ] **Step 4: Resize boss geometry using grid cell dimensions**

Use grid-derived target sizes:

```text
sentinel/siege outer body: at least 4×2 cells
hive combined core and guns: at least 4×3 cells
maximum occupied boss envelope: 6×4 cells
```

Keep each boss's current shape and attack logic. Change geometry and tuning only. Add every visible damageable gun sprite to the same boss target group used by orb colliders.

- [ ] **Step 5: Update E2E expectations**

`e2e/combat.spec.ts` must verify:

- one orb at run start;
- first level-up only offers `additional-core`;
- choosing an unlocked type creates orb two;
- stage-one enemies include multiple footprints;
- all enemies descend smoothly;
- hive lower guns take collision damage;
- boss entry stops new chunks.

`e2e/meta-loop.spec.ts` must verify:

- deploy shows one starting-core selector;
- schema 1 progress migrates without losing parts or unlocks;
- a newly unlocked core appears in the first-level second-orb selection;
- the chosen starting core persists after reload.

- [ ] **Step 6: Run the final verification gate**

Run:

```bash
rtk npm test
rtk npm run build
rtk npm run test:e2e
rtk git diff --check
```

Expected: all unit tests, build and all Playwright tests pass; no whitespace errors.

- [ ] **Step 7: Commit**

```bash
rtk git add src/game/bosses src/game/config/gameTuning.ts src/game/scenes/CombatScene.ts e2e
rtk git commit -m "feat: complete grid combat redesign"
```

---

## Execution Checkpoints

1. After Task 4, play only stage one. Stop if large targets, empty lanes or smooth descent feel wrong.
2. After Task 7, play the first 60 seconds. Stop if one-orb opening feels longer than 30 seconds or orb two does not create a clear power jump.
3. After Task 8, run the full three-boss loop once on desktop and once through a mobile viewport.
