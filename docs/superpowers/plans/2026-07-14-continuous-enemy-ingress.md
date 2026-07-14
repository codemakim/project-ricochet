# Continuous Enemy Ingress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the one-shot 20-enemy prototype formation with deterministic reinforcement formations that enter continuously while surviving enemies remain.

**Architecture:** Keep timing and spawn decisions in a Phaser-independent `EncounterDirector`. Keep deterministic formation content in pure rules, and let `EnemyManager` own only Phaser sprites and stable IDs. `CombatScene` feeds frame time and enemy snapshots to the director, then forwards accepted formations to the manager.

**Tech Stack:** TypeScript 5.9, Phaser 3.90 Arcade Physics, Vitest 4.1, Playwright 1.61, Vite 8.1

## Global Constraints

- This plan implements only the continuous `running` portion. Until the boss slice intercepts at 180 seconds, phase 2 continues past 180 seconds so the playable build does not stop again.
- First encounter descent speed stays `22px/s`.
- Threat phases use `0~1 min: cap 22`, `1~2 min: cap 26`, `2~3 min: cap 30`.
- Initial spawn interval values are 8,000ms, 7,000ms, and 6,000ms by threat phase.
- Initial formation stays the current 20-enemy prototype formation.
- Reinforcement formations contain 6, 8, or 10 enemies.
- A reinforcement requires elapsed interval, top clearance, and enough active-enemy capacity.
- Blocked reinforcement remains pending; never catch up with multiple formations in one frame.
- No wave number, wave-clear copy, transition panel, XP, pause UI, or boss behavior in this plan.
- Existing shooter cap 2, bullet cap 12, experiment flags, health, orb recovery, desktop controls, and mobile controls remain unchanged.
- Add no dependencies.

---

## File Structure

- Create `src/game/encounters/encounterRules.ts`: pure threat-phase and spawn-gate rules.
- Create `src/game/encounters/encounterRules.test.ts`: boundary tests for timing, clearance, capacity, and phases.
- Create `src/game/encounters/formationRules.ts`: deterministic 6/8/10-enemy reinforcement templates.
- Create `src/game/encounters/formationRules.test.ts`: size, composition, position, and determinism tests.
- Create `src/game/encounters/EncounterDirector.ts`: frame-driven pending-spawn state.
- Create `src/game/encounters/EncounterDirector.test.ts`: timer, blocking, release, and no-catch-up tests.
- Modify `src/game/enemies/EnemyManager.ts`: append formations with monotonic IDs and expose topmost position.
- Modify `src/game/enemies/EnemyManager.test.ts`: verify append behavior, IDs, collisions, and cleanup.
- Modify `src/game/scenes/CombatScene.ts`: connect director to manager and expose development-only spawn state.
- Modify `e2e/combat.spec.ts`: prove reinforcement arrives while original enemies remain.

---

### Task 1: Define pure encounter spawn rules

**Files:**
- Create: `src/game/encounters/encounterRules.ts`
- Create: `src/game/encounters/encounterRules.test.ts`

**Interfaces:**
- Consumes: elapsed encounter time and current spawn-gate measurements.
- Produces: `ThreatPhase`, `ThreatConfig`, `threatConfigAt(elapsedMs)`, and `canSpawnReinforcement(input)`.

- [ ] **Step 1: Write failing phase and gate tests**

```ts
import { describe, expect, it } from 'vitest';
import { canSpawnReinforcement, threatConfigAt } from './encounterRules';

describe('encounter rules', () => {
  it.each([
    [0, { phase: 0, activeCap: 22, spawnIntervalMs: 8_000 }],
    [59_999, { phase: 0, activeCap: 22, spawnIntervalMs: 8_000 }],
    [60_000, { phase: 1, activeCap: 26, spawnIntervalMs: 7_000 }],
    [120_000, { phase: 2, activeCap: 30, spawnIntervalMs: 6_000 }],
    [180_000, { phase: 2, activeCap: 30, spawnIntervalMs: 6_000 }],
  ] as const)('maps %ims to its threat config', (elapsedMs, expected) => {
    expect(threatConfigAt(elapsedMs)).toEqual(expected);
  });

  it('requires interval, top clearance, and capacity together', () => {
    const ready = {
      elapsedSinceSpawnMs: 8_000,
      spawnIntervalMs: 8_000,
      topmostEnemyY: 120,
      requiredTopmostY: 98,
      activeEnemies: 16,
      incomingEnemies: 6,
      activeCap: 22,
    };

    expect(canSpawnReinforcement(ready)).toBe(true);
    expect(canSpawnReinforcement({ ...ready, elapsedSinceSpawnMs: 7_999 })).toBe(false);
    expect(canSpawnReinforcement({ ...ready, topmostEnemyY: 97 })).toBe(false);
    expect(canSpawnReinforcement({ ...ready, activeEnemies: 17 })).toBe(false);
    expect(canSpawnReinforcement({ ...ready, topmostEnemyY: Number.POSITIVE_INFINITY })).toBe(true);
  });
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm test -- src/game/encounters/encounterRules.test.ts`

