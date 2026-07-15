# Varied Enemy Formations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace repetitive checkerboard enemy layouts with deterministic seeded clusters, gaps, rare grid formations, and higher active density.

**Architecture:** Keep pattern catalogs, weighted shuffle-bag selection, mirroring, and row offsets in pure `formationRules`. `CombatScene` creates one run seed and passes it to both the initial formation and `EncounterDirector`; `EnemyManager` remains a consumer of completed `EnemySpec[]`. Browser tests observe only public debug snapshots, while pure tests use fixed seeds.

**Tech Stack:** TypeScript 5.9.3, Phaser 3.90.0, Vitest 4.1.10, Playwright 1.61.1

## Global Constraints

- Initial formation has exactly 20 enemies and always uses one of four non-grid layouts.
- Each threat phase has four organic patterns and one grid pattern.
- One nine-entry shuffle bag contains each organic pattern twice and the grid pattern once.
- The same base pattern never appears consecutively, including across bag boundaries.
- Reinforcement sizes stay inside `9~11`, `11~13`, and `13~15` for phases 0, 1, and 2.
- Active caps are exactly `32`, `40`, and `48`; spawn intervals remain `8_000`, `7_000`, and `6_000ms`.
- Enemy speed remains `18px/s`; HP, XP, shooter cap 2, bullet cap 12, controls, and abilities remain unchanged.
- Every generated enemy center remains within `x=36~414`.
- Same seed and sequence must reproduce the same formation; consecutive runs receive different seeds.
- No generic random-layout engine, settings UI, boss, or temporary-orb behavior change is added.

---

### Task 1: Build the pure seeded pattern catalog and shuffle bag

**Files:**
- Modify: `src/game/encounters/formationRules.ts`
- Modify: `src/game/encounters/formationRules.test.ts`

**Interfaces:**
- Produces: `FormationStyle`, `FormationResult`, `createInitialFormation(runSeed)`, `createReinforcementFormation(phase, sequence, runSeed)`.
- `FormationResult` is `{ id: string; style: FormationStyle; enemies: EnemySpec[] }`.
- `FormationStyle` is `'organic-a' | 'organic-b' | 'organic-c' | 'organic-d' | 'grid'`.

- [ ] **Step 1: Replace fixed-size expectations with failing seeded-selection tests**

Add these behaviors to `formationRules.test.ts` before changing production:

```ts
import {
  createInitialFormation,
  createReinforcementFormation,
} from './formationRules';

it('creates four non-grid 20-enemy initial layouts from fixed seeds', () => {
  const results = [0, 1, 2, 3].map(createInitialFormation);
  expect(results.map((result) => result.id)).toEqual([
    'initial-0', 'initial-1', 'initial-2', 'initial-3',
  ]);
  expect(results.every((result) => result.style !== 'grid')).toBe(true);
  expect(results.every((result) => result.enemies.length === 20)).toBe(true);
  expect(new Set(results.map((result) => JSON.stringify(
    result.enemies.map((enemy) => [enemy.x, enemy.y]),
  )))).toHaveLength(4);
});

it.each([
  [0, 9, 11],
  [1, 11, 13],
  [2, 13, 15],
] as const)('keeps phase %i formations within %i..%i enemies', (phase, minimum, maximum) => {
  for (let sequence = 0; sequence < 18; sequence += 1) {
    const result = createReinforcementFormation(phase, sequence, 1234);
    expect(result.enemies.length).toBeGreaterThanOrEqual(minimum);
    expect(result.enemies.length).toBeLessThanOrEqual(maximum);
    expect(result.enemies.every((enemy) => enemy.speed === 18)).toBe(true);
    expect(result.enemies.every((enemy) => enemy.x >= 36 && enemy.x <= 414)).toBe(true);
  }
});

it('uses one grid and two of each organic style per nine-entry bag', () => {
  const styles = Array.from({ length: 9 }, (_, sequence) =>
    createReinforcementFormation(1, sequence, 77).style);
  expect(styles.filter((style) => style === 'grid')).toHaveLength(1);
  for (const style of ['organic-a', 'organic-b', 'organic-c', 'organic-d'] as const) {
    expect(styles.filter((candidate) => candidate === style)).toHaveLength(2);
  }
});

it('does not repeat a base style, including across bag boundaries', () => {
  const styles = Array.from({ length: 36 }, (_, sequence) =>
    createReinforcementFormation(2, sequence, 9981).style);
  for (let index = 1; index < styles.length; index += 1) {
    expect(styles[index]).not.toBe(styles[index - 1]);
  }
});

it('is deterministic by seed and changes with another seed', () => {
  const one = Array.from({ length: 9 }, (_, sequence) =>
    createReinforcementFormation(0, sequence, 21));
  const again = Array.from({ length: 9 }, (_, sequence) =>
    createReinforcementFormation(0, sequence, 21));
  const other = Array.from({ length: 9 }, (_, sequence) =>
    createReinforcementFormation(0, sequence, 22));
  expect(again).toEqual(one);
  expect(other).not.toEqual(one);
});
```

