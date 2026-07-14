# Level-Up Power Growth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add automatic kill XP, full-pause level-up choices, four rankable abilities, explosion splash, and capped temporary split orbs to the continuous combat prototype.

**Architecture:** Keep XP, option generation, ranks, and derived combat values in pure TypeScript modules. Use `CombatScene` only to connect kill events, pause reasons, UI, permanent orb modifiers, splash damage, and temporary orb spawning. Keep temporary orbs separate from permanent recovery and launch queues while sharing `EnemyManager` collision and kill reporting.

**Tech Stack:** TypeScript 5.9, Phaser 3.90 Arcade Physics, Vitest 4.1, Playwright 1.61, Vite 8.1

## Global Constraints

- Basic, shooter, and armored kills grant exactly `1`, `2`, and `3 XP`; breaches grant 0.
- Level costs are `8 + level * 4`, producing `8, 12, 16, 20, 24...`.
- XP overflow persists and may queue multiple choices.
- Level-up pauses physics, orbs, enemies, bullets, encounter time, and spawn time.
- `visibility`, `levelUp`, and `defeated` are independent pause reasons; gameplay resumes only when none remain.
- Four abilities: `firepower`, `kinetic`, `explosion`, `split`; each max rank 5.
- First choice includes `explosion` or `split`; one screen never repeats an ability.
- Firepower adds `0.25` direct damage per rank to permanent and temporary orbs.
- Kinetic charged permanent speeds are `440, 480, 520, 560, 600px/s`; uncharged speed is `400px/s`.
- Explosion rank tables are radius `[48,56,64,72,80]` and damage `[0.5,0.75,1,1.25,1.5]`.
- Split counts are `[1,1,2,2,3]`; temporary lifetime `1500ms`, speed `440px/s`, base damage `0.5`, hit cooldown `80ms`, active cap 12.
- Temporary orbs may trigger explosion and firepower, but never split, charge, recover, floor-return, or enter the permanent launch queue.
- Existing enemy health, descent speed, formation cadence, active caps, shooter cap, bullet cap, controls, experiment flags, and health values stay unchanged.
- No visible wave-transition UI. No dependencies added. Production bundle must exclude development mutation helpers.

---

## File Structure

- Create `src/game/progression/progressionRules.ts`: XP values, level costs, deterministic option selection.
- Create `src/game/progression/progressionRules.test.ts`: XP, overflow, option, and cap tests.
- Create `src/game/progression/ProgressionManager.ts`: stateful XP and pending-choice coordinator.
- Create `src/game/progression/ProgressionManager.test.ts`: multi-level and choice-consumption tests.
- Create `src/game/progression/BuildState.ts`: ability ranks and derived combat values.
- Create `src/game/progression/BuildState.test.ts`: exact rank tables and validation.
- Create `src/game/combat/CombatPauseController.ts`: reason-set pause state and resume-delta discard.
- Create `src/game/combat/CombatPauseController.test.ts`: overlapping-reason tests.
- Create `src/game/ui/LevelUpOverlay.ts`: Phaser cards and pointer/keyboard selection.
- Create `src/game/ui/LevelUpOverlay.test.ts`: fake-scene input and cleanup tests.
- Create `src/game/orbs/TemporaryOrbManager.ts`: capped temporary orb group, lifetime, angles, cooldowns.
- Create `src/game/orbs/TemporaryOrbManager.test.ts`: spawn geometry, expiry, cap, and hit tests.
- Modify `src/game/orbs/orbRules.ts` and tests: charged flag and firepower damage.
- Modify `src/game/orbs/OrbManager.ts` and tests: dynamic charged speed and modifier refresh.
- Modify `src/game/enemies/EnemyManager.ts` and tests: kill/direct-hit events, area damage, temporary group collisions.
- Modify `src/game/scenes/CombatScene.ts`: compose progression, pause, UI, splash, split, HUD, debug snapshot.
- Modify `e2e/combat.spec.ts`: level-up, pause, stat, explosion, split, restart acceptance.
- Modify `docs/playtests/2026-07-13-core-redesign-prototype.md`: automation results and manual-play gaps.

---

### Task 1: Implement XP, levels, and deterministic choices

**Files:**
- Create: `src/game/progression/progressionRules.ts`
- Create: `src/game/progression/progressionRules.test.ts`
- Create: `src/game/progression/ProgressionManager.ts`
- Create: `src/game/progression/ProgressionManager.test.ts`

**Interfaces:**
- Produces `AbilityId`, `ProgressionSnapshot`, `xpForEnemy(kind)`, `xpRequiredForLevel(level)`, `selectAbilityOptions(ranks, level, seed)`.
- Produces `ProgressionManager.gainEnemyKill(kind)`, `choose(ability)`, `getChoices()`, `getSnapshot()`.

