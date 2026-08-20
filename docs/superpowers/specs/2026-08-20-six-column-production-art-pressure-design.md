# Six-Column Production Art And Combat Pressure Design

## Goal

Ship a busy, readable ricochet combat field with release-quality art. The battlefield moves from five oversized columns to six, the player and orbs shrink to a comfortable mobile scale, enemy downtime is bounded, and stage balance gains a measurable pressure budget. Every visible asset is designed from one approved world concept before it is translated into final pixel art.

This document supersedes:

- the five-column geometry and asset sizes in `2026-08-20-five-column-combat-scale-design.md`;
- the direct-low-resolution-only production rule and simplified character descriptions in `2026-08-19-gbc-psychedelic-art-design.md`;
- the scrapyard visual concept in `2026-08-14-art-audio-vertical-slice-design.md`.

Stable asset loading, nearest-neighbor runtime sampling, smooth VFX, semantic audio ownership, centralized tuning, and collision-to-visible-body alignment remain valid.

## Locked World Concept

The release art direction is **psychedelic mechanical occult**.

The game takes place inside a sealed machine sanctuary. A compact combat robot destroys runaway automatons using weaponized core orbs. The premise stays visual and simple; the game does not need heavy exposition.

The shared design language is:

- blackened metal and worn enamel shells;
- dark cavities and strong outer silhouettes;
- paired eye visors on the player and every complete enemy unit;
- circuit seals, machine talismans, clamps, rings, and reactor housings;
- cyan, magenta, amber, acid green, violet, and hot white energy;
- short or recessed appendages that remain inside the collision silhouette;
- rigid pixel machinery contrasted with smooth high-resolution energy effects.

Enemies never resemble insects or small crabs. No thin exposed legs, many-jointed arms, antenna clusters, or decorative limbs extend outside the main body. Personality comes from face, posture, shell shape, and animation.

## Production-Art Requirement

All new graphics are release assets. No disposable placeholder or mockup art is presented as an implementation checkpoint.

Each asset family follows one production path:

1. Create a high-resolution concept illustration that establishes silhouette, construction, material, face, color hierarchy, and energy source.
2. Review the concept against the world language and the complete family, not as an isolated icon.
3. Reinterpret the approved concept into authored pixel art at the final game scale. Automatic downsampling is not accepted as the final conversion.
4. Add separate animation and smooth-effect layers without changing collision geometry.
5. Inspect the result at actual mobile size inside combat.
6. Keep approved high-resolution masters under `assets-source/`; ship optimized pixel sprites under `public/assets/` using stable texture keys.

Work is delivered in final batches to limit rework, but the first batch is not temporary. The player, basic enemy, shooter, armored enemy, and three representative permanent orbs form the first release-quality batch. Their approved construction rules then govern the remaining enemies, bosses, orbs, fusions, backgrounds, HUD, workshop, and menus.

### Pixel translation rules

Final combat sprites use a `2 × 2px` runtime pixel cluster rather than the previous coarse `4 × 4px` blocks.

| Asset | Authored pixel grid | Runtime size |
| --- | ---: | ---: |
| Player | `41 × 41` | `82 × 82px` |
| Regular enemy | `35 × 30` | `70 × 60px` |
| Armored enemy | `70 × 60` | `140 × 120px` |
| Splitter | `70 × 30` | `140 × 60px` |
| Permanent orb | `16 × 16` | `32 × 32px` |
| Temporary orb | `10 × 10` | `20 × 20px` |

Characters may use roughly eight to twelve purposeful colors when material separation requires them. Shading is grouped into readable clusters; gradients, antialiasing, isolated noise pixels, and miniature high-resolution texture are removed. This retains concept detail without returning to flat HTML-like rectangles or producing illegible visual noise.

## Character And Orb Bible

### Player

The player is a compact shrine-maintenance combat robot. It has a large expressive two-eye visor, a protected chest launch chamber, broad enamel armor masses, and folded utility parts. Its silhouette must still read as a character when skins change the shell, face frame, and main color regions.

### Enemy family

Every complete enemy has a paired-eye visor. Role is communicated through silhouette before color:

- **Basic:** squat sealed automaton with a broad visor and one central circuit seal.
- **Shooter:** same facial grammar, with an unmistakable recessed barrel, charging chamber, and warning lamp.
- **Armored:** a two-by-two guardian idol with layered shield masses around one visible paired-eye face.
- **Splitter:** a joined double-shell unit whose fracture line is designed into the body. Each fragment inherits one half of the original face and seal.
- **Bosses:** monumental assemblies of the same shells, visors, seals, reactors, and weapons. Destructible parts remain visually independent.