Keep the invalid-sequence test and add invalid seed validation for non-integer and negative values.

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
npm test -- src/game/encounters/formationRules.test.ts
```

Expected: FAIL because `createInitialFormation`, `FormationResult`, seed input, multiple templates, and style metadata do not exist.

- [ ] **Step 3: Implement exact catalog types and pattern positions**

Use these types and constants in `formationRules.ts`:

```ts
export type FormationStyle = 'organic-a' | 'organic-b' | 'organic-c' | 'organic-d' | 'grid';

export interface FormationResult {
  id: string;
  style: FormationStyle;
  enemies: EnemySpec[];
}

type Point = readonly [row: number, column: number];
type Pattern = Readonly<{ style: FormationStyle; points: readonly Point[] }>;

const INITIAL_ROW_Y = [80, 122, 164, 206, 248] as const;
const REINFORCEMENT_ROW_Y = [-28, 14, 56] as const;
const SPEED = 18;
const ORGANIC_STYLES = ['organic-a', 'organic-b', 'organic-c', 'organic-d'] as const;
const BAG_WEIGHTS: readonly FormationStyle[] = [
  'organic-a', 'organic-a', 'organic-b', 'organic-b',
  'organic-c', 'organic-c', 'organic-d', 'organic-d', 'grid',
];
```

Use these exact initial position catalogs; enemy kinds are assigned by the shared initial kind list below:

```ts
const INITIAL_POINTS: readonly (readonly Point[])[] = [
  [[0,0],[0,1],[0,2],[0,6], [1,2],[1,3],[1,4],[1,7], [2,0],[2,5],[2,6],[2,7], [3,1],[3,2],[3,6],[3,7], [4,0],[4,1],[4,4],[4,5]],
  [[0,1],[0,2],[0,5],[0,6], [1,0],[1,1],[1,2],[1,7], [2,3],[2,4],[2,5],[2,6], [3,0],[3,4],[3,5],[3,7], [4,1],[4,2],[4,3],[4,7]],
  [[0,0],[0,4],[0,5],[0,6], [1,0],[1,1],[1,5],[1,6], [2,2],[2,3],[2,4],[2,7], [3,0],[3,1],[3,2],[3,6], [4,3],[4,4],[4,6],[4,7]],
  [[0,1],[0,2],[0,3],[0,7], [1,0],[1,4],[1,5],[1,6], [2,0],[2,1],[2,6],[2,7], [3,2],[3,3],[3,4],[3,7], [4,0],[4,1],[4,5],[4,6]],
];

