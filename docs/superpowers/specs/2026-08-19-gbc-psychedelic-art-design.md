# GBC Psychedelic Machine World Design

## Goal

Give Project Ricochet a distinctive, readable mobile identity: compact GBC-era pixel units moving through a dark psychedelic machine ecosystem, contrasted by smooth modern effects. Every combat role must read instantly at actual gameplay size.

This document supersedes the visual production rules in `2026-08-19-pixel-art-pivot-design.md`. Existing asset loading, gameplay geometry, collision, balance, and the approved audio direction remain valid.

## World Concept

The setting is a neon machine ecosystem. Small machine creatures inhabit a strange living circuit world; the player is a compact robot pushing upward through it. The game does not explain the world through heavy lore.

The contrast defines the identity:

- cute, flat, highly constrained robot sprites;
- dark mechanical spaces with restrained psychedelic energy;
- vivid, smooth energy events breaking through the rigid pixel world.

Psychedelic color is a signal, not wallpaper. It appears in cores, circuits, portals, fusion events, boss phases, and edge machinery. The playfield center stays calm enough to read enemies, friendly orbs, hostile bullets, and aim lines.

## Pixel Language

Runtime characters are authored directly on their effective low-resolution grids. High-resolution image generation followed by reduction is forbidden for final unit art.

- No antialiasing or partial pixels.
- One authored pixel occupies `2 × 2` logical game pixels.
- Runtime PNGs are nearest-neighbor 4× exports of the authored grid.
- Unit sprites use no more than four visible functional colors: outline, main body, secondary face or shadow, and one emissive accent.
- Large flat regions replace gradients and surface texture.
- One role-defining mark per enemy: hostile eyes, shield face, or muzzle.
- Common units have no exposed limbs. Player arms, if visible, remain folded inside the body silhouette.
- No bolts, cables, fingers, claws, rust specks, tiny armor layers, or decorative anatomy.
- Shapes remain recognizable in monochrome silhouette. Palette reinforces shape but never replaces it.

The target is late-handheld-RPG clarity, not literal reproduction of an existing game's characters, palettes, or pixel arrangements.

## Locked Grids And Geometry

| Asset | Authored grid | Runtime PNG | Existing display size |
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

Art conforms to these sizes. Gameplay sizes and collision do not conform to art.

## Core Palette

All pixel assets share a near-black blue-violet outline. Each family adds one body color, one face or shadow color, and one accent.

- World base: ink navy, charcoal blue, muted steel blue.
- Player: warm amber body, pale ceramic face, cyan accent.
- Basic enemy: moss green body, dark visor, coral-red eyes.
- Armored enemy: muted violet body, blue-gray shield, dim magenta accent.
- Shooter enemy: burnt orange body, black-violet muzzle, yellow warning lamp.
- Boss machinery: dark violet and blue-gray mass, amber or acid-colored weakpoint blocks.
- Friendly energy: cyan, violet, acid green, orange, and pale white according to orb identity.
- Hostile projectiles: coral red with a pale yellow center; never cyan.

The background may use eight to twelve colors because it covers a large field, but adjacent floor colors remain close in value. Bright cyan, magenta, and acid green are reserved for sparse edge circuits and state changes.

## Character Silhouettes

### Player

A rounded-square mascot with a large pale face, two single-pixel cyan eyes, and one cyan core. The body is mostly amber. It has no visible legs and no protruding arms. Personality comes from face, color, and later discrete animation frames rather than rotation or small anatomy.

### Basic Enemy

A squat green capsule with a flat bottom and one dark visor. Two coral eye pixels are the only facial detail. It has no appendages.

### Armored Enemy

A wide, low purple shield or compactor. One large blue-gray plate occupies most of the front. It must remain visibly wider and heavier than the basic enemy without internal machinery detail.

### Shooter Enemy

A narrow orange-red turret. One oversized central muzzle occupies most of its lower body, with one warning lamp above it. It must read as a shooter even when desaturated.