- [ ] **Step 1: Write failing pure-rule tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  selectAbilityOptions,
  xpForEnemy,
  xpRequiredForLevel,
  type AbilityRanks,
} from './progressionRules';

const empty: AbilityRanks = { firepower: 0, kinetic: 0, explosion: 0, split: 0 };

describe('progression rules', () => {
  it('maps enemy kinds to XP and levels to exact costs', () => {
    expect(['basic', 'shooter', 'armored'].map(xpForEnemy)).toEqual([1, 2, 3]);
    expect([0, 1, 2, 3, 4].map(xpRequiredForLevel)).toEqual([8, 12, 16, 20, 24]);
  });

  it('returns three unique deterministic first choices with a combat effect', () => {
    const first = selectAbilityOptions(empty, 0, 1234);
    expect(first).toHaveLength(3);
    expect(new Set(first)).toHaveLength(3);
    expect(first.some((id) => id === 'explosion' || id === 'split')).toBe(true);
    expect(selectAbilityOptions(empty, 0, 1234)).toEqual(first);
  });

  it('excludes rank-five abilities and returns only remaining options', () => {
    expect(selectAbilityOptions(
      { firepower: 5, kinetic: 5, explosion: 4, split: 5 },
      19,
      9,
    )).toEqual(['explosion']);
  });
});
```

- [ ] **Step 2: Run focused rules test and confirm RED**

Run: `npm test -- src/game/progression/progressionRules.test.ts`

Expected: FAIL because `progressionRules.ts` does not exist.

- [ ] **Step 3: Implement pure rules**

Use exact types and validation:

```ts
import type { EnemyKind } from '../enemies/enemyRules';

export const ABILITY_IDS = ['firepower', 'kinetic', 'explosion', 'split'] as const;
export type AbilityId = typeof ABILITY_IDS[number];
export type AbilityRanks = Record<AbilityId, number>;

export function xpForEnemy(kind: EnemyKind): number {
  return kind === 'armored' ? 3 : kind === 'shooter' ? 2 : 1;
}

export function xpRequiredForLevel(level: number): number {
  if (!Number.isInteger(level) || level < 0) throw new RangeError('level must be a non-negative integer');
  return 8 + level * 4;
}

function nextSeed(seed: number): number {
  return (Math.imul(seed, 1664525) + 1013904223) >>> 0;
}

export function selectAbilityOptions(
  ranks: Readonly<AbilityRanks>,
  level: number,
  seed: number,
): AbilityId[] {
  const eligible = ABILITY_IDS.filter((id) => ranks[id] < 5);
  let state = (seed ^ Math.imul(level + 1, 2654435761)) >>> 0;
  const shuffled = [...eligible];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state = nextSeed(state);
    const swap = state % (index + 1);
    [shuffled[index], shuffled[swap]] = [shuffled[swap]!, shuffled[index]!];
  }
  const options = shuffled.slice(0, 3);
  if (level === 0 && !options.some((id) => id === 'explosion' || id === 'split')) {
    const effect = shuffled.find((id) => id === 'explosion' || id === 'split');
    if (effect && options.length > 0) options[options.length - 1] = effect;
  }
  return [...new Set(options)];
}
```

- [ ] **Step 4: Add failing stateful progression tests**

```ts
import { describe, expect, it } from 'vitest';
import { ProgressionManager } from './ProgressionManager';

