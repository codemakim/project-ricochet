# Second Three Orb Fusions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add 질량 붕괴탄, 반응로 구슬, and 성단 폭격체 as complete discoverable fusion orbs in the existing mixed reward loop.

**Architecture:** Extend the explicit fusion registry and the existing `FusionCombatState` profile/state helpers. `CombatScene` keeps orchestration: direct-hit and wall-bounce events update small bounded states, existing enemy/boss area-damage APIs apply damage, and Phaser graphics provide procedural feedback. Reuse the current fusion picker, discovery persistence, reward selection, orb storage, and texture generation without adding another framework or generic effect language.

**Tech Stack:** TypeScript 5.9, Phaser 3.90, Vitest 4.1, Playwright 1.61

## Global Constraints

- Recipes are fixed: 부식+관성=`mass-collapse`, 반향+폭발=`reactor-orb`, 폭발+분열=`cluster-bombardment`.
- Basic orb levels remain 1–5; fusion levels remain `material A + material B - 1`, capped at 9.
- Every adjustable number lives under `GAME_TUNING.orbFusions` and every level array has exactly 9 entries.
- All runtime collections are bounded and clear on scene shutdown/restart.
- Existing discovery schema 3 accepts the new registered IDs without a schema bump.
- Existing first-three fusion behavior and reward composition remain unchanged.
- Browser automation runs once after the integrated slice.
- Real raster art, sound, the final three fusions, and balance changes to existing fusions remain out of scope.

---

### Task 1: Register recipes, descriptions, textures, and central tuning

**Files:**
- Modify: `src/game/orbs/orbFusionRules.ts`
- Modify: `src/game/orbs/orbFusionRules.test.ts`
- Modify: `src/game/progression/runRewardRules.test.ts`
- Modify: `src/game/config/gameTuning.ts`
- Modify: `src/game/config/gameTuning.test.ts`
- Modify: `src/game/scenes/combatTextureRules.ts`
- Modify: `src/game/scenes/combatTextureRules.test.ts`

**Interfaces:**
- Extends `FusionOrbId` with `'mass-collapse' | 'reactor-orb' | 'cluster-bombardment'`.
- Extends `ORB_FUSION_DEFINITIONS` and `GAME_TUNING.orbFusions` with the same three identities.
- Existing `availableFusionIds()`, `fusionMaterialPairs()`, reward selection, discovery validation, and texture generation consume the registry automatically.

- [x] **Step 1: Write failing registry and eligibility tests**

```ts
expect(FUSION_ORB_IDS).toEqual([
  'photon-orbit',
  'resonant-swarm',
  'nano-proliferator',
  'mass-collapse',
  'reactor-orb',
  'cluster-bombardment',
]);
expect(availableFusionIds([
  { id: 0, coreType: 'corrosion', level: 3 },
  { id: 1, coreType: 'inertia', level: 4 },
  { id: 2, coreType: 'echo', level: 2 },
  { id: 3, coreType: 'explosion', level: 5 },
  { id: 4, coreType: 'split', level: 3 },
])).toEqual(expect.arrayContaining([
  'mass-collapse',
  'reactor-orb',
  'cluster-bombardment',
]));
```

Add a reward-rule assertion that a valid new recipe can occupy the existing single fusion-card slot. Add texture assertions for `orb-mass-collapse-lv1`, `orb-reactor-orb-lv9`, and `orb-cluster-bombardment-lv4`.

- [x] **Step 2: Run focused tests red**

Run: `rtk npm test -- src/game/orbs/orbFusionRules.test.ts src/game/progression/runRewardRules.test.ts src/game/config/gameTuning.test.ts src/game/scenes/combatTextureRules.test.ts`

Expected: new IDs and tuning keys are absent.

- [x] **Step 3: Add the three explicit definitions**

```ts
'mass-collapse': {
  label: '질량 붕괴탄',
  roleHint: '직격 붕괴형',
  summary: '고속 직격으로 구조 열화를 쌓고 임계점에서 붕괴',
  materials: ['corrosion', 'inertia'],
  maximumLevel: 9,
},
'reactor-orb': {
  label: '반응로 구슬',
  roleHint: '반사 충전형',
  summary: '벽 반사로 반응로를 충전하고 다음 적 충돌에서 방출',
  materials: ['echo', 'explosion'],
  maximumLevel: 9,
},
'cluster-bombardment': {
  label: '성단 폭격체',
  roleHint: '산개 폭격형',
  summary: '적 충돌 시 여섯 방향으로 폭발탄을 산개해 착탄',
  materials: ['explosion', 'split'],
  maximumLevel: 9,
},
```

