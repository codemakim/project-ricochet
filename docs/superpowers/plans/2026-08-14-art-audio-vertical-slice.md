# Art And Audio Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one production-quality scrapyard combat slice from deployment through Sentinel defeat using original hand-painted 2D assets, bounded VFX, readable sound cues, and adaptive music without changing gameplay behavior.

**Architecture:** Keep every existing gameplay manager and stable Phaser texture key. Add a manifest-driven `CombatScene.preload()`, extract the current procedural art into a per-key fallback helper, and add one scene-owned `CombatAudio` class; production sprites and sounds replace placeholders without becoming gameplay inputs. Generate and review art before integration, then run browser automation once after the entire slice is assembled.

**Tech Stack:** TypeScript 5.9, Phaser 3.90, Vite 8.1, Vitest 4.1, Playwright 1.61, OpenAI image generation, ImageMagick, Python 3, NumPy, SoundFile, lameenc

## Global Constraints

- Visual theme is an original dark mechanical scrapyard with cute 70% / mechanical 30% recycled machines.
- Rendering is non-pixel, hand-painted 2D illustration with transparent sprites.
- Normal combat sounds playful; bosses and major danger use heavier industrial weight.
- Logical gameplay resolution remains `450 × 720`.
- Collision bodies, damage radii, enemy placement, boss phases, encounter tuning, and controls do not change.
- Existing texture keys stay stable; missing individual art falls back per key to current procedural graphics.
- Missing or undecodable audio falls back to silence and never blocks combat.
- Runtime atlases stay at or below `2048 × 2048`.
- Initial compressed runtime assets target at most 12 MB total.
- Do not add a global event bus, a new gameplay scene hierarchy, or a broad `CombatScene` refactor.
- Fusion-orb production art, Hive and Siege production art, full menu reskin, skins, detailed audio settings, and new gameplay remain deferred.
- Browser automation runs only after the integrated slice; individual tasks use unit tests, build checks, `view_image`, and file validation.
- All adjustable VFX and audio limits live in `GAME_TUNING` or the audio cue table, never duplicated at call sites.

---

## File Map

### New code

- `src/game/assets/combatAssetManifest.ts` — stable production image/audio paths and Phaser preload calls.
- `src/game/assets/combatAssetManifest.test.ts` — manifest uniqueness, loader contracts, and shipped-file coverage.
- `src/game/assets/createCombatFallbackTextures.ts` — current runtime drawing code, changed to fill only missing keys.
- `src/game/audio/CombatAudio.ts` — cue playback, variation, voice limits, adaptive music, mute persistence, and visibility state.
- `src/game/audio/CombatAudio.test.ts` — deterministic fake-sound tests.
- `scripts/generate_combat_audio.py` — deterministic WAV/OGG/MP3 master and runtime asset generation.
- `scripts/test_generate_combat_audio.py` — standard-library checks for duration, peak, loop alignment, and deterministic output.
- `tools/audio-requirements.txt` — asset-build-only Python encoder dependencies.
- `e2e/combat.spec.ts` — integrated desktop/mobile loading, mute, music state, and screenshot contracts using its existing combat helpers.

### Modified code

- `src/game/scenes/CombatScene.ts` — preload call, fallback call, background/HUD art, bounded transient VFX, audio ownership, and semantic cue calls.
- `src/game/scenes/combatTextureRules.ts` — retain procedural descriptors as fallback definitions.
- `src/game/config/gameTuning.ts` and test — VFX limits, durations, scales, and transient cap.
- `src/game/meta/AppController.ts` — device-pixel-ratio render resolution cap only.
- `src/game/enemies/EnemyManager.ts` and test — shooter warning/fire callbacks.
- `src/game/orbs/OrbManager.ts` and test — launch callback, production basic-core key selection, and loaded-art display size.
- `src/game/bosses/BossManager.ts` and test — production sprite display sizes and Sentinel attack cue callback.
- `src/game/bosses/bossEncounter.ts` — shared Sentinel cue type accepted by the boss manager.
- `.gitignore` — local audio build environment.
- `docs/TUNING.md` and `docs/WORKLOG.md` — asset/audio tuning ownership and completed slice record.

### Source and runtime assets

- `assets-source/combat/graphics/` — concept sheet and high-resolution art masters.
- `assets-source/combat/audio/` — generated WAV masters.
- `public/assets/combat/backgrounds/` — production arena background.
- `public/assets/combat/sprites/` — player, common enemies, Sentinel parts, six basic orb cores, and HUD frames.
- `public/assets/combat/vfx/` — transient combat-effect textures.
- `public/assets/combat/audio/` — OGG/MP3 sound effects.
- `public/assets/combat/music/` — synchronized OGG/MP3 base and boss stems.

---

### Task 1: Add manifest loading and per-key procedural fallback

**Files:**
- Create: `src/game/assets/combatAssetManifest.ts`
- Create: `src/game/assets/combatAssetManifest.test.ts`
- Create: `src/game/assets/createCombatFallbackTextures.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `src/game/scenes/combatTextureRules.ts`

**Interfaces:**
- Produces: `COMBAT_IMAGE_ASSETS`, `COMBAT_AUDIO_ASSETS`, `preloadCombatAssets(scene)`, `missingCombatTextureKeys(hasTexture)`, and `createCombatFallbackTextures(scene)`.
- Consumes: existing `renderableCombatTextureDescriptors()` and the drawing bodies currently inside `CombatScene.createTextures()` / `createProjectileTexture()`.

- [ ] **Step 1: Write the failing manifest tests**

Create a fake loader and assert exact key uniqueness plus preload method selection:

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  COMBAT_AUDIO_ASSETS,
  COMBAT_IMAGE_ASSETS,
  preloadCombatAssets,
} from './combatAssetManifest';

describe('combat asset manifest', () => {
  it('uses one unique runtime path per production image key', () => {
    const keys = COMBAT_IMAGE_ASSETS.map(({ key }) => key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(expect.arrayContaining([
      'combat-background', 'player',
      'enemy-basic', 'enemy-armored', 'enemy-shooter',
      'boss-body', 'boss-left-weakpoint', 'boss-right-weakpoint', 'boss-core',
      'orb-echo', 'orb-corrosion', 'orb-conduction',
      'orb-inertia', 'orb-split', 'orb-explosion',
      'hud-status-frame', 'hud-boss-frame',
    ]));
  });

  it('preloads images and audio through Phaser loader methods', () => {
    const image = vi.fn();
    const audio = vi.fn();
    preloadCombatAssets({ load: { image, audio } } as never);
    expect(image).toHaveBeenCalledTimes(COMBAT_IMAGE_ASSETS.length);
    expect(audio).toHaveBeenCalledTimes(COMBAT_AUDIO_ASSETS.length);
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
rtk npm test -- src/game/assets/combatAssetManifest.test.ts
```

Expected: FAIL because `combatAssetManifest.ts` does not exist.

- [ ] **Step 3: Add the exact manifest types and entries**

Use these public interfaces:

```ts
export interface CombatImageAsset {
  key: string;
  url: string;
}

export interface CombatAudioAsset {
  key: string;
  urls: readonly [ogg: string, mp3: string];
}

export const COMBAT_IMAGE_ASSETS = [
  { key: 'combat-background', url: '/assets/combat/backgrounds/scrapyard-arena.webp' },
  { key: 'player', url: '/assets/combat/sprites/player.png' },
  { key: 'enemy-basic', url: '/assets/combat/sprites/enemy-basic.png' },
  { key: 'enemy-armored', url: '/assets/combat/sprites/enemy-armored.png' },
  { key: 'enemy-shooter', url: '/assets/combat/sprites/enemy-shooter.png' },
  { key: 'boss-body', url: '/assets/combat/sprites/sentinel-body.png' },
  { key: 'boss-left-weakpoint', url: '/assets/combat/sprites/sentinel-left-weakpoint.png' },
  { key: 'boss-right-weakpoint', url: '/assets/combat/sprites/sentinel-right-weakpoint.png' },
  { key: 'boss-core', url: '/assets/combat/sprites/sentinel-core.png' },
  { key: 'orb-echo', url: '/assets/combat/sprites/orb-echo.png' },
  { key: 'orb-corrosion', url: '/assets/combat/sprites/orb-corrosion.png' },
  { key: 'orb-conduction', url: '/assets/combat/sprites/orb-conduction.png' },
  { key: 'orb-inertia', url: '/assets/combat/sprites/orb-inertia.png' },
  { key: 'orb-split', url: '/assets/combat/sprites/orb-split.png' },
  { key: 'orb-explosion', url: '/assets/combat/sprites/orb-explosion.png' },
  { key: 'hud-status-frame', url: '/assets/combat/sprites/hud-status-frame.png' },
  { key: 'hud-boss-frame', url: '/assets/combat/sprites/hud-boss-frame.png' },
] as const satisfies readonly CombatImageAsset[];

export const COMBAT_AUDIO_ASSETS: readonly CombatAudioAsset[] = [];

export function preloadCombatAssets(scene: Phaser.Scene): void {
  for (const { key, url } of COMBAT_IMAGE_ASSETS) scene.load.image(key, url);
  for (const { key, urls } of COMBAT_AUDIO_ASSETS) scene.load.audio(key, [...urls]);
}
```

