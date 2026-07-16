# SDD Progress

## Baseline

- Branch: `codex/midboss-vertical-slice`
- Base: `3858022`
- Unit: 22 files, 148 tests passed

## Tasks

- Task 1 encounter progression: done (`8948f375f0726a5872c0a616bff97c6942f23ef8`, adapter `b06c6062b8a6f90e60cf3f68aa14e2c0d10538bf`, review fix `ced675edea085df8a101d4bc7885ddd91c044c53`)
- Task 2 pure boss rules: done (`d3c57cd7915f7f6558bfd62e090f3961f391453b`, review fix `83e125ecd52d50708c64e2d0079f91f873873dcc`)
- Task 3 BossManager: done (`71fbed0f5b5b2aefe8aedd27d134c8a3e8c22b15`, review fix `b491d9d0225ceb5705ee7f658a40ea8201bbacfe`)
- Task 4 boss relic modifiers: done (`8e04b2817fbc3c51fb0d2d015335c1abddd85289`, review fix `5bc3638436ff6768f43227363f6426384927adc7`)
- Task 5 scene and reward UI: done (`08c10910d2e3ce57f8b39cf82f28ec677ae48a7e`)
- Task 6 browser acceptance: pending
- Final review and verification: pending

## Minor findings

- Resolved in Task 3 (`71fbed0f5b5b2aefe8aedd27d134c8a3e8c22b15`): area damage selects the nearest eligible exposed part exactly once and can exclude the direct-hit part.
- Resolved in Task 3 review fix (`b491d9d0225ceb5705ee7f658a40ea8201bbacfe`): aimed warnings preserve their creation-time target; body reflection exclusion uses actual Arcade body bounds and orb radii for every exposed damage part.
- Task 2 review: validate invariants on public `BossState` inputs.
- Task 2 review: define and test accurate post-defeat damage behavior.
- Task 2 review: add asymmetric left-side reopening movement coverage.
