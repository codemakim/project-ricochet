# Five-Column Combat Scale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the tiny eight-column combat presentation with five large, physically honest columns, readable player and orb sprites, and collision-aligned enemy art.

**Architecture:** `GAME_TUNING` remains the single runtime geometry owner. Pure formation helpers convert five-column footprints into world rectangles; managers consume those rectangles without per-kind shrink factors. The existing deterministic ImageMagick pipeline exports sprites at their actual display sizes, and its verifier checks dimensions, pixel blocks, and opaque bounds.

**Tech Stack:** TypeScript 5.9, Phaser 3.90 Arcade Physics, Vitest 4, Playwright 1.61, Vite 8, ImageMagick shell pipeline.

**Spec:** `docs/superpowers/specs/2026-08-20-five-column-combat-scale-design.md`

## Global Constraints

- Playfield remains `450 × 800px`.
- Formation geometry is `5` columns, `15px` left margin, `84 × 72px` cells, and `0px` physics gap.
- Adjacent occupied cells have no visual or physical passage.
- Regular enemies are `84 × 72px`; armored enemies `168 × 144px`; splitters `168 × 72px`; fragments `84 × 72px`.
- Player display is `96 × 96px`; permanent orbs are `40 × 40px`; temporary orbs are `24 × 24px`.
- Formation movement remains smooth continuous descent; no runtime row snapping.
- Pixel assets use nearest sampling and deterministic 4× exports; smooth VFX remain unchanged.
- No new dependency, enemy behavior, sound, VFX subsystem, or speculative abstraction.

---

### Task 1: Central Geometry And Five-Column Grid

**Files:**
- Modify: `src/game/config/gameTuning.ts`
- Modify: `src/game/config/gameTuning.test.ts`
- Modify: `src/game/constants.ts`
- Modify: `src/game/encounters/formationGrid.ts`
- Modify: `src/game/encounters/formationGrid.test.ts`

**Interfaces:**
- Consumes: existing `GameTuning`, `FORMATION_COLUMNS`, `footprintWorldRect`, and constants imports.
- Produces: `GAME_TUNING.world`, `GAME_TUNING.player.visual`, five-column `GAME_TUNING.encounter.grid`, and unchanged public constant names derived from tuning.

- [ ] **Step 1: Write failing central-geometry tests**

Update the tuning test fixture and add exact assertions:

```ts
expect(GAME_TUNING.world).toEqual({ width: 450, height: 800 });
expect(GAME_TUNING.player.visual).toEqual({ width: 96, height: 96, hurtRadius: 32 });
expect(GAME_TUNING.encounter.grid).toEqual({
  columns: 5,
  left: 15,
  cellWidth: 84,
  cellHeight: 72,
  gap: 0,
});
expect(GAME_TUNING.visual.friendly.permanentOrb).toMatchObject({ width: 40, height: 40 });
expect(GAME_TUNING.visual.friendly.temporaryOrb).toMatchObject({ width: 24, height: 24 });
expect(GAME_TUNING.temporaryOrbs.radius).toBe(12);
```

Replace the eight-column formation assertions with:

```ts
expect(FORMATION_COLUMNS).toBe(5);
expect(() => validateFootprint(
  { column: 4, row: 0, width: 2, height: 1 },
  3,
)).toThrow('formation footprint is outside the grid');

expect(footprintWorldRect(
  { column: 1, row: 2, width: 2, height: 1 },
  80,
)).toEqual({ x: 183, y: 260, width: 168, height: 72 });

const left = footprintWorldRect({ column: 0, row: 0, width: 1, height: 1 }, 0);
const right = footprintWorldRect({ column: 1, row: 0, width: 1, height: 1 }, 0);
expect(left.x + left.width / 2).toBe(right.x - right.width / 2);

expect([...reservedPassageCells(3, 0, 0)].sort()).toEqual(['0:1', '1:1', '2:1']);
expect([...reservedPassageCells(3, 2, 0)].sort()).toEqual(['0:3', '1:2', '1:3', '2:2']);
expect([...reservedPassageCells(3, 4, 0)].sort())
  .toEqual(['0:2', '0:3', '1:2', '1:3', '2:2']);
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
rtk npm test -- src/game/config/gameTuning.test.ts src/game/encounters/formationGrid.test.ts
```

Expected: failures report the old eight-column values and missing `world`/`player` tuning.

- [ ] **Step 3: Move world and player scale into `GAME_TUNING`**

