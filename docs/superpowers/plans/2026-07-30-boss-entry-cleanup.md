# Boss Entry Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove unreachable legacy combat code and prevent bosses from overlapping normal enemies by clearing only their configured entry corridor.

**Architecture:** Keep the existing formation engine. A pure boss rule derives the horizontal corridor and lower boundary from existing boss geometry. `EnemyManager` removes active enemies whose real physics bodies intersect that corridor, and `CombatScene` performs removal and feedback immediately before constructing the boss.

**Tech Stack:** TypeScript 5.9, Phaser 3.90 Arcade Physics, Vitest 4, Playwright 1.61, Vite 8.

## Global Constraints

- Default cleanup mode is `corridor`; the only alternate mode is `all`.
- `corridor` keeps side enemies and also removes matching active enemies still above the viewport.
- Entry removal grants no XP, boss score, kill proc, fragments, or breach damage.
- Reuse existing boss geometry and explosion-ring feedback.
- Keep current fixed/mixed formation templates, procedural generation, and experiment flags.
- Add no dependencies.
- Prefix every repository command with `rtk`.

---

### Task 1: Remove obvious unused values

**Files:**
- Modify: `e2e/combat.spec.ts`
- Modify: `src/game/meta/AppController.ts`
- Modify: `src/game/orbs/TemporaryOrbManager.ts`

**Interfaces:**
- Consumes: Existing constructors and E2E helpers.
- Produces: The same runtime behavior with no TypeScript unused declarations.

- [ ] **Step 1: Run the unused-code check and record the baseline**

Run:

```bash
rtk ./node_modules/.bin/tsc --noEmit --noUnusedLocals --noUnusedParameters
```

Expected: FAIL only for `FIFTH_PHASE_FIXTURE`, `selected`, and the stored `scene` constructor property.

- [ ] **Step 2: Delete the three unused declarations**

Apply these exact simplifications:

```ts
// e2e/combat.spec.ts
// Delete FIFTH_PHASE_FIXTURE.

// AppController.ts
this.progress.loadout.map((_, index) => `...`)

// TemporaryOrbManager.ts
constructor(
  scene: Phaser.Scene,
  private readonly options: TemporaryOrbManagerOptions,
) {
```

- [ ] **Step 3: Verify the cleanup**

Run:

```bash
rtk ./node_modules/.bin/tsc --noEmit --noUnusedLocals --noUnusedParameters
rtk npm test -- src/game/meta/MetaStore.test.ts src/game/orbs/TemporaryOrbManager.test.ts
```

Expected: both commands PASS.

- [ ] **Step 4: Commit**

```bash
rtk git add e2e/combat.spec.ts src/game/meta/AppController.ts src/game/orbs/TemporaryOrbManager.ts
rtk git commit -m "refactor: remove unused combat declarations"
```

---

### Task 2: Delete unreachable legacy boss rewards

**Files:**
- Delete: `src/game/combat/CombatEffectScheduler.ts`
- Delete: `src/game/combat/CombatEffectScheduler.test.ts`
- Modify: `src/game/config/gameTuning.ts`
- Modify: `src/game/config/gameTuning.test.ts`
- Modify: `src/game/constants.test.ts`
- Modify: `src/game/progression/bossRewardRules.ts`
- Modify: `src/game/progression/BossBuild.ts`
- Modify: `src/game/progression/BossBuild.test.ts`
- Modify: `src/game/orbs/orbRules.ts`
- Modify: `src/game/orbs/orbRules.test.ts`
- Modify: `src/game/orbs/OrbManager.ts`
- Modify: `src/game/orbs/OrbManager.test.ts`
- Modify: `src/game/orbs/TemporaryOrbManager.ts`
- Modify: `src/game/orbs/TemporaryOrbManager.test.ts`
- Modify: `src/game/scenes/combatSceneRules.ts`
- Modify: `src/game/scenes/combatSceneRules.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `e2e/combat.spec.ts`

**Interfaces:**
- Consumes: `BOSS_REWARD_IDS`, the nine approved build-relevant relics.
- Produces: `BossRewardId = typeof BOSS_REWARD_IDS[number]`; `BossBuild.acquire` accepts only that union. Direct-hit planning retains current general abilities and the nine approved relic effects.

- [ ] **Step 1: Add a failing reachability test**

In `BossBuild.test.ts`, make the existing acquisition test reject both old reward families:

```ts
expect(() => build.acquire('expanded-magazine' as never))
  .toThrow('unknown boss reward');
expect(() => build.acquire('auxiliary-orbit' as never))
  .toThrow('unknown boss reward');
