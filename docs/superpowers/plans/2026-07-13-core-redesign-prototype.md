# Core Redesign Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the paddle prototype with a playable 2D character, aimed three-orb recovery loop, dense descending enemy formation, and desktop/mobile controls.

**Architecture:** Keep deterministic combat decisions in small pure TypeScript modules and let Phaser adapters own input, sprites, colliders, and timing. `CombatScene` composes `PlayerInput`, `OrbManager`, and `EnemyManager`; it does not duplicate their state machines. Runtime experiment settings are read once at scene creation and passed into the managers.

**Tech Stack:** Phaser 3.90.0, TypeScript 5.9.3, Vite 8.1.4, Vitest 4.1.10, Playwright 1.61.1

## Global Constraints

- Logical playfield remains exactly `450x800` portrait.
- Player starts with 3 permanent orbs; permanent-orb cap is 6.
- Stored orbs launch sequentially every 100ms along the current aim.
- Relaunched orbs receive 3 charges; charged direct hits deal 1.5x damage.
- Proximity pickup starts at 50px and completes in 100ms; enemies and bullets do not block it.
- Default experiments are `passThroughOnKill: false`, `homeOnBottomHit: true`, `autoReturnAfterMs: null`.
- Same orb/enemy pair cannot damage again for 80ms.
- Prototype formation contains 20 enemies, mostly one-charged-hit basics, with a few armored enemies.
- No more than 2 enemy shooters and 12 enemy bullets may be active.
- Player health is 10 with 600ms post-hit invulnerability.
- This plan excludes XP, abilities, temporary split orbs, bosses, production art/audio, stages, and active timeout recall.

---

## File Map

- `src/game/constants.ts`: playfield, player, orb, enemy, and timing constants.
- `src/game/math/vector.ts`: shared vector normalization, reflection, and clamping.
- `src/game/player/playerRules.ts`: deterministic movement and retained aim.
- `src/game/aim/trajectory.ts`: first-wall hit plus one reflected guide segment.
- `src/game/orbs/orbRules.ts`: permanent-orb state transitions, charge damage, and collision response.
- `src/game/orbs/launchQueue.ts`: ordered 100ms release schedule with duplicate prevention.
- `src/game/input/PlayerInput.ts`: WASD/mouse and two-pointer floating-stick adapter.
- `src/game/orbs/OrbManager.ts`: Phaser orb sprites, attraction, floor recall, launch queue, and enemy collision cooldowns.
- `src/game/enemies/enemyRules.ts`: 20-enemy formation and shooter-cap decisions.
- `src/game/enemies/EnemyManager.ts`: Phaser enemy sprites, descent, bullets, contact, and breach callbacks.
- `src/game/scenes/CombatScene.ts`: composition, player/aim rendering, health, defeat, restart, and debug snapshot.
- `e2e/combat.spec.ts`: desktop and mobile browser acceptance checks.

### Task 1: Playfield, Movement, and Retained Aim

**Files:**
- Modify: `src/game/constants.ts`
- Modify: `src/game/constants.test.ts`
- Create: `src/game/math/vector.ts`
- Create: `src/game/player/playerRules.ts`
- Create: `src/game/player/playerRules.test.ts`
- Delete: `src/game/input/horizontalInput.ts`
- Delete: `src/game/input/horizontalInput.test.ts`

**Interfaces:**
- Produces: `Vector`, `normalize(vector, fallback)`, `movePlayer(position, input, deltaMs)`, `resolveAim(previous, candidate)`.
- Produces constants: `PLAYER_RADIUS`, `PLAYER_SPEED`, `PLAYER_MIN_Y`, `ORB_SPEED`, `ORB_PICKUP_RADIUS`, `LAUNCH_INTERVAL_MS`.

- [ ] **Step 1: Write failing playfield and player-rule tests**

