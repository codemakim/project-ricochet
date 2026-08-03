# Final Three Orb Fusions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the nine-recipe fusion pool with 거울 회로, 융해 코어, and 벡터 블레이드.

**Architecture:** Extend the explicit fusion registry, central tuning, and bounded state classes already used by the first six fusions. Wall-bounce and direct-hit events remain the only triggers; `CombatScene` applies damage through existing segment/area APIs and draws procedural feedback. No generic effect engine, asset pipeline, or save-schema change is added.

**Tech Stack:** TypeScript 5.9, Phaser 3.90, Vitest 4.1, Playwright 1.61

## Global Constraints

- Recipes are fixed: 반향+전도=`mirror-circuit`, 폭발+부식=`meltdown-core`, 관성+반향=`vector-blade`.
- Fusion levels remain 1–9 and all `*ByLevel` arrays contain exactly 9 finite values.
- Every adjustable number lives under `GAME_TUNING.orbFusions` and is validated at startup.
- Mirrors, heat zones, and stored vectors have explicit global/per-orb caps and clear on restart/shutdown.
- Existing schema 3 discovery, rewards, material picker, orb storage, and codex consume the new registered IDs unchanged.
- Browser automation runs once after the integrated slice.
- Balance passes, raster art, and sound remain out of scope.

---

### Task 1: Register the final recipes, descriptions, tuning, and textures

**Files:**
- Modify: `src/game/orbs/orbFusionRules.ts`
- Modify: `src/game/orbs/orbFusionRules.test.ts`
- Modify: `src/game/config/gameTuning.ts`
- Modify: `src/game/config/gameTuning.test.ts`
- Modify: `src/game/scenes/combatTextureRules.ts`
- Modify: `src/game/scenes/combatTextureRules.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`

**Interfaces:**
- Extends `FusionOrbId` with `'mirror-circuit' | 'meltdown-core' | 'vector-blade'`.
- Extends `ORB_FUSION_DEFINITIONS` and `GAME_TUNING.orbFusions` with matching identities.
- Existing reward, fusion picker, discovery validation, and procedural texture loops consume the registry.

- [ ] **Step 1: Write failing recipe and texture tests**

```ts
expect(FUSION_ORB_IDS).toHaveLength(9);
expect(availableFusionIds([
  { id: 0, coreType: 'echo', level: 3 },
  { id: 1, coreType: 'conduction', level: 3 },
  { id: 2, coreType: 'explosion', level: 3 },
  { id: 3, coreType: 'corrosion', level: 3 },
  { id: 4, coreType: 'inertia', level: 3 },
])).toEqual(expect.arrayContaining(['mirror-circuit', 'meltdown-core', 'vector-blade']));
expect(textures['orb-vector-blade-lv9']).toMatchObject({ notches: 9 });
```

- [ ] **Step 2: Run focused tests red**

Run: `rtk npm test -- src/game/orbs/orbFusionRules.test.ts src/game/config/gameTuning.test.ts src/game/scenes/combatTextureRules.test.ts`

Expected: final IDs and textures are absent.

- [ ] **Step 3: Add definitions and nine-level tuning**

```ts
'mirror-circuit': { materials: ['echo', 'conduction'], maximumLevel: 9 },
'meltdown-core': { materials: ['explosion', 'corrosion'], maximumLevel: 9 },
'vector-blade': { materials: ['inertia', 'echo'], maximumLevel: 9 },
```

Add only these knobs:

- `mirrorCircuit`: duration, tick, thickness, damage, maximum mirrors, Lv9 crossing blast, fill/accent.
- `meltdownCore`: chance, cooldown, zone radius/duration/tick, heat per hit, threshold, heat damage scale, meltdown damage, maximum zones, boss heat cap, fill/accent.
- `vectorBlade`: base length/damage/thickness, speed and path-length scales, maximum vectors, Lv9 replay count, fill/accent.

Validate every curve and scalar with the existing helpers.

