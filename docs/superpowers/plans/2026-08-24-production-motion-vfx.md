# Production Motion And VFX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship role-specific character animation, unique always-on animation for all 15 permanent orbs, and bounded production combat VFX without changing physics or balance.

**Architecture:** Pixel actors use registered equal-frame sprite sheets keyed by role and skin ID. Smooth orbs use a registered visual profile and a physics-free `OrbVisuals` companion that composes the current body texture with animated linear-sampled layers. Existing semantic feedback calls route one-shot effects through one bounded `CombatVfxPlayer`; persistent combat effects remain with their current state owners.

**Tech Stack:** Phaser 3.90, TypeScript 5.9, Vite 8, Vitest 4, Playwright, OpenAI image generation, ImageMagick, PNG/WebP

**Spec:** `docs/superpowers/specs/2026-08-24-production-motion-vfx-design.md`

## Global Constraints

- Player, enemy, orb, and boss collision positions and sizes never change because of animation.
- Actor skins are cosmetic; every skin uses the display box, anchor, and collision owned by its role.
- The only skin shipped in this plan is `default`; store, equip UI, monetization, and save fields remain out of scope.
- Every current `OrbTypeId` has one visual profile; new orb visuals register through the same profile table.
- Actor sheets use nearest sampling. Orb layers and VFX use linear sampling.
- Visual code reads combat state and semantic events but never owns damage, proc timing, movement, or collision.
- Reuse current feedback owners. Do not create a parallel gameplay event bus or a generic animation engine.
- Adjustable frame rates, alpha, sizes, lifetimes, spawn intervals, and caps live under `GAME_TUNING.visual`.
- Browser regression runs only after Tasks 5, 8, and 10. Other tasks use focused unit and asset checks.
- Every shell command begins with `rtk`.

---

## File Map

### New runtime files

- `src/game/visuals/actorVisualProfiles.ts` — actor roles, skin profiles, required-state validation, animation keys.
- `src/game/visuals/actorVisualProfiles.test.ts` — role/skin/state/dimension contracts.
- `src/game/visuals/registerActorAnimations.ts` — Phaser animation registration and state playback.
- `src/game/visuals/registerActorAnimations.test.ts` — animation frame and fallback behavior.
- `src/game/visuals/orbVisualProfiles.ts` — complete `OrbTypeId` visual registry and layer motion descriptors.
- `src/game/visuals/orbVisualProfiles.test.ts` — exhaustive 15-orb profile and identity checks.
- `src/game/visuals/OrbVisuals.ts` — physics-free body companions, layer animation, lifecycle cleanup.
- `src/game/visuals/OrbVisuals.test.ts` — position, visibility, motion, cap, and cleanup tests.
- `src/game/visuals/combatVfxIds.ts` — shared semantic VFX ID list used by orb profiles and playback.
- `src/game/visuals/combatVfxProfiles.ts` — semantic one-shot VFX registry.
- `src/game/visuals/combatVfxProfiles.test.ts` — required event/profile/asset checks.
- `src/game/visuals/CombatVfxPlayer.ts` — bounded one-shot VFX playback and cleanup.
- `src/game/visuals/CombatVfxPlayer.test.ts` — no-body, expiry, cap, pause, and destroy tests.

### Existing runtime files

- `src/game/assets/combatAssetManifest.ts` — combine static, actor-sheet, orb-layer, and VFX assets; load sheets correctly.
- `src/game/assets/combatAssetManifest.test.ts` — image/sheet loader, sampling, and exhaustive asset coverage.
- `src/game/config/gameTuning.ts` — actor motion, orb layer, and VFX tuning.
- `src/game/config/gameTuning.test.ts` — new tuning validation.
- `src/game/scenes/CombatScene.ts` — register actors, route player and semantic feedback states, own `CombatVfxPlayer`.
- `src/game/scenes/combatSceneRules.test.ts` — visual-event mapping rules.
- `src/game/enemies/EnemyManager.ts` — active enemy state transitions; no delayed gameplay death.
- `src/game/enemies/EnemyManager.test.ts` — state transitions and invariant collision geometry.
- `src/game/orbs/OrbManager.ts` — delegate all non-physics orb presentation to `OrbVisuals`.
- `src/game/orbs/OrbManager.test.ts` — integration and removal/cleanup checks.
- `src/game/bosses/BossManager.ts` — Sentinel/Siege part state transitions.
- `src/game/bosses/BossManager.test.ts` — part state and fixed geometry.
- `src/game/bosses/HiveBossManager.ts` — Hive module, reflector, and core state transitions.
- `src/game/bosses/HiveBossManager.test.ts` — phase animation and fixed geometry.
- `e2e/combat.spec.ts` — representative animation, all orb identities, dense mobile ownership, and leak gates.

### Asset and pipeline files

- `assets-source/combat/actors/<role>/default.png` — authored 1× pixel sheet masters.
- `public/assets/combat/actors/<role>/default.png` — deterministic 2× runtime sheets.
- `assets-source/combat/orbs-hd/<orb-id>/body.png` — approved 256px body master.
- `assets-source/combat/orbs-hd/<orb-id>/<layer-id>.png` — transparent animated layer masters.
- `public/assets/combat/orbs/<orb-id>/*.png` — 64px runtime body/layers.
- `assets-source/combat/vfx/<event-id>.png` — transparent smooth VFX sheet masters.
- `public/assets/combat/vfx/<event-id>.png` — runtime VFX sheets.
- `scripts/render_gbc_combat_art.sh` — extend the existing exporter with 2× nearest actor and Lanczos orb/VFX modes.
- `scripts/verify_gbc_combat_art.sh` — extend existing dimensions, alpha, block, and asset coverage checks.
- `scripts/combat_art_assets.sh` — add centralized animation source/runtime selection.
- `scripts/combat_art_assets.test.sh` — add deterministic animation fixture coverage.

---

### Task 1: Define Actor Skin And Orb Visual Registries

**Files:**
- Create: `src/game/visuals/actorVisualProfiles.ts`
- Create: `src/game/visuals/actorVisualProfiles.test.ts`
- Create: `src/game/visuals/orbVisualProfiles.ts`
- Create: `src/game/visuals/orbVisualProfiles.test.ts`
- Create: `src/game/visuals/combatVfxIds.ts`