describe('ProgressionManager', () => {
  it('preserves overflow and queues multiple choices', () => {
    const manager = new ProgressionManager(7);
    manager.gainExperience(21);
    expect(manager.getSnapshot()).toMatchObject({ level: 2, xp: 1, pendingChoices: 2 });
  });

  it('applies one valid choice and rejects stale or invalid choices', () => {
    const manager = new ProgressionManager(7);
    manager.gainExperience(8);
    const choice = manager.getChoices()[0]!;
    expect(manager.choose(choice)).toBe(true);
    expect(manager.getSnapshot().pendingChoices).toBe(0);
    expect(manager.choose(choice)).toBe(false);
  });

  it('stops gaining XP when all abilities reach rank five', () => {
    const manager = new ProgressionManager(7, {
      firepower: 5, kinetic: 5, explosion: 5, split: 5,
    });
    manager.gainExperience(100);
    expect(manager.getSnapshot()).toMatchObject({ level: 20, xp: 0, pendingChoices: 0 });
  });
});
```

- [ ] **Step 5: Run manager test and confirm RED**

Run: `npm test -- src/game/progression/ProgressionManager.test.ts`

Expected: FAIL because `ProgressionManager.ts` does not exist.

- [ ] **Step 6: Implement `ProgressionManager`**

Store `level`, `xp`, `pendingChoices`, `seed`, current choices, and an injected mutable `AbilityRanks`. `gainExperience(amount)` validates a finite non-negative number, repeatedly subtracts `xpRequiredForLevel(level)`, increments level and pending choices, then generates choices if none exist. `gainEnemyKill(kind)` delegates through `xpForEnemy`. `choose(id)` succeeds only when pending and the id is in current choices; increment the rank, decrement pending, then either generate the next choices or clear them. At all ranks 5, normalize to `{ level: 20, xp: 0, pendingChoices: 0, choices: [] }`.

Return defensive copies from:

```ts
export interface ProgressionSnapshot {
  level: number;
  xp: number;
  xpRequired: number | null;
  pendingChoices: number;
  choices: AbilityId[];
}
```

- [ ] **Step 7: Run focused and full tests**

Run: `npm test -- src/game/progression/progressionRules.test.ts src/game/progression/ProgressionManager.test.ts && npm test`

Expected: focused progression tests PASS; all existing tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/game/progression
git commit -m "feat: add XP progression rules"
```

---

### Task 2: Implement ability ranks and derived combat values

**Files:**
- Create: `src/game/progression/BuildState.ts`
- Create: `src/game/progression/BuildState.test.ts`
- Modify: `src/game/progression/ProgressionManager.ts`
- Modify: `src/game/progression/ProgressionManager.test.ts`

**Interfaces:**
- Produces `BuildState.rank(id)`, `upgrade(id)`, `getRanks()`, `directDamageBonus()`, `chargedSpeed()`, `explosion()`, `splitCount()`.
- `ProgressionManager` consumes one shared `BuildState` instead of a raw ranks record.

- [ ] **Step 1: Write failing exact-value tests**

```ts
import { describe, expect, it } from 'vitest';
import { BuildState } from './BuildState';

describe('BuildState', () => {
  it('derives exact firepower and kinetic values', () => {
    const build = new BuildState();
    for (let rank = 1; rank <= 5; rank += 1) {
      build.upgrade('firepower');
      build.upgrade('kinetic');
      expect(build.directDamageBonus()).toBe(rank * 0.25);
      expect(build.chargedSpeed()).toBe(400 + rank * 40);
    }
  });

  it('derives exact explosion and split tables', () => {
    const build = new BuildState();
    const explosions = [
      { radius: 48, damage: 0.5 },
      { radius: 56, damage: 0.75 },
      { radius: 64, damage: 1 },
      { radius: 72, damage: 1.25 },
      { radius: 80, damage: 1.5 },
    ];
    const splitCounts = [1, 1, 2, 2, 3];
    for (let rank = 0; rank < 5; rank += 1) {
      build.upgrade('explosion');
      build.upgrade('split');
      expect(build.explosion()).toEqual(explosions[rank]);
      expect(build.splitCount()).toBe(splitCounts[rank]);
    }
  });

  it('rejects a sixth rank', () => {
    const build = new BuildState({ firepower: 5, kinetic: 0, explosion: 0, split: 0 });
    expect(() => build.upgrade('firepower')).toThrow('firepower is already rank 5');
  });
});
```

- [ ] **Step 2: Run focused test and confirm RED**

Run: `npm test -- src/game/progression/BuildState.test.ts`

Expected: FAIL because `BuildState.ts` does not exist.

- [ ] **Step 3: Implement `BuildState`**

Use private ranks initialized to zero, validate every supplied rank is an integer from 0 through 5, return copies, and use exact tables:

```ts
const EXPLOSIONS = [
  null,
  { radius: 48, damage: 0.5 },
  { radius: 56, damage: 0.75 },
  { radius: 64, damage: 1 },
  { radius: 72, damage: 1.25 },
  { radius: 80, damage: 1.5 },
] as const;
const SPLIT_COUNTS = [0, 1, 1, 2, 2, 3] as const;
```

`chargedSpeed()` returns `400 * (1 + kineticRank * 0.1)`. `directDamageBonus()` returns `firepowerRank * 0.25`. `explosion()` returns a copy or `null`.

- [ ] **Step 4: Connect manager to shared build and rerun tests**

Change `ProgressionManager(seed, build = new BuildState())`. Choice generation reads `build.getRanks()`; successful choice calls `build.upgrade(id)`. Update its tests to inspect the supplied build after choices.

Run: `npm test -- src/game/progression`

