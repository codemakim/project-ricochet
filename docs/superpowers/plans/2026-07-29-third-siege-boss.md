# Third Siege Boss Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add stage three and a large configurable siege-platform boss, then finish the run directly after its defeat.

**Architecture:** Extend the existing typed stage data and `BossEncounter` factory. Keep geometry and phase decisions pure, keep Phaser objects in `SiegeBossManager`, and add only one reusable moving-laser pattern.

**Tech Stack:** TypeScript 5.9, Phaser 3.90, Vitest 4.1, Playwright 1.61.

## Global Constraints

- Stage-three descent speed multiplier stays exactly `1`.
- Boss tuning lives in `GAME_TUNING.siegeBoss`.
- The core is locked while any module lives.
- Modules may be destroyed in any order.
- Final boss defeat enters `runComplete` without a combat reward.
- Boss cleanup removes bullets, hazards, warnings, and lasers.

---

### Task 1: Stage-three data and final-boss transition

**Files:**
- Modify: `src/game/config/gameTuning.ts`
- Modify: `src/game/config/gameTuning.test.ts`
- Modify: `src/game/encounters/stageDefinitions.ts`
- Modify: `src/game/encounters/stageDefinitions.test.ts`
- Modify: `src/game/encounters/EncounterDirector.ts`
- Modify: `src/game/encounters/EncounterDirector.test.ts`
- Modify: `src/game/encounters/encounterProgressionRules.ts`

**Interfaces:**
- Produces: `BossKind` including `'siege'`, `StageId` including `'default-3'`, and `markBossDefeated(): BossDefeatAdvance`.
- Consumes: existing `STAGES` ordering.

- [ ] **Step 1: Write failing stage and transition tests**

```ts
expect(STAGES.map(({ id }) => id)).toEqual(['default-1', 'default-2', 'default-3']);
expect(STAGES[2]!.descentSpeedMultiplier).toBe(1);
expect(director.markBossDefeated()).toEqual({ type: 'runCompleted' });
```

Also prove stages one and two return `{ type: 'rewardRequired' }`.

- [ ] **Step 2: Run focused tests**

Run: `rtk npx vitest run src/game/encounters/stageDefinitions.test.ts src/game/encounters/EncounterDirector.test.ts src/game/config/gameTuning.test.ts`

Expected: FAIL because stage three and direct completion do not exist.

- [ ] **Step 3: Add stage data and explicit defeat advance**

```ts
export type BossDefeatAdvance =
  | { type: 'rewardRequired' }
  | { type: 'runCompleted' };

markBossDefeated(): BossDefeatAdvance;
```

Use existing `assault` and `onslaught` profiles with higher HP, population caps, and special-enemy weights. Do not add enemies or increase descent speed.

- [ ] **Step 4: Run focused tests**

Run: `rtk npx vitest run src/game/encounters/stageDefinitions.test.ts src/game/encounters/EncounterDirector.test.ts src/game/config/gameTuning.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/game/config/gameTuning.ts src/game/config/gameTuning.test.ts src/game/encounters/stageDefinitions.ts src/game/encounters/stageDefinitions.test.ts src/game/encounters/EncounterDirector.ts src/game/encounters/EncounterDirector.test.ts src/game/encounters/encounterProgressionRules.ts
rtk git commit -m "feat: add third stage progression"
```

### Task 2: Siege geometry and pure phase rules

**Files:**
- Create: `src/game/bosses/siegeBossRules.ts`
- Create: `src/game/bosses/siegeBossRules.test.ts`
- Create: `src/game/bosses/siegeBossGeometry.ts`
- Create: `src/game/bosses/siegeBossGeometry.test.ts`

**Interfaces:**
- Produces: `SiegePartId`, `SiegeState`, `damageSiegePart`, `siegePhase`, and part rectangles.
- Consumes: `GAME_TUNING.siegeBoss` dimensions and HP.

- [ ] **Step 1: Write failing pure tests**

Prove free-order module destruction, locked core damage rejection, core unlock after all modules die, enrage phase, and doubled visual dimensions without off-screen rectangles.

- [ ] **Step 2: Run focused tests**

Run: `rtk npx vitest run src/game/bosses/siegeBossRules.test.ts src/game/bosses/siegeBossGeometry.test.ts`

Expected: FAIL because both modules are absent.

- [ ] **Step 3: Implement immutable rules and geometry**

```ts
export type SiegePartId = 'leftCannon' | 'rightCannon' | 'defenseModule' | 'core';
export type SiegePhase = 'modules' | 'enraged' | 'defeated';
export function damageSiegePart(
  state: SiegeState,
  part: SiegePartId,
  damage: number,
): { state: SiegeState; applied: number; killed: boolean };
```

