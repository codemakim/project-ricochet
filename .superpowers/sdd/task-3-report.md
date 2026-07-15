# Task 3 Report

- Status: DONE
- Implementation commit: `27bf8ac5e4f89db23666a8d34ac18b0e4210c19b`

## Tests

- Focused acceptance: `npm run test:e2e -- --project=desktop-chromium --grep "varies procedural enemy formations"` — 1/1 passed.
- Initial full E2E: `npm run test:e2e` — 16/18 passed. Existing passthrough fixture expected 19 enemies but received 18; existing explosion fixture expected XP 1 but received 3.
- Root-cause reproduction: `npm run test:e2e -- --project=desktop-chromium --grep "kills through Arcade collision with passThroughOnKill=true|applies explosion damage once"` — passthrough failed again with expected 19/received 18; explosion passed on the next seed. Procedural initial formations invalidated fixed-position and fixed-kind-by-ID assumptions.
- Stabilized focused E2E: `npm run test:e2e -- --project=desktop-chromium --grep "kills through Arcade collision|applies explosion damage once|varies procedural enemy formations"` — 4/4 passed after isolating the collision lane and selecting basic-enemy fixture IDs dynamically.
- Final unit suite: `npm test` — 22 files passed, 143/143 tests passed.
- Final E2E suite: `npm run test:e2e` — 18/18 tests passed: desktop 16, Pixel 7 emulation 2.
- Production build: `npm run build` — exit 0; `tsc --noEmit` and Vite build passed, 30 modules transformed.
- Diff hygiene: `git diff --check` and staged diff check passed.

## Result

- Browser acceptance verifies 20 initial enemies, phase-0 reinforcement sizes of 9..11, non-null and changing formation IDs/styles/layouts, unique reinforcement positions, and changed run seed plus initial layout after the existing defeat/restart flow.
- Playwright clock advances both 8.1-second spawn windows; restart uses bounded condition polling.
- Existing collision tests retain their behavioral assertions while their fixtures no longer assume fixed initial coordinates or special-enemy IDs.
- Added the procedural-formation evidence and unchecked manual playtest targets to `docs/playtest/2026-07-15-core-loop-playtest.md`.

## Concerns

- Vite still emits the existing advisory that the main minified chunk exceeds 500 kB; build succeeds.
- Visible clusters/gaps, rare-grid familiarity, density readability/performance, and obvious repeated-layout perception remain pending user playtest.
- `mobile-chromium` is Pixel 7 emulation, not a physical phone result.