const INITIAL_KINDS: readonly EnemyKind[] = [
  'basic','basic','armored','basic', 'basic','shooter','basic','basic',
  'basic','armored','basic','basic', 'shooter','basic','basic','basic',
  'armored','basic','shooter','basic',
];
```

Use these exact point catalogs for phases 0, 1, and 2. Array order maps to `organic-a`, `organic-b`, `organic-c`, `organic-d`, `grid`:

```ts
const PHASE_PATTERNS: Readonly<Record<ThreatPhase, readonly Pattern[]>> = {
  0: [
    { style:'organic-a', points:[[0,0],[0,1],[0,2],[0,6],[1,2],[1,3],[1,7],[2,0],[2,6]] },
    { style:'organic-b', points:[[0,0],[0,4],[0,5],[1,1],[1,2],[1,3],[1,7],[2,0],[2,1],[2,6]] },
    { style:'organic-c', points:[[0,0],[0,1],[0,5],[0,6],[0,7],[1,2],[1,3],[1,4],[2,0],[2,6],[2,7]] },
    { style:'organic-d', points:[[0,1],[0,2],[0,6],[1,0],[1,4],[1,5],[1,6],[2,2],[2,7]] },
    { style:'grid', points:[[0,0],[0,2],[0,4],[0,6],[0,7],[1,1],[1,3],[1,5],[1,7],[2,4]] },
  ],
  1: [
    { style:'organic-a', points:[[0,0],[0,1],[0,2],[0,6],[0,7],[1,2],[1,3],[1,4],[1,7],[2,0],[2,5]] },
    { style:'organic-b', points:[[0,0],[0,4],[0,5],[0,6],[1,0],[1,1],[1,2],[1,6],[1,7],[2,3],[2,4],[2,7]] },
    { style:'organic-c', points:[[0,0],[0,1],[0,5],[0,6],[0,7],[1,2],[1,3],[1,4],[2,0],[2,1],[2,6],[2,7],[2,4]] },
    { style:'organic-d', points:[[0,1],[0,2],[0,3],[0,7],[1,0],[1,4],[1,5],[1,6],[2,0],[2,1],[2,6]] },
    { style:'grid', points:[[0,0],[0,2],[0,4],[0,6],[1,1],[1,3],[1,5],[1,7],[2,0],[2,2],[2,4],[2,6]] },
  ],
  2: [
    { style:'organic-a', points:[[0,0],[0,1],[0,2],[0,5],[0,6],[0,7],[1,2],[1,3],[1,4],[1,7],[2,0],[2,1],[2,5]] },
    { style:'organic-b', points:[[0,0],[0,3],[0,4],[0,5],[0,6],[1,0],[1,1],[1,2],[1,6],[1,7],[2,2],[2,3],[2,4],[2,7]] },
    { style:'organic-c', points:[[0,0],[0,1],[0,5],[0,6],[0,7],[1,1],[1,2],[1,3],[1,4],[2,0],[2,4],[2,5],[2,6],[2,7],[1,7]] },
    { style:'organic-d', points:[[0,1],[0,2],[0,3],[0,7],[1,0],[1,4],[1,5],[1,6],[1,7],[2,0],[2,1],[2,2],[2,6]] },
    { style:'grid', points:[[0,0],[0,2],[0,4],[0,6],[0,7],[1,1],[1,3],[1,5],[1,7],[2,0],[2,2],[2,4],[2,6],[2,7]] },
  ],
};
```

Assign reinforcement special enemies by stable indexes so special pressure remains bounded:

```ts
function reinforcementKind(phase: ThreatPhase, index: number): EnemyKind {
  if (phase === 0) return index === 2 ? 'armored' : 'basic';
  if (phase === 1) {
    if (index === 2 || index === 8) return 'armored';
    return index === 5 ? 'shooter' : 'basic';
  }
  if (index === 2 || index === 9) return 'armored';
  if (index === 5 || index === 11) return 'shooter';
  return 'basic';
}
```

- [ ] **Step 4: Implement deterministic bag selection and transforms**

Use an LCG and two shuffled organic permutations. Rotate the second permutation until its first entry differs from the first permutation's last entry, insert `grid` into a seeded slot, then repair the first item against the previous cycle's last item by swapping with the first different style. This preserves exact weights and prevents adjacent repeats.

```ts
function nextSeed(seed: number): number {
  return (Math.imul(seed, 1664525) + 1013904223) >>> 0;
}

function shuffledOrganic(seed: number): { styles: FormationStyle[]; seed: number } {
  const styles: FormationStyle[] = [...ORGANIC_STYLES];
  let state = seed >>> 0;
  for (let index = styles.length - 1; index > 0; index -= 1) {
    state = nextSeed(state);
    const swap = state % (index + 1);
    [styles[index], styles[swap]] = [styles[swap]!, styles[index]!];
  }
  return { styles, seed: state };
}

