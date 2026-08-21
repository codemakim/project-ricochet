# Psychedelic Mechanical Occult Art Bible

## World

- A sealed machine sanctuary occupied by runaway automatons.
- Blackened structural metal, worn enamel armor, circuit seals, and luminous reactor energy.
- Rigid pixel machinery contrasts with smooth high-resolution energy effects.
- The premise stays visual and simple; avoid lore-dependent readability.

## Shared construction

- Every complete character has one paired rectangular or arched eye visor.
- Broad outer masses define the silhouette; appendages stay short, recessed, or folded inside it.
- One readable role feature may break symmetry: barrel, shield mass, fracture line, or reactor.
- Faces, posture, shell shape, and animation carry personality.
- No insect legs, antenna fans, crab claws, spindly parts, or decorative detail outside collision footprints.

## Character roles

- Player: compact amber shrine-maintenance combat robot; large visor, chest launch chamber, broad armor masses.
- Basic: squat moss/teal sealed automaton; broad visor and central circuit seal.
- Shooter: burnt-orange automaton; recessed barrel, charge chamber, and warning lamp.
- Armored: violet/steel guardian idol; layered shield masses around one visible paired-eye face.
- Splitter: coral/magenta joined double shell; fracture line crosses one paired face so each fragment inherits one half.
- Bosses: monumental assemblies of the same shells, visors, seals, reactors, and weapons; every destructible part reads independently.

## Energy palette

- Cyan: resonance and electric precision.
- Acid green: corrosion and gas.
- Blue-violet: inertia and gravity.
- Magenta: splitting and replication.
- Orange-white: heat and explosion.

Color reinforces identity but never replaces silhouette or internal construction.

## Orb construction

- Every permanent orb is a physical occult machine weapon, not a colored circle.
- Shared black-metal containment shells frame a readable internal phenomenon.
- Echo: resonant rings and vibrating lens.
- Corrosion: sealed gas ampoule, vents, suspended vapor.
- Conduction: forked electrodes and unstable arc.
- Inertia: directional flywheel and asymmetric counterweight.
- Split: paired chambers and branching clamp.
- Explosion: radial locks and white-hot pressure vessel.
- Fusion orbs combine both parents' construction clues but gain a new dominant silhouette and phenomenon.

## Pixel translation

- Preserve silhouette, paired visor, role device, material separation, and energy source.
- Author at half runtime dimensions, then export at exactly `200%` with nearest-neighbor sampling.
- Use `8–12` purposeful colors when material separation requires them.
- Group highlights and shadows into clusters; remove gradients, micro-scratches, isolated noise pixels, and sub-`2px` runtime detail.
- Opaque enemy shell masses reach blocking footprint edges. Transparent rounded corners may not imply a passable lane.
- Aura, trail, proc, and impact layers remain separate from collision art.
- Inspect every asset at `1×` mobile display size before approval.

## Runtime dimensions

| Asset | Authored master | Runtime |
| --- | ---: | ---: |
| Player | `41 × 41` | `82 × 82px` |
| Regular enemy | `35 × 30` | `70 × 60px` |
| Armored enemy | `70 × 60` | `140 × 120px` |
| Splitter | `70 × 30` | `140 × 60px` |
| Permanent orb | `16 × 16` | `32 × 32px` |
| Temporary orb | `10 × 10` | `20 × 20px` |

## Production gate

1. Design each family in high resolution.
2. Review the complete family for one visual language.
3. Re-author approved concepts as final-scale pixel art; automatic downsampling is forbidden.
4. Add motion and smooth effects without changing collision geometry.
5. Inspect in live desktop and mobile combat.
6. Keep concept and pixel masters under `assets-source/`; ship optimized runtime assets under `public/assets/` with stable texture keys.

All approved graphics are release assets. No disposable placeholder or mockup batch counts as progress.