```ts
// src/game/player/playerRules.test.ts
import { describe, expect, it } from 'vitest';
import { movePlayer, resolveAim } from './playerRules';

describe('player rules', () => {
  it('moves diagonally without exceeding cardinal speed', () => {
    const next = movePlayer({ x: 225, y: 600 }, { x: 1, y: -1 }, 1000);
    expect(next.x).toBeCloseTo(225 + 420 / Math.sqrt(2));
    expect(next.y).toBeCloseTo(600 - 420 / Math.sqrt(2));
  });

  it('clamps the player below the spawn exclusion zone', () => {
    expect(movePlayer({ x: 20, y: 100 }, { x: -1, y: -1 }, 1000)).toEqual({ x: 18, y: 98 });
  });

  it('keeps the last aim when the new vector is zero', () => {
    expect(resolveAim({ x: 0, y: -1 }, { x: 0, y: 0 })).toEqual({ x: 0, y: -1 });
    expect(resolveAim({ x: 0, y: -1 }, { x: 3, y: 4 })).toEqual({ x: 0.6, y: 0.8 });
  });
});
```

Update `constants.test.ts` to assert `{ width: 450, height: 800, minY: 98 }`, 3 starting orbs, 6 maximum orbs, and the three experiment defaults.

- [ ] **Step 2: Run tests and verify the new imports fail**

Run: `npm test -- src/game/constants.test.ts src/game/player/playerRules.test.ts`

Expected: FAIL because `playerRules.ts` and new constants do not exist.

- [ ] **Step 3: Implement constants, vector helpers, movement, and aim retention**

```ts
// src/game/math/vector.ts
export interface Vector { x: number; y: number }

export function normalize(vector: Vector, fallback: Vector = { x: 0, y: -1 }): Vector {
  const length = Math.hypot(vector.x, vector.y);
  return length > 0 ? { x: vector.x / length, y: vector.y / length } : fallback;
}

export function reflect(vector: Vector, normal: Vector): Vector {
  const dot = vector.x * normal.x + vector.y * normal.y;
  return { x: vector.x - 2 * dot * normal.x, y: vector.y - 2 * dot * normal.y };
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
```

```ts
// src/game/player/playerRules.ts
import { GAME_HEIGHT, GAME_WIDTH, PLAYER_MIN_Y, PLAYER_RADIUS, PLAYER_SPEED } from '../constants';
import { clamp, normalize, type Vector } from '../math/vector';

export function movePlayer(position: Vector, input: Vector, deltaMs: number): Vector {
  const direction = Math.hypot(input.x, input.y) > 1 ? normalize(input) : input;
  const distance = PLAYER_SPEED * deltaMs / 1000;
  return {
    x: clamp(position.x + direction.x * distance, PLAYER_RADIUS, GAME_WIDTH - PLAYER_RADIUS),
    y: clamp(position.y + direction.y * distance, PLAYER_MIN_Y, GAME_HEIGHT - PLAYER_RADIUS),
  };
}

export function resolveAim(previous: Vector, candidate: Vector): Vector {
  return Math.hypot(candidate.x, candidate.y) < 0.001 ? previous : normalize(candidate);
}
```

Replace paddle constants with the exact Global Constraints values. Export `EXPERIMENT_DEFAULTS` using an `ExperimentSettings` interface and `autoReturnAfterMs: number | null`.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- src/game/constants.test.ts src/game/player/playerRules.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/constants.ts src/game/constants.test.ts src/game/math/vector.ts src/game/player src/game/input/horizontalInput.ts src/game/input/horizontalInput.test.ts
git commit -m "feat: add free movement and aim rules"
```

### Task 2: First-Bounce Aim Guide

**Files:**
- Create: `src/game/aim/trajectory.ts`
- Create: `src/game/aim/trajectory.test.ts`

**Interfaces:**
- Consumes: `Vector`, `normalize`, `reflect`, `GAME_WIDTH`, `GAME_HEIGHT`.
- Produces: `traceFirstBounce(origin, direction, inset, reflectionLength): [Vector, Vector, Vector]`.

- [ ] **Step 1: Write failing trajectory tests**

```ts
import { describe, expect, it } from 'vitest';
import { traceFirstBounce } from './trajectory';

