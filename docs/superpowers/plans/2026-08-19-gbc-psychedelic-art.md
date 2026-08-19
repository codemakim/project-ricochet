# GBC Psychedelic Art Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the rejected combat illustrations with directly authored GBC-style PNG assets for the opening arena, common units, Sentinel, basic orbs, projectiles, and combat HUD without changing gameplay geometry or balance.

**Architecture:** Use one deterministic ImageMagick renderer as the editable art source: exact low-resolution shapes and a centralized palette produce committed low-resolution masters and 4× nearest-neighbor runtime files. Keep stable Phaser texture keys and procedural per-key fallbacks; only the Sentinel and basic-orb paths require display/body conversion because their production sources are 2× larger than logical display size. Verify the opening slice in the real browser before expanding the same language to boss, tokens, and HUD.

**Tech Stack:** Bash, ImageMagick 7, Phaser 3, TypeScript, Vitest, Playwright, Vite

---

## Execution Rules

- Task 1 of `2026-08-19-pixel-art-pivot.md` is already complete and remains valid.
- This plan replaces Tasks 2–4 of that document.
- The currently modified high-detail masters and runtime images are rejected working files. Task 1 overwrites them; never stage them before the renderer has run.
- Push each verified task commit because the user's connection may interrupt work.
- Do not touch `GAME_TUNING`, encounter data, collision constants, enemy footprints, damage, speed, or spawn logic.
- Do not create production VFX textures in this plan. Existing smooth Phaser Graphics remain the approved contrast layer.

---

### Task 1: Author the opening arena and common units directly in pixels

**Files:**
- Create: `scripts/render_gbc_combat_art.sh`
- Create: `scripts/verify_gbc_combat_art.sh`
- Replace: `assets-source/combat/graphics/player-master.png`
- Replace: `assets-source/combat/graphics/enemy-basic-master.png`
- Replace: `assets-source/combat/graphics/enemy-armored-master.png`
- Replace: `assets-source/combat/graphics/enemy-shooter-master.png`
- Replace: `assets-source/combat/graphics/scrapyard-arena-master.png`
- Replace: `public/assets/combat/sprites/player.png`
- Replace: `public/assets/combat/sprites/enemy-basic.png`
- Replace: `public/assets/combat/sprites/enemy-armored.png`
- Replace: `public/assets/combat/sprites/enemy-shooter.png`
- Replace: `public/assets/combat/backgrounds/scrapyard-arena.webp`

- [ ] **Step 1: Create the direct-pixel renderer with the centralized palette**

Create this executable script. These are authored pixel shapes, not an AI image reduction path:

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE="$ROOT/assets-source/combat/graphics"
SPRITES="$ROOT/public/assets/combat/sprites"
BACKGROUNDS="$ROOT/public/assets/combat/backgrounds"
mkdir -p "$SOURCE" "$SPRITES" "$BACKGROUNDS"

INK='#101018'
FLOOR='#111923'
FLOOR_ALT='#151f2a'
EDGE='#090d13'
STEEL='#263342'
STEEL_LIGHT='#35485a'
CYAN='#40dcf2'
MAGENTA='#d64fa8'
ACID='#9fcf45'
AMBER='#c8891c'
CERAMIC='#eee3c8'
GREEN='#4f7d2d'
CORAL='#f05b43'
VIOLET='#49397d'
BLUE_STEEL='#7580a8'
ORANGE='#c53a17'
YELLOW='#ffae2b'

export_sprite() {
  magick "$1" -filter point -resize 400% "$2"
}

magick -size 18x18 xc:none +antialias \
  -fill "$INK" -draw 'polygon 5,2 12,2 12,3 14,3 14,4 15,4 15,13 13,13 13,15 4,15 4,13 2,13 2,4 4,4 4,3 5,3' \
  -fill "$AMBER" -draw 'rectangle 5,3 12,14 rectangle 3,5 14,12' \
  -fill "$CERAMIC" -draw 'rectangle 5,5 12,9' \
  -fill "$CYAN" -draw 'point 7,7 point 10,7 rectangle 8,12 9,13' \
  "$SOURCE/player-master.png"
export_sprite "$SOURCE/player-master.png" "$SPRITES/player.png"

magick -size 18x14 xc:none +antialias \
  -fill "$INK" -draw 'rectangle 3,3 14,12 rectangle 2,5 15,11' \
  -fill "$GREEN" -draw 'rectangle 4,4 13,11 rectangle 3,6 14,10' \
  -fill "$INK" -draw 'rectangle 5,6 12,9' \
  -fill "$CORAL" -draw 'point 7,8 point 10,8' \
  "$SOURCE/enemy-basic-master.png"
export_sprite "$SOURCE/enemy-basic-master.png" "$SPRITES/enemy-basic.png"

magick -size 20x16 xc:none +antialias \
  -fill "$INK" -draw 'rectangle 3,3 16,14 rectangle 1,5 18,13' \
  -fill "$VIOLET" -draw 'rectangle 4,4 15,13 rectangle 2,6 17,12' \
  -fill "$BLUE_STEEL" -draw 'rectangle 5,5 14,9' \
  -fill "$INK" -draw 'rectangle 7,8 12,12' \
  "$SOURCE/enemy-armored-master.png"
export_sprite "$SOURCE/enemy-armored-master.png" "$SPRITES/enemy-armored.png"

