# First Three Orb Fusions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add the first three complete fusion orbs—광자 궤도, 공명 군체, 나노 증식체—to the mixed level-up loop.

**Architecture:** Keep basic-core rules intact and add one explicit fusion registry. Fusion consumes two selected physical basic orbs atomically, keeps stable orb IDs, and emits existing direct-hit/wall-bounce events into three small runtime effect paths. All balance values stay in `GAME_TUNING`; no generic effect language or external data loader is added.

**Tech Stack:** TypeScript 5.9, Phaser 3.90, Vitest 4.1, Playwright 1.61

## Global Constraints

- Basic orb levels remain 1–5; fusion orb levels are `material A + material B - 1`, capped at 9.
- Fusion orbs cannot be fusion materials, cannot duplicate in one run, and occupy one slot.
- Full-slot rewards offer at most one fusion, one physical-orb upgrade, and one ability.
- Every tuning value lives under `GAME_TUNING.orbFusions` and is validated at startup.
- Browser automation runs once after the integrated slice, not after each internal task.
- Discovery masking, codex persistence, remaining six fusions, real art, and sound remain out of scope.

---

### Task 1: Fusion identity, recipes, and reward eligibility

**Files:**
- Create: `src/game/orbs/orbFusionRules.ts`
- Create: `src/game/orbs/orbFusionRules.test.ts`
- Modify: `src/game/progression/runRewardRules.ts`
- Modify: `src/game/progression/runRewardRules.test.ts`
- Modify: `src/game/config/gameTuning.ts`
- Modify: `src/game/config/gameTuning.test.ts`

**Interfaces:**
- Produces: `FusionOrbId`, `OrbTypeId`, `ORB_FUSION_DEFINITIONS`, `fusionLevel()`, `availableFusionIds()`, `fusionMaterialPairs()`, `orbDefinition()`, `orbMaximumLevel()`.
- Produces reward choice `{ kind: 'orb-fusion'; fusionType: FusionOrbId }`.

- [x] **Step 1: Write failing recipe and reward tests**

```ts
expect(fusionLevel(4, 2)).toBe(5);
expect(availableFusionIds([
  { id: 1, coreType: 'inertia', level: 4 },
  { id: 2, coreType: 'conduction', level: 2 },
])).toEqual(['photon-orbit']);
expect(selectRunRewardOptions(fullContext, 8, 1))
  .toContainEqual({ kind: 'orb-fusion', fusionType: 'photon-orbit' });
```

- [x] **Step 2: Run tests and confirm missing fusion APIs fail**

Run: `npm test -- src/game/orbs/orbFusionRules.test.ts src/game/progression/runRewardRules.test.ts`

- [x] **Step 3: Add the three explicit recipes and full-slot reward mix**

```ts
export const ORB_FUSION_DEFINITIONS = {
  'photon-orbit': { materials: ['inertia', 'conduction'], maximumLevel: 9 },
  'resonant-swarm': { materials: ['conduction', 'split'], maximumLevel: 9 },
  'nano-proliferator': { materials: ['split', 'corrosion'], maximumLevel: 9 },
} as const;
```

- [x] **Step 4: Run focused tests green**

Run: `npm test -- src/game/orbs/orbFusionRules.test.ts src/game/progression/runRewardRules.test.ts src/game/config/gameTuning.test.ts`

### Task 2: Atomic physical-orb fusion and material picker