Task 6 fills the audio array. Do not add fake audio paths now.

- [ ] **Step 4: Write the failing per-key fallback selection test**

Add:

```ts
import {
  FALLBACK_COMBAT_TEXTURE_KEYS,
  missingCombatTextureKeys,
} from './createCombatFallbackTextures';

it('returns only missing fallback keys', () => {
  const loaded = new Set(FALLBACK_COMBAT_TEXTURE_KEYS.slice(1));
  expect(missingCombatTextureKeys((key) => loaded.has(key)))
    .toEqual([FALLBACK_COMBAT_TEXTURE_KEYS[0]]);
});
```

- [ ] **Step 5: Extract the current drawing code and change only its guard**

Move `CombatScene.createTextures()` and `createProjectileTexture()` into `createCombatFallbackTextures.ts`. Keep their actual drawing instructions unchanged. Replace grouped `player` / boss guards with per-key generation:

```ts
export const FALLBACK_COMBAT_TEXTURE_KEYS = [
  'player', 'enemy-basic', 'enemy-armored', 'enemy-shooter',
  'boss-body', 'boss-left-weakpoint', 'boss-right-weakpoint', 'boss-core',
  'boss-aim-marker', 'boss-drop-marker',
  ...Object.keys(renderableCombatTextureDescriptors()),
] as const;

export function missingCombatTextureKeys(
  hasTexture: (key: string) => boolean,
): string[] {
  return FALLBACK_COMBAT_TEXTURE_KEYS.filter((key) => !hasTexture(key));
}

export function createCombatFallbackTextures(scene: Phaser.Scene): void {
  const missing = new Set(missingCombatTextureKeys((key) => scene.textures.exists(key)));
  if (missing.size === 0) return;
  const graphics = scene.add.graphics();
  const shouldCreate = (key: string): boolean => missing.has(key);
  if (shouldCreate('player')) {
    graphics.fillStyle(0x4ddcff).fillCircle(18, 18, 18);
    graphics.fillStyle(0x061225).fillCircle(12, 15, 2).fillCircle(24, 15, 2);
    graphics.generateTexture('player', 36, 36);
  }
  for (const [key, descriptor] of Object.entries(renderableCombatTextureDescriptors())) {
    if (shouldCreate(key)) createProjectileTexture(graphics, key, descriptor);
  }
  graphics.destroy();
}
```

Copy the remaining current enemy and boss drawing statements without changing their colors or dimensions. Wrap each block that ends in `generateTexture` with `if (shouldCreate(key))`. Move the current `createProjectileTexture` switch body unchanged as a file-local function; every referenced shape and symbol therefore remains defined by `CombatTextureDescriptor`.

Do not generate `combat-background` or HUD production keys. `CombatScene` must tolerate their absence until Task 3/4 by checking `textures.exists()` before adding them.

- [ ] **Step 6: Add preload and fallback calls to `CombatScene`**

```ts
preload(): void {
  preloadCombatAssets(this);
}

create(): void {
  // existing state initialization
  createCombatFallbackTextures(this);
  // existing gameplay creation
}
```

Delete the two moved private methods from `CombatScene` and remove their now-unused imports.

- [ ] **Step 7: Run focused and full non-browser checks**

Run:

```bash
rtk npm test -- src/game/assets/combatAssetManifest.test.ts src/game/scenes/combatTextureRules.test.ts
rtk npm test
rtk npm run build
```

Expected: all pass. Do not run Playwright yet.

- [ ] **Step 8: Commit**

```bash
rtk git add src/game/assets src/game/scenes/CombatScene.ts src/game/scenes/combatTextureRules.ts
rtk git commit -m "feat: add combat asset loading seam"
```

---

### Task 2: Produce and approve the opening-slice concept sheet

**Files:**
- Create: `assets-source/combat/graphics/opening-slice-concept.png`
- Create: `assets-source/combat/graphics/palette.md`

**Interfaces:**
- Produces: the single approved visual reference passed to every production image-generation call in Tasks 3–5.
- Consumes: the approved A1 direction from the design spec.

- [ ] **Step 1: Read the image-generation instructions**

Read the complete `imagegen` skill. This task creates a reference image, not runtime art.

- [ ] **Step 2: Generate one original concept sheet**

Use this prompt, without naming a living artist, commercial game, or protected character:

```text
Original 2D mobile game concept sheet for PROJECT RICOCHET. Non-pixel hand-painted illustration. Dark mechanical scrapyard world. Cute 70 percent, mechanical 30 percent. Show a small floating repair robot player with a large ceramic face plate, short utility arms, patched yellow-orange worn steel body and bright cyan recovery core; three enemies: compact square maintenance robot, wide armored scrap compactor, narrow turret robot with obvious barrel and warning lamp; a large modular Sentinel boss assembled from mismatched heavy scrapyard machinery with separate left weakpoint, right weakpoint and glowing central core; six small metal orb cores with distinct wave, corrosion canister, electric fork, flywheel arrow, branching split, and unstable explosion motifs. Front-facing orthographic game sprites, strong distinct silhouettes, restrained moss green and oxidized brown environment colors, saturated energy lights, no text, no logos, no UI, neutral dark presentation board, consistent scale and material language, original designs.
```

Save the generated result as `assets-source/combat/graphics/opening-slice-concept.png`.

- [ ] **Step 3: Inspect and self-check the concept**

Use `view_image` at original detail. Reject and regenerate if any of these fail:

- player face remains readable at thumbnail size;
- three common enemies differ without relying on color;
- shooter barrel reads immediately;
- Sentinel parts can be separated without inventing hidden geometry;
- six orb motifs remain distinct;
- no text, watermark, unrelated object, copied mascot, or cropped unit appears.

- [ ] **Step 4: Record the palette and material rules**

Create `palette.md` with exact swatches sampled from the approved sheet:

```md
# Opening Slice Palette

- Background iron: `#17211E`
- Moss shadow: `#34483B`
- Player yellow-orange: `#DDA24C`
- Ceramic face: `#E7E1C7`
- Friendly cyan energy: `#62E5F4`
- Hostile orange-red energy: `#F26B42`
- Boss warning yellow: `#FFD166`