```

- [ ] **Step 2: Run the test and verify RED**

```bash
rtk npm test -- src/game/progression/BossBuild.test.ts
```

Expected: FAIL because `auxiliary-orbit` is currently accepted.

- [ ] **Step 3: Collapse reward types to the approved set**

Make `bossRewardRules.ts` expose only:

```ts
export type BossRewardTier = 'first' | 'second';
export type BossRewardId = typeof BOSS_REWARD_IDS[number];
export type BossRewardChoice =
  | { kind: 'relic'; id: BossRewardId }
  | { kind: 'ability-rank'; id: AbilityId };
```

Delete `LEGACY_FIRST_BOSS_REWARD_IDS`, `SECOND_BOSS_REWARD_IDS`, `LegacyBossRewardId`, and `selectLegacyBossRewardOptions`.

In `BossBuild.acquire`, validate only `BOSS_REWARD_IDS`:

```ts
acquire(id: BossRewardId): void {
  if (!(BOSS_REWARD_IDS as readonly string[]).includes(id)) {
    throw new RangeError(`unknown boss reward: ${id}`);
  }
  if (this.owns(id)) throw new RangeError(`${id} is already owned`);
  this.rewards.push(id);
}
```

- [ ] **Step 4: Remove every legacy-only runtime path**

Delete these `BossBuild` methods and their callers:

```text
orbLimitBonus
restoredCharges
openingHitBonus
temporaryExplosionEnabled
recoverySalvoCount
recordPermanentDirectHit
chargedDamageBonus
chargedKillPierces
aftershock
chainSplitEnabled
```

Delete `GAME_TUNING.relics.secondBoss` and its validation.

Simplify the remaining boundaries:

```ts
// OrbManager runtime cap
return Math.min(limit, GAME_TUNING.build.basicGrowth.maximumOrbs);

// CombatScene recovery
onRecovery: (orbId, source) => {
  this.combatProcs?.resetOrbFlight(orbId);
  this.handleOrbRecovery(source);
},

// planDirectHitEffects result
return {
  immediateAreas: explosion && explosionTriggered
    ? [{ kind: 'explosion', radius: explosion.radius, damage: explosion.damage }]
    : [],
  spawnChildren: event.source === 'temporary' && decision.split,
  splitCount: event.source === 'permanent' && decision.split
    ? build.split()?.count ?? 0
    : 0,
};
```

Retain `temporaryProcChance`, `crossCutDamage`, `gasIgnitionFraction`, `recursiveSplit`, `inertiaHitLimit`, `completeCycleEnabled`, `reloadSecondaryBonus`, `conductionHitsRequired`, `conductionDamage`, and `resonanceRupture`.

Delete `CombatEffectScheduler`, aftershock scheduling/draining, and legacy-only E2E assertions. Keep general explosion, temporary split, and current relic coverage.

- [ ] **Step 5: Verify the approved reward system**

Run:

```bash
rtk npm test -- \
  src/game/progression/bossRewardRules.test.ts \
  src/game/progression/BossBuild.test.ts \
  src/game/orbs/orbRules.test.ts \
  src/game/orbs/OrbManager.test.ts \
  src/game/orbs/TemporaryOrbManager.test.ts \
  src/game/scenes/combatSceneRules.test.ts
rtk ./node_modules/.bin/tsc --noEmit --noUnusedLocals --noUnusedParameters
```

Expected: PASS. No reference to `secondBoss`, `selectLegacyBossRewardOptions`, `auxiliary-orbit`, or `aftershock-explosion` remains under `src/`.

- [ ] **Step 6: Commit**

```bash
rtk git add -A src/game e2e/combat.spec.ts
rtk git commit -m "refactor: remove unreachable legacy boss rewards"
```

---

### Task 3: Define boss entry corridor rules

**Files:**
- Create: `src/game/bosses/bossEntryRules.ts`
- Create: `src/game/bosses/bossEntryRules.test.ts`
- Modify: `src/game/config/gameTuning.ts`
- Modify: `src/game/config/gameTuning.test.ts`

**Interfaces:**
- Consumes: `BossKind`, `BOSS_GEOMETRY`, `HIVE_BOSS_GEOMETRY`, `bodyBounds`, `GAME_WIDTH`, `GAME_HEIGHT`.
- Produces:

```ts
export interface BossEntryCorridor {
  left: number;
  right: number;
  bottom: number;
}

export function bossEntryCorridor(kind: BossKind): BossEntryCorridor;
export function bossEntryCleanup(
  kind: BossKind,
  mode: 'corridor' | 'all',
): { mode: 'all' } | { mode: 'corridor'; corridor: BossEntryCorridor };
```

- [ ] **Step 1: Write failing geometry and tuning tests**

Add tests with hand-derived invariants:

```ts
it('covers sentinel and siege initial collision geometry', () => {
  expect(bossEntryCorridor('sentinel')).toEqual({
    left: 114,
    right: 336,
    bottom: 176,
  });
  expect(bossEntryCorridor('siege')).toEqual({
    left: 114,
    right: 336,
    bottom: 176,
  });
});