**Interfaces:**
- Consumes: `OrbTypeId`, `ORB_CORE_IDS`, `FUSION_ORB_IDS`, current role display sizes from `GAME_TUNING`.
- Produces: `ActorRole`, `ActorState`, `ActorSkinProfile`, `ACTOR_SKIN_PROFILES`, `actorSkinProfile()`, `CombatVfxId`, `OrbVisualProfile`, `ORB_VISUAL_PROFILES`, `orbVisualProfile()`.

- [ ] **Step 1: Write failing actor registry tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  ACTOR_SKIN_PROFILES,
  REQUIRED_ACTOR_STATES,
  actorSkinProfile,
} from './actorVisualProfiles';

describe('actor visual profiles', () => {
  it('ships one complete default skin for every combat role', () => {
    for (const [role, required] of Object.entries(REQUIRED_ACTOR_STATES)) {
      const profile = actorSkinProfile(role as keyof typeof REQUIRED_ACTOR_STATES, 'default');
      expect(profile.role).toBe(role);
      expect(profile.skinId).toBe('default');
      expect(required.every((state) => profile.states[state])).toBe(true);
      expect(profile.frameWidth).toBeGreaterThan(0);
      expect(profile.frameHeight).toBeGreaterThan(0);
    }
    expect(new Set(ACTOR_SKIN_PROFILES.map(({ role }) => role)).size)
      .toBe(Object.keys(REQUIRED_ACTOR_STATES).length);
  });

  it('rejects an unknown skin instead of silently changing role geometry', () => {
    expect(() => actorSkinProfile('player', 'missing')).toThrow('unknown player skin: missing');
  });
});
```

- [ ] **Step 2: Write failing orb registry tests**

```ts
import { describe, expect, it } from 'vitest';
import { ORB_CORE_IDS } from '../orbs/orbCoreRules';
import { FUSION_ORB_IDS } from '../orbs/orbFusionRules';
import { ORB_VISUAL_PROFILES, orbVisualProfile } from './orbVisualProfiles';