magick -size 19x15 xc:none +antialias \
  -fill "$INK" -draw 'rectangle 7,0 11,14 rectangle 5,2 13,12' \
  -fill "$ORANGE" -draw 'rectangle 8,1 10,13 rectangle 6,3 12,11' \
  -fill "$YELLOW" -draw 'rectangle 8,2 10,3' \
  -fill "$INK" -draw 'rectangle 7,6 11,11' \
  "$SOURCE/enemy-shooter-master.png"
export_sprite "$SOURCE/enemy-shooter-master.png" "$SPRITES/enemy-shooter.png"

magick -size 225x360 "xc:$FLOOR" +antialias \
  -fill "$FLOOR_ALT" -draw 'rectangle 22,24 109,118 rectangle 112,24 202,118 rectangle 22,121 202,235 rectangle 22,238 109,335 rectangle 112,238 202,335' \
  -fill "$STEEL" -draw 'rectangle 22,119 202,120 rectangle 110,24 111,335 rectangle 22,236 202,237' \
  -fill "$EDGE" -draw 'rectangle 0,0 17,359 rectangle 207,0 224,359 rectangle 0,0 224,18 rectangle 0,341 224,359' \
  -fill "$STEEL" -draw 'rectangle 3,28 15,78 rectangle 3,102 15,154 rectangle 3,202 15,258 rectangle 3,282 15,332 rectangle 209,28 221,78 rectangle 209,102 221,154 rectangle 209,202 221,258 rectangle 209,282 221,332 rectangle 27,3 78,15 rectangle 100,3 153,15 rectangle 176,3 202,15 rectangle 27,344 78,356 rectangle 100,344 153,356 rectangle 176,344 202,356' \
  -fill "$STEEL_LIGHT" -draw 'rectangle 6,34 12,70 rectangle 212,34 218,70 rectangle 6,208 12,250 rectangle 212,208 218,250 rectangle 34,6 70,12 rectangle 182,6 198,12' \
  -fill "$CYAN" -draw 'rectangle 10,42 12,55 rectangle 212,116 214,131 rectangle 42,348 60,350 rectangle 184,348 197,350' \
  -fill "$MAGENTA" -draw 'rectangle 10,221 12,230 rectangle 212,296 214,307' \
  -fill "$ACID" -draw 'rectangle 10,306 12,319 rectangle 212,48 214,57' \
  -fill "$YELLOW" -draw 'rectangle 109,8 115,12 rectangle 109,347 115,351' \
  "$SOURCE/scrapyard-arena-master.png"
magick "$SOURCE/scrapyard-arena-master.png" -filter point -resize 400% -define webp:lossless=true "$BACKGROUNDS/scrapyard-arena.webp"
```

- [ ] **Step 2: Create the reusable asset verifier**

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP_SMALL="$(mktemp -t ricochet-small.XXXXXX.png)"
TMP_ROUND="$(mktemp -t ricochet-round.XXXXXX.png)"
trap 'rm -f "$TMP_SMALL" "$TMP_ROUND"' EXIT

check() {
  local file="$ROOT/$1" expected="$2" maximum_colors="$3" alpha="$4"
  local dimensions colors channels
  read -r dimensions colors channels < <(magick identify -format '%wx%h %k %[channels]' "$file")
  [[ "$dimensions" == "$expected" ]] || { echo "$file: expected $expected, got $dimensions"; exit 1; }
  (( colors <= maximum_colors )) || { echo "$file: $colors colors exceeds $maximum_colors"; exit 1; }
  if [[ "$alpha" == yes ]]; then
    [[ "$channels" == *a* ]] || { echo "$file: alpha channel missing"; exit 1; }
    [[ "$(magick "$file" -format '%[pixel:p{0,0}]' info:)" == *',0)' ]] || { echo "$file: opaque corner"; exit 1; }
  fi
}

check_blocks() {
  local file="$ROOT/$1"
  magick "$file" -filter point -resize 25% "$TMP_SMALL"
  magick "$TMP_SMALL" -filter point -resize 400% "$TMP_ROUND"
  [[ "$(compare -metric AE "$file" "$TMP_ROUND" null: 2>&1)" == '0 (0)' ]]
}

check public/assets/combat/sprites/player.png 72x72 5 yes
check public/assets/combat/sprites/enemy-basic.png 72x56 5 yes
check public/assets/combat/sprites/enemy-armored.png 80x64 5 yes
check public/assets/combat/sprites/enemy-shooter.png 76x60 5 yes
check public/assets/combat/backgrounds/scrapyard-arena.webp 900x1440 12 no
check_blocks public/assets/combat/sprites/player.png
check_blocks public/assets/combat/sprites/enemy-basic.png
check_blocks public/assets/combat/sprites/enemy-armored.png
check_blocks public/assets/combat/sprites/enemy-shooter.png
echo 'GBC combat art verified'
```

- [ ] **Step 3: Render, verify, and inspect at actual size**

```bash
rtk chmod +x scripts/render_gbc_combat_art.sh scripts/verify_gbc_combat_art.sh
rtk scripts/render_gbc_combat_art.sh
rtk scripts/verify_gbc_combat_art.sh
rtk magick public/assets/combat/sprites/player.png -filter point -resize 36x36 /tmp/player-display.png
rtk magick public/assets/combat/sprites/enemy-basic.png -filter point -resize 36x28 /tmp/basic-display.png
rtk magick public/assets/combat/sprites/enemy-armored.png -filter point -resize 40x32 /tmp/armored-display.png
rtk magick public/assets/combat/sprites/enemy-shooter.png -filter point -resize 38x30 /tmp/shooter-display.png
rtk magick montage /tmp/player-display.png /tmp/basic-display.png /tmp/armored-display.png /tmp/shooter-display.png -tile 4x1 -geometry +16+16 -background '#101018' /tmp/gbc-opening-strip.png
```