it('covers every recalled hive part', () => {
  expect(bossEntryCorridor('hive')).toEqual({
    left: 93,
    right: 357,
    bottom: 396,
  });
});

it('uses corridor cleanup by default', () => {
  expect(GAME_TUNING.encounter.bossEntry).toEqual({
    cleanupMode: 'corridor',
    padding: 8,
  });
});

it('accepts all-enemy cleanup as the alternate mode', () => {
  const tuning = mutableTuning();
  tuning.encounter.bossEntry.cleanupMode = 'all';
  expect(() => validateGameTuning(tuning)).not.toThrow();
  expect(bossEntryCleanup('hive', 'all')).toEqual({ mode: 'all' });
});
```

- [ ] **Step 2: Run tests and verify RED**

```bash
rtk npm test -- src/game/bosses/bossEntryRules.test.ts src/game/config/gameTuning.test.ts
```

Expected: FAIL because the module and tuning do not exist.

- [ ] **Step 3: Add centralized tuning**

Add:

```ts
// GameTuning encounter shape
bossEntry: {
  cleanupMode: 'corridor' | 'all';
  padding: number;
};

// GAME_TUNING value
encounter: {
  reinforcementReleaseY: 50,
  bossEntry: { cleanupMode: 'corridor' as 'corridor' | 'all', padding: 8 },
  grid: { columns: 8, left: 17, cellWidth: 52, cellHeight: 48, gap: 4 },
},
```

Validate the mode and require finite non-negative padding.

- [ ] **Step 4: Implement the pure corridor calculation**

For Sentinel/Siege:

```ts
const centerX = GAME_WIDTH / 2;
return {
  left: Math.max(0, centerX - BOSS_GEOMETRY.collisionHalfWidth - padding),
  right: Math.min(GAME_WIDTH, centerX + BOSS_GEOMETRY.collisionHalfWidth + padding),
  bottom: Math.min(
    GAME_HEIGHT,
    GAME_TUNING.boss.y + BOSS_GEOMETRY.collisionHalfHeight + padding,
  ),
};
```

For Hive, build the five recalled bodies from existing core, shooter sizes, reflector sizes, and recalled positions. Use `bodyBounds` to return the padded minimum left, maximum right, and maximum bottom.

Implement mode selection without duplicating removal logic:

```ts
export function bossEntryCleanup(
  kind: BossKind,
  mode: 'corridor' | 'all',
) {
  return mode === 'all'
    ? { mode: 'all' as const }
    : { mode: 'corridor' as const, corridor: bossEntryCorridor(kind) };
}
```

- [ ] **Step 5: Verify GREEN**

```bash
rtk npm test -- src/game/bosses/bossEntryRules.test.ts src/game/config/gameTuning.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
rtk git add src/game/bosses/bossEntryRules.ts src/game/bosses/bossEntryRules.test.ts src/game/config/gameTuning.ts src/game/config/gameTuning.test.ts
rtk git commit -m "feat: define boss entry corridors"
```

---

### Task 4: Remove enemies through their real physics bodies

**Files:**
- Modify: `src/game/enemies/EnemyManager.ts`
- Modify: `src/game/enemies/EnemyManager.test.ts`

**Interfaces:**
- Consumes: `{ left: number; right: number; bottom: number }`.
- Produces:

```ts
clearEnemies(): Vector[];
clearCorridor(corridor: {
  left: number;
  right: number;
  bottom: number;
}): Vector[];
```

- [ ] **Step 1: Write failing removal tests**

Use one 2×2 center enemy, one side enemy, and one splitter above the viewport:

```ts
const removed = manager.clearCorridor({ left: 100, right: 300, bottom: 180 });

expect(removed).toEqual(expect.arrayContaining([
  { x: 200, y: 120 },
  { x: 220, y: -40 },
]));
expect(manager.getSnapshot().enemies.map(({ position }) => position))
  .toEqual([{ x: 380, y: 120 }]);
expect(onEnemyKilled).not.toHaveBeenCalled();
expect(onBreach).not.toHaveBeenCalled();
```

Also assert the removed splitter creates no fragments and a body touching exactly at `left` survives.

- [ ] **Step 2: Run and verify RED**

```bash
rtk npm test -- src/game/enemies/EnemyManager.test.ts
```

Expected: FAIL because `clearCorridor` is missing and `clearEnemies` returns `void`.

- [ ] **Step 3: Implement one shared removal path**

Implement strict overlap against real Arcade body coordinates:

```ts
clearCorridor({ left, right, bottom }: {
  left: number;
  right: number;
  bottom: number;
}): Vector[] {
  return this.removeMatchingEnemies((enemy) => {
    const body = enemy.body as Phaser.Physics.Arcade.Body;
    return body.left < right && body.right > left && body.top < bottom;
  });
}