Expected: all progression tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/progression
git commit -m "feat: derive ability combat values"
```

---

### Task 3: Replace pause booleans with reason-based pause control

**Files:**
- Create: `src/game/combat/CombatPauseController.ts`
- Create: `src/game/combat/CombatPauseController.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `e2e/combat.spec.ts`

**Interfaces:**
- Produces `add(reason)`, `remove(reason)`, `has(reason)`, `isPaused()`, `consumeGameplayDelta(delta)`.
- Reasons: `'visibility' | 'levelUp' | 'defeated'`.

- [ ] **Step 1: Write failing pure controller tests**

```ts
import { describe, expect, it } from 'vitest';
import { CombatPauseController } from './CombatPauseController';

describe('CombatPauseController', () => {
  it('resumes only after the last reason is removed', () => {
    const pause = new CombatPauseController();
    pause.add('visibility');
    pause.add('levelUp');
    pause.remove('visibility');
    expect(pause.isPaused()).toBe(true);
    pause.remove('levelUp');
    expect(pause.isPaused()).toBe(false);
  });

  it('discards the first delta after every paused interval', () => {
    const pause = new CombatPauseController();
    pause.add('visibility');
    expect(pause.consumeGameplayDelta(16)).toBe(0);
    pause.remove('visibility');
    expect(pause.consumeGameplayDelta(8_100)).toBe(0);
    expect(pause.consumeGameplayDelta(16)).toBe(16);
  });
});
```

- [ ] **Step 2: Run focused test and confirm RED**

Run: `npm test -- src/game/combat/CombatPauseController.test.ts`

Expected: FAIL because the controller does not exist.

- [ ] **Step 3: Implement reason set and delta discard**

Use `Set<PauseReason>`, make duplicate add/remove idempotent, return 0 while paused, and set one `discardNextDelta` flag only when transitioning from paused to unpaused. `defeated` may be added but never removed before scene restart.

- [ ] **Step 4: Refactor `CombatScene` without changing behavior**

Replace `visibilityPaused` and `discardNextEncounterDelta` with one controller. `update()` returns while paused, then obtains `gameplayDelta = pause.consumeGameplayDelta(delta)` and passes that same value to player movement, `OrbManager.update`, and `EncounterDirector.update`. Visibility change adds/removes `visibility`; defeat adds `defeated`. A private `syncPauseState()` calls `physics.pause()` and sets `time.paused = true` when paused, otherwise resumes both.

Update hidden E2E to retain its current timer, sequence, enemy-count, position, and first-resume-delta assertions.

- [ ] **Step 5: Run focused, full unit, and hidden E2E**

Run: `npm test -- src/game/combat/CombatPauseController.test.ts && npm test && npm run test:e2e -- --project=desktop-chromium --grep "pauses while hidden"`

Expected: controller and all existing tests PASS; hidden test PASS unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/game/combat/CombatPauseController.ts src/game/combat/CombatPauseController.test.ts src/game/scenes/CombatScene.ts e2e/combat.spec.ts
git commit -m "refactor: unify combat pause reasons"
```

---

### Task 4: Report combat kills, direct hits, and area damage

**Files:**
- Modify: `src/game/orbs/orbRules.ts`
- Modify: `src/game/orbs/orbRules.test.ts`
- Modify: `src/game/enemies/EnemyManager.ts`
- Modify: `src/game/enemies/EnemyManager.test.ts`

**Interfaces:**
- `HitResult` adds `charged: boolean`.
- `EnemyManagerOptions` adds `onEnemyKilled(event)` and `onDirectHit(event)`.
- Produces `applyAreaDamage(center, radius, damage, excludedEnemyId): number[]`.
- DEV-only `debugSetEnemy(id, position, hp)` arranges deterministic browser fixtures.

- [ ] **Step 1: Write failing event and area tests**

Add tests proving:

```ts
expect(directHit(1, 3, settings, false, 0.25)).toMatchObject({
  charged: true,
  charges: 0,
  damage: 1.75,
});
```

In `EnemyManager.test.ts`, extend the fake boundary callbacks and prove:

```ts
expect(onDirectHit).toHaveBeenCalledWith(expect.objectContaining({
  source: 'permanent', enemyId: 0, charged: true, position: { x: 36, y: 80 },
}));
expect(onEnemyKilled).toHaveBeenCalledOnce();
expect(onEnemyKilled).toHaveBeenCalledWith(expect.objectContaining({ kind: 'basic', enemyId: 0 }));
```

Add three enemies at known positions, call `applyAreaDamage({x: 100,y:100}, 50, 1, excludedId)`, and assert the excluded target is unchanged, one neighbor dies and reports a kill once, and an out-of-range enemy is unchanged. Breach removal must not call `onEnemyKilled`.

Add a DEV-only helper test proving `debugSetEnemy!(id, { x, y }, hp)` updates exactly one active enemy, rejects non-positive or non-finite HP, and returns false for an unknown ID.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- src/game/orbs/orbRules.test.ts src/game/enemies/EnemyManager.test.ts`