function rawBag(runSeed: number, cycle: number): FormationStyle[] {
  let state = (runSeed ^ Math.imul(cycle + 1, 0x85ebca6b)) >>> 0;
  const first = shuffledOrganic(state);
  state = first.seed;
  const second = shuffledOrganic(nextSeed(state));
  const secondStyles = [...second.styles];
  while (secondStyles[0] === first.styles.at(-1)) secondStyles.push(secondStyles.shift()!);
  state = nextSeed(second.seed);
  const bag = [...first.styles, ...secondStyles];
  bag.splice(state % (bag.length + 1), 0, 'grid');
  return bag;
}

function bagFor(runSeed: number, cycle: number): FormationStyle[] {
  const bag = rawBag(runSeed, cycle);
  if (cycle === 0) return bag;
  const previousLast = rawBag(runSeed, cycle - 1).at(-1)!;
  if (bag[0] !== previousLast) return bag;
  const swap = bag.findIndex((style) => style !== previousLast);
  [bag[0], bag[swap]] = [bag[swap]!, bag[0]!];
  return bag;
}
```

Do not mix `phase` into the style bag seed. Sequence is global, so one style order must continue through phase changes without an adjacent repeat. Phase selects only the matching point catalog.

Validate `runSeed` and `sequence` as non-negative integers. Select `cycle = Math.floor(sequence / BAG_WEIGHTS.length)` and `index = sequence % BAG_WEIGHTS.length`. Apply transforms with these exact helpers:

```ts
const ROW_SHIFTS = [-10, 0, 10] as const;

function validateIndex(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }
}

function transformPoints(
  points: readonly Point[],
  rowY: readonly number[],
  transformSeed: number,
  kindAt: (index: number) => EnemyKind,
): EnemySpec[] {
  let state = transformSeed >>> 0;
  state = nextSeed(state);
  const mirror = state % 2 === 1;
  const shifts = rowY.map(() => {
    state = nextSeed(state);
    return ROW_SHIFTS[state % ROW_SHIFTS.length]!;
  });
  return points.map(([row, rawColumn], index) => {
    const column = mirror ? 7 - rawColumn : rawColumn;
    const signedShift = mirror ? -shifts[row]! : shifts[row]!;
    const x = Math.max(36, Math.min(414, 36 + column * 54 + signedShift));
    const kind = kindAt(index);
    return {
      kind,
      hp: kind === 'armored' ? 3 : 1,
      x,
      y: rowY[row]!,
      column,
      speed: SPEED,
    };
  });
}
```

Implement public functions exactly as follows:

```ts
export function createInitialFormation(runSeed: number): FormationResult {
  validateIndex(runSeed, 'runSeed');
  const index = runSeed % INITIAL_POINTS.length;
  return {
    id: `initial-${index}`,
    style: ORGANIC_STYLES[index]!,
    enemies: transformPoints(
      INITIAL_POINTS[index]!, INITIAL_ROW_Y, runSeed,
      (enemyIndex) => INITIAL_KINDS[enemyIndex]!,
    ),
  };
}