Use `view_image` on `/tmp/gbc-opening-strip.png` and the runtime arena. Reject any unit that needs internal shading to identify its role.

- [ ] **Step 4: Run non-browser regression checks**

```bash
rtk npm test -- src/game/assets/combatAssetManifest.test.ts src/game/enemies/EnemyManager.test.ts
rtk npm test
rtk npm run build
rtk git diff --check
```

Expected: asset verifier passes; 57 test files pass; build passes with only the existing bundle-size warning.

- [ ] **Step 5: Commit and push**

```bash
rtk git add scripts/render_gbc_combat_art.sh scripts/verify_gbc_combat_art.sh assets-source/combat/graphics/player-master.png assets-source/combat/graphics/enemy-basic-master.png assets-source/combat/graphics/enemy-armored-master.png assets-source/combat/graphics/enemy-shooter-master.png assets-source/combat/graphics/scrapyard-arena-master.png public/assets/combat/sprites/player.png public/assets/combat/sprites/enemy-basic.png public/assets/combat/sprites/enemy-armored.png public/assets/combat/sprites/enemy-shooter.png public/assets/combat/backgrounds/scrapyard-arena.webp
rtk git commit -m "art: replace opening combat with gbc pixels"
rtk git push
```

---

### Task 2: Verify the opening slice in the real desktop and mobile canvas

**Files:**
- Modify: `e2e/combat.spec.ts`

- [ ] **Step 1: Add observable source-dimension browser assertions**

Add these two scenarios using existing `loadCanvas`, `sceneCall`, `snapshot`, and touch helpers:

```ts
test('@desktop renders the GBC opening slice', async ({ page }, testInfo) => {
  const failedAssets: string[] = [];
  page.on('response', (response) => {
    if (response.url().includes('/assets/combat/') && !response.ok()) {
      failedAssets.push(`${response.status()} ${response.url()}`);
    }
  });
  await loadCanvas(page);
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
  expect(failedAssets).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('gbc-opening-desktop.png') });
});

test('@mobile renders the GBC opening slice', async ({ page }, testInfo) => {
  await loadCanvas(page);
  await expect(page.locator('#game-root canvas')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('gbc-opening-mobile.png') });
});
```

- [ ] **Step 2: Run the focused browser tests**

```bash
rtk npx playwright test e2e/combat.spec.ts --grep 'GBC opening slice'
```

Expected: desktop and mobile scenarios pass.

- [ ] **Step 3: Inspect both screenshots**

Use `view_image` at original size. Accept only if:

- two cyan player eyes remain visible;
- basic visor, armored shield, and shooter muzzle read without zoom;
- units do not resemble insects or crabs;
- the arena center stays quiet;
- edge neon does not resemble a projectile;
- aim guide and hostile bullets remain clearer than the background.

Revise only pixel shapes or palette in `render_gbc_combat_art.sh`, rerender, and rerun the focused tests. Do not change gameplay values.

- [ ] **Step 4: Commit and push the checkpoint**

```bash
rtk git add e2e/combat.spec.ts scripts/render_gbc_combat_art.sh assets-source/combat/graphics public/assets/combat/backgrounds public/assets/combat/sprites
rtk git commit -m "test: verify gbc opening combat"
rtk git push
```

---

### Task 3: Add the modular pixel Sentinel without changing its hit geometry

**Files:**
- Modify: `scripts/render_gbc_combat_art.sh`
- Modify: `scripts/verify_gbc_combat_art.sh`
- Create: `assets-source/combat/graphics/sentinel-body-master.png`
- Create: `assets-source/combat/graphics/sentinel-weakpoint-master.png`
- Create: `assets-source/combat/graphics/sentinel-core-master.png`
- Create: `public/assets/combat/sprites/sentinel-body.png`
- Create: `public/assets/combat/sprites/sentinel-left-weakpoint.png`
- Create: `public/assets/combat/sprites/sentinel-right-weakpoint.png`
- Create: `public/assets/combat/sprites/sentinel-core.png`
- Modify: `src/game/bosses/BossManager.ts`
- Modify: `src/game/bosses/BossManager.test.ts`

- [ ] **Step 1: Extend the fake and write RED display/body assertions**

In `BossManager.test.ts`, give `FakeSprite` `width`, `height`, `displayWidth`, `displayHeight`, `scaleX`, `scaleY`, and:

```ts
const sourceSize = (texture: string): [number, number] => {
  if (texture === 'boss-body') return [352, 192];
  if (texture.includes('weakpoint')) return [60, 128];
  if (texture === 'boss-core') return [64, 64];
  return [32, 32];
};

constructor(public x: number, public y: number, readonly texture: string) {
  [this.width, this.height] = sourceSize(texture);
  this.displayWidth = this.width;
  this.displayHeight = this.height;
  this.body = new FakeBody(this);
}

setDisplaySize(width: number, height: number): this {
  this.displayWidth = width;
  this.displayHeight = height;
  this.scaleX = width / this.width;
  this.scaleY = height / this.height;
  return this;
}
```

Set fake source sizes by texture: body `352 × 192`, weakpoint `60 × 128`, core `64 × 64`. Add:

```ts
expect(body.displayWidth).toBe(GAME_TUNING.boss.body.width);
expect(body.displayHeight).toBe(GAME_TUNING.boss.body.height);
expect(left.displayWidth).toBe(GAME_TUNING.boss.weakpoint.visual.width);
expect(left.displayHeight).toBe(GAME_TUNING.boss.weakpoint.visual.height);
expect(core.displayWidth).toBe(GAME_TUNING.boss.core.visualSize);
expect(body.body.halfWidth * 2 * body.scaleX).toBe(GAME_TUNING.boss.body.width);
expect(left.body.halfWidth * 2 * left.scaleX).toBe(GAME_TUNING.boss.weakpoint.hitbox.width);
```

- [ ] **Step 2: Run RED**

```bash
rtk npm test -- src/game/bosses/BossManager.test.ts
```

Expected: FAIL because production source sizes are used as display sizes.

- [ ] **Step 3: Add direct Sentinel drawing commands**

Append to the renderer:

```bash
magick -size 88x48 xc:none +antialias \
  -fill "$INK" -draw 'rectangle 4,6 83,43 rectangle 0,13 87,36' \
  -fill "$VIOLET" -draw 'rectangle 7,8 80,41 rectangle 2,15 85,34' \
  -fill "$BLUE_STEEL" -draw 'rectangle 14,10 73,18 rectangle 10,27 77,38' \
  -fill "$INK" -draw 'rectangle 34,16 53,35 rectangle 0,18 10,31 rectangle 77,18 87,31' \
  "$SOURCE/sentinel-body-master.png"
export_sprite "$SOURCE/sentinel-body-master.png" "$SPRITES/sentinel-body.png"

magick -size 15x32 xc:none +antialias \
  -fill "$INK" -draw 'rectangle 2,1 12,30 rectangle 0,6 14,25' \
  -fill "$VIOLET" -draw 'rectangle 3,2 11,29 rectangle 1,7 13,24' \
  -fill "$YELLOW" -draw 'rectangle 4,9 10,21' \
  -fill "$INK" -draw 'rectangle 6,11 8,19' \
  "$SOURCE/sentinel-weakpoint-master.png"
export_sprite "$SOURCE/sentinel-weakpoint-master.png" "$SPRITES/sentinel-left-weakpoint.png"
magick "$SPRITES/sentinel-left-weakpoint.png" -flop "$SPRITES/sentinel-right-weakpoint.png"

magick -size 16x16 xc:none +antialias \
  -fill "$INK" -draw 'rectangle 2,2 13,13' \
  -fill "$YELLOW" -draw 'rectangle 4,4 11,11' \
  -fill "$CERAMIC" -draw 'rectangle 6,5 9,10' \
  -fill "$MAGENTA" -draw 'rectangle 7,7 8,8' \
  "$SOURCE/sentinel-core-master.png"
export_sprite "$SOURCE/sentinel-core-master.png" "$SPRITES/sentinel-core.png"
```

Extend the verifier with exact runtime sizes and maximum five colors.

```bash
check public/assets/combat/sprites/sentinel-body.png 352x192 5 yes
check public/assets/combat/sprites/sentinel-left-weakpoint.png 60x128 5 yes
check public/assets/combat/sprites/sentinel-right-weakpoint.png 60x128 5 yes
check public/assets/combat/sprites/sentinel-core.png 64x64 5 yes
check_blocks public/assets/combat/sprites/sentinel-body.png
check_blocks public/assets/combat/sprites/sentinel-left-weakpoint.png
check_blocks public/assets/combat/sprites/sentinel-right-weakpoint.png
check_blocks public/assets/combat/sprites/sentinel-core.png
```

- [ ] **Step 4: Preserve world display and collision size**

In `BossManager.ts`, after sprite creation, call `setDisplaySize()` with existing visual tuning. Replace raw world `setSize()` calls with this local conversion:

```ts
const setWorldBodySize = (
  sprite: Phaser.Physics.Arcade.Sprite,
  width: number,
  height: number,
): void => {
  sprite.setSize(
    width / Math.abs(sprite.scaleX),
    height / Math.abs(sprite.scaleY),
    true,
  );
};
```

Use `GAME_TUNING.boss.body`, `.weakpoint.visual`, `.weakpoint.hitbox`, `.core.visualSize`, and `.core.hitboxSize`; do not add numbers outside tuning.

- [ ] **Step 5: Render and verify GREEN**

```bash
rtk scripts/render_gbc_combat_art.sh
rtk scripts/verify_gbc_combat_art.sh
rtk npm test -- src/game/bosses/BossManager.test.ts src/game/assets/combatAssetManifest.test.ts
rtk npm test
rtk npm run build
```

Expected: Sentinel runtime files are `352x192`, `60x128`, `60x128`, `64x64`; tests and build pass.

- [ ] **Step 6: Commit and push**

```bash
rtk git add scripts/render_gbc_combat_art.sh scripts/verify_gbc_combat_art.sh assets-source/combat/graphics/sentinel-*-master.png public/assets/combat/sprites/sentinel-*.png src/game/bosses/BossManager.ts src/game/bosses/BossManager.test.ts
rtk git commit -m "art: add gbc sentinel"
rtk git push
```

---

### Task 4: Add pixel basic orbs and friendly/hostile projectiles