Give each definition nine concise `levelEffects` entries and a distinct fill/accent pair. Extend procedural texture symbols using the existing per-fusion registry; do not add image assets.

- [x] **Step 4: Add tuning profiles and startup validation**

Add only these knobs:

```ts
massCollapse: {
  minimumSpeedRatioByLevel: NineLevelValues;
  stacksPerHitByLevel: NineLevelValues;
  precisionBonusStacksByLevel: NineLevelValues;
  thresholdByLevel: NineLevelValues;
  collapseDamageByLevel: NineLevelValues;
  radiusByLevel: NineLevelValues;
  secondaryScale: number;
  maximumTrackedTargets: number;
  fill: number;
  accent: number;
};
reactorOrb: {
  maximumChargesByLevel: NineLevelValues;
  damagePerChargeByLevel: NineLevelValues;
  radiusPerChargeByLevel: NineLevelValues;
  baseRadius: number;
  outerWaveFromLevel: number;
  outerWaveDamageScale: number;
  outerWaveRadiusScale: number;
  fill: number;
  accent: number;
};
clusterBombardment: {
  chanceByLevel: NineLevelValues;
  damageByLevel: NineLevelValues;
  radiusByLevel: NineLevelValues;
  travelMsByLevel: NineLevelValues;
  distanceByLevel: NineLevelValues;
  lingeringFromLevel: number;
  lingeringDurationMsByLevel: NineLevelValues;
  lingeringTickMs: number;
  lingeringDamageByLevel: NineLevelValues;
  cooldownMs: number;
  projectileCount: 6;
  maximumActiveProjectiles: number;
  fill: number;
  accent: number;
};
```

Validate probability, integer, non-negative, positive, and nine-entry constraints with the existing helpers in `gameTuning.ts`.

- [x] **Step 5: Run focused tests green and commit**

Run: `rtk npm test -- src/game/orbs/orbFusionRules.test.ts src/game/progression/runRewardRules.test.ts src/game/config/gameTuning.test.ts src/game/scenes/combatTextureRules.test.ts`

```bash
rtk git add src/game/orbs/orbFusionRules.ts src/game/orbs/orbFusionRules.test.ts src/game/progression/runRewardRules.test.ts src/game/config/gameTuning.ts src/game/config/gameTuning.test.ts src/game/scenes/combatTextureRules.ts src/game/scenes/combatTextureRules.test.ts
rtk git commit -m "feat: register second fusion batch"
```

### Task 2: Deterministic profiles and bounded runtime state

**Files:**
- Modify: `src/game/combat/FusionCombatState.ts`
- Modify: `src/game/combat/FusionCombatState.test.ts`
- Modify: `src/game/combat/CombatProcState.ts`
- Modify: `src/game/combat/CombatProcState.test.ts`

**Interfaces:**
- Produces `massCollapseProfile(level)`, `reactorOrbProfile(level)`, and `clusterBombardmentProfile(level)`.
- Produces `MassCollapseState.record(targetKey, addedStacks, profile): MassCollapseResult`.
- Produces `ReactorChargeState.add(orbId, profile): number` and `consume(orbId): number`.
- Produces bounded `ClusterFieldState` snapshots and due ticks using gameplay elapsed milliseconds.
- Adds `'cluster-bombardment'` to the existing deterministic `ProcId` registry.

- [x] **Step 1: Write failing profile and state tests**

```ts
const mass = massCollapseProfile(9);
expect(mass.precisionBonusStacks).toBeGreaterThan(0);

const collapse = new MassCollapseState();
expect(collapse.record('enemy:7', 2, { ...mass, threshold: 3 })).toMatchObject({
  collapsed: false,
  stacks: 2,
});
expect(collapse.record('enemy:7', 1, { ...mass, threshold: 3 })).toMatchObject({
  collapsed: true,
  stacks: 0,
});

const reactor = new ReactorChargeState();
expect(reactor.add(4, { ...reactorOrbProfile(1), maximumCharges: 2 })).toBe(1);
expect(reactor.add(4, { ...reactorOrbProfile(1), maximumCharges: 2 })).toBe(2);
expect(reactor.add(4, { ...reactorOrbProfile(1), maximumCharges: 2 })).toBe(2);
expect(reactor.consume(4)).toBe(2);
expect(reactor.consume(4)).toBe(0);
```

