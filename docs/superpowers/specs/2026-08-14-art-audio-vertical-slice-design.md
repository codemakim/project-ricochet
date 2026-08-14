# Art And Audio Vertical Slice Design

## Goal

Replace the prototype look of the opening combat loop with one production-quality visual and audio slice without changing gameplay rules. The slice covers the player, the three common enemy kinds, the Sentinel boss, the six basic permanent orb cores, their common combat feedback, one scrapyard arena, the combat HUD, sound effects, and one adaptive music composition.

The result must prove a repeatable asset pipeline before the remaining bosses, fusion orbs, menus, and skins are produced.

## Current Structure Assessment

The gameplay structure is suitable for an asset pass:

- enemies, bosses, permanent orbs, temporary orbs, encounter rules, progression, and tuning already have separate owners;
- runtime objects use stable Phaser texture keys;
- enemy managers already accept texture-key overrides;
- collision bodies and gameplay sizes are configured independently from most drawn shapes;
- automated desktop and mobile combat tests already exercise the opening loop and Sentinel encounter.

Two focused seams are required before production assets are connected:

1. `CombatScene` currently generates placeholder textures itself;
2. the game has no audio ownership layer.

These are integration gaps, not reasons for a broad refactor. `CombatScene` remains the combat orchestrator. Gameplay managers and collision rules do not move.

## Approved Direction

### Visual identity

- Theme: a dark mechanical scrapyard inhabited by small recycled machines.
- Character balance: cute 70%, mechanical 30%.
- Rendering: non-pixel, hand-painted 2D illustration with transparent sprites.
- Shape language: round faces and bodies, short limbs, visible bolts, patched metal, and bright internal cores.
- Materials: worn painted steel, oxidized edges, rubber joints, ceramic face plates, and saturated energy light.
- Readability: units use distinct silhouettes; color is supporting information, not the only distinction.
- Backgrounds remain lower in contrast and saturation than combat objects.
- The reference game establishes the desired density and polish level only. Characters, silhouettes, palette, symbols, and effects remain original to Project Ricochet.

### Sound identity

- Normal combat uses playful toy-machine clicks, springs, small metal impacts, and bright electronic tones.
- Boss attacks, weakpoint breaks, core exposure, and player damage add heavy industrial impacts and low-frequency weight.
- Friendly, hostile, and boss sounds occupy different tonal ranges so danger remains readable during dense combat.
- Music uses one composition with a light base loop and a synchronized heavy boss layer rather than an abrupt track replacement.

## Runtime Asset Architecture

### Manifest and loading

Add one combat asset manifest containing stable Phaser keys and runtime file paths. `CombatScene.preload()` loads the manifest before `create()` runs. A separate loading scene is not needed for this slice.

Runtime files live under:

```text
public/assets/combat/
  backgrounds/
  sprites/
  vfx/
  audio/
  music/
```

Editable high-resolution masters live separately under:

```text
assets-source/combat/
  graphics/
  audio/
```

The source directory preserves reproducible masters. The public directory contains only browser-ready exports.

### Stable texture keys and fallback

Existing keys such as `player`, `enemy-basic`, `enemy-armored`, `enemy-shooter`, `boss-body`, and the orb keys remain unchanged. Managers therefore require no art-specific API changes.

The current procedural texture generator moves out of `CombatScene` into a fallback helper. It generates only keys that were not successfully loaded. One missing asset must not force every asset back to placeholder graphics.

Asset decode or network failure is non-fatal:

- a missing texture receives its procedural fallback;
- a missing sound cue is skipped;
- failed music falls back to silence;
- gameplay initialization and collision behavior continue normally.

### Audio ownership

Add one `CombatAudio` owner created by `CombatScene`. It exposes semantic methods for the small approved cue list instead of introducing a global event bus. Existing combat handlers call it at the same points where they already create visual feedback.

`CombatAudio` owns:

- base music and boss-layer synchronization;
- sound cue lookup;
- small pitch and gain variation for repeated impacts;
- per-cue cooldowns and a global simultaneous-voice cap;
- visibility pause and resume;
- one persistent master-mute setting.

Detailed music and effects sliders remain out of scope until the broader settings UI is designed.

## First Visual Asset Set

### Player

The player is a small floating scrapyard repair robot with a large readable face plate, short utility arms, patched yellow-orange body panels, and a bright recovery core.

The shipped animation remains deliberately small:

- one short idle-hover loop;
- launch and recovery glow handled by Phaser tween and VFX layers;
- damage communicated through tint, recoil, sparks, and face change rather than a large directional animation set.

The player moves freely in every direction, so the sprite stays direction-neutral. No four-direction walk set is produced.

### Common enemies

- Basic: a compact square maintenance robot with a simple readable face.
- Armored: a wider, heavier scrap compactor with layered plates and a reinforced silhouette.
- Shooter: a narrow turret robot with a visible barrel and bright pre-fire lamp.

Idle life comes primarily from small Phaser bob, recoil, telegraph, tint, and particle motion. This avoids multiplying frame counts while preserving a hand-painted main sprite.

### Sentinel boss

The Sentinel is a large scrapyard administrator assembled from mismatched heavy machinery. Its body, left weakpoint, right weakpoint, and core remain separate sprites matching the existing damage model.

Visual states include:

- intact body and weakpoints;
- damaged overlay or tint after meaningful health thresholds;
- weakpoint break debris;
- exposed core pulse;
- final destruction burst.

Art bounds do not define collisions. Existing tuned body and weakpoint hitboxes remain authoritative.

