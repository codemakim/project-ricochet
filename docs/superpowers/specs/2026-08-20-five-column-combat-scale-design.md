# Five-Column Combat Scale Design

## Goal

Make every combat object readable on a phone without sacrificing the brick-like formation language. Regular enemies become large grid tiles, adjacent occupied cells remain physically closed, the player becomes a recognizable character, and each permanent orb has enough pixels for a distinct identity.

This document supersedes the geometry table and the statement that gameplay sizes do not conform to art in `2026-08-19-gbc-psychedelic-art-design.md`. Its palette, silhouette, nearest-neighbor, smooth-VFX, and asset-production rules remain valid.

## Root Problem

The current `450px` playfield uses eight `52px` columns. A regular enemy occupies a `48 × 44px` collider, while its visible opaque pixels occupy much less of the PNG. The player displays at `36 × 36px` and permanent orbs at `16 × 16px`.

This produces three failures:

- units read as tiny symbols instead of characters;
- transparent sprite margins create apparent passages that are actually solid;
- orb colors survive, but orb shapes, motifs, and future cosmetics do not.

## Locked Combat Scale

The opening battlefield uses one geometry source in `GAME_TUNING`:

| Element | New size |
|---|---:|
| Playfield | `450 × 800px` |
| Formation columns | `5` |
| Formation left margin | `15px` |
| Grid cell | `84 × 72px` |
| Inter-cell physics gap | `0px` |
| Regular enemy | `1 × 1` cells = `84 × 72px` |
| Armored enemy | `2 × 2` cells = `168 × 144px` |
| Splitter | `2 × 1` cells = `168 × 72px` |
| Split fragment | `1 × 1` cells = `84 × 72px` |
| Player display | `96 × 96px` |
| Permanent orb | `40 × 40px` |
| Temporary orb | `24 × 24px` |

Five cells occupy `420px`, leaving equal `15px` margins. Two enemies in adjacent occupied cells touch physically and visually. An actual passage exists only where formation data leaves one or more cells empty.

The player uses a clearly visible central hurt core within the larger sprite. The outer shell may exceed the hurt core only when the core is visibly indicated; invisible arbitrary padding is forbidden. Orb collision follows the visible circular body, excluding only additive aura or trails.

## Visual And Collision Contract

For grid enemies, the world rectangle returned by `footprintWorldRect` is the render rectangle and the collision rectangle.

- Opaque enemy art reaches all four edges of that rectangle wherever the silhouette is intended to block.
- PNG transparency may round a corner by a few authored pixels, but cannot create a false channel along an edge.
- Decorative glow, sparks, muzzle flash, and aura render outside the sprite and never imply extra collision.
- Enemy bodies use the exact footprint world size. No independent per-kind display shrink is allowed.
- Automated asset checks compare opaque bounds with the expected footprint and reject large transparent borders.
- Browser checks verify that a ball cannot visually enter a seam between two adjacent occupied cells.

This keeps the original formation rule: a packed row behaves like a brick wall. The art is corrected to the gameplay geometry, not the other way around.

## Formation Migration

Existing templates are data for an eight-column grid and must be rewritten as five-column data. They are not proportionally compressed at runtime.

- Every template remains explicit and seeded.
- Opening templates preserve at least one intentional ricochet passage.
- Packed segments contain two to five adjacent cells and render as continuous walls.
- Empty cells remain large, readable aiming lanes.
- Formation population limits are reduced to match the larger cells instead of filling every visible row.
- Descent remains continuous and smooth; enemies never snap between rows during play.

Procedural formation rules derive all column choices from `FORMATION_COLUMNS`. Fixed anchor arrays tied to eight columns are replaced with five-column-safe data.

## Player And Orb Identity

The player is redrawn on a `24 × 24` authored grid and exported nearest-neighbor to `96 × 96px`. Its face, body color, and core occupy large contiguous regions. Future skins must change at least the body silhouette or one large color region; tiny accessories alone do not qualify as a skin.

Permanent orbs are redrawn on a `10 × 10` authored grid and exported to `40 × 40px`.

- each base orb has a different silhouette or interior motif as well as color;
- one or two exterior pixels may form fins, a ring, a crown, or another readable attachment;
- aura and trails are separate smooth effects;
- level notches cannot obscure the core motif;
- fusion orbs may use stronger exterior shapes but keep the same collision circle.

## Boss Scale

Bosses are reviewed against the five-column grid rather than mechanically multiplied.

- a midboss must occupy at least three columns visually;
- its core and weakpoints must each be large enough to target with a `40px` orb;
- production art and collision bounds must agree per destructible part;
- resizing cannot make a boss corridor impossible or cause boss-entry overlap.

Sentinel is corrected in the same implementation pass. Hive and Siege use the same contract and receive geometry checks; art replacement may remain a later asset checkpoint if their current sprites are still procedural.

## Central Tuning Ownership

All scale values live in one tuning boundary. Runtime systems read those values rather than repeating literals.

- grid columns, margins, cell size, and gap: `GAME_TUNING.encounter.grid`;
- player display and hurt-core size: `GAME_TUNING.player.visual`;
- permanent and temporary orb display/collision sizes: `GAME_TUNING.visual.friendly`;
- boss part geometry: existing boss tuning sections.

Derived rectangles and radii are calculated once by their existing geometry helpers. Asset source dimensions are documented beside the renderer inputs but do not become a second gameplay authority.

## Verification

Implementation must prove:

- five-column footprint validation and world coordinates;
- all procedural and fixed formations remain in bounds;
- adjacent occupied cells have no collision seam;
- one empty cell produces a real passage;
- enemy opaque bounds fill their runtime footprint;
- player and orb display sizes match tuning;
- orb collision matches its visible body;
- boss corridors and part collisions remain valid;
- desktop and mobile screenshots show readable player, enemies, and orb motifs;
- existing combat, build, and full E2E suites still pass.

## Scope

Included:

- five-column formation geometry and template migration;
- common enemy, player, and permanent-orb size correction;
- collision-to-art alignment;
- Sentinel scale correction;
- centralized scale tuning and regression checks.

Deferred:

- new enemy behaviors;
- stage balance beyond population changes required by the five-column migration;
- new skins and fusion-orb production art;
- new VFX and sound;
- Hive and Siege production PNG replacement when existing procedural art remains readable.
