# Trigger Weapons Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five approved trigger abilities and finish readable conduction/corrosion target feedback.

**Architecture:** Extend the existing ability registry, `BuildState`, and deterministic `CombatProcState`. Reuse `CombatScene` as the secondary-effect coordinator and add only the smallest target-query/damage methods required by enemy and boss managers.

**Tech Stack:** TypeScript, Phaser 3, Vitest, Playwright.

## Global Constraints

- Secondary damage cannot recursively trigger abilities.
- All tunable values belong in `GAME_TUNING`.
- The existing 12-kind cap remains authoritative.
- Browser automation runs only after unit behavior is green.

---

### Task 1: Ability definitions and proc decisions

**Files:**
- Modify: `src/game/progression/progressionRules.ts`
- Modify: `src/game/progression/BuildState.ts`
- Modify: `src/game/config/gameTuning.ts`
- Modify: `src/game/combat/CombatProcState.ts`
- Test corresponding `.test.ts` files.

- [ ] Write failing tests for five new ranks, two laser proc streams, kill reaction, six-hit missile, and four-recovery shockwave.
- [ ] Run focused tests and confirm expected failures.
- [ ] Add minimal registry, tuning, build specs, proc streams, and counters.
- [ ] Run focused tests and commit.

### Task 2: Target geometry and immediate effects

**Files:**
- Modify: `src/game/enemies/EnemyManager.ts`
- Modify: `src/game/bosses/bossEncounter.ts`
- Modify: `src/game/bosses/BossManager.ts`
- Modify: `src/game/bosses/HiveBossManager.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Test corresponding manager/rule files.

- [ ] Write failing tests for horizontal/vertical strip targeting and nearest-target positions.
- [ ] Implement non-recursive secondary damage methods.
- [ ] Connect laser and kill-explosion plans to permanent hit events.
- [ ] Draw lasers, actual conduction links, and corrosion tick numbers.
- [ ] Run focused tests and commit.

### Task 3: Missile and recovery shockwave

**Files:**
- Modify: `src/game/combat/CombatEffectScheduler.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Test: `src/game/combat/CombatEffectScheduler.test.ts`
- Test: `e2e/combat.spec.ts`

- [ ] Write failing scheduler and focused browser tests.
- [ ] Schedule one target-bound missile impact after `180ms`.
- [ ] Trigger and draw recovery shockwaves after four proximity recoveries.
- [ ] Run focused tests, build, and focused E2E; commit.

### Task 4: Integration verification

- [ ] Run all unit tests.
- [ ] Run production build.
- [ ] Run the full desktop/mobile E2E suite once.
- [ ] Review diff and working-tree state.
