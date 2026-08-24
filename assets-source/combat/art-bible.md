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
- At `16 × 16`, each orb gets one outer silhouette and one internal phenomenon. Extra ring lines, facet lines, shell segmentation, filigree, and tiny attachments are forbidden; if a line cannot survive as a named part, delete it.
- Use shape and one dominant energy cluster before color. A grayscale thumbnail must not resemble broken glass or an arbitrary pile of pixels.
- Echo: resonant rings and vibrating lens.
- Corrosion: sealed gas ampoule, vents, suspended vapor.
- Conduction: forked electrodes and unstable arc.
- Inertia: directional flywheel and asymmetric counterweight.
- Split: paired chambers and branching clamp.
- Explosion: radial locks and white-hot pressure vessel.
- Fusion orbs combine both parents' construction clues but gain a new dominant silhouette and phenomenon.

## Pixel translation

- Preserve silhouette, paired visor, role device, material separation, and energy source.
- Design concepts for the final in-game size: large color masses first, then at most one role device and one identity mark.
- A mark is allowed only when it remains a readable symbol at `1×` mobile size. If it becomes texture, dithering, scratches, or visual static after pixel translation, remove it from the concept before pixel work.
- Do not fill shells with circuit glyphs, engraved borders, repeated panel lines, rivet fields, mottling, or ornamental highlights. Empty armor planes are intentional readability space.
- Spend detail on silhouette breaks and functional parts—visor, barrel, fracture, shield, reactor—not surface decoration.
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

## Skin frame boxes

- 한 역할의 모든 스킨과 상태 프레임은 `actorVisualProfiles.ts`에 선언된 동일 프레임 박스를 사용한다.
- 스프라이트시트는 상태별 프레임을 가로로 배치하고, 새 스킨도 `REQUIRED_ACTOR_STATES`를 빠짐없이 제공한다.
- 실루엣은 프레임 박스와 기존 충돌 외곽 안에 머문다. 애니메이션 때문에 표시 크기·원점·물리 바디를 바꾸지 않는다.
- 파괴·분열·격파 연출은 원본 물리 스프라이트가 아니라 비물리 종료 스프라이트에서 1회 재생한다.
- 플레이어·적·보스 스킨 추가는 프로필과 에셋 등록만으로 끝내며 전투 매니저에 스킨 분기를 추가하지 않는다.

## Production gate

1. Design each family in high resolution.
2. Review the complete family at intended runtime size; reject any concept whose marks collapse into noisy texture.
3. Re-author approved concepts as final-scale pixel art; automatic downsampling is forbidden.
4. Add motion and smooth effects without changing collision geometry.
5. Inspect in live desktop and mobile combat.
6. Keep concept and pixel masters under `assets-source/`; ship optimized runtime assets under `public/assets/` with stable texture keys.

All approved graphics are release assets. No disposable placeholder or mockup batch counts as progress.
