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
- Task 5 scene and reward UI: done (`08c10910d2e3ce57f8b39cf82f28ec677ae48a7e`, review fix `8eb1bfc5c4bf50157bda9c20bddbd13eb1fe2a2e`)
- Task 6 browser acceptance: done (`98cc1ca`, hardening `6fb0330`, stabilization `31573fd`)
- Final review and verification: done (`96e39da`)

## Minor findings

- Resolved in Task 3 (`71fbed0f5b5b2aefe8aedd27d134c8a3e8c22b15`): area damage selects the nearest eligible exposed part exactly once and can exclude the direct-hit part.
- Resolved in Task 3 review fix (`b491d9d0225ceb5705ee7f658a40ea8201bbacfe`): aimed warnings preserve their creation-time target; body reflection exclusion uses actual Arcade body bounds and orb radii for every exposed damage part.
- Task 2 review: validate invariants on public `BossState` inputs.
- Task 2 review: define and test accurate post-defeat damage behavior.
- Task 2 review: add asymmetric left-side reopening movement coverage.

## Combat density tuning execution

- Branch: `codex/combat-density-tuning`
- Base: `57afd9c`
- Baseline: 30 files, 260 unit tests passed
- Task 1 typed tuning foundation: complete (`57afd9c..e7645a9`, review clean)
- Task 2 enemy ingress tuning: complete (`f7fc573..4945c0d`, review clean)
- Task 3 boss geometry and movement: complete (`2999a8c..009f4ff`, review clean)
- Task 4 projectile visual separation: complete (`54a3ea2..6b9fe94`, review clean; browser contrast verified)
- Task 5 boss basic shot: complete (`23b14b4..72d0d27`, review clean after configured support-damage fix)
- Task 6 browser acceptance and playtest handoff: complete (focused 4/4, browser 27/27, unit 277/277, build passed)
- Final review and verification: complete (`24cf72a`; re-review clean; unit 292/292, browser 27/27, build and diff check passed)

## Second hive midboss execution

- Branch: `codex/second-hive-midboss`
- Base: `87a488a`
- Baseline: 33 files, 292 unit tests passed
- Task 1 central tuning and threat phase 3: complete (`b3f2c82..f934aa4`, review clean)
- Task 2 splitter rules and formation population: complete (`02d42a3..94e1c62`, review clean)
- Task 3 runtime splitter enemy: complete (`53cf618..eafc02a`, review clean)
- Task 4 data-driven two-boss encounter: complete (`bb2cb38..2650065`, review clean)
- Task 5 common boss contract and pure hive rules: complete (`7185b3b..1cea82f`, review clean)
- Task 6 hive core, modules, and reflectors: pending
- Task 7 hive shooter and core attacks: pending
- Task 8 second-tier rewards and UI: pending
- Task 9 runtime relic combat effects: pending
- Task 10 scene integration and lifecycle: pending
- Task 11 browser acceptance and playtest handoff: pending
- Final review and verification: pending