**Files:**
- Modify: `scripts/render_gbc_combat_art.sh`
- Modify: `scripts/verify_gbc_combat_art.sh`
- Create: `assets-source/combat/graphics/orb-*-master.png`
- Create: `assets-source/combat/graphics/projectile-*-master.png`
- Create: `public/assets/combat/sprites/orb-*.png`
- Create: `public/assets/combat/sprites/projectile-*.png`
- Modify: `src/game/assets/combatAssetManifest.ts`
- Modify: `src/game/assets/combatAssetManifest.test.ts`
- Modify: `src/game/orbs/OrbManager.ts`
- Modify: `src/game/orbs/OrbManager.test.ts`
- Modify: `src/game/orbs/TemporaryOrbManager.ts`
- Modify: `src/game/orbs/TemporaryOrbManager.test.ts`
- Modify: `src/game/enemies/EnemyManager.ts`
- Modify: `src/game/enemies/EnemyManager.test.ts`
- Modify: `src/game/bosses/BossManager.ts`
- Modify: `src/game/bosses/BossManager.test.ts`

- [ ] **Step 1: Write RED manifest and basic-orb tests**

Require these new stable production keys:

```ts
'orb-temporary',
'enemy-bullet',
'boss-basic-bullet',
'boss-aimed-bullet',
'boss-falling-hazard',
```

Upgrade a basic orb and assert:

```ts
expect(manager.configureStartingCores(['inertia'])).toBe(true);
manager.upgradeOrb(0);
expect(sprites[0]?.textureKey).toBe('orb-inertia');
expect(sprites[0]?.displayWidth).toBe(GAME_TUNING.visual.friendly.permanentOrb.width);
expect(sprites[0]!.circle * sprites[0]!.scaleX).toBe(8);
```

Extend the fake sprite with source size `32 × 32` for basic core keys and:

```ts
setTexture(textureKey: string): this {
  this.textureKey = textureKey;
  if (/^orb-(echo|corrosion|conduction|inertia|split|explosion)$/.test(textureKey)) {
    this.width = 32;
    this.height = 32;
  }
  return this;
}

setDisplaySize(width: number, height: number): this {
  this.displayWidth = width;
  this.displayHeight = height;
  this.scaleX = width / this.width;
  this.scaleY = height / this.height;
  return this;
}
```

- [ ] **Step 2: Run RED**

```bash
rtk npm test -- src/game/assets/combatAssetManifest.test.ts src/game/orbs/OrbManager.test.ts
```

Expected: missing manifest keys and baked `-lvN` texture expectation fail.

- [ ] **Step 3: Add direct 8×8 core maps and projectile maps**

Append the six direct `8 × 8` orb masters:

```bash
magick -size 8x8 xc:none +antialias -fill "$INK" -draw 'rectangle 1,1 6,6' -fill "$CYAN" -draw 'rectangle 2,2 5,5' -fill "$CERAMIC" -draw 'point 2,4 point 3,3 point 4,4 point 5,3' "$SOURCE/orb-echo-master.png"
export_sprite "$SOURCE/orb-echo-master.png" "$SPRITES/orb-echo.png"
magick -size 8x8 xc:none +antialias -fill "$INK" -draw 'rectangle 1,1 6,6' -fill "$ACID" -draw 'rectangle 2,2 5,5' -fill "$CERAMIC" -draw 'point 4,2 point 3,3 point 3,4 point 4,5' "$SOURCE/orb-corrosion-master.png"
export_sprite "$SOURCE/orb-corrosion-master.png" "$SPRITES/orb-corrosion.png"
magick -size 8x8 xc:none +antialias -fill "$BLUE_STEEL" -draw 'rectangle 1,1 6,6' -fill "$CYAN" -draw 'rectangle 2,2 5,5' -fill "$CERAMIC" -draw 'point 3,2 point 3,3 point 2,4 point 4,4 point 4,5' "$SOURCE/orb-conduction-master.png"
export_sprite "$SOURCE/orb-conduction-master.png" "$SPRITES/orb-conduction.png"
magick -size 8x8 xc:none +antialias -fill "$INK" -draw 'rectangle 1,1 6,6' -fill "$CERAMIC" -draw 'rectangle 2,2 5,5' -fill "$CYAN" -draw 'point 2,5 point 3,4 point 4,3 point 5,2 point 4,2 point 5,3' "$SOURCE/orb-inertia-master.png"
export_sprite "$SOURCE/orb-inertia-master.png" "$SPRITES/orb-inertia.png"
magick -size 8x8 xc:none +antialias -fill "$INK" -draw 'rectangle 1,1 6,6' -fill "$MAGENTA" -draw 'rectangle 2,2 5,5' -fill "$CERAMIC" -draw 'point 3,5 point 3,4 point 2,3 point 4,3 point 5,2' "$SOURCE/orb-split-master.png"
export_sprite "$SOURCE/orb-split-master.png" "$SPRITES/orb-split.png"
magick -size 8x8 xc:none +antialias -fill "$INK" -draw 'rectangle 1,1 6,6' -fill "$ORANGE" -draw 'rectangle 2,2 5,5' -fill "$YELLOW" -draw 'point 3,2 point 3,5 point 2,3 point 5,3 point 3,3' "$SOURCE/orb-explosion-master.png"
export_sprite "$SOURCE/orb-explosion-master.png" "$SPRITES/orb-explosion.png"
```

Add direct projectile masters and runtime exports:

```bash
magick -size 6x6 xc:none +antialias -fill "$INK" -draw 'rectangle 1,1 4,4' -fill "$CYAN" -draw 'rectangle 2,2 3,3' "$SOURCE/projectile-temporary-master.png"
export_sprite "$SOURCE/projectile-temporary-master.png" "$SPRITES/projectile-temporary.png"
magick -size 5x5 xc:none +antialias -fill "$CORAL" -draw 'rectangle 0,1 4,3 rectangle 1,0 3,4' -fill "$YELLOW" -draw 'point 2,2' "$SOURCE/projectile-enemy-master.png"
export_sprite "$SOURCE/projectile-enemy-master.png" "$SPRITES/projectile-enemy.png"
magick -size 5x5 xc:none +antialias -fill "$INK" -draw 'rectangle 0,1 4,3 rectangle 1,0 3,4' -fill "$CORAL" -draw 'rectangle 1,1 3,3' -fill "$YELLOW" -draw 'point 2,2' "$SOURCE/projectile-boss-master.png"
export_sprite "$SOURCE/projectile-boss-master.png" "$SPRITES/projectile-boss.png"
magick -size 8x12 xc:none +antialias -fill "$INK" -draw 'rectangle 1,0 6,11' -fill "$CORAL" -draw 'rectangle 2,1 5,10' -fill "$YELLOW" -draw 'rectangle 3,2 4,5' "$SOURCE/projectile-hazard-master.png"
export_sprite "$SOURCE/projectile-hazard-master.png" "$SPRITES/projectile-hazard.png"
```

Extend the verifier:

```bash
for core in echo corrosion conduction inertia split explosion; do
  check "public/assets/combat/sprites/orb-$core.png" 32x32 5 yes
  check_blocks "public/assets/combat/sprites/orb-$core.png"
done
check public/assets/combat/sprites/projectile-temporary.png 24x24 4 yes
check public/assets/combat/sprites/projectile-enemy.png 20x20 4 yes
check public/assets/combat/sprites/projectile-boss.png 20x20 4 yes
check public/assets/combat/sprites/projectile-hazard.png 32x48 4 yes
check_blocks public/assets/combat/sprites/projectile-temporary.png
check_blocks public/assets/combat/sprites/projectile-enemy.png
check_blocks public/assets/combat/sprites/projectile-boss.png
check_blocks public/assets/combat/sprites/projectile-hazard.png
```

- [ ] **Step 4: Add projectile manifest entries**

```ts
{ key: 'orb-temporary', url: '/assets/combat/sprites/projectile-temporary.png', sampling: 'nearest' },
{ key: 'enemy-bullet', url: '/assets/combat/sprites/projectile-enemy.png', sampling: 'nearest' },
{ key: 'boss-basic-bullet', url: '/assets/combat/sprites/projectile-boss.png', sampling: 'nearest' },
{ key: 'boss-aimed-bullet', url: '/assets/combat/sprites/projectile-boss.png', sampling: 'nearest' },
{ key: 'boss-falling-hazard', url: '/assets/combat/sprites/projectile-hazard.png', sampling: 'nearest' },
```

Do not add `boss-muzzle-flash`; it remains a smooth VFX fallback.

- [ ] **Step 5: Reuse one production texture per basic core**

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

Fusion orbs keep existing procedural level textures.

For each production projectile, call `setDisplaySize()` before converting the existing world collider back into source pixels:

```ts
const setWorldCircle = (
  sprite: Phaser.Physics.Arcade.Sprite,
  width: number,
  height: number,
  radius: number,
): void => {
  sprite.setDisplaySize(width, height);
  const sourceRadius = radius / Math.abs(sprite.scaleX);
  sprite.setCircle(
    sourceRadius,
    (sprite.width - sourceRadius * 2) / 2,
    (sprite.height - sourceRadius * 2) / 2,
  );
};
```

Use it in `TemporaryOrbManager.createOrb()` with `GAME_TUNING.visual.friendly.temporaryOrb` and `temporaryOrbs.radius`; in `EnemyManager.finishShooterAttack()` with `visual.hostile.enemyBullet` and radius `5`; and in both Sentinel bullet creation paths with their visual sizes and configured projectile radii.

For the falling hazard:

```ts
const visual = GAME_TUNING.visual.hostile.bossHazard;
hazard.setDisplaySize(visual.width, visual.height).setSize(
  tuning.width / Math.abs(hazard.scaleX),
  tuning.height / Math.abs(hazard.scaleY),
  true,
);
```

Extend the existing manager fakes with `width`, `height`, `scaleX`, `scaleY`, `displayWidth`, `displayHeight`, and `setDisplaySize()`. Assert world radius as `fake.circle * fake.scaleX` and world rectangle size as fake body size multiplied by scale. This proves art scaling cannot change hit geometry.

- [ ] **Step 6: Render, verify, test, commit, and push**

```bash
rtk scripts/render_gbc_combat_art.sh
rtk scripts/verify_gbc_combat_art.sh
rtk npm test -- src/game/assets/combatAssetManifest.test.ts src/game/orbs/OrbManager.test.ts src/game/orbs/TemporaryOrbManager.test.ts src/game/enemies/EnemyManager.test.ts src/game/bosses/BossManager.test.ts
rtk npm test
rtk npm run build
rtk git add scripts/render_gbc_combat_art.sh scripts/verify_gbc_combat_art.sh assets-source/combat/graphics/orb-*-master.png assets-source/combat/graphics/projectile-*-master.png public/assets/combat/sprites/orb-*.png public/assets/combat/sprites/projectile-*.png src/game/assets/combatAssetManifest.ts src/game/assets/combatAssetManifest.test.ts src/game/orbs/OrbManager.ts src/game/orbs/OrbManager.test.ts src/game/orbs/TemporaryOrbManager.ts src/game/orbs/TemporaryOrbManager.test.ts src/game/enemies/EnemyManager.ts src/game/enemies/EnemyManager.test.ts src/game/bosses/BossManager.ts src/game/bosses/BossManager.test.ts
rtk git commit -m "art: add gbc combat tokens"
rtk git push
```