Remove the `constants.ts` import from `gameTuning.ts`, making tuning independent, then have `constants.ts` derive its public aliases from tuning. Add these interfaces and values:

```ts
export interface GameTuning {
  world: { width: number; height: number };
  player: { visual: { width: number; height: number; hurtRadius: number } };
}

export const GAME_TUNING = {
  world: { width: 450, height: 800 },
  player: { visual: { width: 96, height: 96, hurtRadius: 32 } },
} as const satisfies GameTuning;
```

Insert the two interface fields before `boss` and the two values before the existing `boss` value; do not alter the other tuning fields in this step.

Inside tuning validation, read `const { width: GAME_WIDTH, height: GAME_HEIGHT } = world`. Validate world sizes, player display sizes, and `hurtRadius * 2 <= min(width, height)`.

Derive existing constant exports without changing callers:

```ts
import { GAME_TUNING } from './config/gameTuning';

export const GAME_WIDTH = GAME_TUNING.world.width;
export const GAME_HEIGHT = GAME_TUNING.world.height;
export const PLAYER_RADIUS = GAME_TUNING.player.visual.hurtRadius;
export const ORB_RADIUS = GAME_TUNING.visual.friendly.permanentOrb.width / 2;
```

- [ ] **Step 4: Set five-column geometry and safe passage anchors**

Set:

```ts
grid: { columns: 5, left: 15, cellWidth: 84, cellHeight: 72, gap: 0 },
temporaryOrbs: {
  radius: 12,
  speed: 440,
  cap: 30,
  lifetimeMs: 1500,
  hitCooldownMs: 80,
  baseDamage: 0.65,
},
visual: {
  friendly: {
    permanentOrb: { fill: 0xffffff, accent: 0x4ddcff, width: 40, height: 40 },
    temporaryOrb: { fill: 0x8cf7ff, accent: 0x167d9a, width: 24, height: 24 },
  },
},
```

Change only the shown `visual.friendly` entries inside the existing `visual` object; retain its feedback and hostile sections.

Replace the eight-column anchor array in `reservedPassageCells`:

```ts
const anchors = [1, 3, 2, 0, 4] as const;
```

Clamp the neighboring turn/pocket column to the five-column range by choosing `column + 1` left of center and `column - 1` at or right of center. Do not add a generic grid-layout abstraction.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
rtk npm test -- src/game/config/gameTuning.test.ts src/game/encounters/formationGrid.test.ts
```

Expected: both files pass.

- [ ] **Step 6: Commit geometry**

```bash
rtk git add src/game/config/gameTuning.ts src/game/config/gameTuning.test.ts src/game/constants.ts src/game/encounters/formationGrid.ts src/game/encounters/formationGrid.test.ts
rtk git commit -m "feat: establish five-column combat geometry"
```

---

### Task 2: Five-Column Formation Data And Population

**Files:**
- Modify: `src/game/encounters/stageDefinitions.ts`
- Modify: `src/game/encounters/stageDefinitions.test.ts`
- Modify: `src/game/encounters/formationRules.test.ts`

**Interfaces:**
- Consumes: `FORMATION_COLUMNS = 5`, `occupyFootprint`, `reservedPassageCells`, existing seeded formation generator.
- Produces: valid five-column `FORMATION_TEMPLATES`, population profiles, and stage active caps.

- [ ] **Step 1: Write failing five-column content tests**

Add these assertions to `stageDefinitions.test.ts`:

```ts
it('keeps every template inside five columns and preserves a real empty cell', () => {
  for (const template of FORMATION_TEMPLATES) {
    const occupied = new Set<string>();
    for (const slot of template.slots) occupyFootprint(occupied, slot, template.rows);
    expect(Math.max(...template.slots.map((slot) => slot.column + slot.width))).toBeLessThanOrEqual(5);
    expect(occupied.size).toBeLessThan(template.rows * 5);
  }
});

