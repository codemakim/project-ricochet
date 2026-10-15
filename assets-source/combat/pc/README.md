# PC combat art — integration and expansion, 2026-10-15

User approved `masters/concept.png`: smooth contemporary spacecraft in an orbital
reflector corridor. Broad manufactured armor, simple silhouettes, restrained light.
No pixel constraint, tiny ornament, alien/Protoss motifs, ancient statues or runes.

## Current scope

- Orbital background; player, basic drone, armored drone and shooter.
- SENTINEL main hull, mirrored weapon pods and exposed reactor core.
- Echo: blue single optical lens and slowly pulsing wavefronts.
- Conduction: violet diamond nucleus and rapidly flickering electrical arcs.
- Inertia: dense amber pearl with an equatorial belt and rotating speed strokes.
- Explosion: contained gold heat core, slow light pulse.
- Split: blue paired nuclei, counterclockwise energy circulation.
- Corrosion: mint nanofluid core and orbiting droplets; a planar radial nanite field.
- Existing logical display sizes, collision shapes, damage and combat rules retained.
- Splitter/fragments, Hive/Siege and other VFX still use earlier art.

`masters/` contains the original outputs of the built-in `image_gen` tool. The exact
generation prompts are in `prompts.md`, `expansion-prompts.md` and `base-orb-prompts.md`. The right pod master
is a mirrored derivative of the original left pod. The source PNG alpha is preserved; no color
key, palette quantization or nearest-neighbor enlargement is used.

```sh
rtk bash scripts/build_pc_combat_art.sh
```

The script checks output dimensions and alpha, exports smooth sheets to the existing
actor directories as `pc.png`, and copies orb/field assets to `public/assets/combat/pc/`.
The older pixel builders write `default.png` and cannot overwrite the PC sheets.
Actor frame sizes: player 256×256/20 frames; basic 280×240/9; armored 280×240/11;
shooter 280×240/15; SENTINEL body 504×288/12, pods 112×240/11 each, core 256×256/14.
Rigid poses repeat; hurt uses a light tint and destruction fades. These are static
authored hulls with reaction states, not fully animated spacecraft.

Orb components have 256×256 frames, with bodies centered in a 160px envelope.
All six base orbs use one body and one additive energy image. Echo pulses every 720ms;
conduction pulses every 340ms; inertia's energy rotates counterclockwise at 2.2rad/s.
Their compact center and outer energy rim together describe the
existing 32px hit diameter inside the 42px presentation envelope. No extra layers
extend beyond that envelope. Corrosion has eight 256px frames, transparent centers,
and padded outer edges; its 1.1 presentation scale replaces the previous 1.6 scale.

Verification: `e2e/pc-art.spec.ts` checks the actual normal trial with all three
starting cores, asset loading, background visibility, and unchanged world hitboxes.
Screenshots require human visual review; passing tests do not establish art quality.
For the remaining base cores, `e2e/combat.spec.ts` cases `renders (echo|conduction|inertia)
orb animation identity` check actual flight and each declared energy motion.
`e2e/combat-sandbox.spec.ts` checks the new enemies' 140×120 and 70×60 world bodies,
SENTINEL's 252×144 hull, 56×120 pods and 56×56 core, actual boss hits and restart.