Cover invalid levels, non-positive stack increments, stable target reset after collapse, target-cap eviction, charge cap, `clear()`, and seeded cluster proc behavior.
Also cover cluster-field duration, tick cadence, and global-cap eviction with fake gameplay timestamps.

- [x] **Step 2: Run focused tests red**

Run: `rtk npm test -- src/game/combat/FusionCombatState.test.ts src/game/combat/CombatProcState.test.ts src/game/config/gameTuning.test.ts`

Expected: new profiles/state/proc ID are absent.

- [x] **Step 3: Implement minimal bounded state**

`MassCollapseState` stores insertion-ordered target stacks in one `Map<string, number>`. When the cap is reached, remove the oldest key before adding a new one. A collapse resets that target to zero. `ReactorChargeState` stores one capped integer per permanent orb ID. Both expose `clear()`; no generic status-effect container is introduced.

`clusterBombardmentProfile()` returns six fixed angles `[210, 270, 330, 30, 90, 150]` in degrees so the runtime only applies distance and timing. It includes lingering-field data only at or above `lingeringFromLevel`. `ClusterFieldState` follows the existing bounded `NanoSeedState` timing pattern but stores only landing position, radius, damage, expiry, and next tick.

- [x] **Step 4: Run focused tests green and commit**

Run: `rtk npm test -- src/game/combat/FusionCombatState.test.ts src/game/combat/CombatProcState.test.ts src/game/config/gameTuning.test.ts`

```bash
rtk git add src/game/combat/FusionCombatState.ts src/game/combat/FusionCombatState.test.ts src/game/combat/CombatProcState.ts src/game/combat/CombatProcState.test.ts
rtk git commit -m "feat: add second fusion combat state"
```

### Task 3: Wire direct hits, wall charges, bombardment, and feedback

**Files:**
- Modify: `src/game/scenes/combatSceneRules.ts`
- Modify: `src/game/scenes/combatSceneRules.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `src/game/orbs/OrbManager.ts`
- Modify: `src/game/orbs/OrbManager.test.ts`

**Interfaces:**
- Extends `planFusionDirectHitEffects(event, procTriggered)` with mass-collapse and cluster-bombardment plans.
- Extends the wall-bounce callback path with reactor charge feedback.
- Reuses `applyAreaEffects()`, `drawEffectRing()`, enemy/boss target IDs, gameplay elapsed time, and existing direct-hit event fields.

- [x] **Step 1: Write failing effect-planning and speed tests**

```ts
expect(planFusionDirectHitEffects({
  source: 'permanent',
  sourceOrbId: 2,
  coreType: 'mass-collapse',
  coreLevel: 4,
  speedRatio: 1.5,
  precisionHit: true,
  position: { x: 100, y: 100 },
  direction: { x: 0, y: -1 },
}, false).massCollapse).toMatchObject({ addedStacks: expect.any(Number) });