describe('orb visual profiles', () => {
  it('covers every current orb exactly once with a distinct identity', () => {
    const ids = [...ORB_CORE_IDS, ...FUSION_ORB_IDS];
    expect(Object.keys(ORB_VISUAL_PROFILES).sort()).toEqual([...ids].sort());
    expect(new Set(ids.map((id) => orbVisualProfile(id).identity)).size).toBe(ids.length);
    expect(ids.every((id) => orbVisualProfile(id).layers.length > 0)).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests and verify RED**

Run:

```bash
rtk npx vitest run src/game/visuals/actorVisualProfiles.test.ts src/game/visuals/orbVisualProfiles.test.ts
```

Expected: FAIL because both profile modules are missing.

- [ ] **Step 4: Implement the actor profile contract**

Create these exact public shapes:

```ts
export type ActorRole =
  | 'player'
  | 'enemy-basic' | 'enemy-armored' | 'enemy-shooter'
  | 'enemy-splitter' | 'enemy-fragment-left' | 'enemy-fragment-right'
  | 'sentinel-body' | 'sentinel-left-weakpoint' | 'sentinel-right-weakpoint' | 'sentinel-core'
  | 'hive-core' | 'hive-left-shooter' | 'hive-right-shooter'
  | 'hive-left-reflector' | 'hive-right-reflector'
  | 'siege-body' | 'siege-left-weakpoint' | 'siege-right-weakpoint' | 'siege-core';

export type ActorState =
  | 'idle' | 'move' | 'launch' | 'recover' | 'hurt' | 'destroyed' | 'defeated'
  | 'charge' | 'fire' | 'brace' | 'fracture' | 'split'
  | 'attack' | 'broken' | 'exposed' | 'enraged';

export interface ActorAnimationState {
  frames: readonly number[];
  frameRate: number;
  repeat: number;
}

export interface ActorSkinProfile {
  role: ActorRole;
  skinId: string;
  textureKey: string;
  url: string;
  frameWidth: number;
  frameHeight: number;
  displayWidth: number;
  displayHeight: number;
  states: Readonly<Partial<Record<ActorState, ActorAnimationState>>>;
}

export function actorAnimationKey(role: ActorRole, skinId: string, state: ActorState): string {
  return `actor:${role}:${skinId}:${state}`;
}

export function actorSkinProfile(role: ActorRole, skinId = 'default'): ActorSkinProfile {
  const profile = ACTOR_SKIN_PROFILES.find((candidate) => (
    candidate.role === role && candidate.skinId === skinId
  ));
  if (!profile) throw new RangeError(`unknown ${role} skin: ${skinId}`);
  return profile;
}
```

Define `REQUIRED_ACTOR_STATES` from the design state table. Every shipped profile uses `default` and exact current role display dimensions.

- [ ] **Step 5: Implement the orb profile contract**

First create `combatVfxIds.ts` as the single ID owner. Task 9 adds profiles and playback; it does not redefine these IDs.

```ts
export const REQUIRED_COMBAT_VFX_IDS = [
  'player-launch', 'player-recover', 'player-hit', 'player-defeat',
  'orb-ricochet', 'orb-direct-hit',
  'enemy-hit', 'enemy-break', 'shooter-charge', 'shooter-fire',
  'armored-brace', 'splitter-fracture',
  'boss-module-break', 'boss-core-rage', 'boss-defeat',
  'echo-ring', 'corrosion-cloud', 'conduction-arc',
  'inertia-compression', 'split-burst', 'explosion-burst',
  'photon-beam', 'photon-intersection',
  'resonant-spawn', 'resonant-final',
  'nano-seed', 'nano-spread', 'mass-collapse',
  'reactor-charge', 'reactor-blast',
  'cluster-projectile', 'cluster-impact',
  'mirror-node', 'mirror-intersection',
  'meltdown-eruption', 'vector-blade',
] as const;

export type CombatVfxId = (typeof REQUIRED_COMBAT_VFX_IDS)[number];
```

```ts
export type OrbLayerMotion =
  | { kind: 'spin'; direction: 1 | -1; radiansPerSecond: number }
  | { kind: 'pulse'; periodMs: number; alphaMinimum: number; alphaMaximum: number }
  | { kind: 'orbit'; periodMs: number; radius: number; phase: number }
  | { kind: 'frames'; frameRate: number };

export interface OrbVisualLayerProfile {
  id: string;
  textureKey: string;
  url: string;
  frameConfig?: { frameWidth: number; frameHeight: number };
  motion: OrbLayerMotion;
  blendMode: 'ADD' | 'NORMAL';
  scale: number;
}

export interface OrbVisualProfile {
  id: OrbTypeId;
  identity: string;
  bodyTextureKey: string;
  bodyUrl: string;
  layers: readonly OrbVisualLayerProfile[];
  trailVfx: CombatVfxId;
  hitVfx: CombatVfxId;
  procVfx: CombatVfxId;
}

export const ORB_VISUAL_PROFILES = {
  echo: echoProfile,
  corrosion: corrosionProfile,
  conduction: conductionProfile,
  inertia: inertiaProfile,
  split: splitProfile,
  explosion: explosionProfile,
  'photon-orbit': photonOrbitProfile,
  'resonant-swarm': resonantSwarmProfile,
  'nano-proliferator': nanoProliferatorProfile,
  'mass-collapse': massCollapseProfile,
  'reactor-orb': reactorOrbProfile,
  'cluster-bombardment': clusterBombardmentProfile,
  'mirror-circuit': mirrorCircuitProfile,
  'meltdown-core': meltdownCoreProfile,
  'vector-blade': vectorBladeProfile,
} as const satisfies Record<OrbTypeId, OrbVisualProfile>;

export function orbVisualProfile(id: OrbTypeId): OrbVisualProfile {
  return ORB_VISUAL_PROFILES[id];
}
```

Use the exact identities and motion concepts from section 6 of the spec. Every profile uses `orb-ricochet` for its trail, `orb-direct-hit` for its hit, and its matching semantic proc ID from Task 9. Asset existence becomes a hard gate as each asset family lands in Tasks 3, 4, 7, 8, and 9.

- [ ] **Step 6: Run tests and commit**

```bash
rtk npx vitest run src/game/visuals/actorVisualProfiles.test.ts src/game/visuals/orbVisualProfiles.test.ts
rtk git add src/game/visuals/actorVisualProfiles.ts src/game/visuals/actorVisualProfiles.test.ts src/game/visuals/orbVisualProfiles.ts src/game/visuals/orbVisualProfiles.test.ts src/game/visuals/combatVfxIds.ts
rtk git commit -m "feat(visuals): register actors and orbs"
```

Expected: PASS.

---

### Task 2: Extend Asset Loading And Add The Animation Pipeline

**Files:**
- Modify: `src/game/assets/combatAssetManifest.ts`
- Modify: `src/game/assets/combatAssetManifest.test.ts`
- Modify: `scripts/render_gbc_combat_art.sh`
- Modify: `scripts/verify_gbc_combat_art.sh`
- Modify: `scripts/combat_art_assets.sh`
- Modify: `scripts/combat_art_assets.test.sh`

**Interfaces:**
- Consumes: `ACTOR_SKIN_PROFILES`, `ORB_VISUAL_PROFILES`.
- Produces: `CombatSheetAsset`, combined `COMBAT_IMAGE_ASSETS`, deterministic render and verification commands.

- [ ] **Step 1: Write failing loader tests**

```ts
it('loads actor and framed layer profiles as sprite sheets, and static layers as images', () => {
  const image = vi.fn();
  const spritesheet = vi.fn();
  preloadCombatAssets({ load: { image, spritesheet, audio: vi.fn() } } as never);

  expect(spritesheet).toHaveBeenCalledWith(
    'actor-player-default',
    '/assets/combat/actors/player/default.png',
    { frameWidth: 82, frameHeight: 82 },
  );
  expect(spritesheet).toHaveBeenCalledWith(
    'orb-conduction-arc',
    '/assets/combat/orbs/conduction/arc.png',
    { frameWidth: 64, frameHeight: 64 },
  );
});
```

Keep existing sampling assertions and add: every actor asset is `nearest`; every orb layer and VFX asset is `linear`. A layer with `frameConfig` is loaded through `spritesheet` while retaining linear texture filtering.

- [ ] **Step 2: Run the focused test and verify RED**

```bash
rtk npx vitest run src/game/assets/combatAssetManifest.test.ts
```

Expected: FAIL because sprite-sheet assets and profile-derived assets are not loaded.

- [ ] **Step 3: Extend the manifest without a second loader**

```ts
export interface CombatSheetAsset extends CombatImageAsset {
  frameConfig: { frameWidth: number; frameHeight: number };
}

export type CombatRasterAsset = CombatImageAsset | CombatSheetAsset;

function isSheet(asset: CombatRasterAsset): asset is CombatSheetAsset {
  return 'frameConfig' in asset;
}

export function preloadCombatAssets(scene: Phaser.Scene): void {
  for (const asset of COMBAT_IMAGE_ASSETS) {
    if (isSheet(asset)) scene.load.spritesheet(asset.key, asset.url, asset.frameConfig);
    else scene.load.image(asset.key, asset.url);
  }
  for (const { key, urls } of COMBAT_AUDIO_ASSETS) scene.load.audio(key, [...urls]);
}
```

Build profile-derived asset arrays with `flatMap`, then combine them with the existing background, projectile, and HUD assets. Reject duplicate texture keys in the manifest test.

- [ ] **Step 4: Write the pipeline contract before the scripts**

`scripts/combat_art_assets.test.sh` must validate one generated actor-sheet fixture and one smooth-layer fixture in a temporary directory, then assert deterministic output through the existing pipeline:

```bash
rtk bash scripts/render_gbc_combat_art.sh --fixture-directory "$FIXTURE_DIRECTORY"
rtk bash scripts/verify_gbc_combat_art.sh --fixture-directory "$FIXTURE_DIRECTORY"
rtk cmp "$EXPECTED_ACTOR" "$ACTUAL_ACTOR"
rtk cmp "$EXPECTED_LAYER" "$ACTUAL_LAYER"
```

The fixture option is test-only and never touches production assets. The normal render command exports actor masters at exactly 2× with nearest-neighbor filtering and strips PNG time metadata. It exports 256px orb/VFX masters to their declared runtime sizes with Lanczos filtering and strips time metadata. Production verification accepts only these scopes: `actor-core`, `actor-boss`, `orb-base`, `orb-fusion`, `vfx`, and `all`; an unknown scope exits non-zero.

- [ ] **Step 5: Implement verification**

For every actor profile, verify:

- runtime height equals `frameHeight`;
- runtime width is divisible by `frameWidth`;
- frame count covers the greatest declared frame index;
- the PNG has alpha;
- no opaque pixel exists outside the role frame box.

For every orb layer and VFX profile, verify declared runtime dimensions, alpha, and transparent corners. Exit non-zero with the texture key in the message.

- [ ] **Step 6: Run focused checks and commit**

```bash
rtk npx vitest run src/game/assets/combatAssetManifest.test.ts
rtk bash scripts/combat_art_assets.test.sh
rtk git add src/game/assets/combatAssetManifest.ts src/game/assets/combatAssetManifest.test.ts src/game/visuals/orbVisualProfiles.ts scripts/render_gbc_combat_art.sh scripts/verify_gbc_combat_art.sh scripts/combat_art_assets.sh scripts/combat_art_assets.test.sh
rtk git commit -m "build(visuals): add animation asset pipeline"
```

Expected: manifest and isolated pipeline fixtures PASS. Production asset completeness is checked per asset family in the later authoring tasks and for the entire registry in Task 10.

---

### Task 3: Author The Default Player And Enemy Sheets

**Files:**
- Create: `assets-source/combat/actors/player/default.png`
- Create: `assets-source/combat/actors/enemy-basic/default.png`
- Create: `assets-source/combat/actors/enemy-armored/default.png`
- Create: `assets-source/combat/actors/enemy-shooter/default.png`
- Create: `assets-source/combat/actors/enemy-splitter/default.png`
- Create: `assets-source/combat/actors/enemy-fragment-left/default.png`
- Create: `assets-source/combat/actors/enemy-fragment-right/default.png`
- Create: matching files under `public/assets/combat/actors/`
- Modify: `src/game/visuals/actorVisualProfiles.ts`
- Modify: `src/game/visuals/actorVisualProfiles.test.ts`

**Interfaces:**
- Consumes: approved static player/enemy sprites and Task 1 profile contract.
- Produces: complete `default` sheets for the core cast.

- [ ] **Step 1: Lock exact frame maps in tests**

Assert these frame totals and required state slices:

| Role | Frame total | States |
| --- | ---: | --- |
| player | 20 | idle 0-3, move 4-7, launch 8-10, recover 11-13, hurt 14-15, defeated 16-19 |
| enemy-basic | 9 | idle 0-2, hurt 3-4, destroyed 5-8 |
| enemy-armored | 11 | idle 0-2, brace 3-4, hurt 5-6, destroyed 7-10 |
| enemy-shooter | 15 | idle 0-2, charge 3-5, fire 6-8, hurt 9-10, destroyed 11-14 |
| enemy-splitter | 14 | idle 0-2, fracture 3-5, split 6-9, destroyed 10-13 |
| each fragment | 7 | idle 0-1, hurt 2-3, destroyed 4-6 |

- [ ] **Step 2: Run profile and asset checks and verify RED**

```bash
rtk npx vitest run src/game/visuals/actorVisualProfiles.test.ts
rtk bash scripts/verify_gbc_combat_art.sh --animation-scope actor-core
```

Expected: FAIL listing the missing core-cast actor sheets.

- [ ] **Step 3: Produce source frames**

Use `game-studio:sprite-pipeline`. Start from the current approved static sprite as the idle reference. Author key frames individually; do not ask image generation for a full strip. Preserve the exact outer frame, paired-eye visor, pixel cluster size, and role color.

Motion requirements:

- player: engine/visor idle, directional chassis compression for move, chamber recoil for launch, intake pulse for recover, white/coral hurt, powered-down defeated;
- basic: weight shift and visor blink;
- armored: slow weight shift and inward brace;
- shooter: warning lamp sequence and contained barrel recoil;
- splitter: center seam widening before two halves separate;
- fragments: inherited half-face pulse and short collapse.

- [ ] **Step 4: Normalize and export**

```bash
rtk bash scripts/render_gbc_combat_art.sh --animation-scope actor-core
rtk bash scripts/verify_gbc_combat_art.sh --animation-scope actor-core
```

Inspect every sheet at runtime 1×. Reject a frame if limbs leave the collision footprint, neighboring animation frames change the outer body size, or the visor becomes unreadable.

- [ ] **Step 5: Run tests and commit**

```bash
rtk npx vitest run src/game/visuals/actorVisualProfiles.test.ts src/game/assets/combatAssetManifest.test.ts
rtk git add assets-source/combat/actors public/assets/combat/actors src/game/visuals/actorVisualProfiles.ts src/game/visuals/actorVisualProfiles.test.ts
rtk git commit -m "art: animate the default combat cast"
```

Expected: PASS for all core-cast profiles and files.

---

### Task 4: Author All Three Boss Animation Families

**Files:**
- Create: default sheets for every Sentinel, Hive, and Siege role listed in `ActorRole` under `assets-source/combat/actors/`
- Create: matching runtime sheets under `public/assets/combat/actors/`
- Modify: `src/game/visuals/actorVisualProfiles.ts`
- Modify: `src/game/visuals/actorVisualProfiles.test.ts`

**Interfaces:**
- Consumes: boss geometry and part names from `BossManager`, `HiveBossManager`, `bossGeometry`, and `hiveBossGeometry`.
- Produces: all boss default sheets with equal-size frames and fixed anchors.

- [ ] **Step 1: Lock boss state maps in tests**

Use these state groups:

- Sentinel and Siege body: idle 3 frames, attack 3, hurt 2, broken 4.
- Sentinel and Siege weakpoints: idle 2, attack 3, hurt 2, broken 4.
- Sentinel and Siege core: idle 3, exposed 3, enraged 4, defeated 4.
- Hive core: idle 3, exposed 3, enraged 4, defeated 4.
- Hive shooters: idle 2, charge 3, fire 3, hurt 2, broken 4.
- Hive reflectors: idle 3, attack 3, hurt 2, broken 4.

Assert each profile frame size equals its current visible part size and each required state has at least two frames.

- [ ] **Step 2: Run profile and asset checks and verify RED**

```bash
rtk npx vitest run src/game/visuals/actorVisualProfiles.test.ts
rtk bash scripts/verify_gbc_combat_art.sh --animation-scope actor-boss
```

Expected: FAIL listing each missing boss sheet.

- [ ] **Step 3: Produce boss concepts and key frames**

Use existing approved mechanical-occult family art. For Hive and Siege, first produce one intact and one exposed reference composition so every module shares the same body language. Then author frames per physical part.

Part rules:

- removed parts leave a readable hole; no replacement decoration fills it;
- broken frames are visual clones only and never remain collidable;
- exposed and enraged cores increase energy movement, not physical size;
- reflector and shooter frames never extend outside their configured hitboxes.

- [ ] **Step 4: Export, verify, and inspect**

```bash
rtk bash scripts/render_gbc_combat_art.sh --animation-scope actor-boss
rtk bash scripts/verify_gbc_combat_art.sh --animation-scope actor-boss
```

Create intact, partially broken, and core-only montages for all three bosses. Inspect at `450 × 800` game size.

- [ ] **Step 5: Commit boss assets**

```bash
rtk npx vitest run src/game/visuals/actorVisualProfiles.test.ts src/game/assets/combatAssetManifest.test.ts
rtk git add assets-source/combat/actors public/assets/combat/actors src/game/visuals/actorVisualProfiles.ts src/game/visuals/actorVisualProfiles.test.ts
rtk git commit -m "art: animate all boss families"
```

Expected: all actor profiles and animation assets PASS verification.

---

### Task 5: Drive Actor States Without Changing Physics

**Files:**
- Create: `src/game/visuals/registerActorAnimations.ts`
- Create: `src/game/visuals/registerActorAnimations.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `src/game/enemies/EnemyManager.ts`
- Modify: `src/game/enemies/EnemyManager.test.ts`
- Modify: `src/game/bosses/BossManager.ts`
- Modify: `src/game/bosses/BossManager.test.ts`
- Modify: `src/game/bosses/HiveBossManager.ts`
- Modify: `src/game/bosses/HiveBossManager.test.ts`
- Modify: `src/game/orbs/OrbManager.ts`
- Modify: `src/game/orbs/OrbManager.test.ts`
- Modify: `e2e/combat.spec.ts`

**Interfaces:**
- Consumes: `ActorSkinProfile`, `actorAnimationKey()`, actor sheets.
- Produces: `registerActorAnimations(scene)`, `playActorState(sprite, role, state, skinId?)`, semantic player launch callback.

- [ ] **Step 1: Write failing animation registration tests**

```ts
it('registers each declared state once and falls back only to idle', () => {
  registerActorAnimations(scene);
  expect(createdKeys).toContain('actor:player:default:launch');
  expect(playActorState(sprite, 'enemy-basic', 'charge')).toBe('actor:enemy-basic:default:idle');
  expect(playActorState(sprite, 'enemy-shooter', 'charge')).toBe('actor:enemy-shooter:default:charge');
});
```

Assert a second `registerActorAnimations(scene)` call creates no duplicate keys.

- [ ] **Step 2: Write failing manager state tests**

Add tests that assert:

- player begins `idle`, movement selects `move`, launch callback selects `launch`, recovery selects `recover`, damage selects `hurt`;
- shooter warning selects `charge` and fire selects `fire`;
- armored direct hit selects `brace` before returning to `idle`;
- splitter lethal hit emits a non-physics `fracture` visual before fragments spawn;
- boss part damage selects `hurt`, removed module emits `broken`, exposed core selects `exposed`, permanent exposure selects `enraged`.

Capture body center, width, and height before and after every state change and require exact equality.

- [ ] **Step 3: Run focused tests and verify RED**

```bash
rtk npx vitest run src/game/visuals/registerActorAnimations.test.ts src/game/enemies/EnemyManager.test.ts src/game/orbs/OrbManager.test.ts src/game/bosses/BossManager.test.ts src/game/bosses/HiveBossManager.test.ts
```

Expected: FAIL because animation registration and semantic transitions do not exist.

- [ ] **Step 4: Register and play actor states**

```ts
export function registerActorAnimations(scene: Phaser.Scene): void {
  for (const profile of ACTOR_SKIN_PROFILES) {
    for (const [state, animation] of Object.entries(profile.states)) {
      const key = actorAnimationKey(profile.role, profile.skinId, state as ActorState);
      if (scene.anims.exists(key)) continue;
      scene.anims.create({
        key,
        frames: animation!.frames.map((frame) => ({ key: profile.textureKey, frame })),
        frameRate: animation!.frameRate,
        repeat: animation!.repeat,
      });
    }
  }
}

export function playActorState(
  sprite: Phaser.Physics.Arcade.Sprite,
  role: ActorRole,
  state: ActorState,
  skinId = 'default',
): string {
  const profile = actorSkinProfile(role, skinId);
  const resolved = profile.states[state] ? state : 'idle';
  const key = actorAnimationKey(role, skinId, resolved);
  sprite.play(key, true);
  return key;
}
```

- [ ] **Step 5: Route existing semantic state changes**

Add `onLaunch?: (orbId: number) => void` to `OrbManagerOptions` and call it only when a queued permanent orb becomes active. Use existing recovery callback for `recover`.

In managers, call `playActorState` at the existing warning, fire, direct-hit, part-damage, phase-transition, and defeat boundaries. Do not delay `destroyEnemy`, fragment spawning, boss part removal, or damage resolution. When gameplay destroys an object immediately, create a texture-only visual clone for its terminal animation.

- [ ] **Step 6: Add one browser invariant test**

Extend `@desktop animates combat art without changing collision bodies` to trigger player launch, shooter fire, armored hit, splitter fracture, and boss core exposure. Assert animation keys change while physics rectangles remain byte-for-byte equal.

- [ ] **Step 7: Run the first browser checkpoint and commit**

```bash
rtk npx vitest run src/game/visuals/registerActorAnimations.test.ts src/game/enemies/EnemyManager.test.ts src/game/orbs/OrbManager.test.ts src/game/bosses/BossManager.test.ts src/game/bosses/HiveBossManager.test.ts
rtk npm run test:e2e -- --project=desktop-chromium --grep "animates combat art"
rtk git add src/game/visuals src/game/scenes/CombatScene.ts src/game/enemies/EnemyManager.ts src/game/enemies/EnemyManager.test.ts src/game/orbs/OrbManager.ts src/game/orbs/OrbManager.test.ts src/game/bosses e2e/combat.spec.ts
rtk git commit -m "feat(visuals): drive actor animation states"
```

Expected: focused unit tests and one browser test PASS.

---

### Task 6: Move Permanent Orb Presentation Into OrbVisuals

**Files:**
- Create: `src/game/visuals/OrbVisuals.ts`
- Create: `src/game/visuals/OrbVisuals.test.ts`
- Modify: `src/game/config/gameTuning.ts`
- Modify: `src/game/config/gameTuning.test.ts`
- Modify: `src/game/orbs/OrbManager.ts`
- Modify: `src/game/orbs/OrbManager.test.ts`

**Interfaces:**
- Consumes: `OrbVisualProfile`, `OrbVisualLayerProfile`, live `OrbSnapshot` and owning physics sprite.
- Produces: `OrbVisuals.add()`, `update()`, `remove()`, `clear()`, `activeObjectCount()`.

- [ ] **Step 1: Write failing OrbVisuals lifecycle tests**

```ts
it('tracks layers to the owning sprite without creating physics bodies', () => {
  const visuals = new OrbVisuals(scene);
  visuals.add(7, sprite, orbVisualProfile('conduction'));
  visuals.update(260, [{ id: 7, visible: true, rotation: 0.5 }]);

  expect(children.every((child) => child.body === undefined)).toBe(true);
  expect(children.every((child) => child.x === sprite.x && child.y === sprite.y)).toBe(true);
  expect(children.some((child) => child.rotation !== 0)).toBe(true);
  expect(children.some((child) => child.alpha > 0)).toBe(true);
});

it('removes every layer when an orb fuses or the manager is destroyed', () => {
  const visuals = new OrbVisuals(scene);
  visuals.add(1, first, orbVisualProfile('echo'));
  visuals.add(2, second, orbVisualProfile('conduction'));
  visuals.remove(2);
  expect(visuals.activeObjectCount()).toBeGreaterThan(0);
  visuals.clear();
  expect(visuals.activeObjectCount()).toBe(0);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

```bash
rtk npx vitest run src/game/visuals/OrbVisuals.test.ts src/game/orbs/OrbManager.test.ts
```

Expected: FAIL because `OrbVisuals` does not exist.

- [ ] **Step 3: Implement the focused companion owner**

`OrbVisuals` stores one body companion and declared layer objects per orb ID. `update()` reads current owner position, visibility, and body rotation, then applies the four motion descriptor kinds from Task 1. `remove()` destroys only the selected orb layers; `clear()` destroys all objects and clears maps.

Move the current aura map and pulse math out of `OrbManager`. `OrbManager` retains physics sprite creation, rotation based on travel distance, collision setup, and store synchronization. It calls `OrbVisuals.add` after sprite creation, `remove` after fusion, `update` once per gameplay update, and `clear` on destroy.

- [ ] **Step 4: Add central motion validation**

Under `GAME_TUNING.visual.orbAnimation`, define:

```ts
{
  maximumLayersPerOrb: 4,
  maximumParticlesPerOrb: 3,
  mobileMaximumOrbVisualObjects: 48,
  trailIntervalMs: 48,
  trailLifetimeMs: 180,
}
```

Validate positive integers and require every profile to stay within the layer cap.

- [ ] **Step 5: Run tests and commit**

```bash
rtk npx vitest run src/game/visuals/OrbVisuals.test.ts src/game/orbs/OrbManager.test.ts src/game/config/gameTuning.test.ts
rtk git add src/game/visuals/OrbVisuals.ts src/game/visuals/OrbVisuals.test.ts src/game/orbs/OrbManager.ts src/game/orbs/OrbManager.test.ts src/game/config/gameTuning.ts src/game/config/gameTuning.test.ts
rtk git commit -m "refactor(orbs): isolate visual layers"
```

Expected: PASS; existing orb physics tests remain unchanged.

---

### Task 7: Produce And Wire The Six Base Orb Animations

**Files:**
- Create: `assets-source/combat/orbs-hd/<base-id>/body.png` and declared layer masters for all six base IDs
- Create: matching runtime files under `public/assets/combat/orbs/<base-id>/`
- Modify: `src/game/visuals/orbVisualProfiles.ts`
- Modify: `src/game/visuals/orbVisualProfiles.test.ts`

**Interfaces:**
- Consumes: approved current 256px bodies, Task 1 profiles, Task 6 `OrbVisuals`.
- Produces: six visually distinct always-on animations and base trail/hit/proc layer assets.

- [ ] **Step 1: Lock each base profile in tests**

Assert exact motion identities:

```ts
expect(orbVisualProfile('conduction').layers.map(({ id, motion }) => [id, motion.kind]))
  .toEqual([['arc', 'frames'], ['flow', 'spin']]);
expect(orbVisualProfile('corrosion').layers.map(({ id, motion }) => [id, motion.kind]))
  .toEqual([['bubbles', 'frames'], ['gas', 'spin']]);
```

Add equivalent assertions for echo ring/pulse, inertia counter-spin, split dual orbit, and explosion heat/pulse.

- [ ] **Step 2: Verify RED asset coverage**

```bash
rtk npx vitest run src/game/visuals/orbVisualProfiles.test.ts src/game/assets/combatAssetManifest.test.ts
rtk bash scripts/verify_gbc_combat_art.sh --animation-scope orb-base
```

Expected: FAIL listing missing base-orb layer files.

- [ ] **Step 3: Produce separated high-resolution layers**

Use each approved 256px body as the reference image. Generate or edit only the named transparent energy layer; do not regenerate the body and do not add micro-glyphs.

- echo: inner lens pulse and outer ring;
- corrosion: three broad bubbles and one soft gas band;
- conduction: 4-frame crawling arc and one clockwise flow band;
- inertia: inner flywheel and counter-rotating outer ticks;
- split: two nucleus layers offset for orbit;
- explosion: heat core and sparse 4-frame spark layer.

Each layer must remain readable at 42px display size and stay inside the configured non-collision aura.

- [ ] **Step 4: Export and inspect at game size**

```bash
rtk bash scripts/render_gbc_combat_art.sh --animation-scope orb-base
rtk bash scripts/verify_gbc_combat_art.sh --animation-scope orb-base
```

Render one six-orb montage at 42px display size and reject any pair that reads as the same motion. Runtime browser coverage waits until all 15 profiles exist in Task 8.

- [ ] **Step 5: Commit base orb animations**

```bash
rtk git add assets-source/combat/orbs-hd public/assets/combat/orbs src/game/visuals/orbVisualProfiles.ts src/game/visuals/orbVisualProfiles.test.ts
rtk git commit -m "art(orbs): animate all base cores"
```

Expected: base profile, asset, and browser checks PASS.

---

### Task 8: Produce And Wire The Nine Fusion Orb Animations

**Files:**
- Create: `assets-source/combat/orbs-hd/<fusion-id>/body.png` and declared layer masters for all nine fusion IDs
- Create: matching runtime files under `public/assets/combat/orbs/<fusion-id>/`
- Modify: `src/game/visuals/orbVisualProfiles.ts`
- Modify: `src/game/visuals/orbVisualProfiles.test.ts`
- Modify: `e2e/combat.spec.ts`

**Interfaces:**
- Consumes: approved fusion body assets and existing fusion combat definitions.
- Produces: nine unique fusion idle animations and profile-bound semantic VFX IDs.

- [ ] **Step 1: Lock fusion identities in tests**

Assert that all nine IDs have unique `identity` strings, at least two animated layers, and these required layer IDs:

```ts
const required = {
  'photon-orbit': ['halo', 'axis'],
  'resonant-swarm': ['nuclei', 'phase'],
  'nano-proliferator': ['branches', 'growth'],
  'mass-collapse': ['gravity-ring', 'shadow'],
  'reactor-orb': ['channels', 'charge'],
  'cluster-bombardment': ['pods', 'sequence'],
  'mirror-circuit': ['mirror', 'circuit'],
  'meltdown-core': ['molten-band', 'heat'],
  'vector-blade': ['blade-axis', 'direction'],
} as const;
```

- [ ] **Step 2: Verify RED asset coverage**

```bash
rtk npx vitest run src/game/visuals/orbVisualProfiles.test.ts src/game/assets/combatAssetManifest.test.ts
rtk bash scripts/verify_gbc_combat_art.sh --animation-scope orb-fusion
```

Expected: FAIL listing missing fusion layer files.

- [ ] **Step 3: Produce layers from approved fusion bodies**

Create only broad transparent energy layers matching section 6.2 of the spec. Use no more than four layers and three transient particles per orb. Preserve the body sphere and its current 32px collision core.

- [ ] **Step 4: Export and run the second browser checkpoint**

```bash
rtk bash scripts/render_gbc_combat_art.sh --animation-scope orb-fusion
rtk bash scripts/verify_gbc_combat_art.sh --animation-scope orb-fusion
rtk npm run test:e2e -- --project=desktop-chromium --grep "fusion orb animation identities"
```

The test creates every fusion through `debugFuseOrbs`, advances one full animation period, asserts visible layer movement with no bodies, and captures a 15-orb comparison montage.

- [ ] **Step 5: Commit fusion animations**

```bash
rtk git add assets-source/combat/orbs-hd public/assets/combat/orbs src/game/visuals/orbVisualProfiles.ts src/game/visuals/orbVisualProfiles.test.ts e2e/combat.spec.ts
rtk git commit -m "art(orbs): animate all fusion cores"
```

Expected: all 15 orb profiles and assets PASS.

---

### Task 9: Add Bounded Common, Orb, And Boss VFX

**Files:**
- Create: `src/game/visuals/combatVfxProfiles.ts`
- Create: `src/game/visuals/combatVfxProfiles.test.ts`
- Create: `src/game/visuals/CombatVfxPlayer.ts`
- Create: `src/game/visuals/CombatVfxPlayer.test.ts`
- Create: VFX masters under `assets-source/combat/vfx/`
- Create: runtime VFX sheets under `public/assets/combat/vfx/`
- Modify: `src/game/config/gameTuning.ts`
- Modify: `src/game/config/gameTuning.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `src/game/scenes/combatSceneRules.test.ts`
- Modify: `src/game/enemies/EnemyManager.ts`
- Modify: `src/game/bosses/BossManager.ts`
- Modify: `src/game/bosses/HiveBossManager.ts`
- Modify: `e2e/combat.spec.ts`

**Interfaces:**
- Consumes: current named feedback calls and persistent effect state owners.
- Produces: `COMBAT_VFX_PROFILES`, `CombatVfxPlayer.play()`, `clear()`, `activeCount()` using the `CombatVfxId` declared in Task 1.

- [ ] **Step 1: Write exhaustive VFX profile tests**

Import `REQUIRED_COMBAT_VFX_IDS` and `CombatVfxId` from `combatVfxIds.ts`. Require exactly one profile for every ID and reject extra profile keys.

Every profile declares texture key, frame size, frame count, frame rate, duration, blend mode, depth, scale, and maximum concurrent instances.

- [ ] **Step 2: Write CombatVfxPlayer lifecycle tests**

```ts
it('creates no physics body, enforces the per-effect cap, and expires', () => {
  const player = new CombatVfxPlayer(scene);
  for (let index = 0; index < 20; index += 1) {
    player.play('orb-direct-hit', { position: { x: index, y: 40 }, direction: { x: 1, y: 0 }, intensity: 1 });
  }
  expect(objects.every((object) => object.body === undefined)).toBe(true);
  expect(player.activeCount('orb-direct-hit')).toBeLessThanOrEqual(
    COMBAT_VFX_PROFILES['orb-direct-hit'].maximumConcurrent,
  );
  time.advance(COMBAT_VFX_PROFILES['orb-direct-hit'].durationMs);
  expect(player.activeCount()).toBe(0);
});
```

Add tests for `clear()` and paused scene cleanup.

- [ ] **Step 3: Run focused tests and verify RED**

```bash
rtk npx vitest run src/game/visuals/combatVfxProfiles.test.ts src/game/visuals/CombatVfxPlayer.test.ts src/game/scenes/combatSceneRules.test.ts
```

Expected: FAIL because profiles and player do not exist.

- [ ] **Step 4: Implement the bounded player and central tuning**

```ts
export interface CombatVfxContext {
  position: Vector;
  direction?: Vector;
  intensity: number;
}

export class CombatVfxPlayer {
  play(id: CombatVfxId, context: CombatVfxContext): boolean;
  activeCount(id?: CombatVfxId): number;
  clear(): void;
  destroy(): void;
}
```

Use `scene.add.sprite`, never `scene.physics.add`. Refuse playback when that profile reaches its cap. On completion, remove the object from the active set and destroy it. Scene shutdown calls `destroy()`.

Under `GAME_TUNING.visual.productionVfx`, add:

```ts
{
  mobileMaximumTotal: 64,
  desktopMaximumTotal: 96,
  minimumAlpha: 0.08,
  maximumAlpha: 0.9,
  maximumLifetimeMs: 2_500,
}
```

- [ ] **Step 5: Produce VFX sheets**

Generate isolated transparent effects from the approved orb and actor references. Use broad shapes, clean gutters, no text, no characters, and no projectile ownership ambiguity. Crop each event to its own source sheet, export with Lanczos, and verify transparent corners.

- [ ] **Step 6: Replace existing one-shot feedback paths**

Construct one `CombatVfxPlayer` in `CombatScene`. Route current launch, recovery, ricochet, direct hit, player hit, enemy reactions, boss breaks, and named core/fusion one-shot calls through `play()`.

Keep persistent corrosion fields, photon trails, nano seeds, cluster fields, mirrors, meltdown zones, hostile projectiles, and physical temporary orbs with their existing owners. Replace only their creation/impact decoration, not their state or damage.

- [ ] **Step 7: Run focused tests and asset checks**

```bash
rtk npx vitest run src/game/visuals/combatVfxProfiles.test.ts src/game/visuals/CombatVfxPlayer.test.ts src/game/scenes/combatSceneRules.test.ts src/game/enemies/EnemyManager.test.ts src/game/bosses/BossManager.test.ts src/game/bosses/HiveBossManager.test.ts
rtk bash scripts/verify_gbc_combat_art.sh --animation-scope vfx
```

Expected: PASS with no missing VFX files.

- [ ] **Step 8: Commit VFX**

```bash
rtk git add src/game/visuals src/game/config/gameTuning.ts src/game/config/gameTuning.test.ts src/game/scenes/CombatScene.ts src/game/scenes/combatSceneRules.test.ts src/game/enemies/EnemyManager.ts src/game/bosses assets-source/combat/vfx public/assets/combat/vfx
rtk git commit -m "art: ship production combat effects"
```

---

### Task 10: Final Mobile QA, Performance Gate, And Documentation

**Files:**
- Modify: `e2e/combat.spec.ts`
- Modify: `docs/WORKLOG.md`
- Modify: `docs/TUNING.md`
- Modify: `assets-source/combat/art-bible.md`
- Modify: `assets-source/combat/orbs-hd/README.md`

**Interfaces:**
- Consumes: complete actor, orb, and VFX systems.
- Produces: release evidence, tuning ownership documentation, clean worktree.

- [ ] **Step 1: Add final browser gates**

Add these tests:

- `@mobile keeps hostile bullets readable during dense production VFX`
- `@desktop renders all actor states without collision drift`
- `@desktop renders all 15 orb animation identities`
- `@desktop clears production visual objects on scene shutdown`
- `@mobile keeps total visual objects under the configured cap`

The dense test grants three permanent orbs, places shooter enemies, triggers one basic proc and one fusion proc, advances 10 seconds, and asserts hostile bullet count, aim guide visibility, active VFX cap, and stable physics rectangles.

- [ ] **Step 2: Run one final browser suite**

Stop any manually running server on port 4173, then run:

```bash
rtk npm run test:e2e -- --grep "production|animation identities|collision drift|visual objects"
```

Expected: every selected desktop and mobile test PASS.

- [ ] **Step 3: Capture and inspect release scenes**

Use `game-studio:game-playtest` once for this final pass. Capture:

- player launch, recovery, hurt;
- dense normal combat with shooter charge and splitter fracture;
- base six and fusion nine animation montage;
- Sentinel, Hive, and Siege intact, damaged, and enraged states;
- dense mobile frame containing friendly trail, hostile bullets, one proc, and an aim guide.

Reject any scene where an effect hides hostile ownership, a moving frame changes the apparent collision edge, two orb identities read the same, or an animation leaves its role frame.

- [ ] **Step 4: Run the full verification gate**

```bash
rtk npm test
rtk npm run build
rtk bash scripts/combat_art_assets.test.sh
rtk bash scripts/verify_gbc_combat_art.sh --animation-scope all
rtk git diff --check
```

Expected: all commands exit 0. The existing Vite 500KB bundle warning is non-fatal unless bundle size materially increases from the pre-plan baseline.

- [ ] **Step 5: Document exact tuning ownership**

Add `docs/TUNING.md` rows for:

- actor state frame rates and response durations;
- orb layer motion and visual-object caps;
- VFX alpha, lifetime, per-effect cap, and total mobile/desktop cap.

Update the art bible with skin frame-box rules and update the orb README with body/layer source naming. Record all shipped animation families and final test counts in `docs/WORKLOG.md`.

- [ ] **Step 6: Commit final QA documentation**

```bash
rtk git add e2e/combat.spec.ts docs/WORKLOG.md docs/TUNING.md assets-source/combat/art-bible.md assets-source/combat/orbs-hd/README.md
rtk git commit -m "test(visuals): gate production motion and VFX"
```

Expected: clean worktree. Do not push or merge without explicit user instruction.

---

## Execution Stop Conditions

- Stop after Task 5 if actor frames require a collision or display-size change; revise the skin profile contract before continuing.
- Stop after Task 7 if base orbs cannot be distinguished at 42px without exceeding the aura or brightness limit; revise the layer art, not the collision size.
- Stop after Task 8 if all 15 orbs exceed the mobile visual-object cap; reduce layers before changing the cap.
- Stop during Task 9 if a VFX path would need to own damage or timing; keep that state with the existing gameplay owner.
- Stop before Task 10 if any declared actor, orb, or VFX asset is still missing; final QA is not a placeholder-acceptance step.
