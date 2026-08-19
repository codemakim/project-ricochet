# Pixel Art Pivot Design

> **Superseded on 2026-08-19:** The direct low-resolution GBC-style rules in `docs/superpowers/specs/2026-08-19-gbc-psychedelic-art-design.md` replace this document. Do not execute its high-resolution generation and reduction workflow.

## Goal

Replace the opening combat slice's downscaled hand-painted units with original chunky pixel art that remains cute, readable, and distinct at actual mobile gameplay size. Use smooth high-resolution effects as deliberate contrast. Preserve gameplay geometry and balance.

This document supersedes the non-pixel runtime-art requirements in `2026-08-14-art-audio-vertical-slice-design.md`. Its audio direction and asset-loading architecture remain valid.

## Why The Current Direction Fails

The player and common enemies render at roughly `36–40 px`. Rust, bolts, limbs, claws, and small armor plates collapse into noise at that size. Thin appendages dominate the silhouette, making small robots resemble insects or crabs. The source illustrations are acceptable as concept art but unsuitable as runtime sprites.

## Visual System

All gameplay units, the arena background, HUD frames, meters, and icons use one chunky pixel language. High-resolution VFX remain smooth.

- One visible pixel block occupies `2 × 2` logical game pixels.
- Runtime assets are nearest-neighbor 4× exports of the effective art grid, then displayed at the existing logical size.
- Units use a dark one-pixel outline, large uninterrupted color fields, and at most five functional colors: two or three body colors, one shadow, and one emissive accent.
- Micro-rust, individual bolts, thin cables, fingers, claws, and decorative limbs are forbidden at gameplay scale.
- Bodies occupy 80–90 percent of each footprint.
- Any necessary appendage stays tucked against the body and uses at most one or two effective pixels.
- Designs must remain distinguishable in monochrome silhouette; color provides a second identification channel.

The player becomes an original compact pixel mascot: rounded-square body, large ceramic face, two cyan eyes, cyan recovery core, and tiny folded arms. It must not copy any existing product mascot or icon.

## Effective Grids And Runtime Sizes

| Asset | Effective grid | Runtime export | Display size |
|---|---:|---:|---:|
| Player | `18 × 18` | `72 × 72` | `36 × 36` |
| Basic enemy | `18 × 14` | `72 × 56` | `36 × 28` |
| Armored enemy | `20 × 16` | `80 × 64` | `40 × 32` |
| Shooter enemy | `19 × 15` | `76 × 60` | `38 × 30` |
| Arena | `225 × 360` | `900 × 1440` | `450 × 720` |

Boss modules, orb cores, and HUD assets follow the same 4× export and `2 × 2` logical block rule at their existing display sizes.

## Enemy Readability

- Basic enemy: moss-green compact square capsule, no visible legs, two hostile eye pixels.
- Armored enemy: purple and blue-gray, wide low shield or compactor silhouette, thick outer plate.
- Shooter enemy: orange and red, narrow vertical body, one oversized centered muzzle and warning lamp.
- Sentinel: purple-gray modular mass with large left and right weakpoint color blocks and a yellow-orange core. Parts remain readable after adjacent modules are destroyed.

Color cannot replace shape. Each type must still be identifiable when desaturated.

## Background And UI

Replace the detailed arena with a lower-detail pixel background on a `225 × 360` effective grid. Keep the center quiet, reserve machinery for edges, and use broad floor plates rather than small debris.

Combat HUD frames, bars, and icons use the same two-logical-pixel rhythm. English labels and numbers may use a compact bitmap font. Korean menu and explanatory text keep a readable system font initially; their frames, buttons, tabs, and icons still become pixel art. A full Korean bitmap-font replacement is deferred until font licensing and glyph coverage are settled.

## VFX Contrast

Launch trails, sparks, electric arcs, explosions, corrosion clouds, recovery light, and boss destruction use smooth alpha, additive light, gradients, and sub-pixel motion. They are not pixelated.

- VFX textures use linear sampling.
- Pixel art textures use nearest-neighbor sampling.
- VFX remain short and translucent enough that enemy silhouettes and hostile bullets stay visible.
- VFX never change collision, damage radius, timing, or other gameplay inputs.

## Runtime Integration

Keep all existing texture keys, display sizes, physics bodies, encounter data, and tuning values. Extend the combat asset manifest with one sampling field and apply it after loading:

- `nearest`: arena, player, enemies, boss parts, orb cores, HUD.
- `linear`: VFX.

Remove the player's continuous angle tween because rotating a tiny pixel sprite blurs its grid. Idle personality comes from later thruster light or discrete frames, not transformed geometry.

Replace the current Task 3 source masters and runtime files rather than retaining rejected versions in the working tree. Git history remains the archive.

## Verification

- Exact dimensions match the table and all unit sprites have transparent corners.
- Downscaling and re-upscaling preserve uniform 4×4 runtime blocks.
- Each common enemy is recognizable by silhouette and by palette at actual display size.
- Player face and shooter muzzle remain readable on a phone screenshot.
- Pixel textures use nearest sampling while smooth VFX use linear sampling.
- Desktop and mobile combat screenshots show no fringe, interpolation blur, collision mismatch, or HUD obstruction.
- Unit tests, TypeScript build, and final browser playtest pass without balance changes.

## Scope

This pivot replaces the visual direction for the entire game, but implementation proceeds through the existing opening vertical slice first. It includes the arena, player, common enemies, Sentinel, basic orbs, and combat HUD. Hive, Siege, fusion-orb art, meta-screen polish, and the full effect library follow only after the opening slice proves readable in play.