Expected: FAIL for missing charged flag, bonus parameter, callbacks, and area method.

- [ ] **Step 3: Extend direct-hit result**

Change signature to:

```ts
directHit(charges, enemyHp, settings, piercing, directDamageBonus = 0): HitResult
```

Validate finite non-negative bonus. Damage is `(charged ? 1.5 : 1) + directDamageBonus`; return `charged` from the pre-hit charge state.

- [ ] **Step 4: Add exact EnemyManager events**

```ts
export interface DirectHitEvent {
  source: 'permanent' | 'temporary';
  enemyId: number;
  position: Vector;
  charged: boolean;
}

export interface EnemyKilledEvent {
  enemyId: number;
  kind: EnemyKind;
  position: Vector;
}
```

`applyHit` captures kind/position, applies damage, emits `onDirectHit` once for accepted direct hits, then calls `killEnemy` only if HP is at most zero. `killEnemy` calls existing destruction cleanup first and then emits `onEnemyKilled` once. Breach continues to call destruction cleanup directly without kill event. `applyAreaDamage` iterates a snapshot of active enemies, excludes the primary ID, checks Euclidean center distance, applies raw damage without `onDirectHit`, and returns killed IDs.

Install `debugSetEnemy` only inside the existing `import.meta.env.DEV` block. It validates position coordinates and HP, updates the sprite/body position and HP, and returns a boolean indicating whether the active ID existed.

- [ ] **Step 5: Run focused and full unit tests**

Run: `npm test -- src/game/orbs/orbRules.test.ts src/game/enemies/EnemyManager.test.ts && npm test`

Expected: all tests PASS and old reflection/pass-through behavior remains.

- [ ] **Step 6: Commit**

```bash
git add src/game/orbs/orbRules.ts src/game/orbs/orbRules.test.ts src/game/enemies/EnemyManager.ts src/game/enemies/EnemyManager.test.ts
git commit -m "feat: emit combat hit and kill events"
```

---

### Task 5: Add level-up overlay and connect XP pause flow