### Sentinel

A broad dark modular mass rather than an illustrated robot. Weakpoints are tall, simple side blocks. The core is a bright square-cradled reactor. Destroying a module must leave a clear rectangular absence; remaining parts cannot visually collapse into one noisy cluster.

## Arena Background

The arena is authored at `225 × 360`.

- Center: broad, quiet floor plates with very small value changes.
- Edges: chunky machine organs, conduits, and circuit windows.
- Bottom: a clear defensive boundary without implying a solid obstacle beyond existing collision.
- Psychedelic energy: sparse colored channels at edges and boss-entry areas.
- Forbidden: scattered debris, tiny pipes, realistic rust, dense floor noise, fake collision obstacles, and bright central decoration.

Later stages may change the limited palette and edge-organ shapes while reusing the same readability rules. Constant background palette cycling is deferred because it would compete with hostile bullets.

## HUD, Orbs, And Projectiles

HUD frames, meters, icons, basic orbs, and projectiles use the same direct-pixel process.

- Korean text remains a readable system font; surrounding frames and icons are pixel art.
- Basic orb identity uses one color and one two-to-four-pixel motif.
- Orb level marks are drawn as tiny fixed pixel notches outside the core texture.
- Friendly and hostile projectiles must differ by both palette and silhouette.
- HUD interiors stay empty enough for live bars and text.

## Smooth VFX Exception

Launch trails, recovery light, electric arcs, explosions, lasers, corrosion gas, fusion events, and boss destruction remain smooth high-resolution effects.

- Pixel assets use nearest sampling.
- VFX textures use linear sampling; Phaser Graphics remain smooth.
- VFX may use glow, gradients, additive blending, sub-pixel movement, aurora color, and restrained chromatic separation.
- VFX duration and opacity stay low enough to preserve enemy silhouettes and hostile bullets.
- VFX never alter collision, damage radius, proc timing, or balance.

This contrast is intentional: rigid machine creatures inhabit a fluid, unstable energy world.

## Asset Production

- Final unit masters are direct low-resolution PNGs at the authored grids.
- Final arena master is a direct `225 × 360` PNG or a strictly cleaned low-resolution draft.
- Runtime exports are deterministic 4× nearest-neighbor PNGs; the arena may remain lossless WebP under its stable URL.
- Existing texture keys and URLs remain stable.
- Rejected high-detail masters and runtime files are replaced, not retained beside approved files.
- Existing procedural textures remain per-key fallbacks when a production file is absent.
- HTML and CSS are never runtime art assets; browser mockups are decision aids only.

## Verification

Every asset checkpoint must prove:

- exact source, runtime, and display dimensions;
- transparent sprite corners;
- uniform 4×4 runtime pixel blocks;
- unit palette count within the approved limit;
- no antialiasing or interpolation fringe;
- role recognition at actual mobile display size;
- silhouette recognition after desaturation;
- nearest sampling for pixel textures and linear or smooth rendering for effects;
- visual and collision alignment in desktop and mobile combat screenshots;
- no gameplay tuning or balance changes.

The first implementation checkpoint includes only the arena, player, and three common enemies. Sentinel, orbs, projectiles, and HUD follow only after that checkpoint reads correctly in the running game.

## Scope And Deferrals

Included in the first visual slice:

- player;
- basic, armored, and shooter enemies;
- opening arena;
- Sentinel;
- six basic orbs;
- friendly and hostile projectiles;
- combat HUD.

Deferred until the slice is approved:

- Hive and Siege production art;
- fusion-orb production art;
- meta-screen reskin;
- Korean bitmap font;
- continuous background palette animation;
- full production VFX texture library.

## Reference Boundary

Dragon Warrior III on Game Boy Color and Bloodstained: Curse of the Moon establish useful historical constraints: compact silhouettes, limited palettes, and strong dark-light separation. Project Ricochet uses those constraints only. It does not reproduce their characters, environments, UI, palettes, or pixel layouts.