it('uses reduced population bands for the larger five-column cells', () => {
  expect(FORMATION_PROFILES.map(({ cellMinimum, cellMaximum }) => [cellMinimum, cellMaximum]))
    .toEqual([[5, 8], [7, 11], [9, 14], [11, 17]]);
  expect(STAGES.flatMap((stage) => stage.phases.map((phase) => phase.activeCap)))
    .toEqual([12, 18, 22, 22, 26, 24, 28, 30]);
});
```

Change formation-rule expectations that contain literal columns `5`, `6`, or `7` to assert against the new five-column result while retaining deterministic seed assertions.

- [ ] **Step 2: Run content tests and verify RED**

Run:

```bash
rtk npm test -- src/game/encounters/stageDefinitions.test.ts src/game/encounters/formationRules.test.ts
```

Expected: old templates exceed column four and old population bands differ.

- [ ] **Step 3: Replace fixed templates with explicit five-column data**

Use these slot layouts:

```ts
// staggered-lanes, rows 4 so the onslaught minimum fits beside its reserved passage
[
  { column: 0, row: 0, width: 1, height: 1 },
  { column: 1, row: 0, width: 1, height: 1, optional: true },
  { column: 4, row: 0, width: 1, height: 1 },
  { column: 2, row: 1, width: 1, height: 1 },
  { column: 3, row: 1, width: 1, height: 1, optional: true },
  { column: 0, row: 2, width: 1, height: 1 },
  { column: 3, row: 2, width: 1, height: 1 },
  { column: 4, row: 2, width: 1, height: 1, optional: true },
]

// side-fort, rows 4; first slot remains armored-sized
[
  { column: 0, row: 0, width: 2, height: 2 },
  { column: 3, row: 0, width: 1, height: 1 },
  { column: 4, row: 1, width: 1, height: 1, optional: true },
  { column: 2, row: 2, width: 1, height: 1 },
  { column: 4, row: 3, width: 1, height: 1, optional: true },
]

// split-gate, rows 3
[
  { kind: 'basic', column: 0, row: 0, width: 1, height: 1 },
  { kind: 'splitter', column: 1, row: 0, width: 2, height: 1 },
  { kind: 'basic', column: 4, row: 0, width: 1, height: 1 },
  { kind: 'shooter', column: 0, row: 2, width: 1, height: 1 },
  { kind: 'shooter', column: 4, row: 2, width: 1, height: 1 },
]

// broken-wall, rows 5
[
  { column: 0, row: 0, width: 1, height: 1 },
  { column: 1, row: 0, width: 1, height: 1 },
  { column: 3, row: 0, width: 1, height: 1 },
  { column: 4, row: 0, width: 1, height: 1 },
  { column: 0, row: 1, width: 1, height: 1, optional: true },
  { column: 3, row: 1, width: 1, height: 1 },
  { column: 1, row: 3, width: 1, height: 1 },
  { column: 4, row: 3, width: 1, height: 1, optional: true },
  { column: 0, row: 4, width: 1, height: 1 },
  { column: 1, row: 4, width: 1, height: 1 },
  { column: 3, row: 4, width: 1, height: 1 },
  { column: 4, row: 4, width: 1, height: 1 },
]
```

- [ ] **Step 4: Reduce formation and active population values**

Set profile ranges to `[[5,8], [7,11], [9,14], [11,17]]` in opening-to-onslaught order. Set stage phase active caps to `[12,18,22]`, `[22,26]`, and `[24,28,30]`. Keep spawn intervals, descent speed, HP multipliers, boss timing, and score targets unchanged.

Replace the catalog validation literal `8` with `FORMATION_COLUMNS`:

```ts
if (entry.width > FORMATION_COLUMNS) {
  throw new RangeError(`${entry.kind}.width must fit the grid`);
}
```

- [ ] **Step 5: Run encounter tests and verify GREEN**

Run:

```bash
rtk npm test -- src/game/encounters
```

Expected: all encounter tests pass with deterministic five-column formations.

- [ ] **Step 6: Commit formation migration**

```bash
rtk git add src/game/encounters/stageDefinitions.ts src/game/encounters/stageDefinitions.test.ts src/game/encounters/formationRules.test.ts
rtk git commit -m "feat: migrate formations to five columns"
```

---

### Task 3: Collision-Honest Enemy Assets

**Files:**
- Modify: `scripts/render_gbc_combat_art.sh`
- Modify: `scripts/verify_gbc_combat_art.sh`
- Modify: `assets-source/combat/graphics/enemy-basic-master.png`
- Modify: `assets-source/combat/graphics/enemy-armored-master.png`
- Modify: `assets-source/combat/graphics/enemy-shooter-master.png`
- Create: `assets-source/combat/graphics/enemy-splitter-master.png`
- Create: `assets-source/combat/graphics/enemy-fragment-left-master.png`
- Create: `assets-source/combat/graphics/enemy-fragment-right-master.png`
- Modify: `public/assets/combat/sprites/enemy-basic.png`
- Modify: `public/assets/combat/sprites/enemy-armored.png`
- Modify: `public/assets/combat/sprites/enemy-shooter.png`
- Create: `public/assets/combat/sprites/enemy-splitter.png`
- Create: `public/assets/combat/sprites/enemy-fragment-left.png`
- Create: `public/assets/combat/sprites/enemy-fragment-right.png`
- Modify: `src/game/assets/combatAssetManifest.ts`
- Modify: `src/game/assets/combatAssetManifest.test.ts`
- Modify: `src/game/assets/createCombatFallbackTextures.ts`
- Modify: `src/game/scenes/combatTextureRules.ts`
- Modify: `src/game/enemies/EnemyManager.ts`
- Modify: `src/game/enemies/EnemyManager.test.ts`

**Interfaces:**
- Consumes: footprint world rectangles from Task 1 and stable texture keys.
- Produces: production textures for every regular enemy footprint and identical visual/collision world rectangles.

- [ ] **Step 1: Write failing asset and manager tests**

Add the new texture keys to the manifest expectation:

```ts
expect(keys).toEqual(expect.arrayContaining([
  'enemy-basic', 'enemy-armored', 'enemy-shooter',
  'enemy-splitter', 'enemy-fragment-left', 'enemy-fragment-right',
]));
```

Add a manager test that spawns one enemy of every footprint and asserts:

```ts
expect(enemies.map(({ displayWidth, displayHeight }) => [displayWidth, displayHeight]))
  .toEqual([[84, 72], [168, 144], [84, 72], [168, 72], [84, 72], [84, 72]]);
