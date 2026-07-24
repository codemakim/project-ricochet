# Hive Enrage and Rebalance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Hive occupy the intended boss footprint, resist explosion stripping, and become aggressive after all modules are destroyed.

**Architecture:** Existing Hive body/part/state code remains. Geometry and HP are tuned centrally. Boss splash damage affects only the nearest eligible secondary part at reduced damage. The existing `permanentlyExposed` phase becomes enrage and combines parameterized fan and aimed-burst patterns from the shared pattern plan.

**Tech Stack:** TypeScript 5.9, Phaser 3.90, Vitest 4, Playwright 1.61

## Global Constraints

- Requires the public functions from `2026-07-24-boss-attack-patterns.md` before enrage integration.
- No enrage heal, second HP bar, invulnerability window, or forced minimum duration.
- Target exposed-phase duration is roughly 20–30 seconds through HP and pressure, not a timer.
- Direct-hit damage stays unchanged.
- Explosion splash may hit at most one additional boss part by default at `50%` damage.
- All balance values live in `GAME_TUNING`.
- Preserve the global hostile projectile cap.

---

## Task 1: Double Hive geometry and raise part HP

**Files:**
- Modify: `src/game/config/gameTuning.ts`
- Test: `src/game/config/gameTuning.test.ts`
- Modify: `src/game/bosses/hiveBossGeometry.ts`
- Test: `src/game/bosses/hiveBossGeometry.test.ts`
- Modify: `src/game/bosses/HiveBossManager.ts`
- Test: `src/game/bosses/HiveBossManager.test.ts`

- [ ] Write failing tests for:
  - core visual `112`, hitbox `96`;
  - shooter `68 × 56`;
  - reflector `36 × 192`;
  - core HP `120`, shooter HP `20`, reflector HP `24`;
  - all recalled/deployed parts staying inside a `450 × 800` world;
  - a non-negative horizontal movement corridor.

- [ ] Run the four focused suites and confirm failures against current sizes/HP.

- [ ] Update only central tuning values. Keep geometry derived from tuning; do not add literal positions to `HiveBossManager`.

- [ ] Adjust recalled/deployed offsets and movement bounds in `hiveBossGeometry.ts` only as needed to avoid world-edge overlap.

- [ ] Keep boss motion collision behavior: occupied enemy space limits movement; clearing enemies widens the available corridor.

- [ ] Run `npm test -- src/game/config/gameTuning.test.ts src/game/bosses/hiveBossGeometry.test.ts src/game/bosses/HiveBossManager.test.ts`.

- [ ] Commit: `git commit -am "balance: enlarge and reinforce hive boss"`

---

## Task 2: Reduce boss explosion splash

**Files:**
- Modify: `src/game/config/gameTuning.ts`
- Test: `src/game/config/gameTuning.test.ts`
- Modify: `src/game/bosses/bossEncounter.ts`
- Modify: `src/game/bosses/BossManager.ts`
- Test: `src/game/bosses/BossManager.test.ts`
- Modify: `src/game/bosses/HiveBossManager.ts`
- Test: `src/game/bosses/HiveBossManager.test.ts`

- [ ] Write failing tests proving a direct target is excluded, eligible parts are sorted by distance, only the nearest secondary part is damaged, and its received damage is half the requested area damage.

- [ ] Add central tuning:

```ts
bossAreaDamage: {
  secondaryDamageScale: 0.5,
  maxSecondaryTargets: 1,
}
```

- [ ] Validate scale in `[0, 1]` and target count as a non-negative integer.

- [ ] Change `BossEncounter.applyAreaDamage()` to return `BossTargetId[]`. Update both implementations and callers; callers that ignore the result remain unchanged.

- [ ] In each boss implementation, gather exposed eligible targets inside the radius, exclude the direct target, sort by distance and then target ID for deterministic ties, slice to `maxSecondaryTargets`, and apply scaled damage.

- [ ] Do not change ordinary-enemy explosion behavior.

- [ ] Run `npm test -- src/game/bosses/BossManager.test.ts src/game/bosses/HiveBossManager.test.ts src/game/config/gameTuning.test.ts`.

- [ ] Commit: `git commit -am "balance: limit explosion splash across boss parts"`

---

## Task 3: Turn permanent exposure into enrage

**Files:**
- Modify: `src/game/config/gameTuning.ts`
- Test: `src/game/config/gameTuning.test.ts`
- Modify: `src/game/bosses/hiveBossRules.ts`
- Test: `src/game/bosses/hiveBossRules.test.ts`
- Modify: `src/game/bosses/HiveBossManager.ts`
- Test: `src/game/bosses/HiveBossManager.test.ts`

- [ ] Add failing tests proving:
  - destroying the final module enters `permanentlyExposed`;
  - enrage never heals or recreates parts;
  - fan warnings repeat every `2800 ms`;
  - aimed-burst warnings repeat every `1600 ms`;
  - fan offset alternates `0°`, `6°`, `0°`, `6°`;
  - hostile cap truncates shots without postponing the next configured cycle;
  - leaving/destroying the encounter cancels pending warnings and projectiles.

- [ ] Add central tuning:

```ts
hiveEnrage: {
  fan: {
    intervalMs: 2800,
    warningMs: 350,
    speed: 150,
    damage: 1,
    radius: 5,
    count: 9,
    arcDegrees: 96,
    alternatingOffsetDegrees: 6,
  },
  aimedBurst: {
    intervalMs: 1600,
    warningMs: 350,
    speed: 190,
    damage: 1,
    radius: 5,
    count: 3,
    spreadDegrees: 18,
  },
}
```

- [ ] Validate all positive timings/speeds/counts, non-negative angles, and finite values.

- [ ] Keep `permanentlyExposed` as the state name. On entry, cancel obsolete module warnings, schedule both enrage patterns, and apply a visible tint/pulse using existing Phaser primitives.

- [ ] Use `fanShots()` and `aimedBurst()` from the shared pattern module. Do not duplicate angle math.

- [ ] Distinguish enrage warning kinds and projectile kinds in snapshots so tests/debug UI can count them.

- [ ] Keep current collision damage, offscreen cleanup, pause clock, and hostile-cap code paths.

- [ ] Run `npm test -- src/game/bosses/hiveBossRules.test.ts src/game/bosses/HiveBossManager.test.ts src/game/config/gameTuning.test.ts`.

- [ ] Commit: `git commit -am "feat: add hive exposed-phase enrage"`

---

## Task 4: Integrate and playtest

**Files:**
- Modify: `e2e/combat.spec.ts`
- Modify only production files required by failed verification or playtest.

- [ ] Extend E2E debug assertions to enlarge Hive, destroy all modules, enter permanent exposure, observe both enrage projectile kinds, and verify reward still opens after core death.

- [ ] Run `npm test`.

- [ ] Run `npm run build`.

- [ ] Run `npm run test:e2e`.

- [ ] Play Hive with explosion rank 0 and rank 2. Check modules do not vanish as one splash cluster and exposed phase lasts near 20–30 seconds with a representative first-run build.

- [ ] If tuning changes are needed, change only `GAME_TUNING`, rerun focused Hive tests, and record final values in the commit body.

- [ ] Commit any integration/tuning fixes as `balance: finalize hive enrage pacing`.
