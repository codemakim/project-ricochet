# Psychedelic Mechanical Occult Production Art Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every current combat and meta-screen graphic with release-quality psychedelic mechanical occult art designed in high resolution first and deliberately re-authored as readable pixel art.

**Architecture:** High-resolution concept masters establish one family language. Authored `1×` pixel masters are deterministic source assets; a small ImageMagick export script creates `2×` nearest-neighbor runtime PNGs. Stable Phaser texture keys and existing DOM structure remain; procedural drawing survives only as missing-file fallback.

**Tech Stack:** OpenAI image generation, ImageMagick, PNG/WebP, Phaser 3.90 texture manifest, TypeScript 5.9, CSS, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-08-20-six-column-production-art-pressure-design.md`

## Global Constraints

- Every produced graphic is intended for release; no disposable placeholder batch is counted as progress.
- Concept comes before pixel translation for every asset family.
- Shared world language: blackened metal, worn enamel, paired-eye visors, circuit seals, recessed appendages, and psychedelic energy.
- No insect/crab silhouettes, thin external limbs, antenna clusters, or detail outside collision footprints.
- Final runtime character pixels are exact `2 × 2px` nearest-neighbor clusters with no antialiasing.
- Runtime sizes: player `82 × 82`, regular enemy `70 × 60`, armored `140 × 120`, splitter `140 × 60`, permanent orb `32 × 32`, temporary orb `20 × 20`.
- Complete enemies use paired eyes; splitter fragments visibly inherit one half of the original paired face.
- Enemy opaque bounds fill gameplay footprints; aura and glow are separate non-collision effects.
- Static release art replaces generated shapes under stable texture keys. Fallback shapes remain only for asset-load failure.
- High-resolution concepts stay under `assets-source/combat/concepts`; authored pixel masters stay under `assets-source/combat/pixel`; runtime exports stay under `public/assets/combat`.
- Do not change damage, timing, collision, or stage balance in this plan.

---

### Task 1: Create And Approve The Production Art Bible

**Files:**
- Create: `assets-source/combat/art-bible.md`
- Create: `assets-source/combat/concepts/character-family.png`
- Create: `assets-source/combat/concepts/base-orb-family.png`
- Create: `assets-source/combat/concepts/fusion-orb-family.png`
- Create: `assets-source/combat/concepts/boss-family.png`
- Create: `assets-source/combat/concepts/environment-ui-family.png`

**Interfaces:**
- Produces: approved high-resolution reference images and written construction rules consumed by every later art task.
- Consumes: the locked concept and asset roles from the spec; no current low-detail sprite is used as a style reference.

- [ ] **Step 1: Write the permanent art-bible text before image generation**

Record exact shared rules:

```markdown
# Psychedelic Mechanical Occult Art Bible

## Shared construction
- paired rectangular/arched eye visor on every complete character
- blackened structural frame, worn enamel armor, one luminous energy system
- broad outer masses; recessed or folded appendages only
- asymmetry limited to one readable role feature
- no insect legs, antenna fans, claws, photoreal grime, or tiny surface noise

## Energy palette
- cyan: resonance/electric precision
- acid green: corrosion/gas
- blue-violet: inertia/gravity
- magenta: splitting/replication
- orange-white: heat/explosion