- [ ] **Step 4: Run focused tests**

Run: `rtk npx vitest run src/game/bosses/siegeBossRules.test.ts src/game/bosses/siegeBossGeometry.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/game/bosses/siegeBossRules.ts src/game/bosses/siegeBossRules.test.ts src/game/bosses/siegeBossGeometry.ts src/game/bosses/siegeBossGeometry.test.ts
rtk git commit -m "feat: define siege boss rules"
```

### Task 3: Moving laser pattern

**Files:**
- Modify: `src/game/bosses/bossAttackPatterns.ts`
- Modify: `src/game/bosses/bossAttackPatterns.test.ts`

**Interfaces:**
- Produces: `movingVerticalLaser(startX, direction, bounds, speed, warningMs, activeMs, width)`.
- Consumes: finite numeric tuning.

- [ ] **Step 1: Write failing pattern tests**

Assert warning and active timing, left/right clamping, deterministic direction, and rejection of zero width, speed, or duration.

- [ ] **Step 2: Run the test**

Run: `rtk npx vitest run src/game/bosses/bossAttackPatterns.test.ts`

Expected: FAIL because the pattern function is missing.

- [ ] **Step 3: Implement the pure laser specification**

```ts
export interface MovingLaserSpec {
  startX: number;
  endX: number;
  speed: number;
  warningMs: number;
  activeMs: number;
  width: number;
}
```

- [ ] **Step 4: Run the test**

Run: `rtk npx vitest run src/game/bosses/bossAttackPatterns.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/game/bosses/bossAttackPatterns.ts src/game/bosses/bossAttackPatterns.test.ts
rtk git commit -m "feat: add moving boss laser pattern"
```

### Task 4: Phaser siege manager

**Files:**
- Create: `src/game/bosses/SiegeBossManager.ts`
- Create: `src/game/bosses/SiegeBossManager.test.ts`
- Modify: `src/game/bosses/bossEncounter.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `src/game/scenes/combatSceneRules.ts`
- Modify: `src/game/scenes/combatSceneRules.test.ts`

**Interfaces:**
- Consumes: `BossEncounter`, siege rules, geometry, common shot patterns, player callbacks.
- Produces: full `BossEncounter` implementation for kind `'siege'`.

- [ ] **Step 1: Write failing fake-Phaser manager tests**

Cover spawn snapshot, slow movement, each module's attack, attack cancellation after module death, locked core, enraged cadence, direct/area/line damage, laser player hit, and cleanup.

- [ ] **Step 2: Run focused tests**

Run: `rtk npx vitest run src/game/bosses/SiegeBossManager.test.ts src/game/scenes/combatSceneRules.test.ts`

Expected: FAIL because the manager and factory branch are missing.

- [ ] **Step 3: Implement the manager by reusing existing helpers**

Reuse `aimedShot`, `fanShots`, `fallingOrigins`, existing bullet caps, and existing boss direct-hit collision setup. Add laser graphics and overlap checks only inside this manager.

- [ ] **Step 4: Run focused tests and build**

Run: `rtk npx vitest run src/game/bosses/SiegeBossManager.test.ts src/game/scenes/combatSceneRules.test.ts`

Run: `rtk npm run build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/game/bosses/SiegeBossManager.ts src/game/bosses/SiegeBossManager.test.ts src/game/bosses/bossEncounter.ts src/game/scenes/CombatScene.ts src/game/scenes/combatSceneRules.ts src/game/scenes/combatSceneRules.test.ts
rtk git commit -m "feat: add siege platform boss"
```

### Task 5: Three-stage combat integration

**Files:**
- Modify: `e2e/combat.spec.ts`
- Modify: `src/game/ui/RunCompleteOverlay.ts`
- Modify: `src/game/ui/RunCompleteOverlay.test.ts`

**Interfaces:**
- Consumes: three-stage encounter and final `runCompleted`.
- Produces: browser evidence for stage three and direct completion.

- [ ] **Step 1: Extend the E2E debug snapshot and tests**

Assert stage IDs 1→2→3, rewards only after bosses one and two, all siege attacks, module shutdown, enraged core, and direct run-complete overlay after boss three.

- [ ] **Step 2: Run unit tests and build**

Run: `rtk npm test`

Run: `rtk npm run build`

Expected: PASS.

- [ ] **Step 3: Run focused browser integration once**

Run: `rtk npm run test:e2e -- --grep "siege|completes all three stages"`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
rtk git add e2e/combat.spec.ts src/game/ui/RunCompleteOverlay.ts src/game/ui/RunCompleteOverlay.test.ts
rtk git commit -m "test: verify three-stage combat loop"
```