Materials: worn painted steel, oxidized edges, rubber joints, ceramic face plates, saturated internal energy.
```

- [ ] **Step 5: User visual approval checkpoint**

Show the concept image to the user. Stop here until they approve or request a regeneration. Do not produce runtime sprites from an unapproved sheet.

- [ ] **Step 6: Commit the approved reference**

```bash
rtk git add assets-source/combat/graphics/opening-slice-concept.png assets-source/combat/graphics/palette.md
rtk git commit -m "art: approve scrapyard combat direction"
```

---

### Task 3: Produce the arena, player, and common enemy sprites

**Files:**
- Create: `assets-source/combat/graphics/scrapyard-arena-master.png`
- Create: `assets-source/combat/graphics/player-master.png`
- Create: `assets-source/combat/graphics/enemy-basic-master.png`
- Create: `assets-source/combat/graphics/enemy-armored-master.png`
- Create: `assets-source/combat/graphics/enemy-shooter-master.png`
- Create: `public/assets/combat/backgrounds/scrapyard-arena.webp`
- Create: `public/assets/combat/sprites/player.png`
- Create: `public/assets/combat/sprites/enemy-basic.png`
- Create: `public/assets/combat/sprites/enemy-armored.png`
- Create: `public/assets/combat/sprites/enemy-shooter.png`
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `src/game/meta/AppController.ts`
- Modify: `src/game/assets/combatAssetManifest.test.ts`

**Interfaces:**
- Consumes: approved concept sheet and manifest keys from Tasks 1–2.
- Produces: native 2× sprites displayed at existing logical sizes and a `900 × 1440` arena displayed at `450 × 720`.

- [ ] **Step 1: Generate separate transparent masters**

Read the `sprite-pipeline` skill, then call image generation once per player/enemy master with the approved concept sheet as the sole visual reference. Append this constraint to each object-specific prompt:

```text
Single isolated front-facing orthographic production sprite matching the referenced concept exactly. Transparent background, full object visible, centered, symmetrical game-readable silhouette, soft hand-painted edge, no floor shadow, no text, no frame, no additional object, no alternate pose.
```

Prepend exactly one of these subject sentences per call:

- `Small floating repair robot player, large ceramic face plate, short utility arms, patched yellow-orange worn steel body, bright cyan recovery core.`
- `Compact square maintenance enemy robot, simple face, moss-green worn steel shell.`
- `Wide heavy armored scrap-compactor enemy robot, layered purple-gray plates, reinforced silhouette.`
- `Narrow turret enemy robot, orange-brown worn steel, obvious centered barrel and bright hostile warning lamp.`

Generate the arena separately:

```text
Vertical 9:16 hand-painted 2D mobile game arena matching the referenced scrapyard palette. Top-down dark scrapyard floor with inset machine-wall trim, subtle low-contrast debris, clear lower defensive edge, empty central play space, no characters, no enemies, no projectiles, no text, no UI, no physical obstacle, seamless visual flow, 900 by 1440 composition.
```

- [ ] **Step 2: Normalize exports with ImageMagick**

Keep masters untouched. Export with transparent padding and 2× logical dimensions:

```bash
rtk magick assets-source/combat/graphics/player-master.png -background none -trim +repage -resize 64x64 -gravity center -extent 72x72 public/assets/combat/sprites/player.png
rtk magick assets-source/combat/graphics/enemy-basic-master.png -background none -trim +repage -resize 64x48 -gravity center -extent 72x56 public/assets/combat/sprites/enemy-basic.png
rtk magick assets-source/combat/graphics/enemy-armored-master.png -background none -trim +repage -resize 72x56 -gravity center -extent 80x64 public/assets/combat/sprites/enemy-armored.png
rtk magick assets-source/combat/graphics/enemy-shooter-master.png -background none -trim +repage -resize 68x52 -gravity center -extent 76x60 public/assets/combat/sprites/enemy-shooter.png
rtk magick assets-source/combat/graphics/scrapyard-arena-master.png -resize 900x1440^ -gravity center -extent 900x1440 -quality 88 public/assets/combat/backgrounds/scrapyard-arena.webp
```

- [ ] **Step 3: Verify dimensions and alpha**

Run:

```bash
rtk magick identify -format '%f %wx%h %[channels]\n' public/assets/combat/sprites/*.png public/assets/combat/backgrounds/scrapyard-arena.webp
```

Expected: exact dimensions above; every sprite reports an alpha channel; background is `900x1440`.

- [ ] **Step 4: Add file-existence assertions**

Extend the manifest test:

```ts
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

it('ships the arena, player, and common enemy files', () => {
  const taskKeys = new Set([
    'combat-background', 'player',
    'enemy-basic', 'enemy-armored', 'enemy-shooter',
  ]);
  for (const { key, url } of COMBAT_IMAGE_ASSETS.filter(({ key }) => taskKeys.has(key))) {
    expect(existsSync(resolve('public', url.replace(/^\//, ''))), url).toBe(true);
  }
});
```

Task 4 replaces this filtered assertion with full `COMBAT_IMAGE_ASSETS` coverage after every currently declared image exists. Task 5 adds VFX entries and files together. Do not create empty files to satisfy either assertion.

- [ ] **Step 5: Render the production background and preserve player hit geometry**

In `CombatScene.create()` after fallback creation and before gameplay sprites:

```ts
if (this.textures.exists('combat-background')) {
  this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'combat-background')
    .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
    .setDepth(-100);
}

this.player = this.physics.add.sprite(GAME_WIDTH / 2, 690, 'player');
this.player.setDisplaySize(36, 36);
const playerScale = Math.abs(this.player.scaleX);
const playerSourceRadius = PLAYER_RADIUS / playerScale;
this.player.setCircle(
  playerSourceRadius,
  (this.player.width - playerSourceRadius * 2) / 2,
  (this.player.height - playerSourceRadius * 2) / 2,
).setCollideWorldBounds(true);
this.tweens.add({
  targets: this.player,
  angle: { from: -1.5, to: 1.5 },
  duration: 900,
  yoyo: true,
  repeat: -1,
  ease: 'Sine.inOut',
});
```

Arcade bodies remain axis-aligned when the display sprite rotates. Do not tween player position or scale.

EnemyManager already calls `setDisplaySize()` from grid footprints; do not change its body calculation.

- [ ] **Step 6: Cap renderer resolution at 2×**

In `createCombatGame()` add:

```ts
resolution: Math.min(window.devicePixelRatio || 1, 2),
```

Do not change logical width, height, scale mode, or physics.

- [ ] **Step 7: Run non-browser checks and inspect assets**

Run:

```bash
rtk npm test -- src/game/assets/combatAssetManifest.test.ts src/game/enemies/EnemyManager.test.ts
rtk npm test
rtk npm run build
```

Use `view_image` on all five runtime assets. Do not run Playwright yet.

- [ ] **Step 8: Commit**

```bash
rtk git add assets-source/combat/graphics public/assets/combat/backgrounds public/assets/combat/sprites src/game/scenes/CombatScene.ts src/game/meta/AppController.ts src/game/assets/combatAssetManifest.test.ts
rtk git commit -m "art: add scrapyard player and enemies"
```

---

### Task 4: Produce Sentinel, basic cores, and HUD art

**Files:**
- Create: `assets-source/combat/graphics/sentinel-*-master.png`
- Create: `assets-source/combat/graphics/orb-*-master.png`
- Create: `assets-source/combat/graphics/hud-*-master.png`
- Create: `public/assets/combat/sprites/sentinel-*.png`
- Create: `public/assets/combat/sprites/orb-*.png`
- Create: `public/assets/combat/sprites/hud-*.png`
- Modify: `src/game/bosses/BossManager.ts`
- Modify: `src/game/bosses/BossManager.test.ts`
- Modify: `src/game/orbs/OrbManager.ts`
- Modify: `src/game/orbs/OrbManager.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `src/game/scenes/combatSceneRules.ts`
- Modify: `src/game/scenes/combatSceneRules.test.ts`
- Modify: `src/game/assets/combatAssetManifest.test.ts`

**Interfaces:**
- Consumes: approved concept sheet, exact Sentinel tuning dimensions, and basic core IDs.
- Produces: production boss parts at existing visual sizes, six reusable basic-core textures, and runtime level-notch overlay.

- [ ] **Step 1: Generate isolated boss, core, and HUD masters**

Use the approved concept sheet as the visual reference. Generate separate transparent files for Sentinel body, one weakpoint module, Sentinel core, and each basic orb. Mirror the approved weakpoint art at export time for the right side; do not ask image generation to redraw it inconsistently.

Use the same isolated-sprite suffix from Task 3 and one exact subject per call:

- `Large modular Sentinel main body assembled from mismatched heavy scrapyard machinery, front-facing, empty side sockets and empty central core socket clearly visible.`
- `Single Sentinel side weakpoint module, tall narrow armored battery-turret hybrid, designed to attach to the body socket.`
- `Single exposed Sentinel energy core, bright yellow-white ceramic and steel reactor sphere.`
- `Single echo orb core, metal shell with cyan expanding-wave energy motif.`
- `Single corrosion orb core, metal shell with moss-green leaking-canister energy motif.`
- `Single conduction orb core, metal shell with electric-blue fork motif.`
- `Single inertia orb core, metal shell with pale flywheel-arrow motif.`
- `Single split orb core, metal shell with violet branching motif.`
- `Single explosion orb core, metal shell with orange-red unstable radial chamber motif.`

Use this HUD prompt:

```text
Original hand-painted 2D game HUD frame kit matching the referenced cute scrapyard machinery. Two empty transparent frames only: compact player HP and XP status plate, wide boss health plate. Worn yellow-orange and moss-dark steel, ceramic bolts, restrained cyan accent, clean empty interiors for live text and bars, no text, no numbers, no icons, no characters, transparent background.
```

- [ ] **Step 2: Export exact runtime dimensions**

```bash
rtk magick assets-source/combat/graphics/sentinel-body-master.png -background none -trim +repage -resize 320x168 -gravity center -extent 352x192 public/assets/combat/sprites/sentinel-body.png
rtk magick assets-source/combat/graphics/sentinel-weakpoint-master.png -background none -trim +repage -resize 52x116 -gravity center -extent 60x128 public/assets/combat/sprites/sentinel-left-weakpoint.png
rtk magick public/assets/combat/sprites/sentinel-left-weakpoint.png -flop public/assets/combat/sprites/sentinel-right-weakpoint.png
rtk magick assets-source/combat/graphics/sentinel-core-master.png -background none -trim +repage -resize 72x72 -gravity center -extent 84x84 public/assets/combat/sprites/sentinel-core.png
rtk magick assets-source/combat/graphics/orb-echo-master.png -background none -trim +repage -resize 32x32 -gravity center -extent 36x36 public/assets/combat/sprites/orb-echo.png
rtk magick assets-source/combat/graphics/orb-corrosion-master.png -background none -trim +repage -resize 32x32 -gravity center -extent 36x36 public/assets/combat/sprites/orb-corrosion.png
rtk magick assets-source/combat/graphics/orb-conduction-master.png -background none -trim +repage -resize 32x32 -gravity center -extent 36x36 public/assets/combat/sprites/orb-conduction.png
rtk magick assets-source/combat/graphics/orb-inertia-master.png -background none -trim +repage -resize 32x32 -gravity center -extent 36x36 public/assets/combat/sprites/orb-inertia.png
rtk magick assets-source/combat/graphics/orb-split-master.png -background none -trim +repage -resize 32x32 -gravity center -extent 36x36 public/assets/combat/sprites/orb-split.png
rtk magick assets-source/combat/graphics/orb-explosion-master.png -background none -trim +repage -resize 32x32 -gravity center -extent 36x36 public/assets/combat/sprites/orb-explosion.png
rtk magick assets-source/combat/graphics/hud-status-frame-master.png -background none -trim +repage -resize 340x108 -gravity center -extent 360x128 public/assets/combat/sprites/hud-status-frame.png
rtk magick assets-source/combat/graphics/hud-boss-frame-master.png -background none -trim +repage -resize 720x64 -gravity center -extent 760x80 public/assets/combat/sprites/hud-boss-frame.png
```

Display HUD sources at `180 × 64` and `380 × 40`; the 2× runtime files above preserve detail. Confirm every output has alpha with `magick identify`.

- [ ] **Step 3: Write RED tests for loaded-art display geometry and basic-core key reuse**

Update the existing manager fakes and assertions:

```ts
expect(body.displayWidth).toBe(GAME_TUNING.boss.body.width);
expect(left.displayWidth).toBe(GAME_TUNING.boss.weakpoint.visual.width);
expect(left.displayHeight).toBe(GAME_TUNING.boss.weakpoint.visual.height);
expect(core.displayWidth).toBe(GAME_TUNING.boss.core.visualSize);

manager.upgradeOrb(0);
expect(sprites[0]?.textureKey).toBe('orb-inertia');
```

Expected: RED because boss parts use native 2× texture size and the orb manager requests leveled baked textures.

- [ ] **Step 4: Preserve visual and collision dimensions separately**

After creating boss sprites, set production display sizes first and convert desired world hitboxes back into source pixels:

```ts
this.body.setDisplaySize(GAME_TUNING.boss.body.width, GAME_TUNING.boss.body.height);
this.partSprites.leftWeakpoint.setDisplaySize(
  GAME_TUNING.boss.weakpoint.visual.width,
  GAME_TUNING.boss.weakpoint.visual.height,
);
this.partSprites.rightWeakpoint.setDisplaySize(
  GAME_TUNING.boss.weakpoint.visual.width,
  GAME_TUNING.boss.weakpoint.visual.height,
);
this.partSprites.core.setDisplaySize(
  GAME_TUNING.boss.core.visualSize,
  GAME_TUNING.boss.core.visualSize,
);

const setWorldBodySize = (
  sprite: Phaser.Physics.Arcade.Sprite,
  width: number,
  height: number,
): void => {
  const body = sprite.body as Phaser.Physics.Arcade.Body;
  body.setSize(
    width / Math.abs(sprite.scaleX),
    height / Math.abs(sprite.scaleY),
    true,
  );
};

setWorldBodySize(this.body, GAME_TUNING.boss.body.width, GAME_TUNING.boss.body.height);
setWorldBodySize(
  this.partSprites.leftWeakpoint,
  GAME_TUNING.boss.weakpoint.hitbox.width,
  GAME_TUNING.boss.weakpoint.hitbox.height,
);
setWorldBodySize(
  this.partSprites.rightWeakpoint,
  GAME_TUNING.boss.weakpoint.hitbox.width,
  GAME_TUNING.boss.weakpoint.hitbox.height,
);
setWorldBodySize(
  this.partSprites.core,
  GAME_TUNING.boss.core.hitboxSize,
  GAME_TUNING.boss.core.hitboxSize,
);
```

Replace the existing raw `setSize()` calls with `setWorldBodySize()`. Assertions must continue to observe world hitboxes `176 × 96`, `38 × 72`, and the configured core hitbox despite 2× textures.

- [ ] **Step 5: Use one basic-core master texture per type**

In `OrbManager.synchronizeSprites()`:

```ts
const textureKey = isBasicOrbCoreId(state.coreType)
  ? `orb-${state.coreType}`
  : `orb-${state.coreType}-lv${state.level}`;
sprite.setTexture(textureKey).setDisplaySize(
  GAME_TUNING.visual.friendly.permanentOrb.width,
  GAME_TUNING.visual.friendly.permanentOrb.height,
);
const sourceRadius = this.currentOrbRadius() / Math.abs(sprite.scaleX);
sprite.setCircle(
  sourceRadius,
  (sprite.width - sourceRadius * 2) / 2,
  (sprite.height - sourceRadius * 2) / 2,
);
```

Keep fusion textures on existing procedural level variants.

- [ ] **Step 6: Show meaningful Sentinel damage without adding animation state**

In `BossManager.synchronizePartBodies()`, tint a surviving part only after it crosses half HP:

```ts
const partHp = (partId: BossPartId): [current: number, maximum: number] => {
  if (partId === 'leftWeakpoint') {
    return [this.state.leftWeakpointHp, GAME_TUNING.boss.weakpoint.hp];
  }
  if (partId === 'rightWeakpoint') {
    return [this.state.rightWeakpointHp, GAME_TUNING.boss.weakpoint.hp];
  }
  return [this.state.coreHp, GAME_TUNING.boss.core.hp];
};

const [current, maximum] = partHp(partId);
if (current > 0 && current <= maximum / 2) sprite.setTint(0xffc080);
else sprite.clearTint();
```

Add a manager assertion that a weakpoint remains visible and tinted after `7` damage, while its collision size stays unchanged.

- [ ] **Step 7: Draw level notches as one bounded scene graphics layer**

Create one `orbLevelGraphics` in `CombatScene`. On each unpaused update, clear it and draw `min(level, 9)` small accent dots around every visible permanent orb snapshot. Use snapshot positions; do not attach child game objects or alter physics sprites.

```ts
private drawOrbLevels(): void {
  this.orbLevelGraphics.clear().fillStyle(0xffffff, 0.9);
  for (const orb of this.orbManager?.getSnapshot() ?? []) {
    if (orb.state === 'stored' || orb.state === 'queued') continue;
    for (let notch = 0; notch < Math.min(orb.level, 9); notch += 1) {
      const angle = Math.PI + notch * Math.PI / 4;
      this.orbLevelGraphics.fillCircle(
        orb.position.x + Math.cos(angle) * 7,
        orb.position.y + Math.sin(angle) * 7,
        0.8,
      );
    }
  }
}
```

- [ ] **Step 8: Add HUD frames and the approved boss gauge**

Add `hud-status-frame` behind the existing HP/XP block. The current game has no boss gauge, so add one read-only gauge driven by the existing boss snapshot; it must not write boss state.

First add the pure rule and RED test:

```ts
export function bossHudRatio(
  parts: Readonly<Record<string, number>> | null,
  maximumHp: number,
): number {
  if (!parts || maximumHp <= 0) return 0;
  const remaining = Object.values(parts)
    .reduce((sum, hp) => sum + Math.max(0, hp), 0);
  return Math.max(0, Math.min(1, remaining / maximumHp));
}

expect(bossHudRatio({ left: 0, right: 14, core: 36 }, 64)).toBeCloseTo(50 / 64);
expect(bossHudRatio(null, 64)).toBe(0);
```

At boss start, cache the sum of the initial `parts` snapshot as `bossMaximumHp`. Create a centered `hud-boss-frame`, fill rectangle, and label at the top only when combat enters a boss state. Set the label from `snapshot.kind.toUpperCase()` so fallback Hive and Siege fights are not mislabeled. On every unpaused update, set the fill scale from `bossHudRatio(snapshot.parts, bossMaximumHp)`. Hide all three objects outside boss combat and clear `bossMaximumHp` after defeat or shutdown. Display the 2× frame at `380 × 40`; keep it below warning text and above gameplay sprites.

- [ ] **Step 9: Finish manifest file coverage and verify**

Move all now-existing approved keys into `COMBAT_IMAGE_ASSETS`, then run:

```bash
rtk magick identify -format '%f %wx%h %[channels]\n' public/assets/combat/sprites/*.png
rtk npm test -- src/game/assets/combatAssetManifest.test.ts src/game/bosses/BossManager.test.ts src/game/orbs/OrbManager.test.ts src/game/scenes/combatSceneRules.test.ts
rtk npm test
rtk npm run build
```

Use `view_image` for Sentinel parts, the six orbs, and both HUD frames. Do not run Playwright yet.

- [ ] **Step 10: Commit**

```bash
rtk git add assets-source/combat/graphics public/assets/combat/sprites src/game/bosses/BossManager.ts src/game/bosses/BossManager.test.ts src/game/orbs/OrbManager.ts src/game/orbs/OrbManager.test.ts src/game/scenes/CombatScene.ts src/game/scenes/combatSceneRules.ts src/game/scenes/combatSceneRules.test.ts src/game/assets/combatAssetManifest.test.ts
rtk git commit -m "art: add sentinel cores and combat hud"
```

---

### Task 5: Produce and wire bounded combat VFX

**Files:**
- Create: `assets-source/combat/graphics/vfx-master.png`
- Create: `public/assets/combat/vfx/ricochet.png`
- Create: `public/assets/combat/vfx/hit-spark.png`
- Create: `public/assets/combat/vfx/recovery.png`
- Create: `public/assets/combat/vfx/explosion.png`
- Create: `public/assets/combat/vfx/corrosion-cloud.png`
- Create: `public/assets/combat/vfx/split-burst.png`
- Create: `public/assets/combat/vfx/break-debris.png`
- Create: `public/assets/combat/vfx/core-burst.png`
- Modify: `src/game/assets/combatAssetManifest.ts`
- Modify: `src/game/config/gameTuning.ts`
- Modify: `src/game/config/gameTuning.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`

**Interfaces:**
- Produces: `GAME_TUNING.visual.productionVfx`, production VFX manifest keys, and one bounded `playTransientVfx()` path reused by combat handlers.
- Consumes: existing hit, recovery, wall-bounce, enemy-kill, explosion, corrosion, split, weakpoint-break, and core-exposure call sites.

- [ ] **Step 1: Generate one VFX source sheet and crop named effects**

Use the concept sheet as reference and generate:

```text
Original hand-painted 2D game VFX sprite sheet on transparent background, matching a cute scrapyard robot action game. Eight isolated effects in a clean 4 by 2 grid with generous empty gutters: bright cyan metal ricochet flash, compact white-yellow hit spark, cyan suction recovery swirl, orange-red mechanical explosion, moss-green corrosion gas cloud, violet branching split burst, brown-gray robot break debris, large yellow-white energy core burst. No text, no characters, no projectiles, no overlap between cells, centered effects, soft painted particles, mobile-readable silhouettes.
```

Normalize the sheet to `2048 × 1024`, then crop fixed `512 × 512` cells and downsample:

```bash
rtk magick assets-source/combat/graphics/vfx-master.png -resize 2048x1024^ -gravity center -extent 2048x1024 /tmp/project-ricochet-vfx-grid.png
rtk magick /tmp/project-ricochet-vfx-grid.png -crop 512x512+0+0 +repage -resize 128x128 public/assets/combat/vfx/ricochet.png
rtk magick /tmp/project-ricochet-vfx-grid.png -crop 512x512+512+0 +repage -resize 128x128 public/assets/combat/vfx/hit-spark.png
rtk magick /tmp/project-ricochet-vfx-grid.png -crop 512x512+1024+0 +repage -resize 128x128 public/assets/combat/vfx/recovery.png
rtk magick /tmp/project-ricochet-vfx-grid.png -crop 512x512+1536+0 +repage -resize 128x128 public/assets/combat/vfx/explosion.png
rtk magick /tmp/project-ricochet-vfx-grid.png -crop 512x512+0+512 +repage -resize 128x128 public/assets/combat/vfx/corrosion-cloud.png
rtk magick /tmp/project-ricochet-vfx-grid.png -crop 512x512+512+512 +repage -resize 128x128 public/assets/combat/vfx/split-burst.png
rtk magick /tmp/project-ricochet-vfx-grid.png -crop 512x512+1024+512 +repage -resize 128x128 public/assets/combat/vfx/break-debris.png
rtk magick /tmp/project-ricochet-vfx-grid.png -crop 512x512+1536+512 +repage -resize 128x128 public/assets/combat/vfx/core-burst.png
```

Verify every crop visually with `view_image`.

- [ ] **Step 2: Write RED tuning assertions**

Add exact central values:

```ts
expect(GAME_TUNING.visual.productionVfx).toEqual({
  maximumTransientSprites: 64,
  ricochetDurationMs: 120,
  hitDurationMs: 140,
  recoveryDurationMs: 180,
  explosionDurationMs: 220,
  breakDurationMs: 260,
  coreDurationMs: 360,
});
```

- [ ] **Step 3: Add the tuning and validation**

Every duration is a positive integer. `maximumTransientSprites` is a positive integer. Keep scale choices at the call sites only when they are intrinsic to live gameplay radius; fixed effect scales belong beside these durations.

- [ ] **Step 4: Add one bounded transient helper**

Add a `Set<Phaser.GameObjects.Image>` owned by `CombatScene`:

```ts
private playTransientVfx(
  key: string,
  position: Vector,
  duration: number,
  scale = 1,
): void {
  if (
    !this.textures.exists(key)
    || this.transientVfx.size >= GAME_TUNING.visual.productionVfx.maximumTransientSprites
  ) return;
  const image = this.add.image(position.x, position.y, key)
    .setScale(scale)
    .setDepth(6);
  this.transientVfx.add(image);
  this.tweens.add({
    targets: image,
    alpha: 0,
    scale: scale * 1.18,
    duration,
    onComplete: () => {
      this.transientVfx.delete(image);
      image.destroy();
    },
  });
}
```

Destroy and clear this set in `handleShutdown()`.

- [ ] **Step 5: Reuse existing semantic call sites**

Add production VFX without changing damage or proc logic:

- generic `onCoreWallBounce` → `vfx-ricochet`;
- `handlePostDirectHit` → `vfx-hit-spark`;
- `onRecovery` → `vfx-recovery`;
- `handleEnemyKilled` → `vfx-break-debris`;
- existing explosion draw path → `vfx-explosion` plus retained gameplay-sized ring;
- corrosion field spawn → `vfx-corrosion-cloud` below targets;
- split emission → `vfx-split-burst`;
- killed Sentinel weakpoint → `vfx-break-debris`;
- Sentinel core exposure / boss destruction → `vfx-core-burst`.

If the production texture is absent, retain the existing Graphics feedback. Never run both full-strength fallbacks and production sprites simultaneously.

- [ ] **Step 6: Add VFX assets to manifest and verify**

Append these exact entries:

```ts
{ key: 'vfx-ricochet', url: '/assets/combat/vfx/ricochet.png' },
{ key: 'vfx-hit-spark', url: '/assets/combat/vfx/hit-spark.png' },
{ key: 'vfx-recovery', url: '/assets/combat/vfx/recovery.png' },
{ key: 'vfx-explosion', url: '/assets/combat/vfx/explosion.png' },
{ key: 'vfx-corrosion-cloud', url: '/assets/combat/vfx/corrosion-cloud.png' },
{ key: 'vfx-split-burst', url: '/assets/combat/vfx/split-burst.png' },
{ key: 'vfx-break-debris', url: '/assets/combat/vfx/break-debris.png' },
{ key: 'vfx-core-burst', url: '/assets/combat/vfx/core-burst.png' },
```

Run:

```bash
rtk magick identify -format '%f %wx%h %[channels]\n' public/assets/combat/vfx/*.png
rtk npm test -- src/game/config/gameTuning.test.ts src/game/assets/combatAssetManifest.test.ts
rtk npm test
rtk npm run build
```

Expected: all pass; every VFX is `128x128` with alpha. Do not run Playwright yet.

- [ ] **Step 7: Commit**

```bash
rtk git add assets-source/combat/graphics/vfx-master.png public/assets/combat/vfx src/game/assets/combatAssetManifest.ts src/game/config/gameTuning.ts src/game/config/gameTuning.test.ts src/game/scenes/CombatScene.ts
rtk git commit -m "art: add bounded combat effects"
```

---

### Task 6: Generate original sound effects and adaptive music files

**Files:**
- Create: `tools/audio-requirements.txt`
- Create: `scripts/generate_combat_audio.py`
- Create: `scripts/test_generate_combat_audio.py`
- Create: `assets-source/combat/audio/*.wav`
- Create: `public/assets/combat/audio/*.{ogg,mp3}`
- Create: `public/assets/combat/music/*.{ogg,mp3}`
- Modify: `.gitignore`
- Modify: `src/game/assets/combatAssetManifest.ts`
- Modify: `src/game/assets/combatAssetManifest.test.ts`

**Interfaces:**
- Produces: deterministic runtime keys `sfx-*`, `music-combat-base`, and `music-combat-boss`; files used by `CombatAudio` in Task 7.
- Consumes: no runtime code.

- [ ] **Step 1: Add isolated asset-tool dependencies**

`tools/audio-requirements.txt`:

```text
numpy==2.3.5
soundfile==0.13.1
lameenc==1.8.1
```

Add `.venv-assets/` to `.gitignore`.

- [ ] **Step 2: Write RED standard-library tests for synthesis contracts**

Import the generator and assert:

```py
class CombatAudioGenerationTest(unittest.TestCase):
    def test_every_cue_is_finite_normalized_and_nonempty(self):
        for name, samples in generate_all_cues(seed=731).items():
            self.assertGreater(len(samples), 100)
            self.assertTrue(np.isfinite(samples).all(), name)
            self.assertLessEqual(float(np.abs(samples).max()), 0.98, name)

    def test_music_stems_have_identical_shape_and_loop_edges(self):
        base, boss = generate_music_stems(seed=731)
        self.assertEqual(base.shape, boss.shape)
        self.assertEqual(base.shape[1], 2)
        self.assertLess(float(np.abs(base[0] - base[-1]).max()), 0.02)
        self.assertLess(float(np.abs(boss[0] - boss[-1]).max()), 0.02)
```

Expected RED: generator module is absent.

- [ ] **Step 3: Implement deterministic synthesis primitives and cue recipes**

The generator uses `44_100 Hz`, stereo float arrays, a fixed seed, and these primitives:

```py
import numpy as np

SAMPLE_RATE = 44_100

def sine(frequency: float, seconds: float, phase: float = 0.0) -> np.ndarray:
    count = round(seconds * SAMPLE_RATE)
    time = np.arange(count, dtype=np.float64) / SAMPLE_RATE
    return np.sin(2 * np.pi * frequency * time + phase)

def square(frequency: float, seconds: float) -> np.ndarray:
    return np.sign(sine(frequency, seconds))

def noise(seconds: float, rng: np.random.Generator) -> np.ndarray:
    return rng.uniform(-1.0, 1.0, round(seconds * SAMPLE_RATE))

def adsr(
    samples: np.ndarray,
    attack: float,
    decay: float,
    sustain: float,
    release: float,
) -> np.ndarray:
    count = len(samples)
    attack_n = min(count, round(attack * SAMPLE_RATE))
    decay_n = min(count - attack_n, round(decay * SAMPLE_RATE))
    release_n = min(count - attack_n - decay_n, round(release * SAMPLE_RATE))
    sustain_n = count - attack_n - decay_n - release_n
    envelope = np.concatenate([
        np.linspace(0.0, 1.0, attack_n, endpoint=False),
        np.linspace(1.0, sustain, decay_n, endpoint=False),
        np.full(sustain_n, sustain),
        np.linspace(sustain, 0.0, release_n, endpoint=True),
    ])
    return samples * envelope

def lowpass(samples: np.ndarray, cutoff_hz: float) -> np.ndarray:
    alpha = 1.0 - np.exp(-2.0 * np.pi * cutoff_hz / SAMPLE_RATE)
    output = np.empty_like(samples)
    previous = 0.0
    for index, sample in enumerate(samples):
        previous += alpha * (sample - previous)
        output[index] = previous
    return output

def highpass(samples: np.ndarray, cutoff_hz: float) -> np.ndarray:
    return samples - lowpass(samples, cutoff_hz)

def pan(samples: np.ndarray, position: float) -> np.ndarray:
    normalized = np.clip((position + 1.0) / 2.0, 0.0, 1.0)
    left = np.cos(normalized * np.pi / 2.0)
    right = np.sin(normalized * np.pi / 2.0)
    return np.column_stack((samples * left, samples * right))

def normalize(samples: np.ndarray, peak: float = 0.92) -> np.ndarray:
    maximum = float(np.max(np.abs(samples)))
    return samples.copy() if maximum == 0.0 else samples * (peak / maximum)
```

Implement exact cue names and character:

Use the primitives above with this exact recipe table. Frequencies are Hz, all amplitude layers are mixed before final normalization, and noise is deterministic from the task seed:

| Cue | Duration | Tonal layers | Noise/filter layer |
|---|---:|---|---|
| `orb-launch` | 0.16 s | 720→1360 sine sweep, 0.55 gain | high-pass 3.2 kHz tick, 0.18 |
| `orb-recovery` | 0.24 s | 1280→420 reverse sweep, 0.45; 960 Hz click at end | low-pass 2.4 kHz suction, 0.16 |
| `wall-ricochet-1` | 0.10 s | 1760 and 2640 sines, 0.52/0.16 | high-pass 4.0 kHz transient, 0.12 |
| `wall-ricochet-2` | 0.11 s | 1580 and 2370 sines, 0.52/0.16 | high-pass 3.7 kHz transient, 0.12 |
| `direct-hit-light` | 0.14 s | 820 and 1230 sines, 0.28/0.12 | band formed by high-pass 600 Hz then low-pass 3.2 kHz, 0.42 |
| `direct-hit-heavy` | 0.24 s | 110, 220, 660 sines, 0.28/0.18/0.12 | low-pass 1.8 kHz plate noise, 0.48 |
| `enemy-destroyed` | 0.38 s | 540, 390, 280 Hz clicks at 0/70/145 ms | low-pass 2.6 kHz clatter tail, 0.42 |
| `shooter-warning` | 0.34 s | 420 then 560 square notes, 0.28 | high-pass 1.8 kHz static, 0.08 |
| `shooter-fire` | 0.20 s | 180→90 sine drop, 0.32 | low-pass 2.2 kHz compressed noise, 0.52 |
| `player-hit` | 0.34 s | 75, 150, 480 Hz layers, 0.30/0.18/0.10 | low-pass 1.4 kHz crush, 0.48 |
| `level-up` | 0.56 s | 660, 880, 1100 Hz notes at 0/140/280 ms | high-pass 3.5 kHz console tick, 0.08 |
| `boss-warning` | 0.90 s | 55, 82.5, 110 Hz horn, 0.34/0.24/0.12 | low-pass 700 Hz air, 0.18 |
| `weakpoint-break` | 0.62 s | 82, 164, 328 Hz tear, 0.30/0.18/0.08 | low-pass 2.0 kHz debris, 0.55 |
| `core-exposure` | 0.88 s | 220→1320 rising sine plus 440 Hz pulse | high-pass 2.8 kHz energy shimmer, 0.12 |
| `core-enrage` | 1.10 s | 65 Hz pulse accelerating 5→12 Hz; 130 Hz square, 0.20 | low-pass 1.1 kHz rotor, 0.38 |
| `boss-destroyed` | 1.80 s | 55, 82.5, 165 Hz descending layers | low-pass cutoff sweeps 3.0 kHz→500 Hz, 0.62 |

Linear frequency sweeps use cumulative phase so they remain continuous. Every cue receives a `5 ms` attack and at least `30 ms` release unless the table's delayed click requires its own envelope.

- [ ] **Step 4: Compose synchronized music stems**

Use one 16-second loop at 120 BPM:

- base stem: light mechanical percussion, plucked synth motif, soft bass;
- boss stem: synchronized low drums, stressed metal hits, and sub pulse;
- both stems begin and end at zero crossing with a short equal-power seam taper;
- boss stem contains only the additional layer so it can play at volume zero beside the base.

- [ ] **Step 5: Export WAV masters, OGG, and MP3**

`soundfile` writes WAV and Vorbis OGG. `lameenc` writes MP3. The script accepts:

```bash
rtk .venv-assets/bin/python scripts/generate_combat_audio.py --source assets-source/combat/audio --runtime public/assets/combat
```

Create the environment and run:

```bash
rtk python3 -m venv .venv-assets
rtk .venv-assets/bin/pip install -r tools/audio-requirements.txt
rtk .venv-assets/bin/python -m unittest scripts/test_generate_combat_audio.py
rtk .venv-assets/bin/python scripts/generate_combat_audio.py --source assets-source/combat/audio --runtime public/assets/combat
```

- [ ] **Step 6: Add exact audio manifest entries**

Build the manifest from the exact generated stems:

```ts
const SFX_STEMS = [
  'orb-launch', 'orb-recovery',
  'wall-ricochet-1', 'wall-ricochet-2',
  'direct-hit-light', 'direct-hit-heavy', 'enemy-destroyed',
  'shooter-warning', 'shooter-fire', 'player-hit', 'level-up',
  'boss-warning', 'weakpoint-break', 'core-exposure',
  'core-enrage', 'boss-destroyed',
] as const;

const sfxAsset = (stem: typeof SFX_STEMS[number]): CombatAudioAsset => ({
  key: `sfx-${stem}`,
  urls: [
    `/assets/combat/audio/${stem}.ogg`,
    `/assets/combat/audio/${stem}.mp3`,
  ],
});

export const COMBAT_AUDIO_ASSETS = [
  ...SFX_STEMS.map(sfxAsset),
  {
    key: 'music-combat-base',
    urls: [
      '/assets/combat/music/combat-base.ogg',
      '/assets/combat/music/combat-base.mp3',
    ],
  },
  {
    key: 'music-combat-boss',
    urls: [
      '/assets/combat/music/combat-boss.ogg',
      '/assets/combat/music/combat-boss.mp3',
    ],
  },
] as const satisfies readonly CombatAudioAsset[];
```

Extend the manifest test to assert both files exist and are non-empty.

- [ ] **Step 7: Verify duration, peaks, determinism, and size**

Run generator twice and compare hashes, then verify the total public combat tree:

```bash
rtk .venv-assets/bin/python -m unittest scripts/test_generate_combat_audio.py
rtk du -sh public/assets/combat
rtk npm test -- src/game/assets/combatAssetManifest.test.ts
rtk npm run build
```

Expected: deterministic hashes; no peak above `0.98`; matched music duration; full `public/assets/combat` compressed-source total no greater than 12 MB.

- [ ] **Step 8: Commit**

```bash
rtk git add .gitignore tools/audio-requirements.txt scripts/generate_combat_audio.py scripts/test_generate_combat_audio.py assets-source/combat/audio public/assets/combat/audio public/assets/combat/music src/game/assets/combatAssetManifest.ts src/game/assets/combatAssetManifest.test.ts
rtk git commit -m "audio: generate scrapyard combat sound bank"
```

---

### Task 7: Add `CombatAudio`, semantic cues, adaptive music, and mute

**Files:**
- Create: `src/game/audio/CombatAudio.ts`
- Create: `src/game/audio/CombatAudio.test.ts`
- Modify: `src/game/orbs/OrbManager.ts`
- Modify: `src/game/orbs/OrbManager.test.ts`
- Modify: `src/game/enemies/EnemyManager.ts`
- Modify: `src/game/enemies/EnemyManager.test.ts`
- Modify: `src/game/bosses/bossEncounter.ts`
- Modify: `src/game/bosses/BossManager.ts`
- Modify: `src/game/bosses/BossManager.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `src/game/config/gameTuning.ts`
- Modify: `src/game/config/gameTuning.test.ts`

**Interfaces:**
- Produces: `CombatCue`, `CombatAudioSnapshot`, and class methods `unlock(): void`, `play(cue: CombatCue, nowMs: number): void`, `setBossActive(active: boolean): void`, `setSuspended(suspended: boolean): void`, `toggleMuted(): boolean`, `getSnapshot(): CombatAudioSnapshot`, and `destroy(): void`.
- Consumes: audio keys generated in Task 6 and semantic callbacks from existing gameplay owners.

- [ ] **Step 1: Write RED `CombatAudio` tests with fake sounds and storage**

Cover these contracts:

```ts
expect(audio.getSnapshot()).toEqual({
  muted: false,
  unlocked: false,
  bossLayerActive: false,
  activeVoices: 0,
});

audio.unlock();
audio.play('wallRicochet', 100);
audio.play('wallRicochet', 100);
expect(fakePlayCount()).toBe(1); // same-timestamp cooldown

audio.setBossActive(true);
expect(audio.getSnapshot().bossLayerActive).toBe(true);

expect(audio.toggleMuted()).toBe(true);
expect(storage.getItem('project-ricochet.audio-muted')).toBe('1');
```

Also assert random pitch/gain remain inside each cue's table bounds and total active voices never exceed the configured cap.

Add two failure-path assertions: storage `getItem` / `setItem` throwing must not escape, and a fake cache that reports every audio key missing must leave music stopped while `unlock()` and `play()` remain no-ops.

- [ ] **Step 2: Add central audio tuning**

Add:

```ts
audio: {
  maximumVoices: 16,
  bossLayerFadeMs: 650,
  musicVolume: 0.42,
  bossLayerVolume: 0.55,
  duckVolume: 0.22,
  duckDurationMs: 240,
},
```

Validate all volumes in `[0, 1]`, durations as positive integers, and voice count as a positive integer.

- [ ] **Step 3: Implement the cue table and class**

Use this closed cue union:

```ts
export type CombatCue =
  | 'orbLaunch' | 'orbRecovery' | 'wallRicochet'
  | 'directHitLight' | 'directHitHeavy' | 'enemyDestroyed'
  | 'shooterWarning' | 'shooterFire' | 'playerHit' | 'levelUp'
  | 'bossWarning' | 'bossBasicWarning' | 'bossBasicFire'
  | 'weakpointBreak' | 'coreExposure' | 'coreEnrage' | 'bossDestroyed';
```

Use this exact table shape and values:

```ts
const CUE_TABLE: Record<CombatCue, {
  keys: readonly string[];
  volume: number;
  detune: readonly [minimum: number, maximum: number];
  cooldownMs: number;
}> = {
  orbLaunch: { keys: ['sfx-orb-launch'], volume: 0.34, detune: [-45, 45], cooldownMs: 45 },
  orbRecovery: { keys: ['sfx-orb-recovery'], volume: 0.38, detune: [-30, 30], cooldownMs: 60 },
  wallRicochet: { keys: ['sfx-wall-ricochet-1', 'sfx-wall-ricochet-2'], volume: 0.28, detune: [-90, 90], cooldownMs: 24 },
  directHitLight: { keys: ['sfx-direct-hit-light'], volume: 0.32, detune: [-55, 55], cooldownMs: 32 },
  directHitHeavy: { keys: ['sfx-direct-hit-heavy'], volume: 0.48, detune: [-35, 35], cooldownMs: 45 },
  enemyDestroyed: { keys: ['sfx-enemy-destroyed'], volume: 0.44, detune: [-70, 70], cooldownMs: 55 },
  shooterWarning: { keys: ['sfx-shooter-warning'], volume: 0.42, detune: [0, 0], cooldownMs: 90 },
  shooterFire: { keys: ['sfx-shooter-fire'], volume: 0.45, detune: [-25, 25], cooldownMs: 50 },
  playerHit: { keys: ['sfx-player-hit'], volume: 0.62, detune: [0, 0], cooldownMs: 580 },
  levelUp: { keys: ['sfx-level-up'], volume: 0.48, detune: [0, 0], cooldownMs: 250 },
  bossWarning: { keys: ['sfx-boss-warning'], volume: 0.65, detune: [0, 0], cooldownMs: 1_000 },
  bossBasicWarning: { keys: ['sfx-shooter-warning'], volume: 0.50, detune: [-120, -120], cooldownMs: 120 },
  bossBasicFire: { keys: ['sfx-shooter-fire'], volume: 0.58, detune: [-160, -120], cooldownMs: 75 },
  weakpointBreak: { keys: ['sfx-weakpoint-break'], volume: 0.72, detune: [-20, 20], cooldownMs: 180 },
  coreExposure: { keys: ['sfx-core-exposure'], volume: 0.72, detune: [0, 0], cooldownMs: 500 },
  coreEnrage: { keys: ['sfx-core-enrage'], volume: 0.76, detune: [0, 0], cooldownMs: 800 },
  bossDestroyed: { keys: ['sfx-boss-destroyed'], volume: 0.82, detune: [0, 0], cooldownMs: 1_500 },
};
```

The constructor accepts injected `Storage` and random function for tests; production defaults to `localStorage` and `Math.random`. Wrap storage reads/writes in `try/catch`. Before calling `scene.sound.add()` or `scene.sound.play()`, require `scene.cache.audio.exists(key)`; absent keys produce silence.

The class owns two loop sounds created from `music-combat-base` and `music-combat-boss`. `setBossActive()` tweens only the boss-layer volume. `play()` temporarily ducks both stems for `playerHit`, `weakpointBreak`, `coreExposure`, `coreEnrage`, and `bossDestroyed`, then restores the current base/boss target volumes after `duckDurationMs`. `setSuspended()` pauses/resumes owned music and rejects new cues while suspended. `destroy()` stops music, destroys owned sounds, and clears tracked voices.

- [ ] **Step 4: Add only the missing semantic callbacks**

Extend `OrbCallbacks`:

```ts
onLaunch?: (orbId: number) => void;
```

Call it at the end of `OrbStore.launch()`.

Extend `EnemyManagerOptions`:

```ts
onShooterWarning?: () => void;
onShooterFire?: () => void;
```

Call warning once per started shooter and fire once per created bullet.

Add to `BossManagerOptions`:

```ts
onAttackCue?: (cue: 'basicWarning' | 'basicFire') => void;
```

Call it when the basic warning marker is created and when its bullet is created. Do not generalize Hive or Siege attack audio in this slice.

- [ ] **Step 5: Wire existing scene events to cue calls**

Create `CombatAudio` after assets load. Wire:

- orb launch / recovery / generic wall bounce;
- direct hit light or heavy using the existing charged flag;
- enemy killed;
- shooter warning and fire;
- successful level-up reward selection;
- player damage;
- boss approach warning;
- Sentinel basic warning and fire;
- killed weakpoint;
- core exposure after the second weakpoint dies;
- boss defeat;
- `setBossActive(true)` at Sentinel start and false at defeat;
- `setSuspended(document.hidden)` in `handleVisibilityChange()`.

Use `BossDirectHitEvent.killed` and the post-hit Sentinel snapshot to distinguish a weakpoint break from core exposure. Do not add HP polling.

- [ ] **Step 6: Add the unlock and master-mute control**

Create music only after the first Phaser pointer or keyboard gesture. Add one top-right Phaser text control with `SOUND ON` / `SOUND OFF`, pointer interaction, and `M` keyboard shortcut. It toggles `CombatAudio` and never changes retained aim.

```ts
this.soundControl = this.add.text(GAME_WIDTH - 16, 16, '', {
  color: '#e7e1c7',
  fontSize: '12px',
  fontStyle: 'bold',
}).setOrigin(1, 0).setDepth(40).setInteractive({ useHandCursor: true });
this.soundControl.on('pointerdown', (
  _pointer: Phaser.Input.Pointer,
  _localX: number,
  _localY: number,
  event: Phaser.Types.Input.EventData,
) => event.stopPropagation());
this.soundControl.on('pointerup', () => {
  this.combatAudio?.toggleMuted();
  this.updateSoundControl();
});
this.input.keyboard?.on('keydown-M', this.handleMuteKey);
```

Register the sound control before `PlayerInput` so its stopped pointer event cannot claim the aim role. Remove both listeners during shutdown.

Expose audio state only in the existing development snapshot:

```ts
audio: this.combatAudio?.getSnapshot() ?? null,
```

Destroy the control listeners and `CombatAudio` in `handleShutdown()`.

- [ ] **Step 7: Run all non-browser checks**

Run:

```bash
rtk npm test -- src/game/audio/CombatAudio.test.ts src/game/orbs/OrbManager.test.ts src/game/enemies/EnemyManager.test.ts src/game/bosses/BossManager.test.ts src/game/config/gameTuning.test.ts
rtk npm test
rtk npm run build
```

Expected: all pass. Do not run Playwright yet.

- [ ] **Step 8: Commit**

```bash
rtk git add src/game/audio src/game/orbs/OrbManager.ts src/game/orbs/OrbManager.test.ts src/game/enemies/EnemyManager.ts src/game/enemies/EnemyManager.test.ts src/game/bosses/bossEncounter.ts src/game/bosses/BossManager.ts src/game/bosses/BossManager.test.ts src/game/scenes/CombatScene.ts src/game/config/gameTuning.ts src/game/config/gameTuning.test.ts
rtk git commit -m "feat: add adaptive combat audio"
```

---

### Task 8: Integrated desktop/mobile QA, listening handoff, and documentation

**Files:**
- Modify: `e2e/combat.spec.ts`
- Modify: `docs/TUNING.md`
- Modify: `docs/WORKLOG.md`

**Interfaces:**
- Consumes: the complete asset, VFX, and audio slice.
- Produces: final browser evidence, tuning ownership documentation, and user-visible audio samples.

- [ ] **Step 1: Write integrated E2E contracts**

Extend `DevelopmentScene` with the Phaser texture lookup needed below and extend `CombatSnapshot` with `audio: CombatAudioSnapshot | null`. Add two scenarios only:

```ts
test('@desktop loads production combat assets, mutes, and transitions boss music', async ({ page }, testInfo) => {
  const failedAssets: string[] = [];
  page.on('response', (response) => {
    if (response.url().includes('/assets/combat/') && !response.ok()) {
      failedAssets.push(`${response.status()} ${response.url()}`);
    }
  });
  await loadCanvas(page);
  expect(failedAssets).toEqual([]);
  await expect.poll(async () => (await snapshot(page)).audio).toMatchObject({
    unlocked: true,
    muted: false,
    bossLayerActive: false,
  });
  const dimensions = await sceneCall(page, (scene) => (
    ['player', 'enemy-basic', 'enemy-armored', 'enemy-shooter']
      .map((key) => ({ key, width: scene.textures.get(key).getSourceImage().width }))
  ));
  expect(dimensions).toEqual([
    { key: 'player', width: 72 },
    { key: 'enemy-basic', width: 72 },
    { key: 'enemy-armored', width: 80 },
    { key: 'enemy-shooter', width: 76 },
  ]);
  const openingPath = testInfo.outputPath('art-opening-desktop.png');
  await page.screenshot({ path: openingPath });
  await testInfo.attach('art-opening-desktop', { path: openingPath });

  await sceneCall(page, (scene) => {
    for (const enemy of scene.getDebugSnapshot().enemies) {
      scene.debugSetEnemy(enemy.id, { x: enemy.position.x, y: 25 }, enemy.hp);
    }
    scene.debugAdvanceEncounter(52_000);
  });
  const densePath = testInfo.outputPath('art-dense-desktop.png');
  await page.screenshot({ path: densePath });
  await testInfo.attach('art-dense-desktop', { path: densePath });

  await page.keyboard.press('KeyM');
  await expect.poll(async () => (await snapshot(page)).audio?.muted).toBe(true);
  await enterMidbossByScore(page);
  await expect.poll(async () => (await snapshot(page)).audio?.bossLayerActive).toBe(true);
  await sceneCall(page, (scene) => scene.debugDamageBossPart('leftWeakpoint', 14));
  const sentinelPath = testInfo.outputPath('art-sentinel-desktop.png');
  await page.screenshot({ path: sentinelPath });
  await testInfo.attach('art-sentinel-desktop', { path: sentinelPath });

  await page.reload();
  await expect(page.locator('#game-root canvas')).toBeVisible();
  await confirmCoreLoadout(page);
  await expect.poll(async () => (await snapshot(page)).audio?.muted).toBe(true);
  expect(failedAssets).toEqual([]);
});

test('@mobile preserves two-touch control with production art and mute', async ({ page }, testInfo) => {
  const { box } = await loadCanvas(page);
  const mute = clientPoint(box, { x: 410, y: 20 });
  await page.touchscreen.tap(mute.x, mute.y);
  await expect.poll(async () => (await snapshot(page)).audio?.muted).toBe(true);
  const before = await snapshot(page);
  const moveStart = { x: box.x + box.width * 0.22, y: box.y + box.height * 0.78 };
  const moveEnd = { x: box.x + box.width * 0.34, y: box.y + box.height * 0.66 };
  const aimStart = { x: box.x + box.width * 0.78, y: box.y + box.height * 0.78 };
  const aimEnd = { x: box.x + box.width * 0.66, y: box.y + box.height * 0.66 };
  await dispatchTouchPointers(page, [
    { type: 'pointerdown', pointerId: 41, point: moveStart },
    { type: 'pointerdown', pointerId: 77, point: aimStart },
    { type: 'pointermove', pointerId: 41, point: moveEnd },
    { type: 'pointermove', pointerId: 77, point: aimEnd },
  ]);
  await page.waitForTimeout(250);
  await dispatchTouchPointers(page, [
    { type: 'pointerup', pointerId: 41, point: moveEnd },
    { type: 'pointerup', pointerId: 77, point: aimEnd },
  ]);
  await page.waitForTimeout(260);
  const active = await snapshot(page);
  expect(active.player.x).toBeGreaterThan(before.player.x);
  expect(active.player.y).toBeLessThan(before.player.y);
  expect(active.aim.x).toBeLessThan(0);
  expect(active.aim.y).toBeLessThan(0);
  await sceneCall(page, (scene) => {
    for (const enemy of scene.getDebugSnapshot().enemies) {
      scene.debugSetEnemy(enemy.id, { x: enemy.position.x, y: 25 }, enemy.hp);
    }
    scene.debugAdvanceEncounter(52_000);
  });
  const mobilePath = testInfo.outputPath('art-dense-mobile.png');
  await page.screenshot({ path: mobilePath });
  await testInfo.attach('art-dense-mobile', { path: mobilePath });
});
```

Use the existing `loadCanvas`, `snapshot`, `sceneCall`, `clientPoint`, `dispatchTouchPointers`, `confirmCoreLoadout`, and `enterMidbossByScore` helpers in the same file. Do not move or duplicate bootstrap logic.

- [ ] **Step 2: Run the new E2E file first**

Run:

```bash
rtk npx playwright test e2e/combat.spec.ts --grep 'production combat assets|production art and mute'
```

Fix only integrated asset/audio defects. Avoid unrelated balance changes.

- [ ] **Step 3: Inspect mandatory screenshots**

Use `view_image` at original detail for:

- desktop opening combat;
- desktop dense shooter formation;
- desktop Sentinel with one weakpoint broken;
- mobile dense combat.

Reject the slice if a sprite is clipped, a projectile is ambiguous, VFX hides enemy silhouettes, HUD covers the playfield, or visual art and physics are visibly misaligned.

- [ ] **Step 4: Run one final full verification gate**

Run exactly once after screenshot fixes:

```bash
rtk npm test
rtk npm run build
rtk npm run test:e2e
rtk git diff --check
```

Record exact test counts and the existing Vite bundle warning separately from failures.

- [ ] **Step 5: Document tuning ownership**

Update `docs/TUNING.md`:

- image/audio file paths → `combatAssetManifest.ts`;
- transient count and durations → `GAME_TUNING.visual.productionVfx`;
- music/voice values → `GAME_TUNING.audio`;
- per-cue variation and cooldown → `CombatAudio` cue table;
- gameplay collision and damage remain outside asset tuning.

Append a dated worklog entry with assets produced, deliberate deferrals, verification counts, and the requirement for a listening playtest.

- [ ] **Step 6: Present playable audio samples**

Provide local links for base music, boss layer, ricochet, enemy destruction, weakpoint break, and boss destruction. Ask the user to listen before expanding the same sound language to Hive, Siege, and fusion effects.

- [ ] **Step 7: Commit**

```bash
rtk git add e2e/combat.spec.ts docs/TUNING.md docs/WORKLOG.md
rtk git commit -m "test: verify art audio vertical slice"
```