## Pixel translation
- preserve silhouette, visor, role device, and energy source
- group highlights and shadows into clusters
- remove gradients, micro-scratches, and sub-2px detail
- inspect at 1× mobile display size before approval
```

- [ ] **Step 2: Generate the character-family concept master**

Use `imagegen` with this production prompt:

```text
Release-quality orthographic game character concept sheet on a neutral dark background. Original psychedelic mechanical occult world. Show five separate front-facing designs at consistent scale: compact amber player combat robot, moss-teal basic automaton, burnt-orange shooter automaton, large violet-steel guardian idol, coral-magenta joined splitter automaton. Every complete unit has the same recognizable paired-eye dark visor. Blackened metal frames, worn enamel armor, circuit seals, recessed weapons, short folded appendages contained inside broad silhouettes. Cute but weighty, late-16-bit action RPG readability, high-resolution painted concept art with clean edges. Absolutely no insect legs, crab limbs, antenna clusters, spindly parts, text, UI, perspective overlap, or existing game characters.
```

Save the selected full-resolution result as `character-family.png`. Reject and regenerate if any unit lacks paired eyes, has protruding thin limbs, or cannot be separated cleanly.

- [ ] **Step 3: Generate base and fusion orb concept masters**

Base prompt:

```text
Release-quality weapon artifact concept sheet, six separate spherical occult machine weapons, consistent scale and three-quarter/front presentation, transparent or neutral dark background. Shared black metal containment-shell construction, each with a unique silhouette and internal phenomenon: resonant ring lens, sealed acid gas ampoule, forked electric electrodes, asymmetric inertia flywheel, paired branching split chambers, radial locked explosion vessel. Psychedelic cyan, acid green, electric blue, violet-magenta, orange and white energy. Detailed high-resolution production concept art, readable outer profiles, no text, no simple colored balls, no existing game designs.
```

Fusion prompt lists all nine names and parent concepts:

```text
Release-quality concept sheet of nine distinct fused occult machine orbs: photon orbit, resonant swarm, nano proliferator, mass collapse, reactor orb, cluster bombardment, mirror circuit, meltdown core, vector blade. Each combines physical construction clues from two parent machine weapons but has a new dominant silhouette and phenomenon. Black metal containment shells, luminous mechanical seals, strong readable profiles, psychedelic energy, high-resolution production art, consistent scale, separate objects, neutral dark background, no text, no palette swaps, no simple circles, no existing game designs.
```

Save approved results as `base-orb-family.png` and `fusion-orb-family.png`.

- [ ] **Step 4: Generate boss and environment/UI concept masters**

Boss prompt:

```text
Release-quality orthographic boss family concept sheet for an original psychedelic mechanical occult action game. Three monumental machines built from the same blackened frames, worn enamel shells, paired-eye visors, circuit seals and reactors: modular Sentinel with two tall side weakpoints and central core, circular Hive with two gun modules and two reflector walls, heavy Siege idol with two cannons, defense module and exposed core. Every destructible part visually separable. Front-facing, consistent family language, high-resolution painted concept art, neutral background, no text, no insect anatomy, no existing game designs.
```

Environment/UI prompt:

```text
Release-quality visual development sheet for a sealed psychedelic machine sanctuary. Show a tall mobile combat arena with quiet dark central floor, blackened mechanical shrine walls, worn enamel panels and sparse cyan/magenta/acid energy seals; matching combat HUD frame, reward card, workshop panel, codex tile and buttons. Strong value hierarchy, ornate but readable, game-ready 2D concept art, no text, no fake gameplay obstacles, no existing game UI.
```

Save as `boss-family.png` and `environment-ui-family.png`.

- [ ] **Step 5: Inspect the five concept sheets together and pause for user approval**

Use `view_image` on every sheet and present all five. Verify the written art-bible rules against each image. Do not begin pixel translation until the user approves the family direction. Corrections update the same concept files; rejected alternatives are not committed beside approved masters.

- [ ] **Step 6: Commit approved masters and bible**

```bash
rtk git add assets-source/combat/art-bible.md assets-source/combat/concepts
rtk git commit -m "art: establish mechanical occult art bible"
```

### Task 2: Replace The Coarse Shape Generator With A 2× Pixel Export Pipeline

**Files:**
- Create: `assets-source/combat/pixel/README.md`
- Modify: `scripts/render_gbc_combat_art.sh`
- Modify: `scripts/verify_gbc_combat_art.sh`
- Modify: `src/game/assets/combatAssetManifest.test.ts`

**Interfaces:**
- Consumes: authored pixel PNGs from Tasks 3–7.
- Produces: deterministic `2×` nearest-neighbor exports and exact dimension/palette/alpha checks.

- [ ] **Step 1: Change verifier expectations first**

Replace the `4×` round-trip with a `2×` check:

```bash
check_blocks() {
  local file="$ROOT/$1"
  magick "$file" -filter point -resize 50% "$TMP_SMALL"
  magick "$TMP_SMALL" -filter point -resize 200% "$TMP_ROUND"
  [[ "$(compare -metric AE "$file" "$TMP_ROUND" null: 2>&1)" == '0 (0)' ]]
}
```

Set expected release sizes and maximum purposeful colors:

```bash
check public/assets/combat/sprites/player.png 82x82 12 yes
check public/assets/combat/sprites/enemy-basic.png 70x60 12 yes
check public/assets/combat/sprites/enemy-shooter.png 70x60 12 yes
check public/assets/combat/sprites/enemy-armored.png 140x120 12 yes
check public/assets/combat/sprites/enemy-splitter.png 140x60 12 yes
check public/assets/combat/sprites/enemy-fragment-left.png 70x60 12 yes
check public/assets/combat/sprites/enemy-fragment-right.png 70x60 12 yes
```

Add equivalent `32×32` base/fusion orb, boss-part, projectile, HUD, and background checks as those assets enter later tasks.

- [ ] **Step 2: Run the verifier and confirm RED**

```bash
rtk bash scripts/verify_gbc_combat_art.sh
```

Expected: current `4×` coarse files and old sizes fail.

- [ ] **Step 3: Convert the renderer into an exporter, not an illustrator**

Delete ImageMagick rectangle/polygon commands that invent character, orb, boss, projectile, or HUD masters. Keep only deterministic directory setup and exports:

```bash
export_sprite() {
  local source="$PIXEL/$1" output="$SPRITES/$2"
  magick "$source" -filter point -resize 200% -strip "$output"
}
```

The no-argument script must fail if any required authored master is absent. During staged production, both scripts accept explicit stable asset keys and process only those keys:

```bash
rtk bash scripts/render_gbc_combat_art.sh player enemy-basic orb-echo
rtk bash scripts/verify_gbc_combat_art.sh player enemy-basic orb-echo
```

Reject unknown keys and duplicate the asset inventory in only one shell array shared by selection, export, and verification functions. Background export may use a separately approved authored master and lossless WebP. `assets-source/combat/pixel/README.md` lists exact master and runtime dimensions from the spec.

- [ ] **Step 4: Run shell syntax and manifest tests**

```bash
rtk bash -n scripts/render_gbc_combat_art.sh
rtk npx vitest run src/game/assets/combatAssetManifest.test.ts
```

Expected: shell syntax and existing manifest tests pass. The full art verifier stays RED until the required pixel masters are replaced in subsequent tasks.

- [ ] **Step 5: Commit**

```bash
rtk git add assets-source/combat/pixel/README.md scripts/render_gbc_combat_art.sh scripts/verify_gbc_combat_art.sh src/game/assets/combatAssetManifest.test.ts
rtk git commit -m "build: add production pixel export pipeline"
```

### Task 3: Author The Final Player, Core Enemy Family, And Three Base Orbs

**Files:**
- Create: `assets-source/combat/pixel/player.png`
- Create: `assets-source/combat/pixel/enemy-basic.png`
- Create: `assets-source/combat/pixel/enemy-shooter.png`
- Create: `assets-source/combat/pixel/enemy-armored.png`
- Create: `assets-source/combat/pixel/orb-echo.png`
- Create: `assets-source/combat/pixel/orb-corrosion.png`
- Create: `assets-source/combat/pixel/orb-conduction.png`
- Modify: corresponding runtime files under `public/assets/combat/sprites/`
- Modify: `scripts/verify_gbc_combat_art.sh`

**Interfaces:**
- Consumes: approved `character-family.png`, `base-orb-family.png`, and `art-bible.md`.
- Produces: the first final in-game art batch and locked translation decisions for the rest.

- [ ] **Step 1: Author exact-size pixel masters from approved concepts**

Create:

- player `41 × 41`;
- basic and shooter `35 × 30`;
- armored `70 × 60`;
- echo, corrosion, and conduction `16 × 16`.

Preserve concept silhouette, paired visor, role device, material separation, and energy source. Use `8–12` purposeful colors, transparent corners, grouped shading, and no antialiasing. Enemies must touch every blocking edge through intentional shell/track masses while retaining transparent rounded corners only where they do not imply a passable lane.

- [ ] **Step 2: Export and verify dimensions, blocks, palettes, and opaque bounds**

```bash
rtk bash scripts/render_gbc_combat_art.sh player enemy-basic enemy-shooter enemy-armored orb-echo orb-corrosion orb-conduction
rtk bash scripts/verify_gbc_combat_art.sh player enemy-basic enemy-shooter enemy-armored orb-echo orb-corrosion orb-conduction
```

- [ ] **Step 3: Inspect every asset at runtime size and in combat**

Use `view_image` on the runtime PNGs, then run:

```bash
rtk npx playwright test e2e/combat.spec.ts --project=desktop-chromium --grep "opening slice|visible bounds"
```

Capture desktop and mobile screenshots. Reject the batch if the player reads as a bean, any complete enemy loses its paired eyes, roles require color alone, or a sprite suggests a false collision gap.

- [ ] **Step 4: Commit**

```bash
rtk git add assets-source/combat/pixel/player.png assets-source/combat/pixel/enemy-basic.png assets-source/combat/pixel/enemy-shooter.png assets-source/combat/pixel/enemy-armored.png assets-source/combat/pixel/orb-echo.png assets-source/combat/pixel/orb-corrosion.png assets-source/combat/pixel/orb-conduction.png public/assets/combat/sprites scripts/verify_gbc_combat_art.sh
rtk git commit -m "art: add core mechanical occult cast"
```

### Task 4: Complete Special Enemies And Base Orbs

**Files:**
- Create: `assets-source/combat/pixel/enemy-splitter.png`
- Create: `assets-source/combat/pixel/enemy-fragment-left.png`
- Create: `assets-source/combat/pixel/enemy-fragment-right.png`
- Create: `assets-source/combat/pixel/orb-inertia.png`
- Create: `assets-source/combat/pixel/orb-split.png`
- Create: `assets-source/combat/pixel/orb-explosion.png`
- Modify: corresponding runtime sprites
- Modify: `scripts/verify_gbc_combat_art.sh`

**Interfaces:**
- Consumes: Task 3 translation rules and approved concept sheets.
- Produces: complete common/special enemy and six-base-orb release sets.

- [ ] **Step 1: Author remaining masters**

Create splitter `70 × 30`, fragments `35 × 30`, and three orbs `16 × 16`. The intact splitter has one paired-eye face spanning the fracture; left and right fragments each retain the correct half so their origin is obvious. Inertia, split, and explosion must retain distinct silhouettes when desaturated.

- [ ] **Step 2: Add exact asset assertions and run export verification**

```bash
rtk bash scripts/render_gbc_combat_art.sh
rtk bash scripts/verify_gbc_combat_art.sh
rtk npx vitest run src/game/assets/combatAssetManifest.test.ts src/game/scenes/combatTextureRules.test.ts
```

Expected: all common enemy and base orb assets pass dimensions, `2×` blocks, palette, alpha, and bounds.

- [ ] **Step 3: Run splitter and base-orb browser checks**

```bash
rtk npx playwright test e2e/combat.spec.ts --project=desktop-chromium --grep "splitter|permanent orb cores"
```

Inspect a screenshot containing intact splitter, both fragments, and at least three different base orbs.

- [ ] **Step 4: Commit**

```bash
rtk git add assets-source/combat/pixel public/assets/combat/sprites scripts/verify_gbc_combat_art.sh
rtk git commit -m "art: complete enemies and base orbs"
```

### Task 5: Ship Static Fusion-Orb Art Instead Of Generated Level Shapes

**Files:**
- Create: nine `assets-source/combat/pixel/orb-<fusion-id>.png` files
- Create: nine corresponding `public/assets/combat/sprites/orb-<fusion-id>.png` files
- Modify: `src/game/assets/combatAssetManifest.ts`
- Modify: `src/game/assets/combatAssetManifest.test.ts`
- Modify: `src/game/scenes/combatTextureRules.ts`
- Modify: `src/game/scenes/combatTextureRules.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `src/game/orbs/OrbManager.ts`
- Modify: `src/game/orbs/OrbManager.test.ts`
- Modify: `scripts/render_gbc_combat_art.sh`
- Modify: `scripts/verify_gbc_combat_art.sh`