Expected: FAIL because `./encounterRules` does not exist.

- [ ] **Step 3: Implement minimal pure rules**

```ts
export type ThreatPhase = 0 | 1 | 2;

export interface ThreatConfig {
  phase: ThreatPhase;
  activeCap: number;
  spawnIntervalMs: number;
}

export interface SpawnGateInput {
  elapsedSinceSpawnMs: number;
  spawnIntervalMs: number;
  topmostEnemyY: number;
  requiredTopmostY: number;
  activeEnemies: number;
  incomingEnemies: number;
  activeCap: number;
}

export function threatConfigAt(elapsedMs: number): ThreatConfig {
  if (elapsedMs >= 120_000) return { phase: 2, activeCap: 30, spawnIntervalMs: 6_000 };
  if (elapsedMs >= 60_000) return { phase: 1, activeCap: 26, spawnIntervalMs: 7_000 };
  return { phase: 0, activeCap: 22, spawnIntervalMs: 8_000 };
}

export function canSpawnReinforcement(input: SpawnGateInput): boolean {
  return input.elapsedSinceSpawnMs >= input.spawnIntervalMs
    && input.topmostEnemyY >= input.requiredTopmostY
    && input.activeEnemies + input.incomingEnemies <= input.activeCap;
}
```

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `npm test -- src/game/encounters/encounterRules.test.ts`

Expected: PASS, 2 test groups including all table rows.

- [ ] **Step 5: Commit**

```bash
git add src/game/encounters/encounterRules.ts src/game/encounters/encounterRules.test.ts
git commit -m "feat: define encounter spawn gates"
```

---

### Task 2: Define deterministic reinforcement formations

**Files:**
- Create: `src/game/encounters/formationRules.ts`
- Create: `src/game/encounters/formationRules.test.ts`
- Read: `src/game/enemies/enemyRules.ts`

**Interfaces:**
- Consumes: `ThreatPhase` and a non-negative spawn sequence.
- Produces: `createReinforcementFormation(phase, sequence): EnemySpec[]`.

- [ ] **Step 1: Write failing formation tests**

```ts
import { describe, expect, it } from 'vitest';
import { createReinforcementFormation } from './formationRules';

describe('reinforcement formations', () => {
  it.each([
    [0, 6],
    [1, 8],
    [2, 10],
  ] as const)('creates phase %i with %i enemies', (phase, size) => {
    const formation = createReinforcementFormation(phase, 0);
    expect(formation).toHaveLength(size);
    expect(formation.every((enemy) => enemy.speed === 22)).toBe(true);
    expect(formation.every((enemy) => enemy.y <= 14)).toBe(true);
    expect(formation.every((enemy) => enemy.x >= 36 && enemy.x <= 414)).toBe(true);
  });

  it('raises special-enemy pressure by phase', () => {
    const specialCount = (phase: 0 | 1 | 2) => createReinforcementFormation(phase, 0)
      .filter((enemy) => enemy.kind !== 'basic').length;
    expect(specialCount(0)).toBeLessThan(specialCount(1));
    expect(specialCount(1)).toBeLessThanOrEqual(specialCount(2));
  });

  it('is deterministic and changes layout by sequence', () => {
    expect(createReinforcementFormation(1, 3)).toEqual(createReinforcementFormation(1, 3));
    expect(createReinforcementFormation(1, 3)).not.toEqual(createReinforcementFormation(1, 4));
  });

  it('rejects invalid sequences', () => {
    expect(() => createReinforcementFormation(0, -1)).toThrow(
      'sequence must be a non-negative integer',
    );
  });
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm test -- src/game/encounters/formationRules.test.ts`

Expected: FAIL because `./formationRules` does not exist.

- [ ] **Step 3: Implement three compact templates**

Create the full implementation:

```ts
import type { EnemyKind, EnemySpec } from '../enemies/enemyRules';
import type { ThreatPhase } from './encounterRules';

type Entry = readonly [row: 0 | 1, column: number, kind: EnemyKind];

const PHASE_SIZES = [6, 8, 10] as const;
const ROW_Y = [-28, 14] as const;
const SPEED = 22;

const TEMPLATES: Readonly<Record<ThreatPhase, readonly Entry[]>> = {
  0: [
    [0, 0, 'basic'], [0, 3, 'armored'], [0, 6, 'basic'],
    [1, 1, 'basic'], [1, 4, 'basic'], [1, 7, 'basic'],
  ],
  1: [
    [0, 0, 'basic'], [0, 2, 'armored'], [0, 4, 'basic'], [0, 6, 'shooter'],
    [1, 1, 'basic'], [1, 3, 'armored'], [1, 5, 'basic'], [1, 7, 'basic'],
  ],
  2: [
    [0, 0, 'basic'], [0, 1, 'armored'], [0, 3, 'basic'], [0, 5, 'shooter'], [0, 7, 'basic'],
    [1, 0, 'basic'], [1, 2, 'shooter'], [1, 4, 'basic'], [1, 6, 'armored'], [1, 7, 'basic'],
  ],
};

export function createReinforcementFormation(
  phase: ThreatPhase,
  sequence: number,
): EnemySpec[] {
  if (!Number.isInteger(sequence) || sequence < 0) {
    throw new RangeError('sequence must be a non-negative integer');
  }
  const mirror = sequence % 2 === 1;
  const entries = TEMPLATES[phase];
  if (entries.length !== PHASE_SIZES[phase]) throw new Error('invalid reinforcement template');
  return entries.map(([row, rawColumn, kind]) => {
    const column = mirror ? 7 - rawColumn : rawColumn;
    return {
      kind,
      hp: kind === 'armored' ? 3 : 1,
      x: 36 + column * 54,
      y: ROW_Y[row],
      column,
      speed: SPEED,
    };
  });
}
```

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `npm test -- src/game/encounters/formationRules.test.ts`

Expected: PASS, including exact 6/8/10 sizes and deterministic layout.

- [ ] **Step 5: Run existing enemy-rule tests**

Run: `npm test -- src/game/enemies/enemyRules.test.ts src/game/encounters/formationRules.test.ts`