clearEnemies(): Vector[] {
  this.clearHostileActions();
  return this.removeMatchingEnemies(() => true);
}
```

`removeMatchingEnemies` snapshots positions, calls existing `destroyEnemy`, and never calls `killEnemy`.

- [ ] **Step 4: Verify GREEN**

```bash
rtk npm test -- src/game/enemies/EnemyManager.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/game/enemies/EnemyManager.ts src/game/enemies/EnemyManager.test.ts
rtk git commit -m "feat: clear enemies from boss entry corridors"
```

---

### Task 5: Integrate cleanup immediately before boss construction

**Files:**
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `e2e/combat.spec.ts`

**Interfaces:**
- Consumes: `bossEntryCleanup(kind, mode)`, `GAME_TUNING.encounter.bossEntry.cleanupMode`, `EnemyManager.clearCorridor`, `EnemyManager.clearEnemies`.
- Produces: Boss start with no remaining enemy body inside its initial geometry.

- [ ] **Step 1: Write the failing E2E**

Add one test that:

1. keeps two generated enemies and removes the rest;
2. positions one retained enemy in the center corridor and the other at the left edge;
3. advances to `bossStarted`;
4. asserts the center enemy is gone, the side enemy remains, no kill XP was added, and the boss is active.

Core assertions:

```ts
expect(after.boss.active).toBe(true);
expect(after.enemies.some(({ id }) => id === centerId)).toBe(false);
expect(after.enemies.some(({ id }) => id === sideId)).toBe(true);
expect(after.progression.xp).toBe(before.progression.xp);
```

- [ ] **Step 2: Run and verify RED**

```bash
rtk npm run test:e2e -- e2e/combat.spec.ts --grep "clears only the boss entry corridor" --reporter=line --workers=1
```

Expected: FAIL because the center enemy survives and overlaps the boss.

- [ ] **Step 3: Integrate the selected mode**

At the start of `startBoss(kind)`:

```ts
const cleanup = bossEntryCleanup(
  kind,
  GAME_TUNING.encounter.bossEntry.cleanupMode,
);
const removed = cleanup.mode === 'all'
  ? this.enemyManager.clearEnemies()
  : this.enemyManager.clearCorridor(cleanup.corridor);
for (const position of removed) {
  this.drawExplosion(position, GAME_TUNING.encounter.bossEntry.padding + 12);
}
```

Then construct the boss with the existing factory. Do not alter warning timing, formation generation, boss attacks, rewards, or movement rules.

- [ ] **Step 4: Verify the focused integration**

```bash
rtk npm run test:e2e -- e2e/combat.spec.ts --grep "clears only the boss entry corridor|midboss movement|hive" --reporter=line --workers=1
```

Expected: PASS. Side enemies remain and existing boss behavior is unchanged.

- [ ] **Step 5: Commit**

```bash
rtk git add src/game/scenes/CombatScene.ts e2e/combat.spec.ts
rtk git commit -m "feat: clear boss entry corridor on arrival"
```

---

### Task 6: Full verification and documentation sync

**Files:**
- Modify: `docs/superpowers/plans/2026-07-30-boss-entry-cleanup.md`

**Interfaces:**
- Consumes: All prior tasks.
- Produces: A clean, tested branch ready to merge.

- [ ] **Step 1: Verify no stale legacy names remain**

```bash
rtk rg -n "selectLegacyBossRewardOptions|SECOND_BOSS_REWARD_IDS|secondBoss|auxiliary-orbit|aftershock-explosion" src/game --glob '!*.test.ts'
```

Expected: no production matches. The legacy rejection test may retain literal legacy IDs.

- [ ] **Step 2: Run complete static and unit verification**

```bash
rtk git diff --check
rtk ./node_modules/.bin/tsc --noEmit --noUnusedLocals --noUnusedParameters
rtk npm test
rtk npm run build
```

Expected: all commands PASS.

- [ ] **Step 3: Run the full browser suite once**

```bash
rtk npm run test:e2e -- --reporter=line --workers=1
```

Expected: all desktop and mobile tests PASS.

- [ ] **Step 4: Mark this plan complete and commit any final test-only corrections**

Check every completed checkbox in this file. If verification required no source change, do not create an empty commit. Otherwise:

```bash
rtk git add -A
rtk git commit -m "test: complete boss entry cleanup verification"
```