**Interfaces:**
- Consumes: `FUSION_ORB_IDS`, approved fusion concept sheet, and existing `drawOrbLevels()` overlay.
- Produces: one stable release texture per fusion ID; levels remain a runtime notch overlay.

- [ ] **Step 1: Write failing static-fusion texture tests**

Assert the manifest contains:

```ts
for (const id of FUSION_ORB_IDS) {
  expect(COMBAT_IMAGE_ASSETS).toContainEqual({
    key: `orb-${id}`,
    url: `/assets/combat/sprites/orb-${id}.png`,
    sampling: 'nearest',
  });
}
```

Configure and fuse test orbs at multiple resulting levels. Assert every sprite uses `orb-${fusionType}`, never `orb-${fusionType}-lvN`. Assert `combatProjectileTextureDescriptors()` no longer creates base or fusion level permutations.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
rtk npx vitest run src/game/assets/combatAssetManifest.test.ts src/game/scenes/combatTextureRules.test.ts src/game/orbs/OrbManager.test.ts
```

- [ ] **Step 3: Author nine `16 × 16` fusion masters and export them**

Create final silhouettes for:

```text
photon-orbit, resonant-swarm, nano-proliferator,
mass-collapse, reactor-orb, cluster-bombardment,
mirror-circuit, meltdown-core, vector-blade
```

Each retains construction clues from both parent orbs and one unique dominant effect. Add exact `32 × 32`, `2×`, palette, and alpha checks.

- [ ] **Step 4: Load stable static keys and delete unused generated level textures**

In `OrbManager.synchronizeSprites`:

```ts
const textureKey = `orb-${state.coreType}`;
```

Keep `drawOrbLevels()` as the only level indicator. Make its notch radius derive from `GAME_TUNING.visual.friendly.permanentOrb.width / 2` so level marks sit outside the new `32px` art instead of using the old hard-coded radius. Delete `leveledCores` and `leveledFusions` generation; retain base fallback descriptors for missing assets.

- [ ] **Step 5: Run tests, export verification, and fusion browser checks**

```bash
rtk bash scripts/render_gbc_combat_art.sh
rtk bash scripts/verify_gbc_combat_art.sh
rtk npx vitest run src/game/assets/combatAssetManifest.test.ts src/game/scenes/combatTextureRules.test.ts src/game/orbs/OrbManager.test.ts
rtk npx playwright test e2e/combat.spec.ts --project=desktop-chromium --grep "fusion core"
```

- [ ] **Step 6: Commit**

```bash
rtk git add assets-source/combat/pixel public/assets/combat/sprites src/game/assets/combatAssetManifest.ts src/game/assets/combatAssetManifest.test.ts src/game/scenes/combatTextureRules.ts src/game/scenes/combatTextureRules.test.ts src/game/scenes/CombatScene.ts src/game/orbs/OrbManager.ts src/game/orbs/OrbManager.test.ts scripts/render_gbc_combat_art.sh scripts/verify_gbc_combat_art.sh
rtk git commit -m "art: ship static fusion orb identities"
```

### Task 6: Replace All Three Boss Families With Production Sprites

**Files:**
- Create: Sentinel, Hive, and Siege pixel masters under `assets-source/combat/pixel/bosses/`
- Create: corresponding runtime files under `public/assets/combat/sprites/bosses/`
- Modify: `src/game/assets/combatAssetManifest.ts`
- Modify: `src/game/assets/combatAssetManifest.test.ts`
- Modify: `src/game/scenes/combatTextureRules.ts`
- Modify: `src/game/scenes/combatTextureRules.test.ts`
- Modify: boss texture paths/keys only where current stable keys are missing
- Modify: `scripts/render_gbc_combat_art.sh`
- Modify: `scripts/verify_gbc_combat_art.sh`
- Modify: `e2e/combat.spec.ts`

**Interfaces:**
- Consumes: approved boss concept sheet and existing tuned boss geometry.
- Produces: static production textures for every destructible boss part without changing manager behavior.

- [ ] **Step 1: Inventory and test every required stable key**

The manifest must load at least:

```text
boss-body, boss-left-weakpoint, boss-right-weakpoint, boss-core,
hive-core, hive-left-shooter, hive-right-shooter,
hive-left-reflector, hive-right-reflector,
siege-body, siege-left-weakpoint, siege-right-weakpoint, siege-core
```

Keep warning flashes, bullets, and laser as smooth/runtime effects. Assert `renderableCombatTextureDescriptors()` retains fallback descriptors but loaded static keys win.

- [ ] **Step 2: Author pixel masters at exact tuned part sizes divided by two**

Each boss uses one central paired-eye face language, separable modules, visible weakpoint materials, and no opaque detail outside its collision contract. Hive reflectors read as reflective barriers, not guns. Siege cannons read as cannons even in grayscale.

- [ ] **Step 3: Export and verify asset geometry**

```bash
rtk bash scripts/render_gbc_combat_art.sh
rtk bash scripts/verify_gbc_combat_art.sh
rtk npx vitest run src/game/assets/combatAssetManifest.test.ts src/game/scenes/combatTextureRules.test.ts src/game/bosses/BossManager.test.ts src/game/bosses/HiveBossManager.test.ts
```

- [ ] **Step 4: Run boss screenshot and collision checks**

```bash
rtk npx playwright test e2e/combat.spec.ts --project=desktop-chromium --grep "midboss|hive|third boss|boss part"
```

Capture intact and core-only screenshots of every boss. Verify removed modules leave readable holes and every orb collision occurs at visible part edges.

- [ ] **Step 5: Commit**

```bash
rtk git add assets-source/combat/pixel/bosses public/assets/combat/sprites/bosses src/game/assets/combatAssetManifest.ts src/game/assets/combatAssetManifest.test.ts src/game/scenes/combatTextureRules.ts src/game/scenes/combatTextureRules.test.ts scripts/render_gbc_combat_art.sh scripts/verify_gbc_combat_art.sh e2e/combat.spec.ts
rtk git commit -m "art: replace all boss families"
```

### Task 7: Finish Character Motion And Smooth Combat VFX

**Files:**
- Modify: `src/game/config/gameTuning.ts`
- Modify: `src/game/config/gameTuning.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `src/game/scenes/combatSceneRules.test.ts`
- Modify: `src/game/enemies/EnemyManager.ts`
- Modify: `src/game/enemies/EnemyManager.test.ts`
- Modify: `src/game/orbs/OrbManager.ts`
- Modify: `src/game/orbs/OrbManager.test.ts`
- Modify: `e2e/combat.spec.ts`