Expected: PASS. Original 20-enemy formation remains unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/game/encounters/formationRules.ts src/game/encounters/formationRules.test.ts
git commit -m "feat: add reinforcement formations"
```

---

### Task 3: Allow `EnemyManager` to append formations

**Files:**
- Modify: `src/game/enemies/EnemyManager.ts`
- Modify: `src/game/enemies/EnemyManager.test.ts`

**Interfaces:**
- Consumes: `spawnFormation(formation: readonly EnemySpec[]): void`.
- Produces: monotonically increasing enemy IDs and `EnemyManagerSnapshot.topmostEnemyY`.
- Development-only helper: optional `debugRemoveEnemies(ids: readonly number[]): void`.

- [ ] **Step 1: Extend manager tests first**

Add assertions proving:

```ts
it('appends formations with monotonic IDs and reports topmost position', () => {
  const { manager } = createBoundary();
  manager.spawnFormation([
    { kind: 'basic', hp: 1, x: 90, y: -28, column: 1, speed: 22 },
    { kind: 'shooter', hp: 1, x: 144, y: 14, column: 2, speed: 22 },
  ]);

  const snapshot = manager.getSnapshot();
  expect(snapshot.enemies).toHaveLength(22);
  expect(snapshot.enemies.slice(-2).map((enemy) => enemy.id)).toEqual([20, 21]);
  expect(snapshot.topmostEnemyY).toBe(-28);
});
```

Update every destroyed-manager snapshot expectation to include `topmostEnemyY: Number.POSITIVE_INFINITY`. Add a test that selected IDs are removed and the next spawned ID remains 20 rather than reusing removed IDs.

```ts
it('debug-removes selected enemies without reusing IDs', () => {
  const { manager } = createBoundary();
  manager.debugRemoveEnemies!([0, 3, 7, 11]);
  expect(manager.getSnapshot().enemies).toHaveLength(16);

  manager.spawnFormation([
    { kind: 'basic', hp: 1, x: 90, y: -28, column: 1, speed: 22 },
  ]);
  expect(manager.getSnapshot().enemies.at(-1)?.id).toBe(20);
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm test -- src/game/enemies/EnemyManager.test.ts`

Expected: FAIL because `spawnFormation`, `topmostEnemyY`, and `debugRemoveEnemies` do not exist.

- [ ] **Step 3: Refactor construction into append-safe creation**

In `EnemyManager`:

```ts
export interface EnemyManagerSnapshot {
  enemies: EnemySnapshot[];
  topmostEnemyY: number;
  activeShooters: number;
  bullets: number;
}

declare debugRemoveEnemies?: (ids: readonly number[]) => void;

private readonly textureKeys: Record<EnemyKind | 'bullet', string>;
private nextEnemyId = 0;

spawnFormation(formation: readonly EnemySpec[]): void {
  if (this.destroyed) return;
  for (const spec of formation) {
    const enemy = this.enemyGroup.create(spec.x, spec.y, this.textureKeys[spec.kind]) as EnemySprite;
    enemy.enemyId = this.nextEnemyId;
    this.nextEnemyId += 1;
    enemy.kind = spec.kind;
    enemy.hp = spec.hp;
    enemy.setImmovable(true).setVelocityY(spec.speed);
    this.enemies.set(enemy.enemyId, enemy);
  }
}
```

When destroyed, return:

```ts
{ enemies: [], topmostEnemyY: Number.POSITIVE_INFINITY, activeShooters: 0, bullets: 0 }
```

Store the merged texture map on `this.textureKeys`, set `bulletTextureKey` from it, and replace constructor's inline creation loop with `this.spawnFormation(options.formation ?? createPrototypeFormation())`.

Return `topmostEnemyY` from active enemies:

```ts
const enemies = [...this.enemies.values()].filter((enemy) => enemy.active);
return {
  enemies: enemies.map((enemy) => ({
    id: enemy.enemyId,
    kind: enemy.kind,
    hp: enemy.hp,
    position: { x: enemy.x, y: enemy.y },
    warning: this.activeShooters.has(enemy.enemyId),
  })),
  topmostEnemyY: enemies.length === 0
    ? Number.POSITIVE_INFINITY
    : Math.min(...enemies.map((enemy) => enemy.y)),
  activeShooters: this.activeShooters.size,
  bullets: (this.bulletGroup.getChildren() as Phaser.Physics.Arcade.Sprite[])
    .filter((bullet) => bullet.active).length,
};
```

Install `debugRemoveEnemies` only inside the existing `import.meta.env.DEV` guard:

```ts
this.debugRemoveEnemies = (ids) => {
  if (ids.some((id) => !Number.isInteger(id) || id < 0)) {
    throw new RangeError('enemy IDs must be non-negative integers');
  }
  for (const id of new Set(ids)) {
    const enemy = this.enemies.get(id);
    if (enemy?.active) this.destroyEnemy(enemy);
  }
};
```

- [ ] **Step 4: Run manager and orb collision tests**

Run: `npm test -- src/game/enemies/EnemyManager.test.ts src/game/orbs/OrbManager.test.ts`

Expected: PASS. Appended enemies use existing group colliders without adding colliders per formation.

- [ ] **Step 5: Commit**

```bash
git add src/game/enemies/EnemyManager.ts src/game/enemies/EnemyManager.test.ts
git commit -m "feat: append enemy formations"
```

---

### Task 4: Add frame-driven `EncounterDirector`

**Files:**
- Create: `src/game/encounters/EncounterDirector.ts`
- Create: `src/game/encounters/EncounterDirector.test.ts`

**Interfaces:**
- Consumes: `update(deltaMs, { activeEnemies, topmostEnemyY }): EnemySpec[] | null`.
- Produces: `getSnapshot(): { elapsedMs; elapsedSinceSpawnMs; phase; spawnSequence }`.
- Depends on: `threatConfigAt`, `canSpawnReinforcement`, `createReinforcementFormation`.

- [ ] **Step 1: Write failing stateful timing tests**

```ts
import { describe, expect, it } from 'vitest';
import { EncounterDirector } from './EncounterDirector';

describe('EncounterDirector', () => {
  const clearTop = { activeEnemies: 16, topmostEnemyY: 120 };

  it('releases one pending formation when all gates open', () => {
    const director = new EncounterDirector();
    expect(director.update(7_999, clearTop)).toBeNull();
    const formation = director.update(1, clearTop);
    expect(formation).toHaveLength(6);
    expect(director.getSnapshot()).toMatchObject({ spawnSequence: 1, elapsedSinceSpawnMs: 0 });
  });

  it('keeps a blocked spawn pending and releases it without another interval', () => {
    const director = new EncounterDirector();
    expect(director.update(8_000, { activeEnemies: 17, topmostEnemyY: 120 })).toBeNull();
    expect(director.update(16, clearTop)).toHaveLength(6);
  });

  it('never emits catch-up formations in one update', () => {
    const director = new EncounterDirector();
    expect(director.update(24_000, clearTop)).toHaveLength(6);
    expect(director.getSnapshot().spawnSequence).toBe(1);
    expect(director.update(0, clearTop)).toBeNull();
  });

  it('waits for top clearance even when time and capacity pass', () => {
    const director = new EncounterDirector();
    expect(director.update(8_000, { activeEnemies: 0, topmostEnemyY: 97 })).toBeNull();
    expect(director.update(0, { activeEnemies: 0, topmostEnemyY: 98 })).toHaveLength(6);
  });
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm test -- src/game/encounters/EncounterDirector.test.ts`

Expected: FAIL because `./EncounterDirector` does not exist.

- [ ] **Step 3: Implement pending-spawn state**

```ts
import { PLAYER_MIN_Y } from '../constants';
import type { EnemySpec } from '../enemies/enemyRules';
import { canSpawnReinforcement, threatConfigAt } from './encounterRules';
import { createReinforcementFormation } from './formationRules';

export interface EncounterEnemyState {
  activeEnemies: number;
  topmostEnemyY: number;
}

export class EncounterDirector {
  private elapsedMs = 0;
  private elapsedSinceSpawnMs = 0;
  private spawnSequence = 0;

  update(deltaMs: number, enemyState: EncounterEnemyState): EnemySpec[] | null {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) throw new RangeError('deltaMs must be finite and non-negative');
    this.elapsedMs += deltaMs;
    this.elapsedSinceSpawnMs += deltaMs;
    const threat = threatConfigAt(this.elapsedMs);
    const formation = createReinforcementFormation(threat.phase, this.spawnSequence);
    if (!canSpawnReinforcement({
      elapsedSinceSpawnMs: this.elapsedSinceSpawnMs,
      spawnIntervalMs: threat.spawnIntervalMs,
      topmostEnemyY: enemyState.topmostEnemyY,
      requiredTopmostY: PLAYER_MIN_Y,
      activeEnemies: enemyState.activeEnemies,
      incomingEnemies: formation.length,
      activeCap: threat.activeCap,
    })) return null;

    this.elapsedSinceSpawnMs = 0;
    this.spawnSequence += 1;
    return formation;
  }

  getSnapshot() {
    return {
      elapsedMs: this.elapsedMs,
      elapsedSinceSpawnMs: this.elapsedSinceSpawnMs,
      phase: threatConfigAt(this.elapsedMs).phase,
      spawnSequence: this.spawnSequence,
    } as const;
  }
}
```

- [ ] **Step 4: Run director tests and confirm GREEN**

Run: `npm test -- src/game/encounters/EncounterDirector.test.ts`

Expected: PASS, including pending release and one-spawn-per-update behavior.

- [ ] **Step 5: Run all unit tests**

Run: `npm test`

Expected: all Vitest tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/game/encounters/EncounterDirector.ts src/game/encounters/EncounterDirector.test.ts
git commit -m "feat: schedule continuous encounters"
```

---

### Task 5: Integrate continuous ingress and verify in browser

**Files:**
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `e2e/combat.spec.ts`
- Modify: `docs/playtests/2026-07-13-core-redesign-prototype.md`

**Interfaces:**
- `CombatDebugSnapshot.encounter`: director snapshot.
- Development-only `CombatScene.debugRemoveEnemies(ids): void` delegates to `EnemyManager`.

- [ ] **Step 1: Write failing browser acceptance test**

Extend `DevelopmentScene` and `CombatSnapshot` exactly:

```ts
interface CombatSnapshot {
  // existing fields stay unchanged
  encounter: {
    elapsedMs: number;
    elapsedSinceSpawnMs: number;
    phase: 0 | 1 | 2;
    spawnSequence: number;
  };
}

interface DevelopmentScene {
  // existing methods stay unchanged
  debugRemoveEnemies(ids: readonly number[]): void;
}
```

Then add:

```ts
test('@desktop admits reinforcement while original enemies remain', async ({ page }) => {
  await page.clock.install();
  await loadCanvas(page);
  await sceneCall(page, (scene) => scene.debugRemoveEnemies([0, 3, 7, 11]));
  const before = await snapshot(page);
  expect(before.enemies).toHaveLength(16);

  await page.clock.runFor(8_100);

  const after = await snapshot(page);
  expect(after.enemies.some((enemy) => enemy.id < 20)).toBe(true);
  expect(after.enemies.some((enemy) => enemy.id >= 20)).toBe(true);
  expect(after.encounter.spawnSequence).toBe(1);
  expect(after.encounter.phase).toBe(0);
});
```

- [ ] **Step 2: Run the focused E2E test and confirm RED**

Run: `npm run test:e2e -- --project=desktop-chromium --grep "admits reinforcement"`

Expected: FAIL because `debugRemoveEnemies` and `encounter` snapshot data do not exist.

- [ ] **Step 3: Connect director and manager in `CombatScene`**

Add these declarations and snapshot field:

```ts
import { EncounterDirector } from '../encounters/EncounterDirector';

export interface CombatDebugSnapshot {
  // existing fields stay unchanged
  encounter: ReturnType<EncounterDirector['getSnapshot']>;
}

export class CombatScene extends Phaser.Scene {
  declare debugRemoveEnemies?: (ids: readonly number[]) => void;
  private encounterDirector?: EncounterDirector;
}
```

Instantiate `this.encounterDirector = new EncounterDirector()` immediately before constructing `EnemyManager`. Add this delegate inside the existing development guard:

```ts
this.debugRemoveEnemies = (ids) => this.enemyManager?.debugRemoveEnemies?.(ids);
```

Add director data to `getDebugSnapshot()`. The fallback is used only before scene creation or after shutdown:

```ts
encounter: this.encounterDirector?.getSnapshot() ?? {
  elapsedMs: 0,
  elapsedSinceSpawnMs: 0,
  phase: 0,
  spawnSequence: 0,
},
```

Because `EnemyManagerSnapshot` now requires `topmostEnemyY`, extend the existing fallback:

```ts
const enemySnapshot = this.enemyManager?.getSnapshot() ?? {
  enemies: [],
  topmostEnemyY: Number.POSITIVE_INFINITY,
  activeShooters: 0,
  bullets: 0,
};
```

After the existing manager update, drive one spawn decision:

Core update shape:

```ts
this.enemyManager.update();
const enemies = this.enemyManager.getSnapshot();
const formation = this.encounterDirector.update(delta, {
  activeEnemies: enemies.enemies.length,
  topmostEnemyY: enemies.topmostEnemyY,
});
if (formation) this.enemyManager.spawnFormation(formation);
```

Require `this.encounterDirector` in the early-return guard. In `handleShutdown`, set it to `undefined` beside the existing manager and orb cleanup. Do not add visible wave UI.

- [ ] **Step 4: Run focused E2E and full unit suite**

Run: `npm run test:e2e -- --project=desktop-chromium --grep "admits reinforcement" && npm test`

Expected: focused Playwright test PASS; all Vitest tests PASS.

- [ ] **Step 5: Run full browser and production verification**

Run: `npm run test:e2e && npm run build`

Expected: desktop and mobile Playwright projects PASS; TypeScript and Vite production build exit 0. Production bundle still excludes development helpers through `import.meta.env.DEV` dead-code elimination.

- [ ] **Step 6: Record acceptance state**

Append a dated entry to `docs/playtests/2026-07-13-core-redesign-prototype.md` containing:

```markdown
## 2026-07-14 Continuous ingress automation

- Initial formation: 20
- Reinforcement: 6 enemies after 8 seconds when four capacity slots are available
- Original and reinforcement IDs coexist: verified by Playwright
- Unit tests: PASS
- Desktop/mobile E2E: PASS
- Production build: PASS
- Physical-device density and aim-fatigue check: pending user playtest
```

Replace each `PASS` only with the fresh observed test count or command result from Steps 4~5. Do not mark the physical-device check complete without user play.

- [ ] **Step 7: Commit**

```bash
git add src/game/scenes/CombatScene.ts e2e/combat.spec.ts docs/playtests/2026-07-13-core-redesign-prototype.md
git commit -m "feat: stream enemy reinforcements"
```

---

## Completion Gate

- [ ] `npm test` passes with zero failures.
- [ ] `npm run test:e2e` passes in desktop and mobile projects.
- [ ] `npm run build` exits 0.
- [ ] `git diff --check` reports no errors.
- [ ] Browser snapshot proves at least one original ID `< 20` and one reinforcement ID `>= 20` coexist.
- [ ] No visible wave transition UI exists.
- [ ] Manual density and aim-fatigue acceptance remains explicitly pending until user playtest.