expect(enemies.map(({ body }) => [body.width, body.height]))
  .toEqual([[84, 72], [168, 144], [84, 72], [168, 72], [84, 72], [84, 72]]);
```

Update the fragment texture expectation so splitters use `enemy-splitter` rather than `enemy-basic`.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
rtk npm test -- src/game/assets/combatAssetManifest.test.ts src/game/enemies/EnemyManager.test.ts
```

Expected: missing texture keys, old splitter mapping, or mismatched dimensions fail.

- [ ] **Step 3: Make world-body sizing explicit**

Keep `footprintWorldRect` as the only size calculation. In `spawnFormation`, use `pixelWidth` and `pixelHeight` for both display and Arcade body world size. Reuse the existing world-body sizing technique used by bosses; do not add a geometry class.

Update default texture mapping:

```ts
splitter: 'enemy-splitter',
fragmentLeft: 'enemy-fragment-left',
fragmentRight: 'enemy-fragment-right',
```

Add matching nearest-sampled production asset entries:

```ts
{ key: 'enemy-splitter', url: '/assets/combat/sprites/enemy-splitter.png', sampling: 'nearest' },
{ key: 'enemy-fragment-left', url: '/assets/combat/sprites/enemy-fragment-left.png', sampling: 'nearest' },
{ key: 'enemy-fragment-right', url: '/assets/combat/sprites/enemy-fragment-right.png', sampling: 'nearest' },
```

Generate full-size fallback textures from grid dimensions so missing files remain physically honest.

- [ ] **Step 4: Redraw and export footprint-filling enemies**

Change direct authored grids and 4× runtime exports to:

```text
basic/shooter/fragment master: 21×18 -> runtime 84×72
armored master: 42×36 -> runtime 168×144
splitter master: 42×18 -> runtime 168×72
```

Each sprite keeps transparent rounded corners but has opaque pixels touching the top, bottom, left, and right trim bounds. Adjacent sprites therefore form one continuous blocking wall. Keep the approved four-functional-color limit and role marks: basic visor, armored face plate, shooter muzzle, splitter central crack, complementary fragment cut edges.

Use the existing palette variables and these exact outer bounds in the render script:

```bash
magick -size 21x18 xc:none +antialias \
  -fill "$INK" -draw 'rectangle 1,0 19,17 rectangle 0,1 20,16' \
  -fill "$GREEN" -draw 'rectangle 2,1 18,16 rectangle 1,2 19,15' \
  -fill "$INK" -draw 'rectangle 4,6 16,11' \
  -fill "$CORAL" -draw 'rectangle 6,8 7,9 rectangle 13,8 14,9' \
  -strip "$SOURCE/enemy-basic-master.png"

magick -size 42x36 xc:none +antialias \
  -fill "$INK" -draw 'rectangle 2,0 39,35 rectangle 0,2 41,33' \
  -fill "$VIOLET" -draw 'rectangle 3,1 38,34 rectangle 1,3 40,32' \
  -fill "$BLUE_STEEL" -draw 'rectangle 5,5 36,23' \
  -fill "$INK" -draw 'rectangle 13,13 28,29' \
  -strip "$SOURCE/enemy-armored-master.png"

magick -size 21x18 xc:none +antialias \
  -fill "$INK" -draw 'rectangle 1,0 19,17 rectangle 0,1 20,16' \
  -fill "$ORANGE" -draw 'rectangle 2,1 18,16 rectangle 1,2 19,15' \
  -fill "$YELLOW" -draw 'rectangle 8,2 12,4' \
  -fill "$INK" -draw 'rectangle 5,6 15,15' \
  -strip "$SOURCE/enemy-shooter-master.png"

magick -size 42x18 xc:none +antialias \
  -fill "$INK" -draw 'rectangle 1,0 40,17 rectangle 0,1 41,16' \
  -fill "$CORAL" -draw 'rectangle 2,1 39,16 rectangle 1,2 40,15' \
  -fill "$INK" -draw 'polyline 21,1 18,5 22,8 19,12 21,16' \
  -strip "$SOURCE/enemy-splitter-master.png"
```