**Interfaces:**
- Consumes: approved static sprites and the existing named feedback methods in `CombatScene`.
- Produces: collision-independent idle, attack, hit, split, proc, fusion, and phase feedback; no second effect framework.

- [ ] **Step 1: Write failing visual-state contracts around existing owners**

Add central timing/color assertions for player launch recoil, shooter charge/recoil, armored hit brace, splitter fracture, boss exposed-core rage, base-orb trails, and all current core/fusion feedback names. Unit tests assert that managers emit existing semantic events without moving or resizing physics bodies. Browser tests assert representative named effects exist, expire, and do not own physics bodies.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
rtk npx vitest run src/game/config/gameTuning.test.ts src/game/scenes/combatSceneRules.test.ts src/game/enemies/EnemyManager.test.ts src/game/orbs/OrbManager.test.ts
rtk npx playwright test e2e/combat.spec.ts --project=desktop-chromium --grep "production motion|production effects"
```

- [ ] **Step 3: Upgrade existing feedback methods, not gameplay objects**

Keep static sprites locked to their approved collision rectangles. Use the existing Phaser tweens, additive graphics, trails, rings, beams, and particles to add:

- player visor/chamber idle and launch recoil;
- shooter warning lamp, charge, muzzle flash, and recoil;
- armored brace flash and splitter fracture separation;
- distinct echo, corrosion, conduction, inertia, split, and explosion trails/procs;
- distinct fusion impact signatures using their existing semantic event names;
- boss module break and exposed-core rage pulses.

Move only shared visual timings, widths, colors, alpha, and lifetimes into `GAME_TUNING.visual.feedback`. Do not introduce a generic animation engine or change damage/collision values.

- [ ] **Step 4: Verify mobile readability and effect ownership**

Run the Step 2 commands. Capture a dense mobile combat sequence containing friendly trails, hostile bullets, a proc, and a hit. Reject effects that hide aim, enemy faces, hostile ownership, or real passages.

- [ ] **Step 5: Commit**

```bash
rtk git add src/game/config/gameTuning.ts src/game/config/gameTuning.test.ts src/game/scenes/CombatScene.ts src/game/scenes/combatSceneRules.test.ts src/game/enemies/EnemyManager.ts src/game/enemies/EnemyManager.test.ts src/game/orbs/OrbManager.ts src/game/orbs/OrbManager.test.ts e2e/combat.spec.ts
rtk git commit -m "art: finish character motion and combat effects"
```

### Task 8: Finish Arena, Projectiles, HUD, And Meta UI

**Files:**
- Create: environment, projectile, HUD, card, panel, icon, and frame masters under `assets-source/combat/pixel/ui/`
- Modify: runtime files under `public/assets/combat/backgrounds/`, `public/assets/combat/sprites/`, and `public/assets/meta/`
- Modify: `src/game/assets/combatAssetManifest.ts`
- Modify: `src/game/assets/combatAssetManifest.test.ts`
- Modify: `src/game/meta/AppController.ts`
- Create: `src/game/meta/AppController.test.ts`
- Modify: `src/styles.css`
- Modify: `e2e/meta-loop.spec.ts`
- Modify: `scripts/render_gbc_combat_art.sh`
- Modify: `scripts/verify_gbc_combat_art.sh`

**Interfaces:**
- Consumes: approved environment/UI concept, stable app DOM behavior, and all static orb keys from Task 5.
- Produces: coherent release presentation for combat and meta loop.

- [ ] **Step 1: Author the environment and combat UI masters**

Create a quiet `225 × 400` authored arena master exported to `450 × 800`, plus HUD/status/boss frames, reward-card panels, projectile masters, and semantic icons. The central playfield stays low contrast; mechanical sanctuary detail and psychedelic seals remain at edges and state-change zones.

Friendly and hostile projectiles differ by both silhouette and palette. Aim guide remains cyan; hostile bullets remain coral/yellow. VFX stay smooth and do not become pixel collision proxies.

- [ ] **Step 2: Replace CSS-drawn orb circles with real asset images**

In `AppController`, render:

```html
<img class="workshop-orb" src="/assets/combat/sprites/orb-${coreId}.png" alt="" />
```

for known cores/fusions. Keep accessible names on the card text. Remove radial/conic gradients that fabricate orb art. Use approved panel/frame assets through CSS backgrounds or border images while preserving current responsive layout, tabs, dialog semantics, keyboard navigation, and mobile bottom sheet.

- [ ] **Step 3: Update DOM and accessibility tests first, then implementation**

Assert every workshop card uses the correct static image URL, unknown discoveries preserve their masked label, tabs retain their ARIA relationships, and the mobile detail sheet still opens without scrolling the page.

Run:

```bash
rtk npx vitest run src/game/meta/AppController.test.ts
rtk npx playwright test e2e/meta-loop.spec.ts
```

- [ ] **Step 4: Export and verify all remaining assets**

```bash
rtk bash scripts/render_gbc_combat_art.sh
rtk bash scripts/verify_gbc_combat_art.sh
rtk npx vitest run src/game/assets/combatAssetManifest.test.ts src/game/meta/AppController.test.ts
```

- [ ] **Step 5: Inspect mobile and desktop combat/meta screenshots**

Use `game-playtest`. Capture deploy, opening combat, dense combat, reward choice, each boss, result, workshop grid/detail, codex state, and mobile bottom sheet. Reject any screen with unreadable projectile ownership, background competition, flat HTML-like art, cropped detail, or inconsistent panel language.

- [ ] **Step 6: Commit**

```bash
rtk git add assets-source/combat/pixel/ui public/assets/combat public/assets/meta src/game/assets/combatAssetManifest.ts src/game/assets/combatAssetManifest.test.ts src/game/meta/AppController.ts src/game/meta/AppController.test.ts src/styles.css e2e/meta-loop.spec.ts scripts/render_gbc_combat_art.sh scripts/verify_gbc_combat_art.sh
rtk git commit -m "art: finish sanctuary combat and meta UI"
```

### Task 9: Final Art QA, Documentation, And Release Gate

**Files:**
- Modify: `assets-source/combat/art-bible.md`
- Modify: `docs/TUNING.md`
- Modify: `docs/WORKLOG.md`
- Modify: `e2e/combat.spec.ts`
- Modify: `e2e/meta-loop.spec.ts`

**Interfaces:**
- Consumes: all approved assets and static manifests from Tasks 1–8.
- Produces: final reproducibility notes and full validation evidence.

- [ ] **Step 1: Verify the complete asset inventory**

Compare `COMBAT_IMAGE_ASSETS`, meta-screen image references, renderer exports, verifier entries, and files on disk. Assert every production key has one source master, one runtime file, correct sampling, and a fallback descriptor only where runtime fallback is supported.

- [ ] **Step 2: Add final visual regression assertions**

Keep assertions semantic and stable:

- actual image assets loaded instead of generated fallback textures;
- player/enemy/boss visible and physical bounds align;
- base and fusion orbs use static texture keys;
- friendly/hostile projectile palettes differ;
- workshop uses image assets, not CSS-generated circles;
- mobile HUD and bottom sheet do not cover actionable combat or card content.

- [ ] **Step 3: Run final verification once**

```bash
rtk bash scripts/render_gbc_combat_art.sh
rtk bash scripts/verify_gbc_combat_art.sh
rtk npm test
rtk npm run build
rtk npm run test:e2e
rtk git diff --check
```

Expected: deterministic export; asset verifier passes; all unit and browser tests pass; build passes with only the existing chunk-size warning if still present.

- [ ] **Step 4: Update durable documentation**

Record source/runtime directories, `2×` export rule, palette ceiling, concept approval workflow, texture-key ownership, and screenshot checklist in `art-bible.md`. Update `docs/TUNING.md` only with visual-scale controls. Add a dated `docs/WORKLOG.md` entry covering the completed production-art conversion.

- [ ] **Step 5: Commit**

```bash
rtk git add assets-source/combat/art-bible.md docs/TUNING.md docs/WORKLOG.md e2e/combat.spec.ts e2e/meta-loop.spec.ts
rtk git commit -m "test: verify production art pass"
```