**Files:**
- Create: `src/game/ui/LevelUpOverlay.ts`
- Create: `src/game/ui/LevelUpOverlay.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `e2e/combat.spec.ts`

**Interfaces:**
- `LevelUpOverlay.show(choices, build, onSelect)`, `hide()`, `isVisible()`, `destroy()`.
- `CombatDebugSnapshot` adds progression, build, pause reasons, and level-up visibility.
- DEV helpers add `debugGrantXp(amount)`, `debugChooseAbility(id)`, `debugUpgradeAbility(id)`, and `debugSetEnemy(id, position, hp)`.

- [ ] **Step 1: Write failing overlay boundary test**

Use a fake Phaser scene with rectangle/text objects and keyboard events. First call `show(['firepower','explosion','split'], build, callback)` and assert three interactive cards are created and pointer release on the second calls `callback('explosion')` once. Call `hide()`, call `show()` again with a fresh callback, and assert key `THREE` selects split once. Finally assert `hide()` destroys all objects/listeners and an out-of-range key does nothing.

- [ ] **Step 2: Run overlay test and confirm RED**

Run: `npm test -- src/game/ui/LevelUpOverlay.test.ts`

Expected: FAIL because the overlay does not exist.

- [ ] **Step 3: Implement portrait overlay**

Use a depth-30 full-screen blocker and three vertically stacked cards centered at Y `270`, `400`, `530`. Card width 360 and height 104. Render Korean labels:

```ts
const LABELS = {
  firepower: '화력 증폭',
  kinetic: '운동 에너지',
  explosion: '폭발',
  split: '분열',
} as const;
```

Each card shows current rank and exact next effect from `BuildState`. Bind `Phaser.Input.Keyboard.KeyCodes.ONE`, `TWO`, `THREE`; guard selection with a `consumed` boolean until the next `show()`.

- [ ] **Step 4: Add failing desktop level-up E2E**

Extend debug types, then:

```ts
await sceneCall(page, (scene) => scene.debugGrantXp(8));
await expect.poll(async () => (await snapshot(page)).levelUpVisible).toBe(true);
const paused = await snapshot(page);
await page.waitForTimeout(200);
expect((await snapshot(page)).encounter.elapsedMs).toBe(paused.encounter.elapsedMs);
await page.keyboard.press('Digit1');
await expect.poll(async () => (await snapshot(page)).levelUpVisible).toBe(false);
expect(Object.values((await snapshot(page)).buildRanks).reduce((a, b) => a + b, 0)).toBe(1);
```

- [ ] **Step 5: Run focused E2E and confirm RED**

Run: `npm run test:e2e -- --project=desktop-chromium --grep "pauses for level-up"`

Expected: FAIL because progression debug state and overlay do not exist.

- [ ] **Step 6: Compose progression in `CombatScene`**

Create one `BuildState`, `ProgressionManager(runSeed, build)`, `LevelUpOverlay`, and pause controller per scene create. Enemy `onEnemyKilled` calls `gainEnemyKill(kind)` then updates XP HUD and opens the overlay if pending. `openNextLevelUp()` adds `levelUp`, syncs pause, and displays current choices. Selection calls `progression.choose`, updates HUD, then either displays the next pending choice or hides overlay, removes `levelUp`, and syncs pause.

Add top HUD text `LV {level}  XP {xp}/{required}`. DEV helpers exist only in the current `import.meta.env.DEV` guard. `debugUpgradeAbility` directly calls `BuildState.upgrade` and refreshes combat modifiers without changing XP; it exists only for deterministic effect E2E. `debugSetEnemy` delegates to `EnemyManager`. On defeat, hide overlay before showing defeat. On shutdown, destroy overlay and clear references.

- [ ] **Step 7: Run overlay, progression, E2E, and full unit tests**

Run: `npm test -- src/game/ui/LevelUpOverlay.test.ts src/game/progression && npm run test:e2e -- --project=desktop-chromium --grep "pauses for level-up" && npm test`

Expected: all commands PASS.

- [ ] **Step 8: Commit**

```bash
git add src/game/ui src/game/scenes/CombatScene.ts e2e/combat.spec.ts
git commit -m "feat: add paused level-up choices"
```

---

### Task 6: Apply firepower and kinetic modifiers to permanent orbs

**Files:**
- Modify: `src/game/orbs/orbRules.ts`
- Modify: `src/game/orbs/orbRules.test.ts`
- Modify: `src/game/orbs/OrbManager.ts`
- Modify: `src/game/orbs/OrbManager.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`

**Interfaces:**
- `OrbManagerOptions.getDirectDamageBonus(): number`.
- `OrbManagerOptions.getChargedSpeed(): number`.
- Produces `OrbManager.refreshCombatModifiers()`.

- [ ] **Step 1: Write failing store and manager tests**

Prove charged direct damage is `1.5 + bonus`, uncharged damage is `1 + bonus`, launch uses injected charged speed, consuming the last charge normalizes to 400 after pass-through and reflected collisions, and `refreshCombatModifiers()` immediately rescales active charged bodies without changing direction.

Use assertions:

```ts
expect(Math.hypot(snapshot.velocity.x, snapshot.velocity.y)).toBeCloseTo(480);
expect(result).toMatchObject({ charged: true, damage: 1.75, charges: 0 });
expect(Math.hypot(after.velocity.x, after.velocity.y)).toBeCloseTo(400);
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- src/game/orbs/orbRules.test.ts src/game/orbs/OrbManager.test.ts`

Expected: FAIL for missing modifier providers and refresh method.

- [ ] **Step 3: Implement dynamic modifier providers**

Store provider functions in `OrbStore`. Launch speed is `getChargedSpeed()`. Direct hit passes `getDirectDamageBonus()` to `directHit`. Add a speed target helper returning charged speed when charges remain, otherwise 400. Normalize record and Phaser body velocity after accepted pass-through hits and after reflected hit synchronization. `refreshCombatModifiers()` normalizes every active permanent body using current charges and build.

- [ ] **Step 4: Wire current build providers**

Pass `() => build.directDamageBonus()` and `() => build.chargedSpeed()` when constructing `OrbManager`. After a successful level-up choice, call `orbManager.refreshCombatModifiers()` before gameplay resumes.

- [ ] **Step 5: Run focused, full unit, and existing collision E2E**

Run: `npm test -- src/game/orbs && npm test && npm run test:e2e -- --project=desktop-chromium --grep "Arcade collision"`

Expected: all tests PASS for both pass-through settings.

- [ ] **Step 6: Commit**

```bash
git add src/game/orbs src/game/scenes/CombatScene.ts
git commit -m "feat: apply permanent orb upgrades"
```

---

### Task 7: Apply non-recursive explosion damage

**Files:**
- Modify: `src/game/enemies/EnemyManager.ts`
- Modify: `src/game/enemies/EnemyManager.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `e2e/combat.spec.ts`

