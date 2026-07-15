# Task 2 Report

- Status: DONE
- Implementation commit: `3041ca740d4eedc82209d6d089f7de2dc45a60e2`

## Tests

- RED: `npm test -- src/game/encounters/EncounterDirector.test.ts src/game/encounters/encounterRules.test.ts src/game/enemies/enemyRules.test.ts` — exit 1; 2 files failed, 1 passed; 8 tests failed because the director still emitted fixed 8-enemy formations without seed metadata and caps remained `28/34/40`.
- Focused GREEN: `npm test -- src/game/enemies/EnemyManager.test.ts src/game/encounters/EncounterDirector.test.ts src/game/encounters/encounterRules.test.ts src/game/enemies/enemyRules.test.ts` — 4 files passed, 29 tests passed.
- Full unit suite: `npm test` — 22 files passed, 143 tests passed.
- Typecheck and production build: `npm run build` — exit 0; `tsc --noEmit` and Vite build passed.
- Diff hygiene: `git diff --check` — passed.

## Result

- `CombatScene` now assigns one unsigned run seed per `create()`, shares it between the initial formation and `EncounterDirector`, and keeps progression on the renamed fixed `PROGRESSION_SEED`.
- `EncounterDirector` now uses seeded procedural reinforcement results, gates against each result's actual enemy count, and records `runSeed` plus the last admitted formation ID in snapshots.
- Threat caps are `32/40/48`; spawn intervals remain `8000/7000/6000ms`.
- `EnemyManager` accepts the scene-provided initial formation and uses `createInitialFormation(0).enemies` only as its deterministic fallback.
- Removed fixed prototype formation data and the temporary two-argument reinforcement overload.
- Self-review confirmed blocked formations do not advance sequence or ID metadata, consecutive admitted formations differ, and no two-argument reinforcement callers remain.

## Concerns

- Vite still emits the existing advisory that the main minified chunk exceeds 500 kB; build succeeds.
- Browser acceptance and restart/run-variation coverage remain Task 3 work.