- [ ] **Step 4: Add distinct procedural symbols and run focused tests green**

Use `mirror`, `melt`, and `blade` symbols in the existing texture switch. No assets.

Run: `rtk npm test -- src/game/orbs/orbFusionRules.test.ts src/game/config/gameTuning.test.ts src/game/scenes/combatTextureRules.test.ts`

- [ ] **Step 5: Commit**

```bash
rtk git add src/game/orbs/orbFusionRules.ts src/game/orbs/orbFusionRules.test.ts src/game/config/gameTuning.ts src/game/config/gameTuning.test.ts src/game/scenes/combatTextureRules.ts src/game/scenes/combatTextureRules.test.ts src/game/scenes/CombatScene.ts
rtk git commit -m "feat: register final fusion batch"
```

### Task 2: Add bounded mirror, heat, and vector state

**Files:**
- Modify: `src/game/combat/FusionCombatState.ts`
- Modify: `src/game/combat/FusionCombatState.test.ts`
- Modify: `src/game/combat/CombatProcState.ts`
- Modify: `src/game/combat/CombatProcState.test.ts`

**Interfaces:**
- Produces `mirrorCircuitProfile(level)`, `meltdownCoreProfile(level)`, and `vectorBladeProfile(level)`.
- Produces `MirrorCircuitState.add(orbId, position, nowMs, profile)` plus due connected segments.
- Produces `MeltdownZoneState.addHeat(position, boss, nowMs, profile)` plus due ticks and threshold eruptions.
- Produces `VectorBladeState.recordBounce(orbId, vector, pathLength, profile)` and `consume(orbId)`.
- Adds `'meltdown-core'` to deterministic `ProcId`.

- [ ] **Step 1: Write failing state tests**

```ts
expect(mirrorCircuitProfile(9).maximumMirrors).toBeGreaterThan(2);
expect(meltdownCoreProfile(9).heatThreshold).toBeGreaterThan(0);
expect(vectorBladeProfile(9).replayCount).toBe(2);

const vectors = new VectorBladeState();
vectors.recordBounce(1, { x: 1, y: 0 }, 120, vectorBladeProfile(9));
vectors.recordBounce(1, { x: 0, y: -1 }, 180, vectorBladeProfile(9));
expect(vectors.consume(1)).toHaveLength(2);
expect(vectors.consume(1)).toEqual([]);
```

Cover expiry, tick cadence, mirror eviction, zone overlap heat, boss heat cap, eruption consumption, per-orb vector cap, cloning, and `clear()`.

- [ ] **Step 2: Run focused tests red**

Run: `rtk npm test -- src/game/combat/FusionCombatState.test.ts src/game/combat/CombatProcState.test.ts`

- [ ] **Step 3: Implement the smallest explicit states**

- Mirrors: one bounded array per scene; each new mirror connects only to the previous live mirror owned by that orb.
- Heat zones: one bounded array; overlapping hits add heat to the first matching live zone, otherwise create a zone. Reaching threshold returns one eruption and removes the zone.
- Vectors: one bounded array per orb ID; consume removes stored vectors after a direct hit.

- [ ] **Step 4: Run focused tests green and commit**

Run: `rtk npm test -- src/game/combat/FusionCombatState.test.ts src/game/combat/CombatProcState.test.ts src/game/config/gameTuning.test.ts`

```bash
rtk git add src/game/combat/FusionCombatState.ts src/game/combat/FusionCombatState.test.ts src/game/combat/CombatProcState.ts src/game/combat/CombatProcState.test.ts
rtk git commit -m "feat: add final fusion combat state"
```

### Task 3: Wire wall bounces, direct hits, damage, and feedback

**Files:**
- Modify: `src/game/scenes/combatSceneRules.ts`
- Modify: `src/game/scenes/combatSceneRules.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`