Create each `21 × 18` fragment from the complementary split halves and export every master with the existing `export_sprite` function:

```bash
magick -size 21x18 xc:none +antialias \
  -fill "$INK" -draw 'rectangle 1,0 19,17 rectangle 0,1 20,16' \
  -fill "$CORAL" -draw 'rectangle 2,1 18,16 rectangle 1,2 19,15' \
  -fill "$INK" -draw 'polyline 20,0 16,4 19,8 15,12 20,17' \
  -strip "$SOURCE/enemy-fragment-left-master.png"
magick "$SOURCE/enemy-fragment-left-master.png" -flop -strip \
  "$SOURCE/enemy-fragment-right-master.png"

for enemy in basic armored shooter splitter fragment-left fragment-right; do
  export_sprite "$SOURCE/enemy-$enemy-master.png" "$SPRITES/enemy-$enemy.png"
done
```

- [ ] **Step 5: Extend deterministic asset verification**

Add production dimension checks and an opaque trim-bounds helper:

```bash
check_opaque_bounds() {
  local file="$ROOT/$1" expected="$2" bounds
  bounds="$(magick "$file" -alpha extract -trim -format '%@' info:)"
  [[ "$bounds" == "$expected+0+0" ]] || {
    echo "$file: opaque bounds expected $expected+0+0, got $bounds"
    exit 1
  }
}
```

Call it with `84x72`, `168x144`, `84x72`, `168x72`, `84x72`, and `84x72` for the six runtime sprites. Retain block, palette, alpha, and corner checks.

- [ ] **Step 6: Render assets and verify GREEN**

Run:

```bash
rtk bash scripts/render_gbc_combat_art.sh
rtk bash scripts/verify_gbc_combat_art.sh
rtk npm test -- src/game/assets/combatAssetManifest.test.ts src/game/enemies/EnemyManager.test.ts
```

Expected: `GBC combat art verified`; both test files pass.

- [ ] **Step 7: Commit enemy scale**

```bash
rtk git add scripts assets-source/combat/graphics public/assets/combat/sprites src/game/assets src/game/scenes/combatTextureRules.ts src/game/enemies/EnemyManager.ts src/game/enemies/EnemyManager.test.ts
rtk git commit -m "art: fill five-column enemy footprints"
```

---

### Task 4: Readable Player And Orb Identity

**Files:**
- Modify: `scripts/render_gbc_combat_art.sh`
- Modify: `scripts/verify_gbc_combat_art.sh`
- Modify: `assets-source/combat/graphics/player-master.png`
- Modify: `assets-source/combat/graphics/orb-echo-master.png`
- Modify: `assets-source/combat/graphics/orb-corrosion-master.png`
- Modify: `assets-source/combat/graphics/orb-conduction-master.png`
- Modify: `assets-source/combat/graphics/orb-inertia-master.png`
- Modify: `assets-source/combat/graphics/orb-split-master.png`
- Modify: `assets-source/combat/graphics/orb-explosion-master.png`
- Modify: `public/assets/combat/sprites/player.png`
- Modify: `public/assets/combat/sprites/orb-echo.png`
- Modify: `public/assets/combat/sprites/orb-corrosion.png`
- Modify: `public/assets/combat/sprites/orb-conduction.png`
- Modify: `public/assets/combat/sprites/orb-inertia.png`
- Modify: `public/assets/combat/sprites/orb-split.png`
- Modify: `public/assets/combat/sprites/orb-explosion.png`
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `src/game/orbs/OrbManager.test.ts`