**Files:**
- Modify: `src/game/orbs/OrbManager.ts`
- Modify: `src/game/orbs/OrbManager.test.ts`
- Create: `src/game/ui/OrbFusionOverlay.ts`
- Create: `src/game/ui/OrbFusionOverlay.test.ts`
- Modify: `src/game/ui/LevelUpOverlay.ts`
- Modify: `src/game/ui/LevelUpOverlay.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `src/game/scenes/combatSceneRules.test.ts`

**Interfaces:**
- Produces: `OrbStore.fuseOrbs(firstId, secondId, fusionType)` and matching `OrbManager.fuseOrbs()`.
- Consumes: `fusionMaterialPairs()` and `fusionLevel()` from Task 1.

- [x] **Step 1: Write failing atomic-fusion tests**

```ts
expect(store.fuseOrbs(1, 4, 'photon-orbit')).toBe(true);
expect(store.getSnapshot()).toContainEqual(expect.objectContaining({
  id: 1, coreType: 'photon-orbit', level: 5,
}));
expect(store.getSnapshot()).toHaveLength(5);
```

Cover same ID, wrong materials, fusion material reuse, duplicate result, and stale UI selection.

- [x] **Step 2: Run tests and confirm fusion is absent**

Run: `npm test -- src/game/orbs/OrbManager.test.ts src/game/ui/OrbFusionOverlay.test.ts`

- [x] **Step 3: Replace array-index lookup with stable-ID lookup only where fusion needs it**

```ts
private requireRecord(id: number): OrbRecord {
  const record = this.records.find((candidate) => candidate.id === id);
  if (!record) throw new RangeError(`unknown orb id: ${id}`);
  return record;
}
```

The retained material becomes the fusion orb; the consumed material sprite is destroyed and removed. Existing colliders may retain the destroyed sprite reference but never receive active collisions.

- [x] **Step 4: Add two-material confirmation UI and scene transaction**

The overlay lists only valid material instances, prevents selecting the same ID twice, shows `A LvN + B LvM → result LvK`, and calls `ProgressionManager.consume()` only after `OrbManager.fuseOrbs()` succeeds.

- [x] **Step 5: Run focused manager/UI/scene tests green**

Run: `npm test -- src/game/orbs/OrbManager.test.ts src/game/ui/OrbFusionOverlay.test.ts src/game/ui/LevelUpOverlay.test.ts src/game/scenes/combatSceneRules.test.ts`

### Task 3: Central fusion profiles and deterministic effect state

**Files:**
- Create: `src/game/combat/FusionCombatState.ts`
- Create: `src/game/combat/FusionCombatState.test.ts`
- Modify: `src/game/config/gameTuning.ts`
- Modify: `src/game/config/gameTuning.test.ts`
- Modify: `src/game/math/vector.ts`
- Modify: `src/game/math/vector.test.ts`

**Interfaces:**
- Produces photon beam/trail profiles, resonant swarm profiles, and nano seed profiles for levels 1–9.
- Produces bounded `PhotonTrailState` and `NanoSeedState` using gameplay elapsed milliseconds.
- Produces `distanceToSegment()` and `segmentIntersection()`.

- [x] **Step 1: Write failing profile, expiry, cap, tick, and intersection tests**

```ts
expect(photonFusionProfile(9)).toMatchObject({ intersectionBlast: expect.any(Object) });
expect(resonantSwarmProfile(1).count).toBeGreaterThanOrEqual(2);
expect(nanoFusionProfile(9).maximumGeneration).toBe(2);
```

- [x] **Step 2: Run tests and confirm missing state/profile APIs fail**

Run: `npm test -- src/game/combat/FusionCombatState.test.ts src/game/math/vector.test.ts src/game/config/gameTuning.test.ts`

- [x] **Step 3: Implement only bounded state needed by the three effects**

Photon trails keep a small per-orb cap, tick on gameplay time, and return a single new intersection blast per crossing. Nano seeds tick as fixed fields and replicate only when a death occurs inside a seed whose generation is below the profile limit.

- [x] **Step 4: Run focused tests green**

Run: `npm test -- src/game/combat/FusionCombatState.test.ts src/game/math/vector.test.ts src/game/config/gameTuning.test.ts`

### Task 4: Runtime damage, temporary-orb provenance, and procedural feedback

**Files:**
- Modify: `src/game/orbs/TemporaryOrbManager.ts`
- Modify: `src/game/orbs/TemporaryOrbManager.test.ts`
- Modify: `src/game/enemies/EnemyManager.ts`
- Modify: `src/game/enemies/EnemyManager.test.ts`
- Modify: `src/game/bosses/bossEncounter.ts`
- Modify: `src/game/bosses/BossManager.ts`
- Modify: `src/game/bosses/BossManager.test.ts`
- Modify: `src/game/bosses/HiveBossManager.ts`
- Modify: `src/game/bosses/HiveBossManager.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `src/game/scenes/combatSceneRules.ts`
- Modify: `src/game/scenes/combatSceneRules.test.ts`
- Modify: `src/game/scenes/combatTextureRules.ts`
- Modify: `src/game/scenes/combatTextureRules.test.ts`

**Interfaces:**
- Temporary orbs optionally carry `{ fusionType: 'resonant-swarm'; sourceOrbId; level }` and report it on hit/expiry.
- Enemy and boss managers gain `applySegmentDamage(start, end, thickness, damage, excludedId?)`.

- [x] **Step 1: Write failing provenance, segment damage, and effect-planning tests**

Verify that resonant children retain source level, natural expiry emits once, clear/destroy emits nothing, and segment damage hits only bodies within thickness.

- [x] **Step 2: Run focused tests red**

Run: `npm test -- src/game/orbs/TemporaryOrbManager.test.ts src/game/enemies/EnemyManager.test.ts src/game/bosses/BossManager.test.ts src/game/bosses/HiveBossManager.test.ts src/game/scenes/combatSceneRules.test.ts src/game/scenes/combatTextureRules.test.ts`

- [x] **Step 3: Wire the three fusion behaviors**

- 광자 궤도: every permanent direct hit fires a directional penetrating beam; Lv4+ wall bounces leave bounded ticking trails; Lv9 trail crossings blast once.
- 공명 군체: permanent direct hits use the central proc chance to spawn tagged temporary orbs; their hits chain to nearby targets; nearby siblings increase output; natural expiry emits a final pulse.
- 나노 증식체: permanent direct hits use the central proc chance to scatter fixed seeds; seeds tick damage and Lv7+ seeds replicate on kills within their field, bounded by generation and global caps.

- [x] **Step 4: Add distinct Lv1–Lv9 fusion orb textures and named effect graphics**

Use existing procedural texture generation. No raster assets or sound files.

- [x] **Step 5: Run focused tests green**

Run the same focused command from Step 2 and require zero failures.

### Task 5: Integrated browser proof, documentation, and delivery

**Files:**
- Modify: `e2e/combat.spec.ts`
- Modify: `docs/TUNING.md`
- Modify: `docs/WORKLOG.md`

**Interfaces:**
- Development-only helpers may create a deterministic six-orb material set and select a fusion; no production debug menu is added.

- [x] **Step 1: Add one desktop and one mobile fusion-flow test**

Cover full-slot fusion card, material confirmation, slot count dropping from six to five, fusion level calculation, fusion texture, and at least one named combat feedback object.

- [x] **Step 2: Run the new browser tests**

Run: `npm run test:e2e -- --grep "orb fusion"`

- [x] **Step 3: Update tuning map and worklog**

Record the three recipes, central tuning path, automated verification, and deferred discovery/remaining recipes.

- [x] **Step 4: Run final verification**

Run: `npm test && npm run build && npm run test:e2e`

- [x] **Step 5: Review diff, commit, merge, push, and remove worktree**

Expected branch commit: `feat: add first three orb fusions`
