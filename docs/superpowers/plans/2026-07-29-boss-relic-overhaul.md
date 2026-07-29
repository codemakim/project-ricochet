# Boss Relic Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy tiered boss rewards with nine build-relevant relics and safe fallback rank choices.

**Architecture:** Keep reward selection pure in `bossRewardRules.ts`, combat modifiers in `BossBuild.ts`, and visual application in existing managers. Use a tagged reward choice so boss cards can represent either a relic or an owned ability rank without creating another overlay.

**Tech Stack:** TypeScript 5.9, Phaser 3.90, Vitest 4.1, Playwright 1.61.

## Global Constraints

- Bosses with a following stage offer exactly three distinct choices.
- The final boss offers no combat relic.
- Secondary damage remains non-recursive.
- Temporary orbs remain capped at 30 and recursive splitting remains one generation.
- All adjustable values live in `GAME_TUNING.relics`.
- No new dependency or generic event bus.

---

### Task 1: Reward registry and deterministic choices

**Files:**
- Modify: `src/game/progression/bossRewardRules.ts`
- Modify: `src/game/progression/bossRewardRules.test.ts`
- Modify: `src/game/config/gameTuning.ts`
- Modify: `src/game/config/gameTuning.test.ts`

**Interfaces:**
- Consumes: `AbilityRanks`, `ABILITY_MAX_RANKS`, and `OrbCoreId`.
- Produces: `BossRewardId`, `BossRewardChoice`, `BossRewardContext`, and `selectBossRewardOptions(context, seed)`.

- [ ] **Step 1: Write failing registry and selection tests**

```ts
expect(BOSS_REWARD_IDS).toEqual([
  'auxiliary-link', 'cross-cut', 'gas-ignition', 'recursive-split',
  'inertia-retention', 'complete-cycle', 'direct-link',
  'superconducting-circuit', 'resonance-rupture',
]);
expect(selectBossRewardOptions(context, 7)).toHaveLength(3);
expect(selectBossRewardOptions(context, 7)).toEqual(selectBossRewardOptions(context, 7));
```

Cover every prerequisite, owned-relic exclusion, owned non-max ability fallback, and duplicate exclusion.

- [ ] **Step 2: Run the focused tests and confirm old IDs fail**

Run: `rtk npx vitest run src/game/progression/bossRewardRules.test.ts src/game/config/gameTuning.test.ts`

Expected: FAIL because the new IDs and choice types do not exist.

- [ ] **Step 3: Add the minimal registry and selector**

```ts
export type BossRewardChoice =
  | { kind: 'relic'; id: BossRewardId }
  | { kind: 'ability-rank'; id: AbilityId };

export interface BossRewardContext {
  ownedRewards: ReadonlySet<BossRewardId>;
  ranks: Readonly<AbilityRanks>;
  coreTypes: readonly OrbCoreId[];
}

export function selectBossRewardOptions(
  context: BossRewardContext,
  seed: number,
): BossRewardChoice[];
```

Put the nine numeric relic values under `GAME_TUNING.relics` and extend startup validation for finite probabilities, positive timings, positive counts, and bounded multipliers.

- [ ] **Step 4: Run focused tests**

Run: `rtk npx vitest run src/game/progression/bossRewardRules.test.ts src/game/config/gameTuning.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/game/progression/bossRewardRules.ts src/game/progression/bossRewardRules.test.ts src/game/config/gameTuning.ts src/game/config/gameTuning.test.ts
rtk git commit -m "feat: define build-relevant boss relics"
```

### Task 2: Boss build modifiers

**Files:**
- Modify: `src/game/progression/BossBuild.ts`
- Modify: `src/game/progression/BossBuild.test.ts`
- Modify: `src/game/progression/BuildState.ts`
- Modify: `src/game/progression/BuildState.test.ts`
- Modify: `src/game/orbs/OrbManager.ts`
- Modify: `src/game/orbs/OrbManager.test.ts`

**Interfaces:**
- Consumes: the nine `BossRewardId` values and current direct-hit/recovery callbacks.
- Produces: named `BossBuild` queries for the nine relics.

- [ ] **Step 1: Write failing modifier tests**

```ts
expect(build.temporaryProcChance(0.2)).toBe(0.05);
expect(build.inertiaHitLimit()).toBe(2);
expect(build.conductionHitsRequired(4)).toBe(3);
expect(build.conductionDamage(0.45)).toBeCloseTo(0.54);
expect(build.reloadSecondaryBonus(0.6)).toBeCloseTo(0.18);
```

Also prove maximum resonance creates one shockwave and complete cycle requests recall only for a qualifying permanent kill.