**Interfaces:**
- `planFusionDirectHitEffects()` returns meltdown and vector profiles only for matching permanent hits.
- Existing wall-bounce callback records mirrors and vectors.
- Existing segment/area damage APIs apply every effect to enemies and bosses.

- [ ] **Step 1: Write failing effect-plan tests**

```ts
expect(planFusionDirectHitEffects({
  source: 'permanent', coreType: 'meltdown-core', coreLevel: 7,
}, true).meltdownCore).not.toBeNull();
expect(planFusionDirectHitEffects({
  source: 'permanent', coreType: 'vector-blade', coreLevel: 9,
}, false).vectorBlade).not.toBeNull();
```

- [ ] **Step 2: Run scene-rule tests red**

Run: `rtk npm test -- src/game/scenes/combatSceneRules.test.ts`

- [ ] **Step 3: Wire the three effects**

- 거울 회로: wall bounce adds a mirror, draws the node and connecting beam, and timed ticks damage along live segments. Lv9 segment crossings emit one bounded blast.
- 융해 코어: permanent direct hits roll the central proc; success heats or creates the impact zone. Zones tick damage scaled by heat. Threshold eruption applies area damage once and removes the zone.
- 벡터 블레이드: wall bounces store normalized incoming vectors and segment lengths. The next permanent direct hit consumes them and fires one segment cut per stored vector, scaled by speed ratio and stored path. Lv9 replays the latest two.

- [ ] **Step 4: Clear all state and graphics on create/shutdown**

Destroy mirror and heat graphics and clear all three states through the existing fusion cleanup path.

- [ ] **Step 5: Run focused tests and build green**

Run: `rtk npm test -- src/game/combat/FusionCombatState.test.ts src/game/scenes/combatSceneRules.test.ts`

Run: `rtk npm run build`

- [ ] **Step 6: Commit**

```bash
rtk git add src/game/scenes/combatSceneRules.ts src/game/scenes/combatSceneRules.test.ts src/game/scenes/CombatScene.ts
rtk git commit -m "feat: activate final fusion batch"
```

### Task 4: Browser proof, docs, and delivery

**Files:**
- Modify: `e2e/combat.spec.ts`
- Modify: `e2e/meta-loop.spec.ts`
- Modify: `docs/TUNING.md`
- Modify: `docs/WORKLOG.md`

**Interfaces:**
- Reuses the existing development-only fusion setup and scene-name inspection.
- Verifies result textures, one persistent/observable feedback object per effect, and schema-3 discovery persistence.

- [ ] **Step 1: Add focused E2E coverage**

Assert:

- `orb-mirror-circuit-lv9` and `fusion-feedback-mirror-beam`
- `orb-meltdown-core-lv9` and `fusion-feedback-meltdown-zone`
- `orb-vector-blade-lv9` and `fusion-feedback-vector-blade`
- one final-batch fusion name survives settlement and reload in the codex

- [ ] **Step 2: Run changed browser paths**

Run: `rtk npm run test:e2e -- --grep "mirror circuit|meltdown core|vector blade|settles, unlocks"`

- [ ] **Step 3: Update docs**

Record all nine recipes in `docs/TUNING.md`. Add a `2026-08-03 — 최종 구슬 융합 3종` entry with behavior, caps, verification counts, and deferred balance/art/sound.

- [ ] **Step 4: Run final verification**

Run: `rtk npm test`

Run: `rtk npm run build`

Run once: `rtk npm run test:e2e`

Expected: zero failures; the existing Vite chunk-size warning may remain.

- [ ] **Step 5: Review and commit**

Run: `rtk git diff --check`

```bash
rtk git add e2e/combat.spec.ts e2e/meta-loop.spec.ts docs/TUNING.md docs/WORKLOG.md docs/superpowers/plans/2026-08-03-final-three-orb-fusions.md
rtk git commit -m "test: verify final fusion batch"
```

- [ ] **Step 6: Integrate after user-approved delivery**

Expected feature branch: `codex/final-three-orb-fusions`.