describe('first-bounce trajectory', () => {
  it('hits the top wall then draws one reflected segment', () => {
    const [origin, hit, end] = traceFirstBounce({ x: 225, y: 600 }, { x: 1, y: -2 }, 8, 90);
    expect(origin).toEqual({ x: 225, y: 600 });
    expect(hit.y).toBe(8);
    expect(end.y).toBeGreaterThan(hit.y);
    expect(Math.hypot(end.x - hit.x, end.y - hit.y)).toBeCloseTo(90);
  });

  it('uses the side wall when it is reached first', () => {
    const [, hit] = traceFirstBounce({ x: 225, y: 600 }, { x: 1, y: 0 }, 8, 90);
    expect(hit).toEqual({ x: 442, y: 600 });
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run: `npm test -- src/game/aim/trajectory.test.ts`

Expected: FAIL because `trajectory.ts` does not exist.

- [ ] **Step 3: Implement exact ray-to-rectangle math**

Normalize the direction. Compute positive parametric distances to left, right, top, and bottom inset walls; choose the smallest finite distance. Derive a normal of `{±1,0}` or `{0,±1}`, reflect the direction, and return `[origin, hit, hit + reflected * reflectionLength]`. Reject negative `inset` and non-positive `reflectionLength` with `RangeError`.

- [ ] **Step 4: Run trajectory and full unit tests**

Run: `npm test -- src/game/aim/trajectory.test.ts && npm test`

Expected: both commands PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/aim
git commit -m "feat: calculate first-bounce aim guide"
```

### Task 3: Permanent-Orb Rules and Launch Queue

**Files:**
- Create: `src/game/orbs/orbRules.ts`
- Create: `src/game/orbs/orbRules.test.ts`
- Create: `src/game/orbs/launchQueue.ts`
- Create: `src/game/orbs/launchQueue.test.ts`
- Delete: `src/game/physics/ballRules.ts`
- Delete: `src/game/physics/ballRules.test.ts`

**Interfaces:**
- Produces: `OrbState = 'stored' | 'queued' | 'active' | 'attracting' | 'floor-returning' | 'timeout-returning'`.
- Produces: `RecoverySource = 'proximity' | 'floorRecall' | 'timeoutRecall'`.
- Produces: `directHit(charges, enemyHp, settings, piercing): HitResult`.
- Produces: `LaunchQueue.enqueue(id)`, `LaunchQueue.drain(nowMs)`, `LaunchQueue.clear()`.

- [ ] **Step 1: Write failing orb-rule tests**

```ts
import { describe, expect, it } from 'vitest';
import { directHit, recoveryBonusAllowed, transitionOrb } from './orbRules';

describe('orb rules', () => {
  it('spends one charge and deals 1.5 direct damage', () => {
    expect(directHit(3, 1, { passThroughOnKill: false }, false)).toEqual({
      charges: 2, damage: 1.5, killed: true, reflect: true,
    });
  });

  it('continues through a kill only when enabled', () => {
    expect(directHit(3, 1, { passThroughOnKill: true }, false).reflect).toBe(false);
    expect(directHit(3, 3, { passThroughOnKill: true }, false).reflect).toBe(true);
    expect(directHit(3, 3, { passThroughOnKill: false }, true).reflect).toBe(false);
  });

  it('allows pickup bonuses only for proximity', () => {
    expect(recoveryBonusAllowed('proximity')).toBe(true);
    expect(recoveryBonusAllowed('floorRecall')).toBe(false);
  });

  it('rejects illegal state transitions', () => {
    expect(() => transitionOrb('stored', 'active')).toThrow(RangeError);
    expect(transitionOrb('active', 'attracting')).toBe('attracting');
  });
});
```

```ts
import { describe, expect, it } from 'vitest';
import { LaunchQueue } from './launchQueue';

describe('launch queue', () => {
  it('releases unique IDs one at a time every 100ms', () => {
    const queue = new LaunchQueue(100);
    queue.enqueue(2);
    queue.enqueue(2);
    queue.enqueue(5);
    expect(queue.drain(0)).toEqual([2]);
    expect(queue.drain(99)).toEqual([]);
    expect(queue.drain(100)).toEqual([5]);
  });
});
```

- [ ] **Step 2: Verify failures**

Run: `npm test -- src/game/orbs`

Expected: FAIL because both modules are missing.

- [ ] **Step 3: Implement the explicit orb transition table and FIFO queue**

Legal transitions are `stored->queued`, `queued->active`, `active->attracting|floor-returning|timeout-returning`, and every recovery state to `stored`. `directHit` consumes one charge only when positive, uses damage `1.5` or `1`, lets piercing override all reflection decisions, and otherwise reflects unless the hit killed while `passThroughOnKill` is true. `LaunchQueue` stores unique numeric IDs, emits at most one ID per `drain`, and resets its next-release timestamp when the queue becomes empty.

- [ ] **Step 4: Run orb and full tests**

Run: `npm test -- src/game/orbs && npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/orbs/orbRules.ts src/game/orbs/orbRules.test.ts src/game/orbs/launchQueue.ts src/game/orbs/launchQueue.test.ts src/game/physics/ballRules.ts src/game/physics/ballRules.test.ts
git commit -m "feat: define permanent orb lifecycle"
```

### Task 4: Enemy Formation and Attack Director Rules

**Files:**
- Create: `src/game/enemies/enemyRules.ts`
- Create: `src/game/enemies/enemyRules.test.ts`

**Interfaces:**
- Produces: `EnemyKind = 'basic' | 'armored' | 'shooter'` and `EnemySpec`.
- Produces: `createPrototypeFormation(): EnemySpec[]`.
- Produces: `canFire(activeShooters, activeBullets): boolean`.
- Modify later: `health.ts` imports `EnemyKind` from this module.

- [ ] **Step 1: Write failing formation and cap tests**

```ts
import { describe, expect, it } from 'vitest';
import { canFire, createPrototypeFormation } from './enemyRules';

describe('prototype enemies', () => {
  it('creates 20 enemies with gaps and a small armored minority', () => {
    const formation = createPrototypeFormation();
    expect(formation).toHaveLength(20);
    expect(formation.filter((enemy) => enemy.kind === 'armored')).toHaveLength(3);
    expect(new Set(formation.map((enemy) => enemy.column)).size).toBeGreaterThan(5);
    expect(formation.every((enemy) => enemy.hp === (enemy.kind === 'basic' ? 1 : enemy.kind === 'armored' ? 3 : 1))).toBe(true);
  });

  it('caps shooters at two and bullets at twelve', () => {
    expect(canFire(1, 11)).toBe(true);
    expect(canFire(2, 0)).toBe(false);
    expect(canFire(0, 12)).toBe(false);
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `npm test -- src/game/enemies/enemyRules.test.ts`

Expected: FAIL because `enemyRules.ts` is missing.

- [ ] **Step 3: Implement the fixed prototype formation**

Use five staggered rows at y positions 80, 122, 164, 206, and 248. Use columns within x 36–414 and omit at least one different column per row so no sealed horizontal wall exists. Include 14 basics, 3 armored, and 3 shooters. Set descent speed to 26 px/s for every spec. `canFire` returns `activeShooters < 2 && activeBullets < 12`.

- [ ] **Step 4: Run focused and full tests**

Run: `npm test -- src/game/enemies/enemyRules.test.ts && npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/enemies
git commit -m "feat: define dense enemy formation"
```

### Task 5: Desktop and Floating Dual-Stick Input Adapter

**Files:**
- Create: `src/game/input/pointerRoles.ts`
- Create: `src/game/input/pointerRoles.test.ts`
- Create: `src/game/input/PlayerInput.ts`

**Interfaces:**
- Consumes: `Vector`, `normalize`, `GAME_WIDTH`.
- Produces: `pointerRole(x): 'move' | 'aim'`.
- Produces: `PlayerInput.movement: Vector`, `PlayerInput.aimCandidate: Vector`, `PlayerInput.aimActivated: boolean`, `PlayerInput.destroy()`.

- [ ] **Step 1: Write failing pointer-role tests**

```ts
import { describe, expect, it } from 'vitest';
import { pointerRole, stickVector } from './pointerRoles';

describe('dual-stick pointer roles', () => {
  it('assigns left touches to movement and right touches to aim', () => {
    expect(pointerRole(100)).toBe('move');
    expect(pointerRole(350)).toBe('aim');
  });

  it('normalizes stick displacement outside its radius', () => {
    expect(stickVector({ x: 0, y: 0 }, { x: 100, y: 0 }, 48)).toEqual({ x: 1, y: 0 });
    expect(stickVector({ x: 0, y: 0 }, { x: 12, y: -24 }, 48)).toEqual({ x: 0.25, y: -0.5 });
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `npm test -- src/game/input/pointerRoles.test.ts`

Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement pointer rules and Phaser adapter**

`pointerRole` splits at `GAME_WIDTH / 2`. `stickVector` divides displacement by radius and normalizes only when magnitude exceeds one. `PlayerInput` registers four extra pointers, creates `WASD` keys, and listens for pointer down/move/up. Each touch retains its role from pointer down. Mouse movement sets `aimCandidate` from player world position to pointer world position; touch aim uses the right stick vector. Releasing aim clears only the active pointer, not the last aim stored by the scene. `destroy()` removes input listeners and destroys floating-stick graphics.

- [ ] **Step 4: Run input and full unit tests**

Run: `npm test -- src/game/input && npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/input
git commit -m "feat: add desktop and dual-stick input"
```

### Task 6: Phaser Orb Manager

**Files:**
- Create: `src/game/orbs/OrbManager.ts`
- Create: `src/game/orbs/OrbManager.test.ts`

**Interfaces:**
- Consumes: `LaunchQueue`, orb rules, constants, aim provider, experiment settings.
- Produces: `activateAim()`, `update(time, delta, playerPosition, aim)`, `handleEnemyHit(orb, enemyId, hp, time, piercing)`, `getSprites()`, `getSnapshot()`.
- Emits: `onEnemyDamage(enemyId, damage, reflect)` and `onRecovery(source)` callbacks.

- [ ] **Step 1: Write failing manager-state tests using injected clockless helpers**

Test that construction creates three stored records, first `activateAim()` queues all three once, `update(0)` launches only one, `update(99)` launches none, and `update(100)` launches the second. Test `beginProximityRecovery` sets collision and damage off, and test `beginFloorRecall` is ignored when `homeOnBottomHit` is false.

- [ ] **Step 2: Verify failure**

Run: `npm test -- src/game/orbs/OrbManager.test.ts`

Expected: FAIL because `OrbManager.ts` does not exist.

- [ ] **Step 3: Implement manager state and Phaser sprite synchronization**

Create exactly three permanent records with stable numeric IDs. Spawn from `player + aim * (PLAYER_RADIUS + ORB_RADIUS + 4)` at `ORB_SPEED`. During `active`, check 50px player distance and fixed-terrain line-of-sight before attraction. During `attracting`, tween position toward the current player over 100ms with collision/damage disabled. During floor or timeout return, move directly toward the current player at recall speed while ignoring all bodies. Arrival transitions through `stored`, restores 3 charges, enters the unique launch queue, then fires along the latest aim. Store `Map<enemyId, lastHitMs>` per orb and reject hits newer than 80ms.

- [ ] **Step 4: Run manager and all unit tests**

Run: `npm test -- src/game/orbs/OrbManager.test.ts && npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/orbs/OrbManager.ts src/game/orbs/OrbManager.test.ts
git commit -m "feat: add orb recovery and relaunch manager"
```

### Task 7: Enemy Manager and Combat Scene Composition

**Files:**
- Create: `src/game/enemies/EnemyManager.ts`
- Modify: `src/game/combat/health.ts`
- Modify: `src/game/combat/health.test.ts`
- Rewrite: `src/game/scenes/CombatScene.ts`
- Modify: `src/main.ts`

**Interfaces:**
- `EnemyManager` consumes formation specs, player position, and callbacks `onContact`, `onBreach`, `onBulletHit`.
- `CombatScene` exposes development-only `getDebugSnapshot()` through `window.__RICHOCHET_GAME__` scene access.
- Debug snapshot shape: `{ player, aim, health, defeated, orbs, enemies, activeShooters, bullets, experiment }`; each orb snapshot includes `id`, `state`, `charges`, `damageEnabled`, `collisionEnabled`, `velocity`, and `lastRecoverySource`.

- [ ] **Step 1: Extend health tests for 600ms invulnerability ownership**

Keep `applyDamage` pure. Add `canTakeDamage(now, invulnerableUntil)` and tests proving true at equality and false one millisecond before. Update the health test description from “paddle health” to “player health”. Import `EnemyKind` from `enemyRules`; `breachDamage` returns basic/shooter 2 and armored 4.

- [ ] **Step 2: Verify health test failure**

Run: `npm test -- src/game/combat/health.test.ts`

Expected: FAIL because `canTakeDamage` and shooter breach handling are missing.

- [ ] **Step 3: Implement EnemyManager**

Create sprites from `createPrototypeFormation`, preserving stable ID, kind, hp, and 26 px/s descent. Add orb colliders through `OrbManager`, player overlaps for 1 contact damage plus short separation, and breach detection at `GAME_HEIGHT - PLAYER_RADIUS`. Every 1300ms choose at most two shooter sprites not already marked as attacking; warn for 350ms, then fire one 180 px/s aimed bullet if `canFire` still passes. Clear shooter-active state after firing. Destroy bullets outside bounds. Return armored breach damage 4, all others 2.

- [ ] **Step 4: Rewrite CombatScene as composition root**

In `create()`: reset health/defeat/invulnerability; create textures; create a circular player at `{x:225,y:690}`; create `PlayerInput`, `OrbManager`, and `EnemyManager`; create a dashed `Graphics` aim guide; create HP and instruction text; pause on browser `hidden`; activate the orb queue only after the first non-zero aim input. In `update()`: resolve input, move player, retain aim, redraw the three-point trajectory, update both managers, apply contact/bullet/breach callbacks through one `damagePlayer(amount)` method, and stop all updates after defeat. `showDefeat()` must be idempotent and restart the scene from its interactive label. `shutdown` must call all manager/input cleanup methods and remove visibility listeners.

Use distinct generated textures: small cyan character with face marks, white/cyan charged orb, red basic, purple armored, orange shooter, yellow bullet. These are diagnostic visuals, not production art.

- [ ] **Step 5: Add debug snapshot and experiment parsing**

Read URL query values `passThroughOnKill=true|false` and `homeOnBottomHit=true|false`; keep defaults for absent/invalid values and keep timeout null. `getDebugSnapshot()` returns JSON-safe numbers, strings, booleans, and arrays only. This supports Playwright without exposing mutable sprite references.

- [ ] **Step 6: Run full unit suite and build**

Run: `npm test && npm run build`

Expected: all unit tests PASS and TypeScript/Vite build exits 0.

- [ ] **Step 7: Commit**

```bash
git add src/game/combat src/game/enemies/EnemyManager.ts src/game/scenes/CombatScene.ts src/main.ts
git commit -m "feat: compose redesigned combat scene"
```

### Task 8: Desktop and Mobile Browser Acceptance

**Files:**
- Rewrite: `e2e/combat.spec.ts`
- Modify: `playwright.config.ts` only if touch emulation needs an explicit option.

**Interfaces:**
- Consumes: `CombatScene.getDebugSnapshot()`.
- Verifies the complete prototype; produces no runtime API.

- [ ] **Step 1: Replace obsolete paddle E2E tests**

Desktop test: load the canvas, capture snapshot, press `W+D` for 250ms, move mouse above/right of player, release keys, then assert both player coordinates increased/decreased as expected, aim points up/right, first aim queued/launched three permanent orbs over 250ms, and canvas remains portrait.

Mobile test: use two simultaneous touchscreen pointers via `page.evaluate`-dispatched `pointerdown/pointermove/pointerup` events with stable IDs, left half moving up/right and right half aiming up/left. Assert player changed both axes, aim remains locked after pointerup, and permanent orb count remains exactly three.

Recovery test: call a development-only scene method that places one active orb 5px from the player, wait 250ms, and assert its recovery source is `proximity`, charges reset to 3, and it returned to active or queued. Place another orb on the bottom boundary and assert `floorRecall`, no collision/damage during return, then active/queued recovery.

Combat test: freeze enemy descent, set a charged orb directly below a basic enemy, and assert enemy count decreases. Repeat with `?passThroughOnKill=true` and assert the orb velocity direction does not reverse. Assert no more than two shooters and twelve bullets during a 5-second accelerated-clock sample.

Defeat test: set health to 2 through a development helper, apply breach damage twice in the same frame, assert one defeat panel, click `다시 시작`, then assert health 10 and defeat false.

- [ ] **Step 2: Run E2E and observe expected failures**

Run: `npm run test:e2e`

Expected: obsolete debug access or missing deterministic test helpers fail until the scene exposes only the narrowly required helpers.

- [ ] **Step 3: Add narrowly scoped development helpers**

Under `import.meta.env.DEV`, expose `debugPlaceOrb(id, position)`, `debugFreezeEnemies()`, `debugSetHealth(value)`, and `debugDamage(amount)`. Each delegates to the owning manager or health method. Do not expose helpers in production builds.

- [ ] **Step 4: Run complete verification**

Run: `npm test && npm run test:e2e && npm run build`

Expected: all unit tests PASS, desktop/mobile Playwright projects PASS, and production build exits 0.

- [ ] **Step 5: Manual browser check**

Run: `npm run dev -- --host 0.0.0.0 --port 4173`

Verify desktop `WASD` plus mouse and a real mobile/touch device through the same host. Confirm: first-bounce guide is legible; three orbs cycle without waiting helplessly; direct pickup feels generous but requires movement; floor recall restores lost orbs; 20 enemies resemble a breakable formation; shooter pressure is readable; defeat and restart work. Compare `/?homeOnBottomHit=false` and `/?passThroughOnKill=true` one variable at a time.

- [ ] **Step 6: Commit**

```bash
git add e2e/combat.spec.ts playwright.config.ts src/game/scenes/CombatScene.ts src/game/orbs/OrbManager.ts src/game/enemies/EnemyManager.ts
git commit -m "test: verify redesigned combat loop"
```

### Task 9: Prototype Acceptance Record

**Files:**
- Create: `docs/playtests/2026-07-13-core-redesign-prototype.md`

**Interfaces:**
- Consumes: spec section 18 acceptance criteria and experiment query settings.
- Produces: reproducible playtest observations; no runtime interface.

- [ ] **Step 1: Record the verification environment and objective results**

Record commit hash, browser/device, viewport, experiment values, automatic test counts, build result, 20-enemy clear percentage before first breach, longest all-orbs-out interval, proximity/floor recovery ratio, and maximum observed shooters/bullets.

- [ ] **Step 2: Record subjective results without converting them into code changes**

Give 1–5 scores for aim trust, movement fatigue, recovery satisfaction, waiting, ricochet spectacle, pressure fairness, and desire for another run. List only observed problems with reproduction steps. Keep tuning proposals in a separate “Next decision” section so this prototype remains a clean measurement point.

- [ ] **Step 3: Run final repository checks**

Run: `npm test && npm run test:e2e && npm run build && git diff --check && git status --short`

Expected: all commands PASS; status shows only the new playtest record before commit.

- [ ] **Step 4: Commit**

```bash
git add docs/playtests/2026-07-13-core-redesign-prototype.md
git commit -m "docs: record core redesign playtest"
```