**Interfaces:**
- Consumes `DirectHitEvent` and `BuildState.explosion()`.
- Uses `EnemyManager.applyAreaDamage(center, radius, damage, excludedEnemyId)`.

- [ ] **Step 1: Write failing explosion integration tests**

In manager tests, verify the primary target is excluded, each neighbor is damaged once, multiple deaths emit one kill each, and `onDirectHit` is not emitted from area damage. In E2E, call `debugUpgradeAbility('explosion')`, use `debugSetEnemy` to place a primary and neighbor within 48px, hit the primary, and assert neighbor HP falls by exactly `0.5` with no second explosion.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- src/game/enemies/EnemyManager.test.ts && npm run test:e2e -- --project=desktop-chromium --grep "explosion damage"`

Expected: unit or E2E FAIL because direct-hit callback is not connected to build splash.

- [ ] **Step 3: Connect explosion once per direct event**

`CombatScene.handleDirectHit(event)` reads the build explosion value. If non-null, call area damage with the event position and primary enemy ID. Do not route area results through `handleDirectHit`. Draw one short-lived ring at the event position using the rank radius; destroy it after 120ms through scene time so pause also pauses the visual.

- [ ] **Step 4: Run focused, full unit, and explosion E2E**

Run: `npm test -- src/game/enemies/EnemyManager.test.ts && npm test && npm run test:e2e -- --project=desktop-chromium --grep "explosion damage"`

Expected: exact 0.5 splash and non-recursion tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/enemies/EnemyManager.ts src/game/enemies/EnemyManager.test.ts src/game/scenes/CombatScene.ts e2e/combat.spec.ts
git commit -m "feat: add orb explosion damage"
```

---

### Task 8: Add capped temporary split orbs

**Files:**
- Create: `src/game/orbs/TemporaryOrbManager.ts`
- Create: `src/game/orbs/TemporaryOrbManager.test.ts`
- Modify: `src/game/enemies/EnemyManager.ts`
- Modify: `src/game/enemies/EnemyManager.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `e2e/combat.spec.ts`

**Interfaces:**
- `TemporaryOrbManager.spawn(position, direction, count): number`.
- `getGroup()`, `handleEnemyHit(orb, enemyId, enemyHp, nowMs)`, `synchronizeOrb(orb)`, `update(nowMs)`, `getSnapshot()`, `destroy()`.
- `EnemyManagerOptions.temporaryOrbManager` registers one group collider.

- [ ] **Step 1: Write failing pure/fake-Phaser temporary orb tests**

Verify:

- rank counts use directions: one alternates ±25 degrees, two use ±25, three use -30/0/+30.
- speed magnitude is 440.
- cap 12 returns only available spawn count and never evicts existing records.
- lifetime expiry at exactly 1500ms destroys sprites.
- same orb/enemy pair rejects hits newer than 80ms.
- temporary direct damage is `0.5 + firepower bonus`.
- `destroy()` removes group, colliders/listeners owned by the manager, and records.

- [ ] **Step 2: Run focused test and confirm RED**

Run: `npm test -- src/game/orbs/TemporaryOrbManager.test.ts`

Expected: FAIL because the manager does not exist.

- [ ] **Step 3: Implement temporary orb manager**

Each sprite has a monotonically increasing `temporaryOrbId`, `expiresAt`, and per-enemy hit map. Spawn at the impact position with `setCircle(6).setBounce(1,1).setCollideWorldBounds(true)`. Use texture `orb-temporary`. `handleEnemyHit` returns `{ charged:false, charges:0, damage:0.5 + bonus, killed, reflect:true }`; it never exposes split state.

- [ ] **Step 4: Add temporary group collision in `EnemyManager`**

Register one collider between `temporaryOrbManager.getGroup()` and the existing enemy group. Use prefixed pending keys `temporary:{temporaryOrbId}:{enemyId}`. On completed reflected hit, synchronize temporary velocity, apply direct damage with source `temporary`, and emit `onDirectHit` so explosion can apply. The event always has `charged:false`, preventing split.

- [ ] **Step 5: Connect charged permanent split**

In `CombatScene.handleDirectHit`, after explosion, spawn temporary orbs only when `event.source === 'permanent'`, `event.charged === true`, and split count is positive. Use the permanent orb incoming direction captured in `DirectHitEvent.direction`; extend that event and tests with a normalized direction. Update and expire temporary orbs during gameplay frames. Pause freezes scene time, so expiry does not advance while paused. Add temporary texture and debug snapshot count.

- [ ] **Step 6: Add split E2E and confirm GREEN**

Call `debugUpgradeAbility('split')` five times, cause one charged direct hit, assert temporary count rises by 3, never exceeds 12 across repeated hits, and returns to zero after 1500ms of active game time. Also upgrade explosion once and confirm a temporary hit can splash while temporary hits never increase the temporary count.

Run: `npm test -- src/game/orbs/TemporaryOrbManager.test.ts src/game/enemies/EnemyManager.test.ts && npm test && npm run test:e2e -- --project=desktop-chromium --grep "temporary split"`

Expected: all focused, full unit, and split E2E tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/game/orbs/TemporaryOrbManager.ts src/game/orbs/TemporaryOrbManager.test.ts src/game/enemies/EnemyManager.ts src/game/enemies/EnemyManager.test.ts src/game/scenes/CombatScene.ts e2e/combat.spec.ts
git commit -m "feat: add temporary split orbs"
```