Palette supports role recognition: basic uses moss/teal, shooter burnt orange, armored violet/steel, splitter coral/magenta, and bosses combine their stage palette with shared black metal.

### Permanent orbs

An orb is a physical occult machine weapon, not a colored circle. Every orb has a metal containment shell, a readable internal phenomenon, and a distinctive exterior silhouette.

- **Echo:** resonant rings and a vibrating central lens.
- **Corrosion:** sealed gas ampoule with vents and suspended acid vapor.
- **Conduction:** forked electrodes containing an unstable arc.
- **Inertia:** directional flywheel and heavy asymmetric counterweight.
- **Split:** paired chambers held by a branching clamp.
- **Explosion:** pressure vessel with radial locks and a white-hot center.

Fusion orbs combine construction features from both parents but receive a new silhouette and a new dominant phenomenon. They are not palette swaps. Aura, trail, proc, and impact layers remain smooth and may extend outside the collision circle.

## Six-Column Combat Geometry

The playfield remains `450 × 800px`. One central tuning source owns the revised scale.

| Element | Approved size |
| --- | ---: |
| Formation columns | `6` |
| Left/right margin | `15px` |
| Grid cell | `70 × 60px` |
| Physics gap | `0px` |
| Regular enemy | `70 × 60px` |
| Armored enemy | `140 × 120px` |
| Splitter | `140 × 60px` |
| Split fragment | `70 × 60px` |
| Player display | `82 × 82px` |
| Player hurt radius | `28px` |
| Permanent orb | `32 × 32px` |
| Temporary orb | `20 × 20px` |

Six cells still occupy `420px`. Adjacent occupied cells touch physically and visibly. Empty formation cells remain the only real ricochet passages.

Existing five-column templates are rewritten as six-column data. No runtime proportional conversion remains. Procedural rules derive all limits and anchors from the central column count.

Moving from five to six columns does not automatically increase per-enemy HP, descent speed, or damage. The larger possible population is measured first through the pressure model.

## Collision And Entry Contract

- Enemy render and collision rectangles remain identical to their grid footprints.
- Opaque blocking silhouettes reach footprint edges; decorative glow does not affect collision.
- A non-piercing permanent orb must reflect from every edge and internal seam of a two-by-two armored enemy in a real browser physics test.
- Intentional inertia piercing is visually explicit through a unique trail, entry flash, and exit streak. It cannot look like a missing collision.
- If a non-piercing browser reproduction still tunnels, collision processing is fixed at the shared orb/enemy boundary before art or balance work continues.
- Offscreen enemies cannot lose HP, receive damage-over-time, or trigger direct-hit procs until their complete collision rectangle has entered the visible playfield.
- Entry-protected enemies still block an orb and show a restrained deployment shield response; they do not record a damaging hit or consume a proc.

## Busy-Field Contract

Normal stage combat must feel continuously occupied without raising on-screen descent speed first.

- Visible-enemy downtime target: `2–3 seconds`.
- Hard maximum with the encounter in `running` state: `5 seconds`.
- Boss warnings, reward selection, pause, defeat, and run completion are exempt.
- When the visible field is empty and incoming enemies are still offscreen, the game advances the entire offscreen stack while preserving relative positions so its nearest footprint reaches the entry line before the deadline.
- When no enemies exist, the director prepares the next legal formation immediately and releases it at the entry line before the deadline.
- Formation generation avoids fully empty authored rows that create accidental long pauses.
- On-screen descent remains smooth and continuous. Offscreen release correction never accelerates an enemy after it becomes damageable.

Difficulty increases in this order:

1. occupied cells and overlapping formation supply;
2. enemy effective HP;
3. shooter frequency and projectile pressure;
4. special-enemy composition;
5. on-screen descent speed only after the other controls fail.

This order protects the ricochet-and-recovery cadence from sudden unfair breaches.

## Pressure Budget

Pressure is an authoring and diagnostics metric, not hidden runtime rubber-banding. Stage data remains deterministic for a given seed and build.

The model produces four values from central tuning and an expected build profile:

### Player output