---

### Task 5: Add the pixel combat HUD and orb level notches

**Files:**
- Modify: `scripts/render_gbc_combat_art.sh`
- Modify: `scripts/verify_gbc_combat_art.sh`
- Create: `assets-source/combat/graphics/hud-status-frame-master.png`
- Create: `assets-source/combat/graphics/hud-boss-frame-master.png`
- Create: `public/assets/combat/sprites/hud-status-frame.png`
- Create: `public/assets/combat/sprites/hud-boss-frame.png`
- Modify: `src/game/scenes/combatSceneRules.ts`
- Modify: `src/game/scenes/combatSceneRules.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`

- [ ] **Step 1: Write RED boss ratio tests**

```ts
expect(bossHudRatio({ left: 0, right: 14, core: 36 }, 64)).toBeCloseTo(50 / 64);
expect(bossHudRatio(null, 64)).toBe(0);
expect(bossHudRatio({ core: -5 }, 36)).toBe(0);
```

- [ ] **Step 2: Run RED and implement the pure rule**

```bash
rtk npm test -- src/game/scenes/combatSceneRules.test.ts
```

Then add:

```ts
export function bossHudRatio(
  parts: Readonly<Record<string, number>> | null,
  maximumHp: number,
): number {
  if (!parts || maximumHp <= 0) return 0;
  const remaining = Object.values(parts).reduce((sum, hp) => sum + Math.max(0, hp), 0);
  return Math.max(0, Math.min(1, remaining / maximumHp));
}
```

- [ ] **Step 3: Add direct HUD frame commands**

Append commands for transparent `90 × 32` and `190 × 20` masters. Draw only a two-pixel `INK` outer border, one-pixel `STEEL` inner border, cyan status corners, amber boss corners, and empty transparent interiors. Export to `360 × 128` and `760 × 80`.

```bash
magick -size 90x32 xc:none +antialias \
  -fill "$INK" -draw 'rectangle 0,0 89,1 rectangle 0,30 89,31 rectangle 0,0 1,31 rectangle 88,0 89,31' \
  -fill "$STEEL" -draw 'rectangle 2,2 87,2 rectangle 2,29 87,29 rectangle 2,2 2,29 rectangle 87,2 87,29' \
  -fill "$CYAN" -draw 'rectangle 3,3 8,4 rectangle 3,27 8,28 rectangle 81,3 86,4 rectangle 81,27 86,28' \
  "$SOURCE/hud-status-frame-master.png"
export_sprite "$SOURCE/hud-status-frame-master.png" "$SPRITES/hud-status-frame.png"

magick -size 190x20 xc:none +antialias \
  -fill "$INK" -draw 'rectangle 0,0 189,1 rectangle 0,18 189,19 rectangle 0,0 1,19 rectangle 188,0 189,19' \
  -fill "$STEEL" -draw 'rectangle 2,2 187,2 rectangle 2,17 187,17 rectangle 2,2 2,17 rectangle 187,2 187,17' \
  -fill "$YELLOW" -draw 'rectangle 3,3 10,4 rectangle 3,15 10,16 rectangle 179,3 186,4 rectangle 179,15 186,16' \
  "$SOURCE/hud-boss-frame-master.png"
export_sprite "$SOURCE/hud-boss-frame-master.png" "$SPRITES/hud-boss-frame.png"
```

Extend the verifier to require both sizes, alpha, no more than five colors, and 4× block alignment.

```bash
check public/assets/combat/sprites/hud-status-frame.png 360x128 5 yes
check public/assets/combat/sprites/hud-boss-frame.png 760x80 5 yes
check_blocks public/assets/combat/sprites/hud-status-frame.png
check_blocks public/assets/combat/sprites/hud-boss-frame.png
```

- [ ] **Step 4: Add one bounded orb-level graphics layer**

Create `orbLevelGraphics` once, call after `orbManager.update()`, and clear/redraw:

```ts
private drawOrbLevels(): void {
  this.orbLevelGraphics.clear().fillStyle(0xffffff, 0.9);
  for (const orb of this.orbManager?.getSnapshot() ?? []) {
    if (orb.state === 'stored' || orb.state === 'queued') continue;
    for (let notch = 0; notch < Math.min(orb.level, 9); notch += 1) {
      const angle = Math.PI + notch * Math.PI / 4;
      this.orbLevelGraphics.fillRect(
        Math.round(orb.position.x + Math.cos(angle) * 7),
        Math.round(orb.position.y + Math.sin(angle) * 7),
        1,
        1,
      );
    }
  }
}
```

- [ ] **Step 5: Add status and boss HUD objects**

Place the status frame at `(8, 8)`, origin `(0, 0)`, display `180 × 64`, depth `9`. Keep current HP, XP, and bars above it.

Create a centered boss frame at `(225, 8)`, display `380 × 40`, one `340 × 8` fill rectangle at `(55, 34)`, and a centered label. `syncBossHud()` reads `activeBoss.getSnapshot()` only, caches the first sum of `parts` as maximum HP, and applies `bossHudRatio`. Hide all boss HUD objects and reset the cache when no boss is active.

Add fields:

```ts
private orbLevelGraphics!: Phaser.GameObjects.Graphics;
private statusHudFrame!: Phaser.GameObjects.Image;
private bossHudFrame!: Phaser.GameObjects.Image;
private bossHudFill!: Phaser.GameObjects.Rectangle;
private bossHudLabel!: Phaser.GameObjects.Text;
private bossMaximumHp = 0;
```