---

### Task 9: Complete mobile acceptance, cleanup, and verification

**Files:**
- Modify: `e2e/combat.spec.ts`
- Modify: `docs/playtests/2026-07-13-core-redesign-prototype.md`

**Interfaces:**
- Final debug snapshot includes progression, ranks, pause reasons, overlay visibility, and temporary count.
- Production bundle contains none of the mutation helper names.

- [ ] **Step 1: Add missing browser acceptance tests**

Add tests for:

- mobile taps a visible ability card and resumes;
- hidden plus level-up keeps all gameplay state paused until both reasons clear;
- multiple pending choices keep overlay and pause active between choices;
- defeat closes overlay and restart resets level, XP, ranks, pause reasons, and temporary count;
- four abilities at rank 5 stop XP and do not open overlay.

Use condition polling, not fixed sleeps, except the explicit 1500ms lifetime boundary test.

The restart assertion must match this exact snapshot shape:

```ts
expect(await snapshot(page)).toMatchObject({
  progression: { level: 0, xp: 0, pendingChoices: 0 },
  buildRanks: { firepower: 0, kinetic: 0, explosion: 0, split: 0 },
  pauseReasons: [],
  levelUpVisible: false,
  temporaryOrbs: 0,
});
```

The overlapping-pause test must grant 8 XP, hide the document, choose the visible card through `debugChooseAbility`, assert gameplay remains paused, then reveal the document and assert the first resume delta is discarded before normal progress resumes.

- [ ] **Step 2: Run focused new acceptance tests**

Run: `npm run test:e2e -- --grep "level-up|temporary split|explosion damage"`

Expected: all new desktop and mobile tests PASS.

- [ ] **Step 3: Run full verification**

Run:

```bash
npm test
npm run test:e2e
npm run build
git diff --check
```

Expected: all Vitest files PASS; desktop and mobile Playwright projects PASS; TypeScript/Vite build exits 0; diff check has no output.

- [ ] **Step 4: Audit production DEV isolation**

Run:

```bash
! rg "debugGrantXp|debugChooseAbility|debugUpgradeAbility|debugSetEnemy|debugPlaceOrb|debugRemoveEnemies|__RICHOCHET_GAME__" dist
```

Expected: command exits 0 with no matches.

- [ ] **Step 5: Record honest acceptance state**

Append a dated section containing exact fresh unit/E2E counts, build result, first-level target `15~20s`, initial ability pool, and automated explosion/split results. Keep these manual items pending until user play:

- first level actually arrives in 15~20 seconds;
- selection feels like a reward rather than interruption;
- split plus explosion creates a satisfying burst;
- 12 temporary orbs remain readable and performant on a physical phone;
- 1~3 minute power growth and enemy pressure stay balanced.

- [ ] **Step 6: Commit**

```bash
git add e2e/combat.spec.ts docs/playtests/2026-07-13-core-redesign-prototype.md
git commit -m "test: verify level-up power growth"
```

---

## Completion Gate

- [ ] Unit tests pass with zero failures.
- [ ] Desktop and mobile E2E pass with zero failures.
- [ ] Production build exits 0.
- [ ] `git diff --check` has no output.
- [ ] Production bundle contains no development mutation helpers or game global.
- [ ] Level-up pause, visibility pause, and defeat never resume each other incorrectly.
- [ ] Firepower, kinetic, explosion, and split match every approved rank value.
- [ ] Explosion and split cannot recurse.
- [ ] Temporary orb count never exceeds 12 and lifetime pauses with gameplay.
- [ ] Existing continuous ingress, orb recovery, collision, health, controls, and experiment tests remain green.
- [ ] Physical-device fun, readability, and 15~20-second first-level timing remain explicitly pending user playtest.