```text
expected damage per hit
  = direct damage
  + sum(proc chance × proc damage × expected targets)
  + sum(proc chance × damage-over-time ticks × expected targets)

expected player DPS
  = orb count × expected hits per second per orb × expected damage per hit
```

Orb speed affects expected hit frequency. Core level, proc chance, radius, target count, fusion effects, and expected orb count affect damage. Formula estimates are calibrated against deterministic telemetry rather than treated as exact physics simulation.

### Enemy clear load

```text
clear load = enemy effective HP entering per second / expected player DPS
```

Effective HP includes normal/elite multipliers and footprint role. A value near the stage target means the player clears roughly as fast as durable threat enters.

### Breach load

```text
breach load = sum(occupied-cell weight / max(seconds to defense line, 1))
```

This distinguishes a crowded distant formation from a smaller group already threatening the player.

### Hostile-fire load

```text
hostile-fire load
  = sum(shots per second × projectile damage × pattern risk coefficient)
```

Pattern risk accounts for aimed, spread, lane-denial, and warning duration. The coefficient is explicit tuning data, not a hidden heuristic scattered through combat code.

### Composite score

```text
pressure score = 100 × (
  0.50 × normalized clear load
  + 0.30 × normalized breach load
  + 0.20 × normalized hostile-fire load
)
```

- below `80`: likely sparse or trivial;
- `80–120`: normal combat target;
- `120–135`: intentional late-stage or boss pressure;
- above `135`: requires an explicit fairness review.

Downtime is a separate hard guard and cannot be hidden by a good average pressure score.

Runtime debug telemetry exposes hits per second, player damage per second, enemy HP inflow, visible occupied cells, visible-empty duration, hostile shots per second, and breaches. Release builds do not show the panel.

## Central Ownership

Geometry, entry protection, maximum downtime, pressure targets, and risk coefficients live under `GAME_TUNING` or stage definitions. Runtime managers read them through existing geometry and encounter helpers.

- `GAME_TUNING.encounter.grid`: columns, margins, cell dimensions, gap.
- `GAME_TUNING.player.visual`: display and hurt radius.
- `GAME_TUNING.visual.friendly`: permanent and temporary orb sizes.
- `GAME_TUNING.encounter.pressure`: downtime target, hard deadline, score weights, calibration targets.
- stage phase data: population, HP multiplier, shooter mix, release interval, and risk coefficients.

No duplicated balance literals are introduced in scene orchestration, asset scripts, or tests. `docs/TUNING.md` records the adjustment points.

## Production Scope

Release art covers:

- player and skin-ready construction;
- every common and special enemy;
- Sentinel, Hive, and Siege bosses with all destructible parts and phases;
- six permanent orb families and all fusion orbs;
- friendly, temporary, hostile, boss, and hazard projectiles;
- combat VFX and hit feedback;
- stage backgrounds and boundaries;
- combat HUD, reward cards, deploy, workshop, codex, result, and meta navigation;
- icons required by upgrades, discoveries, currencies, and settings.

Sound production remains part of the release pass, using the existing semantic audio direction. This design changes visual production and combat pressure first; it does not remove the approved audio requirement.

## Verification

Implementation must prove:

- six-column templates and procedural footprints stay in bounds and preserve real passages;
- adjacent occupied cells have no false visual or physical seam;
- player, permanent orbs, temporary orbs, regular enemies, and large enemies use approved central sizes;
- non-piercing real orbs reflect from all armored-enemy edges;
- intentional piercing has distinct readable feedback;
- enemies receive no damage before complete entry;
- visible-field downtime never exceeds five seconds in deterministic stage simulations;
- pressure telemetry responds monotonically when density, HP, shooter rate, orb count, direct damage, or proc output changes;
- pressure does not alter runtime difficulty by itself;
- every sprite remains identifiable at actual mobile size and matches the approved high-resolution concept;
- all complete enemies use the shared paired-eye face language;
- opaque art and collision footprints agree;
- desktop and mobile screenshots validate density, scale, projectile separation, HUD obstruction, and effect readability;
- focused tests run during work, followed by one full unit, build, and E2E pass at completion.

## Explicit Non-Goals

- No runtime adaptive difficulty or player-specific rubber-banding.
- No automatic high-resolution downsample accepted as final pixel art.
- No further increase to on-screen enemy descent speed in the first six-column pass.
- No disposable asset batch presented as release progress.
- No new gameplay mechanic solely to justify the art concept.
