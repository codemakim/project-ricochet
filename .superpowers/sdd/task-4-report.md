# Task 4 Report

- Status: DONE
- Starting commit: `ebb5c3950cea8362a65223720163b82039b1834c`
- Implementation commit: `8e04b2817fbc3c51fb0d2d015335c1abddd85289`
- Review-fix commit: `5bc3638436ff6768f43227363f6426384927adc7`

## RED-GREEN Evidence

- Initial RED: `npm test -- src/game/progression/bossRewardRules.test.ts src/game/progression/BossBuild.test.ts src/game/orbs/OrbManager.test.ts` — exit 1; both new modules were missing, `addOrb()` was missing, proximity restoration stayed at 3, and opening damage was absent.
- Focused GREEN: same command — exit 0; 3 files and 38 tests passed.
- Full unit suite: `npm test` — exit 0; 28 files and 234 tests passed.
- Typecheck and production build: `npm run build` — exit 0; `tsc --noEmit` and Vite build passed, 31 modules transformed.
- Diff hygiene: `git diff --check` and `git diff --cached --check` — exit 0.

## Files

- `src/game/progression/BossBuild.ts`
- `src/game/progression/BossBuild.test.ts`
- `src/game/progression/bossRewardRules.ts`
- `src/game/progression/bossRewardRules.test.ts`
- `src/game/orbs/OrbManager.ts`
- `src/game/orbs/OrbManager.test.ts`

## Result

- Defines exactly four boss reward IDs and deterministically selects up to three unique, unowned eligible rewards. `chain-warhead` requires both split and explosion rank 1; the three universal rewards remain the default rank-zero selection.
- `BossBuild` separately owns relic state, rejects duplicates, exposes the expanded four-orb limit, source-aware restoration, opening-hit damage, and the Task 5 temporary-explosion capability flag.
- `OrbStore.addOrb()` and `OrbManager.addOrb()` add one permanent record/sprite at runtime, immediately queue it after aim activation, and enforce the global six-orb cap.
- Recovery providers restore 5 charges only for proximity with the capacitor contract; floor and timeout restoration remain 3.
- Each orb tracks opening-hit pending state after proximity recovery. The first accepted `handleEnemyHit()` call receives +1 and consumes it, including negative boss-part IDs. Floor/timeout recovery clears pending state.
- Default providers preserve all prior three-orb, three-charge, zero-opening-bonus behavior.
- No Scene/UI work and no temporary-orb explosion gating were added.

## Self-review

- Checked all Task 4 brief bindings against tests and production paths.
- Confirmed the runtime sprite receives the same ownership, world-bounds, collision, visibility, synchronization, and destroy behavior as constructor-created sprites.
- Confirmed hit cooldown rejection occurs before opening-bonus consumption. Boss body reflection remains outside `handleEnemyHit()`, as covered by the existing `BossManager` test.
- Confirmed reward ownership and ability eligibility are independent and deterministic for identical seeds.

## Concerns

- Vite retains the existing advisory that the main minified chunk exceeds 500 kB; build succeeds.
- Task 5 must call `addOrb()` when `expanded-magazine` is acquired and wire `BossBuild` providers/temporary-explosion flag into Scene flow.

## Review Fix Evidence

- Focused RED: `npm test -- src/game/progression/bossRewardRules.test.ts src/game/orbs/OrbManager.test.ts src/game/enemies/EnemyManager.test.ts src/game/bosses/BossManager.test.ts` — exit 1; 15 tests failed for runtime collider registration, subscription cleanup, undersized reward selection, invalid modifier callback values, non-proximity provider use, and post-destroy `addOrb()`.
- Focused GREEN: same command — exit 0; 4 files and 86 tests passed.
- Full unit suite: `npm test` — exit 0; 28 files and 250 tests passed.
- Typecheck and production build: `npm run build` — exit 0; `tsc --noEmit` and Vite build passed, 31 modules transformed.
- Diff hygiene: `git diff --check` and `git diff --cached --check` — exit 0 before the review-fix commit.

## Review Fix Result

- `OrbManager.onOrbAdded()` provides a narrow subscription returning an unsubscribe function. Existing `EnemyManager` and active `BossManager` instances add only the required permanent colliders for each runtime sprite and unsubscribe during destruction; constructor sprites are not emitted again.
- `OrbManager.addOrb()` returns `false` after destruction and creates no sprite.
- Reward selection throws a clear `RangeError` when ownership and chain eligibility leave fewer than three candidates.
- Opening bonus lookup runs only for a pending first proximity hit, accepts exactly `0` or `1`, and validates before hit bookkeeping or pending consumption.
- Non-proximity recovery always restores 3 without calling the provider. Proximity restoration accepts exactly 3 or 5 and validates before changing stored/relaunch state.
- No Scene/UI work or chain gating was added.