**Interfaces:**
- Consumes: `GAME_TUNING.player.visual`, `GAME_TUNING.visual.friendly`, and existing orb texture keys.
- Produces: `96px` player, `40px` base-orb sprites, tuned circular collisions, and distinct base-orb motifs.

- [ ] **Step 1: Write failing runtime-size tests**

Keep the existing orb display assertion and add:

```ts
expect(sprites[0]?.displayWidth).toBe(40);
expect(sprites[0]?.displayHeight).toBe(40);
expect((sprites[0]?.body as FakeBody).circle).toBe(20);
```

Extract a small pure player geometry function only if `CombatScene` cannot be tested without scene construction. Preferred implementation is a direct tuning read with existing scene E2E coverage.

- [ ] **Step 2: Run orb tests and verify RED**

```bash
rtk npm test -- src/game/orbs/OrbManager.test.ts src/game/config/gameTuning.test.ts
```

Expected: old `16px` display or `8px` radius differs.

- [ ] **Step 3: Apply tuned player and orb sizes**

Replace the player literal:

```ts
const { width, height, hurtRadius } = GAME_TUNING.player.visual;
this.player.setDisplaySize(width, height);
const playerScale = Math.abs(this.player.scaleX);
const sourceRadius = hurtRadius / playerScale;
this.player.setCircle(
  sourceRadius,
  (this.player.width - sourceRadius * 2) / 2,
  (this.player.height - sourceRadius * 2) / 2,
);
```

OrbManager already reads the friendly display values and `ORB_RADIUS`; retain that path. Do not add per-core physics sizes.

- [ ] **Step 4: Redraw large direct-pixel assets**

Use a `24 × 24` player master exported to `96 × 96px`. Keep a large face, broad body color, and obvious central hurt core.

Use `10 × 10` masters exported to `40 × 40px` for all six base orbs. Preserve palette identity and give each a unique dominant motif:

```text
echo: double wave ring
corrosion: asymmetric drop shell
conduction: forked lightning crown
inertia: forward chevron fins
split: mirrored twin core
explosion: radial spike shell
```

Exterior ornament stays within the `40 × 40px` texture. Smooth aura remains runtime VFX and does not expand collision.

Use these exact authored canvases and keep every motif at least two authored pixels thick:

```bash
magick -size 24x24 xc:none +antialias \
  -fill "$INK" -draw 'rectangle 3,0 20,23 rectangle 0,3 23,20' \
  -fill "$AMBER" -draw 'rectangle 4,1 19,22 rectangle 1,4 22,19' \
  -fill "$CERAMIC" -draw 'rectangle 4,5 19,13' \
  -fill "$CYAN" -draw 'rectangle 7,8 8,9 rectangle 15,8 16,9 rectangle 9,17 14,21' \
  -strip "$SOURCE/player-master.png"

orb_shell() {
  local fill="$1" output="$2" motif="$3"
  magick -size 10x10 xc:none +antialias \
    -fill "$INK" -draw 'rectangle 3,0 6,9 rectangle 0,3 9,6 rectangle 1,1 8,8' \
    -fill "$fill" -draw 'rectangle 3,1 6,8 rectangle 1,3 8,6 rectangle 2,2 7,7' \
    -fill "$CERAMIC" -draw "$motif" -strip "$output"
}

orb_shell "$CYAN" "$SOURCE/orb-echo-master.png" 'rectangle 2,2 7,3 rectangle 3,6 6,7'
orb_shell "$ACID" "$SOURCE/orb-corrosion-master.png" 'polygon 5,2 3,5 4,7 6,7 7,5'
orb_shell "$CYAN" "$SOURCE/orb-conduction-master.png" 'polygon 5,1 3,5 5,5 4,8 7,4 5,4'
orb_shell "$BLUE_STEEL" "$SOURCE/orb-inertia-master.png" 'polygon 2,4 6,2 8,5 6,8'
orb_shell "$MAGENTA" "$SOURCE/orb-split-master.png" 'rectangle 2,3 4,7 rectangle 6,2 7,6'
orb_shell "$ORANGE" "$SOURCE/orb-explosion-master.png" 'rectangle 4,1 5,8 rectangle 1,4 8,5'
```

- [ ] **Step 5: Render, verify, and run focused tests**

```bash
rtk bash scripts/render_gbc_combat_art.sh
rtk bash scripts/verify_gbc_combat_art.sh
rtk npm test -- src/game/orbs/OrbManager.test.ts src/game/config/gameTuning.test.ts
```

Expected: player verifies at `96x96`, all base orbs at `40x40`, tests pass.