export function createReinforcementFormation(
  phase: ThreatPhase,
  sequence: number,
  runSeed: number,
): FormationResult {
  validateIndex(sequence, 'sequence');
  validateIndex(runSeed, 'runSeed');
  const cycle = Math.floor(sequence / BAG_WEIGHTS.length);
  const index = sequence % BAG_WEIGHTS.length;
  const style = bagFor(runSeed, cycle)[index]!;
  const pattern = PHASE_PATTERNS[phase].find((candidate) => candidate.style === style)!;
  return {
    id: `phase-${phase}-${style}-${cycle}-${index}`,
    style,
    enemies: transformPoints(
      pattern.points,
      REINFORCEMENT_ROW_Y,
      (runSeed ^ Math.imul(sequence + 1, 0x9e3779b1)) >>> 0,
      (enemyIndex) => reinforcementKind(phase, enemyIndex),
    ),
  };
}
```

- [ ] **Step 5: Run focused and full unit tests**

Run:

```bash
npm test -- src/game/encounters/formationRules.test.ts
npm test
```

Expected: formation tests and all unit tests PASS.

- [ ] **Step 6: Commit pure formation rules**

```bash
git add src/game/encounters/formationRules.ts src/game/encounters/formationRules.test.ts
git commit -m "feat: add seeded enemy formation patterns"
```

---

### Task 2: Wire run seeds, initial formations, and higher caps

**Files:**
- Modify: `src/game/enemies/enemyRules.ts`
- Modify: `src/game/enemies/enemyRules.test.ts`
- Modify: `src/game/enemies/EnemyManager.ts`
- Modify: `src/game/enemies/EnemyManager.test.ts`
- Modify: `src/game/encounters/EncounterDirector.ts`
- Modify: `src/game/encounters/EncounterDirector.test.ts`
- Modify: `src/game/encounters/encounterRules.ts`
- Modify: `src/game/encounters/encounterRules.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`

**Interfaces:**
- Consumes: Task 1 `FormationResult`, `createInitialFormation(runSeed)`, `createReinforcementFormation(phase, sequence, runSeed)`.
- Produces: `new EncounterDirector(runSeed)`, debug snapshot `encounter.runSeed` and `encounter.lastFormationId`.

- [ ] **Step 1: Write failing runtime composition tests**

Change `EncounterDirector.test.ts` to construct `new EncounterDirector(1234)`. Assert returned arrays remain `EnemySpec[]`, formation lengths stay inside phase ranges, and snapshot records the emitted formation ID:

```ts
const director = new EncounterDirector(1234);
const formation = director.update(8_000, { activeEnemies: 20, topmostEnemyY: 120 });
expect(formation?.length).toBeGreaterThanOrEqual(9);
expect(formation?.length).toBeLessThanOrEqual(11);
expect(director.getSnapshot()).toMatchObject({
  runSeed: 1234,
  spawnSequence: 1,
  lastFormationId: expect.stringContaining('phase-0-'),
});
```

Update `encounterRules.test.ts` exact caps to `32/40/48`, leaving interval expectations unchanged. Update the capacity test to use a real phase-0 incoming size and prove one extra active enemy blocks the whole formation.

Move initial-formation assertions from `enemyRules.test.ts` to `formationRules.test.ts`. Keep only `EnemyKind`, `EnemySpec`, and `canFire` in `enemyRules.ts`; `EnemyManager` fallback becomes `createInitialFormation(0).enemies`.

- [ ] **Step 2: Run runtime-focused tests and confirm RED**

Run:

```bash
npm test -- src/game/encounters/EncounterDirector.test.ts src/game/encounters/encounterRules.test.ts src/game/enemies/enemyRules.test.ts src/game/enemies/EnemyManager.test.ts
```

Expected: FAIL because constructor seed, snapshot metadata, new caps, and initial-formation ownership are not wired.

- [ ] **Step 3: Implement director and cap changes**

Add constructor seed and last emitted ID:

```ts
export class EncounterDirector {
  private elapsedMs = 0;
  private elapsedSinceSpawnMs = 0;
  private spawnSequence = 0;
  private lastFormationId: string | null = null;

  constructor(private readonly runSeed = 0) {
    if (!Number.isInteger(runSeed) || runSeed < 0) {
      throw new RangeError('runSeed must be a non-negative integer');
    }
  }
}
```

In `update`, call `createReinforcementFormation(threat.phase, this.spawnSequence, this.runSeed)`, use `result.enemies.length` for the cap gate, set `lastFormationId = result.id` only after admission, increment sequence, and return `result.enemies`.

Return `runSeed` and `lastFormationId` from `getSnapshot()`.

Set caps in `encounterRules.ts`:

```ts
if (elapsedMs >= 120_000) return { phase: 2, activeCap: 48, spawnIntervalMs: 6_000 };
if (elapsedMs >= 60_000) return { phase: 1, activeCap: 40, spawnIntervalMs: 7_000 };
return { phase: 0, activeCap: 32, spawnIntervalMs: 8_000 };
```

- [ ] **Step 4: Wire a different seed for each scene run**

At module scope in `CombatScene.ts`, keep the progression-choice seed fixed and add a monotonically advancing formation seed:

```ts
const PROGRESSION_SEED = 0x5249434f;
let nextFormationRunSeed = (Date.now() ^ 0x5249434f) >>> 0;

