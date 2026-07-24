# Final Fix Report

- Status: DONE
- Fix commit: `65bde2008c496b4899606c38c7c8868b3ee69fc1`

## Findings fixed

- Restored exact reinforcement pressure: phase 0 has 1 armored and 0 shooters, phase 1 has 2 armored and 1 shooter, and phase 2 has 2 armored and 2 shooters.
- Added exact composition coverage across three run seeds and six sequences spanning multiple shuffle bags.
- Added interval and top-clearance checks before procedural formation generation.
- Cached one capacity-blocked formation by phase and spawn sequence, reused it across blocked updates, regenerated it after a phase change, and cleared it only after admission.
- Kept elapsed time accumulation, whole-formation capacity gating, sequence advancement, and formation ID updates unchanged.
- Used a Vitest module spy for generation-count assertions without adding a production injection API.

## TDD evidence

- RED: `npm test -- src/game/encounters/formationRules.test.ts src/game/encounters/EncounterDirector.test.ts` — exit 1; 4 tests failed. Phase 1 produced one armored enemy instead of two; cheap-blocked and capacity-blocked updates regenerated formations.
- Focused GREEN: `npm test -- src/game/encounters/formationRules.test.ts src/game/encounters/EncounterDirector.test.ts` — 2 files passed, 29 tests passed.
- Full unit: `npm test` — 22 files passed, 148 tests passed.
- Production build: `npm run build` — exit 0; `tsc --noEmit` and Vite build passed, with only the existing large-chunk advisory.
- Diff hygiene: `git diff --check` — passed.

## Scope

- Changed only formation rules, encounter director, their unit tests, and SDD tracking files.
- Did not change E2E tests, gameplay docs, or DEV seed injection.

## Final-stage validation fixes

## RED

- `stageDefinitions.test.ts`: capped eligible pool could not fill a profile; worst splitter population exceeded `activeCap`; stage/profile/phase tag filters were ignored.
- `formationRules.test.ts`: catalog selection ignored tag and exclusion filters.

## GREEN

- Validator now merges tag/exclusion filters, requires eligible caps to fill `profile.maximum`, and rejects worst-case splitter population above `activeCap` using `populationCostForEnemy()`.
- Formation recipes apply merged filters; the director forwards stage/phase filters without adding empty fields.

## Result

- Focused: 38 tests passed.
- Full: 41 files, 445 tests passed.
- `npm run build` passed.
- Self-review: default filters are empty, so existing formation output and seed determinism remain unchanged.

## Combat fixes

### Root causes

1. `rewardCompleted` cleared hostile actions for every boss reward, but the final `runCompleted` branch left live `EnemyManager` sprites intact.
2. `excludedBossTargetId` stopped at `schedulePlannedAftershock`; queued effects lost it, so aftershock could hit the original boss target.

### Fixes and verification

- Added reusable `EnemyManager.clearEnemies()` and call it only for `runCompleted`; ordinary stage advances retain enemies.
- Preserved boss target exclusion from direct hit through scheduling, queue drain, and delayed settlement.
- RED: missing manager/scheduler state; removed forwarding produced `excludedBossTargetId: undefined`; removed final cleanup made desktop E2E retain enemies.
- GREEN: focused 61 tests; targeted desktop E2E; `npm test` 444 passed; `npm run build` passed.

## Hive enrage fan follow-up

- Fixed `enrageFanCount` so it increments only after an enrage fan warning is actually created. Hostile-cap-skipped cycles still advance their deadlines but no longer consume the 0°/6° alternation.
- Added regression coverage: after a cap-skipped fan cycle, the first actual fan fires at 0° and the next at 6°.

### TDD evidence

- RED: `npm test -- src/game/bosses/HiveBossManager.test.ts` — exit 1; the first actual fan fired at 6° instead of 0°.
- Focused GREEN: `npm test -- src/game/bosses/HiveBossManager.test.ts` — 1 file passed, 30 tests passed.
- Full unit: `npm test` — 41 files passed, 442 tests passed.
- Production build: `npm run build` — exit 0; `tsc --noEmit` and Vite build passed, with only the Vite large-chunk advisory.
- Diff hygiene: `git diff --check` — passed.