- [ ] **Step 6: Commit player and orbs**

```bash
rtk git add scripts assets-source/combat/graphics public/assets/combat/sprites src/game/scenes/CombatScene.ts src/game/orbs/OrbManager.test.ts
rtk git commit -m "art: enlarge player and permanent orbs"
```

---

### Task 5: Sentinel Scale And Targetable Parts

**Files:**
- Modify: `src/game/config/gameTuning.ts`
- Modify: `src/game/config/gameTuning.test.ts`
- Modify: `src/game/bosses/bossGeometry.test.ts`
- Modify: `src/game/bosses/BossManager.test.ts`
- Modify: `src/game/bosses/hiveBossGeometry.test.ts`
- Modify: `src/game/bosses/HiveBossManager.test.ts`
- Modify: `scripts/render_gbc_combat_art.sh`
- Modify: `scripts/verify_gbc_combat_art.sh`
- Modify: `assets-source/combat/graphics/sentinel-body-master.png`
- Modify: `assets-source/combat/graphics/sentinel-weakpoint-master.png`
- Modify: `public/assets/combat/sprites/sentinel-body.png`
- Modify: `public/assets/combat/sprites/sentinel-left-weakpoint.png`
- Modify: `public/assets/combat/sprites/sentinel-right-weakpoint.png`

**Interfaces:**
- Consumes: existing `BOSS_GEOMETRY` derivation and five-column cell sizes.
- Produces: four-column-wide Sentinel envelope with broad weakpoint colliders and valid movement bounds.

- [ ] **Step 1: Write failing boss geometry tests**

Assert exact approved geometry:

```ts
expect(GAME_TUNING.boss.body).toEqual({ width: 252, height: 144 });
expect(GAME_TUNING.boss.weakpoint).toMatchObject({
  visual: { width: 56, height: 120 },
  hitbox: { width: 56, height: 120 },
  edgeOverlap: 14,
});
expect(GAME_TUNING.boss.core).toMatchObject({ visualSize: 64, hitboxSize: 56 });
expect(BOSS_GEOMETRY.collisionHalfWidth * 2).toBe(336);
expect(BOSS_GEOMETRY.collisionHalfHeight * 2).toBe(144);
expect(BOSS_GEOMETRY.movementBounds).toEqual({ minimum: 168, maximum: 282 });

const leftShooter = HIVE_BOSS_GEOMETRY.shooters.leftShooter;
const rightShooter = HIVE_BOSS_GEOMETRY.shooters.rightShooter;
expect(
  rightShooter.x + rightShooter.width / 2
    - (leftShooter.x - leftShooter.width / 2),
).toBe(252);
```

Add a `BossManager` assertion that each weakpoint display and Arcade body is `56 × 120`. Add a `HiveBossManager` assertion that both shooters remain symmetric, in bounds, and use the tuned `70 × 56` geometry.

- [ ] **Step 2: Run boss tests and verify RED**

```bash
rtk npm test -- src/game/config/gameTuning.test.ts src/game/bosses/bossGeometry.test.ts src/game/bosses/BossManager.test.ts src/game/bosses/hiveBossGeometry.test.ts src/game/bosses/HiveBossManager.test.ts
```

Expected: old Sentinel dimensions fail.

- [ ] **Step 3: Apply Sentinel tuning**

Set body, weakpoint, core visual/hitbox values to the exact numbers above. Set `GAME_TUNING.hiveBoss.shooter.width` from `68` to `70`, producing an exact three-column assembled Hive width. Keep HP, attacks, speeds, and boss phases unchanged. Let existing geometry helpers derive offsets and movement bounds.

- [ ] **Step 4: Redraw matching Sentinel assets**

Use `63 × 36` body and `14 × 30` weakpoint authored grids, exported 4× to `252 × 144px` and `56 × 120px`. The weakpoint bright block fills its collider trim bounds. Keep the existing `16 × 16` core master and `64 × 64px` runtime export.

Preserve the current modular Sentinel shapes while changing their canvases and full bounds:

```bash
magick -size 63x36 xc:none +antialias \
  -fill "$INK" -draw 'rectangle 2,0 60,35 rectangle 0,2 62,33' \
  -fill "$VIOLET" -draw 'rectangle 3,1 59,34 rectangle 1,3 61,32' \
  -fill "$BLUE_STEEL" -draw 'rectangle 8,5 54,12 rectangle 7,22 55,30' \
  -fill "$INK" -draw 'rectangle 24,10 38,28' \
  -strip "$SOURCE/sentinel-body-master.png"

magick -size 14x30 xc:none +antialias \
  -fill "$INK" -draw 'rectangle 1,0 12,29 rectangle 0,1 13,28' \
  -fill "$VIOLET" -draw 'rectangle 2,1 11,28 rectangle 1,2 12,27' \
  -fill "$YELLOW" -draw 'rectangle 3,6 10,23' \
  -fill "$INK" -draw 'rectangle 6,9 7,20' \
  -strip "$SOURCE/sentinel-weakpoint-master.png"
```

- [ ] **Step 5: Verify asset and boss tests GREEN**

```bash
rtk bash scripts/render_gbc_combat_art.sh
rtk bash scripts/verify_gbc_combat_art.sh
rtk npm test -- src/game/config/gameTuning.test.ts src/game/bosses/bossGeometry.test.ts src/game/bosses/BossManager.test.ts src/game/bosses/hiveBossGeometry.test.ts src/game/bosses/HiveBossManager.test.ts
```

Expected: asset verifier and all focused tests pass.

- [ ] **Step 6: Commit Sentinel scale**

```bash
rtk git add src/game/config src/game/bosses scripts assets-source/combat/graphics public/assets/combat/sprites
rtk git commit -m "art: scale sentinel for five-column combat"
```

---

### Task 6: Integrated Browser Verification And Worklog

**Files:**
- Modify: `e2e/combat.spec.ts`
- Modify: `docs/WORKLOG.md`

**Interfaces:**
- Consumes: completed five-column geometry, assets, managers, and the existing debug snapshot/API.
- Produces: regression coverage for packed walls and real passages, desktop/mobile visual proof, and durable worklog entry.

- [ ] **Step 1: Add integrated E2E assertions**

Add one test using the existing combat debug helpers:

```ts
test('five-column formations expose only real empty-cell passages', async ({ page }) => {
  await openCombat(page);
  await dismissLoadout(page);
  const snapshot = await combatSnapshot(page);
  expect(snapshot.enemies.length).toBeGreaterThan(0);
  expect(snapshot.enemies.every(({ footprint }) => (
    footprint && footprint.column >= 0 && footprint.column + footprint.width <= 5
  ))).toBe(true);
});
```

- [ ] **Step 2: Run the focused E2E test**

```bash
rtk npm run test:e2e -- --project=desktop --grep "five-column formations"
```

Expected: PASS.

- [ ] **Step 3: Run one desktop and one mobile visual checkpoint**

Start the existing Vite server and use Playwright screenshots after enemies and the first orb are active:

```bash
rtk npm run dev -- --host 127.0.0.1 --port 4173
rtk npm run test:e2e -- --project=desktop --grep "combat starts"
rtk npm run test:e2e -- --project=mobile --grep "combat starts"
```

Inspect the screenshots for these exact conditions:

- player reads as a character, not a dot;
- every base orb motif remains recognizable;
- packed adjacent enemies show no false channel;
- a reserved empty cell is visibly and physically open;
- HUD does not cover the enlarged player or top enemy rows;
- hostile bullets remain distinguishable from friendly orbs.

If a visual check fails, change only central geometry or the relevant asset source, rerender, and repeat this checkpoint.

- [ ] **Step 4: Run complete verification**

```bash
rtk bash scripts/verify_gbc_combat_art.sh
rtk npm test
rtk npm run build
rtk npm run test:e2e
```

Expected: asset verifier passes, all unit tests pass, build succeeds, and full E2E passes. Existing Vite bundle-size warning may remain; new warnings may not.

- [ ] **Step 5: Record the migration**

Append to `docs/WORKLOG.md`:

```markdown
## 2026-08-20 — Five-column combat scale

- Replaced eight small columns with five `84 × 72px` columns and zero packed-cell gap.
- Migrated templates and population caps for fewer, larger enemies.
- Matched enemy production art to footprint collision rectangles.
- Enlarged the player to `96px`, permanent orbs to `40px`, and made base-orb motifs distinct.
- Enlarged Sentinel geometry and weakpoints for the new scale.
- Verified asset pipeline, unit suite, build, and desktop/mobile E2E.
```

- [ ] **Step 6: Commit integrated proof**

```bash
rtk git add e2e/combat.spec.ts docs/WORKLOG.md
rtk git commit -m "test: verify five-column combat scale"
```

- [ ] **Step 7: Push the feature branch**

```bash
rtk git status --short
rtk git push
```

Expected: clean worktree and updated `origin/codex/art-audio-vertical-slice`.
