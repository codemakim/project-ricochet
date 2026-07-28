# General Ability Foundation Implementation Plan

> Execute continuously on `codex/general-ability-foundation`. Unit tests after each task; browser only after integration.

**Goal:** Expand the current four-option level-up system into the first usable general-ability foundation, including the 12-kind run cap and four orb-control synergies.

**Scope:** Keep the existing `BuildState → ProgressionManager → OrbStore` flow. Add no new framework. Centralize current ability metadata and tuning, then extend permanent-orb flight state just enough for near-hit, precision-hit, speed conversion, and wall acceleration. Temporary orbs receive only the migrated base firepower bonus.

## Task 1: Central ability registry

**Files**
- Modify: `src/game/progression/progressionRules.ts`
- Modify: `src/game/config/gameTuning.ts`
- Modify: `src/game/progression/BuildState.ts`
- Modify: `src/game/ui/LevelUpOverlay.ts`
- Test: `src/game/progression/progressionRules.test.ts`
- Test: `src/game/progression/BuildState.test.ts`

**Behavior**
- Define one registry for IDs, labels, descriptions, and maximum ranks.
- Include `firepower`, `kinetic`, `explosion`, `split`, `near-amplification`, `precision-hit`, `kinetic-conversion`, and `wall-acceleration`.
- Derive IDs and maximum ranks from that registry.
- Move firepower and kinetic numeric values into `GAME_TUNING`.
- Migrate firepower to `+12%` per rank and kinetic speed to `+7%` per rank.
- Make the level-up overlay read registry metadata instead of local labels.

## Task 2: Selection rules and 12-kind cap

**Files**
- Modify: `src/game/progression/progressionRules.ts`
- Modify: `src/game/progression/BuildState.ts`
- Modify: `src/game/progression/ProgressionManager.ts`
- Test: `src/game/progression/progressionRules.test.ts`
- Test: `src/game/progression/ProgressionManager.test.ts`

**Behavior**
- Count distinct owned general abilities.
- Before 12 kinds, offer owned non-max abilities and eligible unowned abilities.
- At 12 kinds, offer only owned non-max abilities.
- Keep three unique deterministic choices.
- Support registry prerequisites; no current first-batch ability needs one, but test the shared eligibility rule through an exported pure helper.
- Stop XP only when no eligible upgrade remains, not when every registered ability is globally maxed.

## Task 3: Permanent direct-hit context

**Files**
- Modify: `src/game/progression/BuildState.ts`
- Modify: `src/game/orbs/orbRules.ts`
- Modify: `src/game/orbs/OrbManager.ts`
- Modify: `src/game/enemies/EnemyManager.ts`
- Modify: `src/game/bosses/BossManager.ts`
- Modify: `src/game/bosses/HiveBossManager.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Test: `src/game/progression/BuildState.test.ts`
- Test: `src/game/orbs/orbRules.test.ts`
- Test: `src/game/orbs/OrbManager.test.ts`

**Behavior**
- Pass the player-to-target distance into permanent hit resolution.
- Track wall hits for the current flight.
- Apply:
  - near amplification at `<=150px`, `+15%` per rank;
  - precision hit before the first wall, `+20%` per rank;
  - kinetic conversion for each full `10%` speed above base, `+6%` per rank, capped at `+36%`.
- Use multiplicative base firepower and additive core/conditional bonus.
- Preserve existing charged, boss-reward, piercing, and core behavior.
- Temporary orbs use base firepower only; no permanent-orb conditional effects.

## Task 4: Wall acceleration

**Files**
- Modify: `src/game/orbs/OrbManager.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Test: `src/game/orbs/OrbManager.test.ts`

**Behavior**
- Each wall collision adds one stack, maximum five.
- Each rank grants `+4%` speed per stack.
- Recalculate active speed immediately after a wall collision.
- Reset stacks when the orb is recovered/launched for a new flight.
- Expose stack count in the existing orb debug snapshot.

## Task 5: Integration verification

**Files**
- Modify only if tests reveal defects.

**Checks**
- Run focused progression/orb/UI tests.
- Run full unit suite.
- Run production build.
- Run the existing desktop and mobile E2E suite once.
- Review the final diff and working tree.

**Deferred**
- Remaining direct-hit abilities.
- Lasers, missiles, shockwaves, gas tuning, and effect-upgrade prerequisites.
- Filling all 12 slots; the cap is implemented now and becomes reachable as later ability batches land.
