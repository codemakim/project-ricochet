# Pixel Art Pivot Implementation Plan

> **Superseded after Task 1 on 2026-08-19:** Task 1 is complete and remains valid. Do not execute Tasks 2–4; replace them with the plan derived from `docs/superpowers/specs/2026-08-19-gbc-psychedelic-art-design.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the rejected opening-slice illustrations with readable chunky pixel art while preserving every gameplay size, collider, timing, and balance value.

**Architecture:** Keep the existing manifest and procedural fallback seam. Add per-texture sampling, overwrite the rejected runtime files under their stable keys, and scale 4× runtime pixel assets back to existing logical display sizes. Existing Phaser Graphics effects stay smooth; the larger production VFX library remains deferred until the pixel silhouettes pass phone-size playtesting.

**Tech Stack:** Phaser 3, TypeScript, Vite, Vitest, Playwright, ImageMagick, imagegen

---

## Authority And Execution Order

This plan supersedes Tasks 3–5 of `docs/superpowers/plans/2026-08-14-art-audio-vertical-slice.md`.

Execute in this order:

1. Tasks 1–4 in this document.
2. Tasks 6–7 in `docs/superpowers/plans/2026-08-14-art-audio-vertical-slice.md` for audio generation and runtime wiring.
3. Task 8 in that document, with these changes:
   - do not require `GAME_TUNING.visual.productionVfx` or `public/assets/combat/vfx/*`;
   - judge existing smooth Phaser Graphics VFX against silhouette and hostile-bullet visibility;
   - document the production VFX library as deferred, not missing.

Tasks 1–2 of the older plan are already complete. Do not regenerate its rejected hand-painted assets.

## Locked Runtime Sizes

| Asset | Effective grid | Runtime file | Existing display size |
|---|---:|---:|---:|
| Player | `18 × 18` | `72 × 72` | `36 × 36` |
| Basic enemy | `18 × 14` | `72 × 56` | `36 × 28` |
| Armored enemy | `20 × 16` | `80 × 64` | `40 × 32` |
| Shooter enemy | `19 × 15` | `76 × 60` | `38 × 30` |
| Arena | `225 × 360` | `900 × 1440` | `450 × 720` |
| Sentinel body | `88 × 48` | `352 × 192` | `176 × 96` |
| Sentinel weakpoint | `15 × 32` | `60 × 128` | `30 × 64` |
| Sentinel core | `16 × 16` | `64 × 64` | `32 × 32` |
| Basic orb | `8 × 8` | `32 × 32` | `16 × 16` |
| Status HUD | `90 × 32` | `360 × 128` | `180 × 64` |
| Boss HUD | `190 × 20` | `760 × 80` | `380 × 40` |

Do not change `GAME_TUNING`, grid footprints, logical display sizes, or physics geometry to fit art.

---

### Task 1: Add per-texture sampling and remove pixel-blurring rotation

**Files:**
- Modify: `src/game/assets/combatAssetManifest.ts`
- Modify: `src/game/assets/combatAssetManifest.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`

- [ ] **Step 1: Write RED sampling tests**

Import `COMBAT_TEXTURE_FILTER` and `applyCombatTextureSampling`. Add:

```ts
it('assigns nearest sampling to pixel art and linear sampling to smooth effects', () => {
  expect(COMBAT_TEXTURE_FILTER).toEqual({ linear: 0, nearest: 1 });
  expect(COMBAT_IMAGE_ASSETS.every(({ sampling }) => sampling === 'nearest')).toBe(true);
});

it('applies sampling only to loaded production textures', () => {
  const setFilter = vi.fn();
  const exists = vi.fn((key: string) => key === 'player');
  const get = vi.fn(() => ({ setFilter }));
  applyCombatTextureSampling({ textures: { exists, get } } as never);
  expect(get).toHaveBeenCalledOnce();
  expect(get).toHaveBeenCalledWith('player');
  expect(setFilter).toHaveBeenCalledWith(COMBAT_TEXTURE_FILTER.nearest);
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

```bash
rtk npm test -- src/game/assets/combatAssetManifest.test.ts
```

Expected: FAIL because sampling fields and helpers do not exist.

- [ ] **Step 3: Implement the minimal manifest contract**

Keep the type-only Phaser import and extend the image interface:

```ts
export type CombatTextureSampling = 'nearest' | 'linear';

export const COMBAT_TEXTURE_FILTER = {
  linear: 0,
  nearest: 1,
} as const satisfies Record<CombatTextureSampling, Phaser.Textures.FilterMode>;

export interface CombatImageAsset {
  key: string;
  url: string;
  sampling: CombatTextureSampling;
}
```

Add `sampling: 'nearest'` to every current `COMBAT_IMAGE_ASSETS` entry. Then add:

```ts
export function applyCombatTextureSampling(scene: Phaser.Scene): void {
  for (const { key, sampling } of COMBAT_IMAGE_ASSETS) {
    if (!scene.textures.exists(key)) continue;
    scene.textures.get(key).setFilter(COMBAT_TEXTURE_FILTER[sampling]);
  }
}
```

- [ ] **Step 4: Apply filters after fallbacks exist**

Import `applyCombatTextureSampling` in `CombatScene.ts`. Keep the current call order and insert one line:

```ts
createCombatFallbackTextures(this);
applyCombatTextureSampling(this);
```

Delete the continuous player tween completely:

```ts
this.tweens.add({
  targets: this.player,
  angle: { from: -1.5, to: 1.5 },
  duration: 900,
  yoyo: true,
  repeat: -1,
  ease: 'Sine.inOut',
});
```

Do not replace it with another transform animation.

- [ ] **Step 5: Verify and commit**

```bash
rtk npm test -- src/game/assets/combatAssetManifest.test.ts
rtk npm test
rtk npm run build
rtk git add src/game/assets/combatAssetManifest.ts src/game/assets/combatAssetManifest.test.ts src/game/scenes/CombatScene.ts
rtk git commit -m "feat: preserve pixel texture sampling"
```

Expected: focused and full tests pass; build passes with only the existing bundle-size warning.

---

### Task 2: Replace arena, player, and common enemies with chunky pixel art

**Files:**
- Replace: `assets-source/combat/graphics/player-master.png`
- Replace: `assets-source/combat/graphics/enemy-basic-master.png`
- Replace: `assets-source/combat/graphics/enemy-armored-master.png`
- Replace: `assets-source/combat/graphics/enemy-shooter-master.png`
- Replace: `assets-source/combat/graphics/scrapyard-arena-master.png`
- Replace: `public/assets/combat/backgrounds/scrapyard-arena.webp`
- Replace: `public/assets/combat/sprites/player.png`
- Replace: `public/assets/combat/sprites/enemy-basic.png`
- Replace: `public/assets/combat/sprites/enemy-armored.png`
- Replace: `public/assets/combat/sprites/enemy-shooter.png`

- [ ] **Step 1: Read the imagegen skill and generate five original masters**

Use one imagegen call per sprite. Use the same suffix for all four sprites:

```text
Original chunky pixel-art game sprite, strict front/top-down hybrid view, centered on transparent background, no text, no floor, no shadow, no loose parts. Dark one-pixel outline, large uninterrupted color fields, maximum five functional colors, no rust specks, bolts, cables, fingers, claws, or thin limbs. Body occupies 85 percent of the canvas. Any appendage is folded tightly inside the silhouette. Designed to remain readable at 18 pixels wide.
```

Prepend exactly one subject:

```text
Compact friendly repair robot mascot: rounded-square body, oversized pale ceramic face plate, two cyan eye pixels, cyan recovery core, tiny folded arms; warm yellow-orange shell.
Compact basic enemy: moss-green square capsule, no visible legs, two hostile eye pixels; broad flat lower edge.
Wide armored enemy: purple and blue-gray scrap compactor, low shield silhouette, thick outer plate, no visible legs.
Narrow shooter enemy: orange-red vertical body, one oversized centered dark muzzle and bright warning lamp, no visible legs.
```

Generate the arena separately:

```text
Original vertical chunky pixel-art mobile combat arena, dark mechanical salvage bay, broad floor plates, quiet low-contrast center, heavy machinery only along the outer edges, cyan and amber utility lights, no characters, no projectiles, no text, no UI, no physical obstacles, 9:16 composition. Avoid tiny debris and realistic texture noise.
```

Save results to the five `assets-source/combat/graphics/*-master.png` paths above, replacing rejected masters.

- [ ] **Step 2: Normalize on the effective grids, then export 4× nearest**

```bash
rtk magick assets-source/combat/graphics/player-master.png -background none -trim +repage -filter point -resize 16x16 -gravity center -extent 18x18 -dither None -colors 6 -filter point -resize 400% public/assets/combat/sprites/player.png
rtk magick assets-source/combat/graphics/enemy-basic-master.png -background none -trim +repage -filter point -resize 16x12 -gravity center -extent 18x14 -dither None -colors 6 -filter point -resize 400% public/assets/combat/sprites/enemy-basic.png
rtk magick assets-source/combat/graphics/enemy-armored-master.png -background none -trim +repage -filter point -resize 18x14 -gravity center -extent 20x16 -dither None -colors 6 -filter point -resize 400% public/assets/combat/sprites/enemy-armored.png
rtk magick assets-source/combat/graphics/enemy-shooter-master.png -background none -trim +repage -filter point -resize 17x13 -gravity center -extent 19x15 -dither None -colors 6 -filter point -resize 400% public/assets/combat/sprites/enemy-shooter.png
rtk magick assets-source/combat/graphics/scrapyard-arena-master.png -filter point -resize 225x360^ -gravity center -extent 225x360 -dither None -colors 24 -filter point -resize 400% -define webp:lossless=true public/assets/combat/backgrounds/scrapyard-arena.webp
```

If a silhouette loses its face, muzzle, or shield during reduction, revise the master and rerun the same command. Do not raise the palette or add detail.

- [ ] **Step 3: Verify exact dimensions, alpha, and 4× blocks**

```bash
rtk magick identify -format '%f %wx%h %[channels]\n' public/assets/combat/sprites/player.png public/assets/combat/sprites/enemy-basic.png public/assets/combat/sprites/enemy-armored.png public/assets/combat/sprites/enemy-shooter.png public/assets/combat/backgrounds/scrapyard-arena.webp
rtk sh -c 'for f in public/assets/combat/sprites/player.png public/assets/combat/sprites/enemy-basic.png public/assets/combat/sprites/enemy-armored.png public/assets/combat/sprites/enemy-shooter.png; do magick "$f" -filter point -resize 25% -filter point -resize 400% /tmp/pixel-roundtrip.png; compare -metric AE "$f" /tmp/pixel-roundtrip.png null: 2>&1; done'
```

Expected sizes: `72x72`, `72x56`, `80x64`, `76x60`, `900x1440`. Each sprite reports alpha. Each `compare` result is `0`.

- [ ] **Step 4: Inspect at actual display size**

Create one temporary contact sheet and inspect it with `view_image`:

```bash
rtk magick public/assets/combat/sprites/player.png -filter point -resize 36x36 /tmp/player-display.png
rtk magick public/assets/combat/sprites/enemy-basic.png -filter point -resize 36x28 /tmp/basic-display.png
rtk magick public/assets/combat/sprites/enemy-armored.png -filter point -resize 40x32 /tmp/armored-display.png
rtk magick public/assets/combat/sprites/enemy-shooter.png -filter point -resize 38x30 /tmp/shooter-display.png
rtk magick montage /tmp/player-display.png /tmp/basic-display.png /tmp/armored-display.png /tmp/shooter-display.png -tile 4x1 -geometry +12+12 -background '#101820' /tmp/opening-pixel-silhouettes.png
```

Accept only if the player face, basic capsule, armored shield, and shooter muzzle are distinguishable both by shape and color. Delete `/tmp` outputs after inspection.

- [ ] **Step 5: Verify and commit**

```bash
rtk npm test -- src/game/assets/combatAssetManifest.test.ts src/game/enemies/EnemyManager.test.ts
rtk npm test
rtk npm run build
rtk git add assets-source/combat/graphics/player-master.png assets-source/combat/graphics/enemy-basic-master.png assets-source/combat/graphics/enemy-armored-master.png assets-source/combat/graphics/enemy-shooter-master.png assets-source/combat/graphics/scrapyard-arena-master.png public/assets/combat/backgrounds/scrapyard-arena.webp public/assets/combat/sprites/player.png public/assets/combat/sprites/enemy-basic.png public/assets/combat/sprites/enemy-armored.png public/assets/combat/sprites/enemy-shooter.png
rtk git commit -m "art: replace opening units with pixel sprites"
```

---

### Task 3: Add pixel Sentinel, basic orbs, and combat HUD

**Files:**
- Create: `assets-source/combat/graphics/sentinel-body-master.png`
- Create: `assets-source/combat/graphics/sentinel-weakpoint-master.png`
- Create: `assets-source/combat/graphics/sentinel-core-master.png`
- Create: `assets-source/combat/graphics/orb-{echo,corrosion,conduction,inertia,split,explosion}-master.png`
- Create: `assets-source/combat/graphics/hud-status-frame-master.png`
- Create: `assets-source/combat/graphics/hud-boss-frame-master.png`
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

- [ ] **Step 1: Write RED boss and orb geometry tests**

In `BossManager.test.ts`, extend `FakeSprite` so the test models the 2× source-to-display scale:

```ts
const sourceSize = (texture: string): [number, number] => {
  if (texture === 'boss-body') return [352, 192];
  if (texture.includes('weakpoint')) return [60, 128];
  if (texture === 'boss-core') return [64, 64];
  return [32, 32];
};

class FakeSprite {
  width: number;
  height: number;
  displayWidth: number;
  displayHeight: number;
  scaleX = 1;
  scaleY = 1;

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
}
```

Keep the class's existing fields and methods around the shown additions. Assert production-size source textures still display and collide at world sizes:

```ts
expect(body.displayWidth).toBe(GAME_TUNING.boss.body.width);
expect(body.displayHeight).toBe(GAME_TUNING.boss.body.height);
expect(left.displayWidth).toBe(GAME_TUNING.boss.weakpoint.visual.width);
expect(left.displayHeight).toBe(GAME_TUNING.boss.weakpoint.visual.height);
expect(core.displayWidth).toBe(GAME_TUNING.boss.core.visualSize);
expect(body.body.halfWidth * 2).toBe(GAME_TUNING.boss.body.width);
expect(left.body.halfWidth * 2).toBe(GAME_TUNING.boss.weakpoint.hitbox.width);
```

In `OrbManager.test.ts`, extend its `FakeSprite` with `width`, `height`, `scaleX`, `scaleY`, `displayWidth`, `displayHeight`, and this method:

```ts
setDisplaySize(width: number, height: number): this {
  this.displayWidth = width;
  this.displayHeight = height;
  this.scaleX = width / this.width;
  this.scaleY = height / this.height;
  return this;
}
```

When `setTexture()` receives one of the six base basic-core keys, set `width = 32` and `height = 32` before `setDisplaySize()` runs. Upgrade one basic orb and assert it reuses the base texture while retaining world diameter:

```ts
manager.upgradeOrb(0);
expect(sprites[0]?.textureKey).toBe('orb-inertia');
expect(sprites[0]?.displayWidth).toBe(GAME_TUNING.visual.friendly.permanentOrb.width);
expect(sprites[0]!.circle * sprites[0]!.scaleX).toBe(8);
```

Update older fake-only circle assertions to compare `circle * scaleX`; production world radius remains unchanged.

- [ ] **Step 2: Run focused tests and confirm RED**

```bash
rtk npm test -- src/game/bosses/BossManager.test.ts src/game/orbs/OrbManager.test.ts
```

Expected: FAIL because boss production textures are not scaled and basic orbs request baked `-lvN` keys.

- [ ] **Step 3: Generate compact pixel masters**

Read the imagegen skill. Generate one isolated transparent file per subject with this common suffix:

```text
Original chunky pixel-art game asset, centered, orthographic front/top-down hybrid, transparent background, dark one-pixel outline, maximum five functional colors, broad uninterrupted shapes, no tiny bolts, rust specks, cables, fingers, claws, or protruding limbs. Readable at the stated effective grid. No text and no shadow.
```

Use these subjects and effective grids:

```text
88x48 Sentinel body: wide purple-gray modular machine mass, empty side sockets, empty central reactor socket, large calm shapes.
15x32 Sentinel weakpoint: tall purple side battery-turret module with a large yellow-orange damage block; designed for horizontal mirroring.
16x16 Sentinel core: exposed yellow-orange reactor sphere inside a dark square cradle.
8x8 echo orb: cyan concentric-wave motif.
8x8 corrosion orb: acid-green canister/drop motif.
8x8 conduction orb: electric-blue fork motif.
8x8 inertia orb: pale steel arrow/flywheel motif.
8x8 split orb: violet branching motif.
8x8 explosion orb: orange-red radial chamber motif.
```

Generate two empty HUD frames separately: a `90x32` status plate and a `190x20` boss plate. Use dark blue-gray pixel steel, pale ceramic corners, cyan player accents, amber boss accents, and empty interiors. No text, numbers, or icons.

- [ ] **Step 4: Export exact 4× runtime files**

```bash
rtk magick assets-source/combat/graphics/sentinel-body-master.png -background none -trim +repage -filter point -resize 84x44 -gravity center -extent 88x48 -dither None -colors 6 -filter point -resize 400% public/assets/combat/sprites/sentinel-body.png
rtk magick assets-source/combat/graphics/sentinel-weakpoint-master.png -background none -trim +repage -filter point -resize 13x30 -gravity center -extent 15x32 -dither None -colors 6 -filter point -resize 400% public/assets/combat/sprites/sentinel-left-weakpoint.png
rtk magick public/assets/combat/sprites/sentinel-left-weakpoint.png -flop public/assets/combat/sprites/sentinel-right-weakpoint.png
rtk magick assets-source/combat/graphics/sentinel-core-master.png -background none -trim +repage -filter point -resize 14x14 -gravity center -extent 16x16 -dither None -colors 6 -filter point -resize 400% public/assets/combat/sprites/sentinel-core.png
rtk sh -c 'for name in echo corrosion conduction inertia split explosion; do magick "assets-source/combat/graphics/orb-$name-master.png" -background none -trim +repage -filter point -resize 7x7 -gravity center -extent 8x8 -dither None -colors 6 -filter point -resize 400% "public/assets/combat/sprites/orb-$name.png"; done'
rtk magick assets-source/combat/graphics/hud-status-frame-master.png -background none -filter point -resize 90x32! -dither None -colors 8 -filter point -resize 400% public/assets/combat/sprites/hud-status-frame.png
rtk magick assets-source/combat/graphics/hud-boss-frame-master.png -background none -filter point -resize 190x20! -dither None -colors 8 -filter point -resize 400% public/assets/combat/sprites/hud-boss-frame.png
```

- [ ] **Step 5: Preserve boss display and collision geometry**

In `BossManager.ts`, set visual sizes, then convert world hitboxes into source pixels:

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

- [ ] **Step 6: Reuse one production texture per basic core**

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

Keep fusion orbs on their existing procedural `-lvN` textures. Do not change orb radius, speed, or state.

- [ ] **Step 7: Add a bounded level-notch layer**

Create one `orbLevelGraphics` in `CombatScene`, clear and redraw it during the existing visual update, and destroy it with the scene:

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

This layer is visual only. Do not attach child game objects to physics sprites.

- [ ] **Step 8: Add pixel HUD frames and a read-only boss ratio rule**

In `combatSceneRules.ts`:

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
```

Test:

```ts
expect(bossHudRatio({ left: 0, right: 14, core: 36 }, 64)).toBeCloseTo(50 / 64);
expect(bossHudRatio(null, 64)).toBe(0);
```

Add these scene fields:

```ts
private orbLevelGraphics!: Phaser.GameObjects.Graphics;
private statusHudFrame!: Phaser.GameObjects.Image;
private bossHudFrame!: Phaser.GameObjects.Image;
private bossHudFill!: Phaser.GameObjects.Rectangle;
private bossHudLabel!: Phaser.GameObjects.Text;
private bossMaximumHp = 0;
```

In `CombatScene.create()`, create frames before the existing text:

```ts
this.statusHudFrame = this.add.image(8, 8, 'hud-status-frame')
  .setOrigin(0, 0)
  .setDisplaySize(180, 64)
  .setDepth(9);
this.bossHudFrame = this.add.image(GAME_WIDTH / 2, 8, 'hud-boss-frame')
  .setOrigin(0.5, 0)
  .setDisplaySize(380, 40)
  .setDepth(20)
  .setVisible(false);
this.bossHudFill = this.add.rectangle(55, 34, 340, 8, 0xffb23e)
  .setOrigin(0, 0.5)
  .setDepth(21)
  .setVisible(false);
this.bossHudLabel = this.add.text(GAME_WIDTH / 2, 14, '', {
  color: '#fff2cf',
  fontSize: '12px',
  fontStyle: 'bold',
}).setOrigin(0.5, 0).setDepth(22).setVisible(false);
this.orbLevelGraphics = this.add.graphics().setDepth(7);
```

Add and call this after `activeBoss?.update()`:

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
  this.bossHudFill
    .setVisible(true)
    .setScale(bossHudRatio(parts, this.bossMaximumHp), 1);
  this.bossHudLabel.setVisible(true).setText(snapshot.kind.toUpperCase());
}
```

Call `drawOrbLevels()` immediately after `orbManager.update(...)`. Reset `bossMaximumHp` in shutdown; normal Phaser scene teardown owns the HUD game objects.

Keep Korean/system text unchanged. Do not add a bitmap-font dependency.

- [ ] **Step 9: Verify every file and runtime contract**

Rename the filtered manifest test to `ships every declared production image` and replace its filtered loop with:

```ts
for (const { url } of COMBAT_IMAGE_ASSETS) {
  expect(shippedAssets.has(`/public${url}`), url).toBe(true);
}
```

```bash
rtk magick identify -format '%f %wx%h %[channels]\n' public/assets/combat/sprites/sentinel-*.png public/assets/combat/sprites/orb-*.png public/assets/combat/sprites/hud-*.png
rtk npm test -- src/game/assets/combatAssetManifest.test.ts src/game/bosses/BossManager.test.ts src/game/orbs/OrbManager.test.ts src/game/scenes/combatSceneRules.test.ts
rtk npm test
rtk npm run build
```

Expected exact dimensions: Sentinel `352x192`, `60x128`, `60x128`, `64x64`; each basic orb `32x32`; HUD `360x128` and `760x80`. All PNG files report alpha. Full tests and build pass.

- [ ] **Step 10: Commit**

```bash
rtk git add assets-source/combat/graphics public/assets/combat/sprites src/game/bosses/BossManager.ts src/game/bosses/BossManager.test.ts src/game/orbs/OrbManager.ts src/game/orbs/OrbManager.test.ts src/game/scenes/CombatScene.ts src/game/scenes/combatSceneRules.ts src/game/scenes/combatSceneRules.test.ts src/game/assets/combatAssetManifest.test.ts
rtk git commit -m "art: add pixel sentinel cores and combat hud"
```

---

### Task 4: Run one real-size visual acceptance gate

**Files:**
- Modify: `e2e/combat.spec.ts`
- Modify: `docs/WORKLOG.md`

- [ ] **Step 1: Add only observable asset contracts to the existing combat E2E**

Add two scenarios named `@desktop renders pixel opening and sentinel` and `@mobile renders pixel opening`. Reuse `loadCanvas`, `sceneCall`, `enterMidbossByScore`, and existing touch helpers; do not duplicate bootstrap logic. In the desktop scenario, assert loaded source widths:

```ts
const dimensions = await sceneCall(page, (scene) => (
  ['player', 'enemy-basic', 'enemy-armored', 'enemy-shooter', 'boss-body']
    .map((key) => ({ key, width: scene.textures.get(key).getSourceImage().width }))
));
expect(dimensions).toEqual([
  { key: 'player', width: 72 },
  { key: 'enemy-basic', width: 72 },
  { key: 'enemy-armored', width: 80 },
  { key: 'enemy-shooter', width: 76 },
  { key: 'boss-body', width: 352 },
]);
```

Capture exactly three screenshots in the existing desktop/mobile scenarios:

```ts
await page.screenshot({ path: testInfo.outputPath('pixel-opening-desktop.png') });
await page.screenshot({ path: testInfo.outputPath('pixel-sentinel-desktop.png') });
await page.screenshot({ path: testInfo.outputPath('pixel-opening-mobile.png') });
```

The desktop scenario captures its opening image, calls `enterMidbossByScore(page)`, waits for `snapshot(page).boss.active` to become true, then captures Sentinel. The mobile scenario uses the existing two-touch movement/aim sequence before its screenshot so the HUD and touch-safe play area are both exercised.

- [ ] **Step 2: Run the focused browser gate once**

```bash
rtk npx playwright test e2e/combat.spec.ts --grep 'pixel opening|pixel sentinel'
```

Expected: scenarios pass; no `/assets/combat/` response fails.

- [ ] **Step 3: Inspect all three screenshots at original size**

Use `view_image`. Reject and revise assets if any condition fails:

- player face or shooter muzzle is unreadable at actual mobile scale;
- enemy silhouettes merge into insect-like limbs;
- two enemy types depend only on color for identification;
- nearest-neighbor sprites show interpolation blur or fringe;
- smooth electric, corrosion, explosion, or recovery Graphics obscure hostile bullets;
- visible sprite and collider behavior appear misaligned;
- HUD blocks aim or touch space.

Asset-only revisions return to the ImageMagick and `view_image` steps. Do not change combat tuning during this gate.

- [ ] **Step 4: Run the final verification gate**

```bash
rtk npm test
rtk npm run build
rtk npm run test:e2e
rtk git diff --check
```

Record exact counts and the existing Vite bundle warning separately from failures.

- [ ] **Step 5: Document the pivot and commit**

Append a dated `docs/WORKLOG.md` entry containing:

```text
- Replaced rejected high-detail opening sprites with 2-logical-pixel chunky art.
- Preserved runtime texture keys, display geometry, collision geometry, and balance.
- Pixel textures use nearest sampling; existing Phaser Graphics VFX remain smooth, and the manifest supports future linear-sampled VFX textures.
- Deferred Hive, Siege, fusion-orb art, meta-screen reskin, Korean bitmap font, and production VFX texture library until phone-size readability is approved.
- Verification: copy the exact unit-test and E2E counts printed by the final commands, the build result, and the three screenshot names.
```

Then commit:

```bash
rtk git add e2e/combat.spec.ts docs/WORKLOG.md
rtk git commit -m "test: verify pixel art combat slice"
```

Do not push until the task commit and verification result have been reported. Then push the branch once.