expect(planFusionDirectHitEffects({
  source: 'permanent',
  sourceOrbId: 3,
  coreType: 'cluster-bombardment',
  coreLevel: 5,
  position: { x: 100, y: 100 },
  direction: { x: 0, y: -1 },
}, true).clusterBombardment).toMatchObject({ projectileCount: 6 });
```

Add an `OrbManager` assertion that these three fusions keep normal launch speed unless their own profile explicitly changes it. This prevents accidental inheritance from their material cores.

- [x] **Step 2: Run focused tests red**

Run: `rtk npm test -- src/game/scenes/combatSceneRules.test.ts src/game/orbs/OrbManager.test.ts`

- [x] **Step 3: Wire 질량 붕괴탄 and 반응로 구슬**

- 질량 붕괴탄: only permanent hits at or above `minimumSpeedRatio` add stacks. Precision adds the configured bonus. Key enemies as `enemy:<id>` and boss parts as `boss:<targetId>`. On threshold, apply the configured center damage and one existing bounded secondary area effect, reset stacks, and draw an inward two-ring collapse graphic.
- 반응로 구슬: every wall bounce increments that orb's charge up to its level cap and updates one small orb-centered charge flash. The next permanent enemy/boss hit consumes all charges. Zero charge does nothing. Non-zero charge produces one radius/damage-scaled blast; at `outerWaveFromLevel`, also emit one weaker outer ring.

- [x] **Step 4: Wire 성단 폭격체**

Use `CombatProcState.tryProc('cluster-bombardment', ...)` on permanent direct hits. A success creates exactly six lightweight Phaser graphics moving to clamped landing points around the impact. Each delayed landing calls existing area damage once and destroys its graphic. Track active graphics/timers in one bounded collection; if `maximumActiveProjectiles` is reached, skip excess creation. At `lingeringFromLevel`, add the landing to the distinct `ClusterFieldState` from Task 2; do not label or count these as nano seeds.

- [x] **Step 5: Clear state and visuals on restart/shutdown**

Call `clear()` on mass stacks, reactor charges, and cluster fields. Destroy pending cluster graphics and cancel their timers through the same cleanup path already used by photon trails and nano seed visuals.

- [x] **Step 6: Run focused tests green and commit**

Run: `rtk npm test -- src/game/combat/FusionCombatState.test.ts src/game/combat/CombatProcState.test.ts src/game/scenes/combatSceneRules.test.ts src/game/orbs/OrbManager.test.ts`

```bash
rtk git add src/game/combat/FusionCombatState.ts src/game/combat/FusionCombatState.test.ts src/game/combat/CombatProcState.ts src/game/combat/CombatProcState.test.ts src/game/scenes/combatSceneRules.ts src/game/scenes/combatSceneRules.test.ts src/game/scenes/CombatScene.ts src/game/orbs/OrbManager.ts src/game/orbs/OrbManager.test.ts
rtk git commit -m "feat: activate second fusion batch"
```

### Task 4: Browser proof, tuning map, worklog, and delivery

**Files:**
- Modify: `e2e/combat.spec.ts`
- Modify: `e2e/meta-loop.spec.ts`
- Modify: `docs/TUNING.md`
- Modify: `docs/WORKLOG.md`

**Interfaces:**
- Consumes existing development-only orb/reward helpers and `CombatScene.debugSnapshot()`.
- Verifies production fusion selection, one deterministic named feedback object per new fusion, and schema-3 persistence of a new fusion ID.

- [x] **Step 1: Add focused browser coverage**

Extend the existing fusion E2E setup, not a new harness:

```ts
await expect.poll(async () => (await combatSnapshot(page)).orbs)
  .toContainEqual(expect.objectContaining({ coreType: 'reactor-orb' }));
await expect.poll(async () => activeSceneNames(page))
  .toContain('fusion-feedback-reactor-blast');
```

Cover all three result textures and one runtime feedback name each:

- `fusion-feedback-mass-collapse`
- `fusion-feedback-reactor-blast`
- `fusion-feedback-cluster-impact`

Extend the existing meta-loop settlement fixture with one new discovered fusion and assert its real name appears after reload. Keep mobile coverage to the existing generic material-picker flow because all six recipes use the same UI.

- [x] **Step 2: Run only changed browser paths**

Run: `rtk npm run test:e2e -- --grep "orb fusion|settles, unlocks"`

Expected: matched desktop/mobile tests pass.

- [x] **Step 3: Update tuning and work records**

Add the three recipes and their `GAME_TUNING.orbFusions` keys to `docs/TUNING.md`. Add a `2026-08-03 — 두 번째 구슬 융합 3종` worklog entry with behavior, caps, verification counts, and the deferred final three fusions/art/sound.

- [x] **Step 4: Run final verification**

Run: `rtk npm test`

Run: `rtk npm run build`

Run once: `rtk npm run test:e2e`

Expected: zero failures. The existing Vite chunk-size warning may remain.

- [x] **Step 5: Review and commit**

Run: `rtk git diff --check`

```bash
rtk git add e2e/combat.spec.ts e2e/meta-loop.spec.ts docs/TUNING.md docs/WORKLOG.md docs/superpowers/plans/2026-08-03-second-three-orb-fusions.md
rtk git commit -m "test: verify second fusion batch"
```

- [x] **Step 6: Integrate after user-approved delivery**

Expected feature branch: `codex/second-three-orb-fusions`.
