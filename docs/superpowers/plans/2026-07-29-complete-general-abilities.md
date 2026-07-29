# Complete General Abilities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the approved 33-ability run pool by adding the remaining 20 basic, direct-hit, and effect-modifier abilities.

**Architecture:** Keep `ABILITY_DEFINITIONS`, `GAME_TUNING`, and `BuildState` as the ability registry, numeric source, and derived-build API. Extend existing orb flight records and `CombatScene` coordination only where runtime state is required; secondary damage remains non-recursive.

**Tech Stack:** TypeScript 5.9, Phaser 3.90, Vitest 4.1, Playwright 1.61.

## Global Constraints

- The run may own at most 12 general ability kinds.
- Permanent orb cores and boss relics do not consume the 12-kind cap.
- All adjustable values live in `GAME_TUNING`.
- Secondary damage and temporary orbs never start another proc.
- Browser verification runs only after all unit tests and the production build pass.

---

### Task 1: Basic growth abilities

**Files:**
- Modify: `src/game/progression/progressionRules.ts`
- Modify: `src/game/config/gameTuning.ts`
- Modify: `src/game/progression/BuildState.ts`
- Modify: `src/game/orbs/OrbManager.ts`
- Modify: `src/game/player/playerRules.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Test: corresponding `.test.ts` files

**Interfaces:**
- Produces: `BuildState.orbLimit()`, `orbRadius()`, `recoveryRadius()`, `playerSpeed()`, and `maximumHealth()`.
- Consumes: existing orb add/recovery, player movement, and health initialization flows.

- [ ] Add failing registry and `BuildState` tests for `additional-core`, `core-expansion`, `recovery-field`, `mobility-motor`, and `armor-reinforcement`.
- [ ] Run focused tests; confirm failures are missing IDs/APIs.
- [ ] Add centralized rank values and minimal derived methods.
- [ ] Thread dynamic orb limit/radius/recovery radius, player speed, and immediate max-health growth through existing managers.
- [ ] Run focused tests and commit.

### Task 2: Direct-hit flight abilities

**Files:**
- Modify: `src/game/progression/progressionRules.ts`
- Modify: `src/game/config/gameTuning.ts`
- Modify: `src/game/progression/BuildState.ts`
- Modify: `src/game/orbs/orbRules.ts`
- Modify: `src/game/orbs/OrbManager.ts`
- Modify: `src/game/enemies/EnemyManager.ts`
- Modify: `src/game/bosses/bossEncounter.ts`
- Modify: both boss managers
- Test: corresponding `.test.ts` files

**Interfaces:**
- Produces: direct-hit context and flight state for reload overcharge, consecutive hits, kill overclock, collision acceleration, tracking magnet, and high-speed impact.
- Consumes: direct-hit `killed`, wall collision, recovery source, launch speed, and proximity recovery.

- [ ] Add failing pure and manager tests for all six flight abilities and reset boundaries.
- [ ] Run focused tests; confirm each missing behavior.
- [ ] Add the smallest per-orb state fields and `BuildState` calculations.
- [ ] Apply damage/speed/recovery modifiers without changing temporary-orb behavior.
- [ ] Emit high-speed impact commands through the existing non-recursive area-damage path.
- [ ] Run focused tests and commit.

### Task 3: Effect modifiers

**Files:**
- Modify: `src/game/progression/progressionRules.ts`
- Modify: `src/game/config/gameTuning.ts`
- Modify: `src/game/progression/BuildState.ts`
- Modify: `src/game/combat/CorrosionFieldState.ts`
- Modify: `src/game/orbs/TemporaryOrbManager.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Test: corresponding `.test.ts` files

**Interfaces:**
- Produces: proc chance, secondary damage, circular radius, duration, cutter thickness, split count, temporary damage/lifetime, and conduction target modifiers.
- Consumes: existing proc, corrosion, cutter, split, missile, shockwave, explosion, temporary-orb, and conduction flows.

- [ ] Add failing tests for `proc-optimization`, `effect-output`, `area-expansion`, `duration-module`, `focusing-lens`, `fragment-expansion`, `fragment-output`, `fragment-stabilization`, and `conduction-expansion`.
- [ ] Run focused tests; confirm failures.
- [ ] Add tuning and derived modifier methods.
- [ ] Apply each modifier once at its shared source so sibling effects cannot diverge.
- [ ] Run focused tests and commit.

### Task 4: UI and integration

**Files:**
- Modify: `src/game/ui/LevelUpOverlay.ts`
- Modify: `src/game/progression/ProgressionManager.ts` only if completion tests expose a defect
- Modify: `e2e/combat.spec.ts`

**Interfaces:**
- Consumes: all 33 definitions and derived next-rank values.
- Produces: readable level-up cards and 33-kind debug fixtures.

- [ ] Add failing UI tests for exact, rounded next-rank summaries.
- [ ] Add minimal summaries without duplicating tuning constants.
- [ ] Update all-abilities E2E fixtures to derive from production IDs/ranks.
- [ ] Run focused tests and commit.

### Task 5: Final verification

- [ ] Run `npm test -- --run`.
- [ ] Run `npm run build`.
- [ ] Run `npm run test:e2e` once for desktop and mobile.
- [ ] Run `git diff --check`, inspect the diff, and confirm a clean worktree after commit.
