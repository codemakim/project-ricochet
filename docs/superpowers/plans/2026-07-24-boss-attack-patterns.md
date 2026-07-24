# Shared Boss Attack Patterns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract four reusable, parameterized boss attack patterns while preserving both bosses’ current behavior.

**Architecture:** A small pure `bossAttackPatterns` module creates fire commands for aimed shots, aimed bursts, fans, and vertical falling barrages. Boss managers continue owning Phaser groups, warning sprites, collisions, and phase decisions. No generic boss DSL or one-size-fits-all boss state machine.

**Tech Stack:** TypeScript 5.9, Phaser 3.90, Vitest 4

## Global Constraints

- Preserve existing Sentinel and Hive timing, damage, projectile caps, warning visuals, pause behavior, snapshots, and cleanup during migration.
- Pattern functions are pure. Phaser objects stay in boss managers.
- Parameters live in `GAME_TUNING`; pattern functions receive values.
- Implement only four patterns already needed: single aimed, aimed burst, fan, vertical falling barrage.
- Do not add summon, laser, rotating, scripting, or registration frameworks.

---

## Task 1: Add pure parameterized pattern functions

**Files:**
- Create: `src/game/bosses/bossAttackPatterns.ts`
- Test: `src/game/bosses/bossAttackPatterns.test.ts`

- [ ] Write failing tests for normalized aimed direction, symmetric burst/fan directions, half-step fan offset, deterministic falling X positions, invalid counts, invalid angles, and zero-length aim fallback.

- [ ] Run `npm test -- src/game/bosses/bossAttackPatterns.test.ts` and confirm failure because the module does not exist.

- [ ] Add only these exports:

```ts
export interface DirectedShot {
  direction: Vector;
  speed: number;
}

export function aimedShot(
  origin: Vector,
  target: Vector,
  speed: number,
  fallback: Vector,
): DirectedShot;

export function aimedBurst(
  origin: Vector,
  target: Vector,
  speed: number,
  count: number,
  spreadDegrees: number,
  fallback: Vector,
): DirectedShot[];

export function fanShots(
  baseDirection: Vector,
  speed: number,
  count: number,
  arcDegrees: number,
  offsetDegrees?: number,
): DirectedShot[];

export function fallingOrigins(
  anchorX: number,
  left: number,
  right: number,
  offsets: readonly number[],
): number[];
```

- [ ] Reuse `normalize` and current rotation math; move the rotation helper only if both managers need it.

- [ ] Validate finite positive speed/count and finite angle/bounds at these function boundaries.

- [ ] Run `npm test -- src/game/bosses/bossAttackPatterns.test.ts` and confirm pass.

- [ ] Commit: `git add src/game/bosses/bossAttackPatterns.ts src/game/bosses/bossAttackPatterns.test.ts && git commit -m "feat: add reusable boss attack patterns"`

---

## Task 2: Migrate Sentinel without changing gameplay

**Files:**
- Modify: `src/game/bosses/BossManager.ts`
- Test: `src/game/bosses/BossManager.test.ts`
- Modify: `src/game/config/gameTuning.ts`
- Test: `src/game/config/gameTuning.test.ts`

- [ ] Add regression assertions for current basic aimed shot, three-shot aimed fan, falling support barrage, hostile cap, warning delay, and cleanup.

- [ ] Run `npm test -- src/game/bosses/BossManager.test.ts` and confirm the new assertions describe current behavior.

- [ ] Replace inline direction/fan/origin calculations with `aimedShot`, `aimedBurst`, and `fallingOrigins`. Preserve the support barrage by passing offsets `[0, attackIndex % 2 === 0 ? 90 : -90]`.

- [ ] Change `bossAimed.fanDegrees` to the equivalent parameter form:

```ts
bossAimed: {
  warningMs: 600,
  speed: 220,
  damage: 1,
  radius: 5,
  count: 3,
  spreadDegrees: 24,
}
```

- [ ] Keep current warning scheduling, projectile groups, sprite keys, and collision callbacks in `BossManager`.

- [ ] Run `npm test -- src/game/bosses/bossAttackPatterns.test.ts src/game/bosses/BossManager.test.ts src/game/config/gameTuning.test.ts`.

- [ ] Commit: `git commit -am "refactor: use shared patterns for sentinel attacks"`

---

## Task 3: Migrate Hive’s existing attacks without changing gameplay

**Files:**
- Modify: `src/game/bosses/HiveBossManager.ts`
- Test: `src/game/bosses/HiveBossManager.test.ts`
- Modify: `src/game/config/gameTuning.ts`
- Test: `src/game/config/gameTuning.test.ts`

- [ ] Add regression assertions for the current five-shot core fan angles, shooter aimed shots, 700 ms module offset, 7 s core interval, hostile cap, and phase cleanup.

- [ ] Replace the shooter direction calculation with `aimedShot`.

- [ ] Replace `hiveCore.fanDegrees` with `count: 5`, `arcDegrees: 72`, and `offsetDegrees: 0`; generate the same directions through `fanShots`.

- [ ] Keep Hive’s current phase activation and warning scheduler local. Shared math must not decide when the core or modules can fire.

- [ ] Run `npm test -- src/game/bosses/bossAttackPatterns.test.ts src/game/bosses/HiveBossManager.test.ts src/game/config/gameTuning.test.ts`.

- [ ] Commit: `git commit -am "refactor: use shared patterns for hive attacks"`

---

## Task 4: Verify shared patterns

**Files:**
- Modify only files required by failed verification.

- [ ] Run `rg -n "fanDegrees|private rotate|Math\\.cos|Math\\.sin" src/game/bosses` and confirm duplicated attack-direction logic is gone without removing unrelated movement math.

- [ ] Run `npm test`.

- [ ] Run `npm run build`.

- [ ] Run `npm run test:e2e -- e2e/combat.spec.ts`.

- [ ] Play both bosses and verify warnings still communicate the actual shot direction/location.

- [ ] Commit any verification fixes as `fix: integrate shared boss patterns`.