### Basic orb cores

The six basic cores share one metal shell language but have distinct core energy, symbols, and emission shapes:

- echo: expanding wave;
- corrosion: leaking canister or droplet;
- conduction: electrical fork;
- inertia: directional flywheel;
- split: branching core;
- explosion: unstable radial chamber.

Level notches remain a runtime overlay. Separate art for every level is not produced. Fusion-orb master art remains on the procedural fallback in this slice.

### Arena, HUD, and effects

The arena uses a dark scrapyard floor, inset machine-wall trim, scattered low-contrast debris, and a clear defensive bottom edge. It does not add physical obstacles or change collision geometry.

The HUD receives matching HP, XP, and boss-bar frames. Meta menus and the workshop retain their current styling.

The first VFX set contains:

- wall ricochet flash and short streak;
- direct-hit spark and compact damage burst;
- recovery suction trail;
- conduction arc;
- corrosion gas cloud;
- split emission;
- explosion flash, core, and dissipating ring;
- enemy break debris;
- weakpoint break and core-exposure bursts.

Raster particles and sprite sheets provide texture. Phaser controls placement, tint, scale, lifetime, and density. Gameplay areas and damage calculations remain unchanged.

## First Audio Asset Set

Runtime audio ships as OGG and MP3 generated from WAV masters.

The cue set contains:

- orb launch;
- orb recovery;
- wall ricochet with small variations;
- direct hit in light and heavy variants;
- enemy destruction;
- shooter warning and fire;
- player hit;
- level-up confirmation;
- boss warning;
- weakpoint break;
- core exposure;
- core enrage;
- boss destruction.

Base combat music and its boss layer share tempo, length, and loop points. The boss layer starts muted and fades in on boss combat. It fades out after boss defeat without restarting the base loop.

The mix prioritizes gameplay information:

- friendly bounce and recovery cues are bright and short;
- hostile fire uses a rough midrange transient distinct from temporary friendly orbs;
- boss warnings and player damage use controlled low-frequency energy;
- major boss events briefly duck music rather than increasing every cue's volume;
- repeated cue pitch and gain variation is bounded so identity remains consistent.

## Production Flow

1. Produce a concept sheet for the player, three enemies, Sentinel parts, core shell language, palette, and material treatment.
2. Review silhouettes and color hierarchy before producing animation or export variants.
3. Generate or paint high-resolution transparent masters for approved designs.
4. Normalize crop bounds, anchor points, scale, transparent padding, and frame dimensions.
5. Export browser sprites and atlases; preserve high-resolution masters separately.
6. Produce WAV sound and music masters, then normalize and export OGG and MP3 runtime files.
7. Connect the manifest, fallback texture helper, `CombatAudio`, common VFX, and master mute.
8. Run desktop and mobile browser QA, then adjust only art scale, color, VFX density, cue volume, and mix timing.

## Budgets And Constraints

- Logical gameplay resolution remains `450 × 720`.
- Collision bodies, damage radii, enemy placement, boss phases, and encounter tuning do not change.
- Individual texture atlases stay at or below `2048 × 2048`.
- The initial vertical-slice runtime asset download target is at most 12 MB compressed.
- Simultaneous sound voices are capped; repeated wall and hit cues use cooldowns.
- VFX pools or bounded collections prevent particles and transient sprites from growing without limit.
- Desktop and mobile controls remain unchanged.
- Asset generation must not depend on a paid external service beyond the tools already available in this workspace.

## Verification

### Automated checks

- Manifest tests cover every approved texture and audio key.
- Fallback tests prove that one missing texture produces only its matching placeholder.
- Pure audio rules test cue variation bounds, cooldowns, voice limits, music-layer state, and mute persistence without requiring audible playback.
- Existing gameplay unit tests prove collisions and combat calculations did not change.
- Production build catches missing imports and invalid runtime integration.
- Browser tests fail on asset request errors, page errors, and console errors.
- Desktop and mobile browser scenarios cover load, first combat, level-up, shooter warning, Sentinel warning, weakpoint destruction, boss music transition, visibility pause, and mute.

### Visual and listening checks

- Capture desktop and mobile screenshots at opening combat, dense combat, and Sentinel exposure.
- Verify sprites align with existing collision bodies and remain readable behind VFX.
- Check that friendly temporary orbs and hostile projectiles cannot be confused.
- Listen for repeated-bounce fatigue, clipped peaks, missing cues, music-loop seams, and boss-layer timing.
- Confirm mute, background-tab pause, and resume work after browser audio unlock.

Automated checks can prove loading and state changes but cannot judge illustration quality or mix feel. Final approval requires the captured frames and a short listening playtest.

## Acceptance Criteria

- Opening combat through Sentinel defeat presents a coherent hand-painted scrapyard style.
- Player, common enemies, boss parts, basic orb cores, hostile shots, and primary effects are distinguishable at mobile scale.
- Missing individual assets degrade to placeholders or silence without blocking play.
- Collision and balance behavior match the pre-art build.
- Normal combat sounds playful while boss events sound materially heavier.
- Music transitions into and out of the boss layer without a loop restart.
- Desktop and mobile controls, pauses, and overlays continue to work.
- The same manifest and normalization process can accept later fusion, boss, menu, and skin assets without new loader architecture.

## Explicitly Deferred

- fusion-orb master sprites and fusion-specific hand-painted effects;
- Hive and Siege boss production art;
- full menu and workshop reskin;
- monetized skins;
- detailed audio settings;
- new gameplay, collision, balance, or encounter behavior.