Create them before the existing HUD text:

```ts
this.statusHudFrame = this.add.image(8, 8, 'hud-status-frame')
  .setOrigin(0, 0).setDisplaySize(180, 64).setDepth(9);
this.bossHudFrame = this.add.image(GAME_WIDTH / 2, 8, 'hud-boss-frame')
  .setOrigin(0.5, 0).setDisplaySize(380, 40).setDepth(20).setVisible(false);
this.bossHudFill = this.add.rectangle(55, 34, 340, 8, 0xffae2b)
  .setOrigin(0, 0.5).setDepth(21).setVisible(false);
this.bossHudLabel = this.add.text(GAME_WIDTH / 2, 14, '', {
  color: '#eee3c8', fontSize: '12px', fontStyle: 'bold',
}).setOrigin(0.5, 0).setDepth(22).setVisible(false);
this.orbLevelGraphics = this.add.graphics().setDepth(7);
```

Add and call after `activeBoss?.update()`:

```ts
private syncBossHud(): void {
  const snapshot = this.activeBoss?.getSnapshot();
  const parts = snapshot?.active ? snapshot.parts : null;
  if (!snapshot || !parts) {
    this.bossMaximumHp = 0;
    this.bossHudFrame.setVisible(false);
    this.bossHudFill.setVisible(false);
    this.bossHudLabel.setVisible(false);
    return;
  }
  if (this.bossMaximumHp === 0) {
    this.bossMaximumHp = Object.values(parts).reduce((sum, hp) => sum + hp, 0);
  }
  this.bossHudFrame.setVisible(true);
  this.bossHudFill.setVisible(true).setScale(bossHudRatio(parts, this.bossMaximumHp), 1);
  this.bossHudLabel.setVisible(true).setText(snapshot.kind.toUpperCase());
}
```

After HUD files exist, change the manifest file test to cover every declared image:

```ts
for (const { url } of COMBAT_IMAGE_ASSETS) {
  expect(shippedAssets.has(`/public${url}`), url).toBe(true);
}
```

Do not replace Korean/system text or add a font dependency.

- [ ] **Step 6: Render, verify, test, commit, and push**

```bash
rtk scripts/render_gbc_combat_art.sh
rtk scripts/verify_gbc_combat_art.sh
rtk npm test -- src/game/scenes/combatSceneRules.test.ts src/game/assets/combatAssetManifest.test.ts
rtk npm test
rtk npm run build
rtk git add scripts/render_gbc_combat_art.sh scripts/verify_gbc_combat_art.sh assets-source/combat/graphics/hud-*-master.png public/assets/combat/sprites/hud-*.png src/game/scenes/combatSceneRules.ts src/game/scenes/combatSceneRules.test.ts src/game/scenes/CombatScene.ts
rtk git commit -m "art: add gbc combat hud"
rtk git push
```

---

### Task 6: Run integrated visual acceptance and document the new direction

**Files:**
- Modify: `e2e/combat.spec.ts`
- Modify: `docs/WORKLOG.md`

- [ ] **Step 1: Extend the existing visual E2E with Sentinel and projectile evidence**

In the desktop GBC scenario, call `enterMidbossByScore(page)`, wait for `snapshot(page).boss.active`, and capture `gbc-sentinel-desktop.png`. In the mobile scenario, use the existing two-touch movement and aim sequence before capturing `gbc-combat-mobile.png`. Track failed `/assets/combat/` responses in both tests.

```ts
await enterMidbossByScore(page);
await expect.poll(async () => (await snapshot(page)).boss.active).toBe(true);
await page.screenshot({ path: testInfo.outputPath('gbc-sentinel-desktop.png') });
```

Mobile interaction:

```ts
const { box } = await loadCanvas(page);
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
await page.screenshot({ path: testInfo.outputPath('gbc-combat-mobile.png') });
```

- [ ] **Step 2: Run the focused visual gate once**

```bash
rtk npx playwright test e2e/combat.spec.ts --grep 'GBC opening slice|GBC sentinel|GBC combat'
```

- [ ] **Step 3: Inspect mandatory screenshots**

Use `view_image` on desktop opening, desktop Sentinel, and mobile combat. Reject if:

- a common unit needs zoom to identify;
- the Sentinel weakpoints merge into the body;
- friendly and hostile projectiles can be confused;
- HUD covers aim or touch space;
- background neon competes with bullets;
- smooth VFX hide the flat pixel silhouettes;
- display art and collision behavior visibly disagree.

- [ ] **Step 4: Run one final full verification gate**

```bash
rtk scripts/verify_gbc_combat_art.sh
rtk npm test
rtk npm run build
rtk npm run test:e2e
rtk git diff --check
```

- [ ] **Step 5: Append the dated worklog entry**

Record:

- direct low-resolution PNG production replaced AI-downsampled units;
- the neon machine ecosystem palette and smooth-VFX exception;
- preserved texture keys, display sizes, collision, and balance;
- exact unit/E2E counts printed by the final commands;
- the existing Vite bundle warning separately from failures;
- deferred Hive, Siege, fusion art, meta UI, Korean bitmap font, palette animation, and production VFX textures.

- [ ] **Step 6: Commit and push**

```bash
rtk git add e2e/combat.spec.ts docs/WORKLOG.md scripts/render_gbc_combat_art.sh assets-source/combat/graphics public/assets/combat
rtk git commit -m "test: verify gbc psychedelic combat art"
rtk git push
```