function takeFormationRunSeed(): number {
  const seed = nextFormationRunSeed;
  nextFormationRunSeed = (nextFormationRunSeed + 1) >>> 0;
  return seed;
}
```

During `create()`:

```ts
const formationRunSeed = takeFormationRunSeed();
this.progression = new ProgressionManager(PROGRESSION_SEED, build);
this.encounterDirector = new EncounterDirector(formationRunSeed);
const initialFormation = createInitialFormation(formationRunSeed).enemies;
this.enemyManager = new EnemyManager(this, {
  formation: initialFormation,
  // existing options unchanged
});
```

The fallback encounter debug snapshot must include `runSeed: 0` and `lastFormationId: null`. Scene restart calls `create()` again and consumes the next seed, guaranteeing a new initial template index because initial selection uses `runSeed % 4`.

- [ ] **Step 5: Run focused and full unit tests**

Run:

```bash
npm test -- src/game/encounters src/game/enemies
npm test
```

Expected: focused tests and all unit tests PASS.

- [ ] **Step 6: Commit runtime integration**

```bash
git add src/game/enemies src/game/encounters src/game/scenes/CombatScene.ts
git commit -m "feat: vary formations across runs"
```

---

### Task 3: Add browser acceptance and record playtest gaps

**Files:**
- Modify: `e2e/combat.spec.ts`
- Modify: `docs/playtests/2026-07-13-core-redesign-prototype.md`

**Interfaces:**
- Consumes: debug snapshot `encounter.runSeed`, `encounter.lastFormationId`, enemy IDs and positions.
- Produces: no runtime API.

- [ ] **Step 1: Add failing browser assertions for varied layouts**

Extend the debug snapshot test type with `runSeed: number` and `lastFormationId: string | null`. Add a desktop test that:

1. Captures the 20 initial enemy positions and run seed.
2. Removes enough initial enemies to admit a phase-0 formation.
3. Advances 8.1 seconds and captures the first reinforcement ID and positions for IDs `>=20`.
4. Removes all current enemies, advances another 8.1 seconds, and captures the second reinforcement.
5. Asserts both formation IDs are non-null and different, position arrays are different, and both sizes are within `9~11`.
6. Causes defeat/restart and asserts the new run seed and initial 20-enemy position array differ from the previous run.

Use sorted `[x,y]` tuples rather than enemy IDs when comparing layouts. Keep existing reinforcement, pause, shooter/bullet, level-up, and restart assertions.

- [ ] **Step 2: Run the new E2E and confirm RED**

Run:

```bash
npm run test:e2e -- --project=desktop-chromium --grep "varies seeded enemy formations"
```

Expected: FAIL because snapshot seed/formation metadata and varied runtime layouts are absent.

- [ ] **Step 3: Make only fixture corrections exposed by the new density**

If existing E2E fixtures assume the previous cap or fixed reinforcement length, update those exact assertions to the new ranges. Do not weaken collision, pause, health, level-up, or temporary-orb assertions.

- [ ] **Step 4: Run full verification**

Run:

```bash
npm test
npm run test:e2e
npm run build
git diff --check
```

Expected: all unit tests PASS; all desktop/mobile E2E tests PASS; production build exits 0; diff check prints nothing. Existing Vite chunk-size warning may remain.

- [ ] **Step 5: Update playtest evidence**

Append a dated section to `docs/playtests/2026-07-13-core-redesign-prototype.md` with exact automated counts and these manual pending checks:

- clusters and large gaps read naturally;
- the rare grid pattern is not over-familiar;
- `32/40/48` density remains readable;
- browser and physical-phone performance stay acceptable.

- [ ] **Step 6: Commit acceptance and docs**

```bash
git add e2e/combat.spec.ts docs/playtests/2026-07-13-core-redesign-prototype.md
git commit -m "test: verify varied enemy formations"
```
