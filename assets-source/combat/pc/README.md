# PC combat art — first integration, 2026-10-14

User approved `masters/concept.png`: smooth contemporary spacecraft in an orbital
reflector corridor. Broad manufactured armor, simple silhouettes, restrained light.
No pixel constraint, tiny ornament, alien/Protoss motifs, ancient statues or runes.

## Current scope

- Orbital background; player and basic drone.
- Explosion: contained gold heat core, slow light pulse.
- Split: blue paired nuclei, counterclockwise energy circulation.
- Corrosion: mint nanofluid core and orbiting droplets; a planar radial nanite field.
- Existing logical display sizes, collision shapes, damage and combat rules retained.
- Other enemies, bosses and VFX still use earlier art and require later visual approval.

`masters/` contains the original outputs of the built-in `image_gen` tool. The exact
generation prompts are in `prompts.md`. The source PNG alpha is preserved; no color
key, palette quantization or nearest-neighbor enlargement is used.

```sh
rtk bash scripts/build_pc_combat_art.sh
```

The script checks output dimensions and alpha, exports smooth sheets to the existing
actor directories as `pc.png`, and copies orb/field assets to `public/assets/combat/pc/`.
The older pixel builders write `default.png` and cannot overwrite the PC sheets.
Actor frame sizes are 256×256 (player, 20 frames) and 280×240 (basic, 9 frames).
Rigid poses repeat; hurt uses a light tint and destruction fades. These are static
authored hulls with reaction states, not fully animated spacecraft.

Orb components have 256×256 frames, with bodies centered in a 160px envelope.
Their compact center and outer energy rim together describe the
existing 32px hit diameter inside the 42px presentation envelope. No extra layers
extend beyond that envelope. Corrosion has eight 256px frames, transparent centers,
and padded outer edges; its 1.1 presentation scale replaces the previous 1.6 scale.

Verification: `e2e/pc-art.spec.ts` checks the actual normal trial with all three
starting cores, asset loading, background visibility, and unchanged world hitboxes.
Screenshots require human visual review; passing tests do not establish art quality.