- [ ] **Step 2: Run focused tests and confirm missing methods**

Run: `rtk npx vitest run src/game/progression/BossBuild.test.ts src/game/progression/BuildState.test.ts src/game/orbs/OrbManager.test.ts`

Expected: FAIL on missing relic methods.

- [ ] **Step 3: Replace legacy methods with named modifiers**

Implement only direct queries and the smallest required per-orb state. Apply inertia retention at the existing first-hit expiry branch, conduction modifiers at `BuildState.conduction()`, and complete-cycle through the existing collision-ignoring return path.

- [ ] **Step 4: Run focused tests**

Run: `rtk npx vitest run src/game/progression/BossBuild.test.ts src/game/progression/BuildState.test.ts src/game/orbs/OrbManager.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/game/progression/BossBuild.ts src/game/progression/BossBuild.test.ts src/game/progression/BuildState.ts src/game/progression/BuildState.test.ts src/game/orbs/OrbManager.ts src/game/orbs/OrbManager.test.ts
rtk git commit -m "feat: apply core boss relic modifiers"
```

### Task 3: Secondary-effect relics

**Files:**
- Modify: `src/game/scenes/combatSceneRules.ts`
- Modify: `src/game/scenes/combatSceneRules.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `src/game/combat/CorrosionFieldState.ts`
- Modify: `src/game/combat/CorrosionFieldState.test.ts`
- Modify: `src/game/orbs/TemporaryOrbManager.ts`
- Modify: `src/game/orbs/TemporaryOrbManager.test.ts`

**Interfaces:**
- Consumes: direct-hit proc decisions, scheduled area effects, corrosion fields, and temporary-orb lineage.
- Produces: cross-cut, gas ignition, auxiliary proc, and one-generation recursive split commands.

- [ ] **Step 1: Write failing pure and manager tests**

Prove cross-cut adds the opposite axis at 60% damage, gas ignition consumes only overlapping fields, auxiliary-link scales proc chance to 25%, and recursive split creates one child once per lineage.

- [ ] **Step 2: Run focused tests**

Run: `rtk npx vitest run src/game/scenes/combatSceneRules.test.ts src/game/combat/CorrosionFieldState.test.ts src/game/orbs/TemporaryOrbManager.test.ts`

Expected: FAIL on the new command paths.

- [ ] **Step 3: Extend existing command paths**

Add `CorrosionFieldState.igniteOverlapping(center, radius, fraction)` returning immediate damage settlements. Carry only `lineageDepth` and `procScale` on temporary orbs. Do not add a general effect graph.

- [ ] **Step 4: Run focused and full unit tests**

Run: `rtk npx vitest run src/game/scenes/combatSceneRules.test.ts src/game/combat/CorrosionFieldState.test.ts src/game/orbs/TemporaryOrbManager.test.ts`

Run: `rtk npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/game/scenes/combatSceneRules.ts src/game/scenes/combatSceneRules.test.ts src/game/scenes/CombatScene.ts src/game/combat/CorrosionFieldState.ts src/game/combat/CorrosionFieldState.test.ts src/game/orbs/TemporaryOrbManager.ts src/game/orbs/TemporaryOrbManager.test.ts
rtk git commit -m "feat: add secondary boss relic effects"
```

### Task 4: Reward overlay and encounter integration

**Files:**
- Modify: `src/game/ui/BossRewardOverlay.ts`
- Modify: `src/game/ui/BossRewardOverlay.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `src/game/scenes/combatSceneRules.ts`
- Modify: `src/game/scenes/combatSceneRules.test.ts`

**Interfaces:**
- Consumes: `BossRewardChoice[]`.
- Produces: one callback `onSelect(choice: BossRewardChoice): boolean`.

- [ ] **Step 1: Write failing overlay and selection tests**

Assert exact three cards, relic acquisition, fallback ability rank increment, and no legacy tier heading.

- [ ] **Step 2: Run focused tests**

Run: `rtk npx vitest run src/game/ui/BossRewardOverlay.test.ts src/game/scenes/combatSceneRules.test.ts`

Expected: FAIL on the old tiered API.

- [ ] **Step 3: Replace the tiered overlay API**

Use registry copy for relic cards and the existing ability copy for rank cards. Remove deprecated overloads and legacy reward helpers.

- [ ] **Step 4: Run unit tests and build**

Run: `rtk npm test`

Run: `rtk npm run build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/game/ui/BossRewardOverlay.ts src/game/ui/BossRewardOverlay.test.ts src/game/scenes/CombatScene.ts src/game/scenes/combatSceneRules.ts src/game/scenes/combatSceneRules.test.ts
rtk git commit -m "feat: connect unified boss rewards"
```
