# Procedural Enemy Formations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace repetitive fixed layouts with deterministic procedural formations whose enemy count can change without editing pattern coordinates.

**Architecture:** Pure `formationRules` selects a weighted style and generates unique board cells from `style + count + seed`. Threat phases own only count ranges and spawn limits. `CombatScene` owns the per-run seed, while `EncounterDirector` owns sequence state and requests completed formations.

**Tech Stack:** TypeScript, Phaser 3, Vitest, Playwright

## Global Constraints

- Initial formation contains exactly 20 enemies and never uses `grid`.
- Reusable styles are `cluster`, `pockets`, `bands`, `scatter`, and rare `grid`; no fixed coordinate catalogs or phase-specific pattern copies.
- Phase 0/1/2 reinforcement sizes are `9..11`, `11..13`, and `13..15`.
- One nine-entry shuffle bag contains each organic style twice and `grid` once; adjacent styles differ across bag boundaries.
- Same run seed and sequence reproduce the same formation. Different run seeds vary the initial layout or first bag.
- Every generated enemy is unique, within x `36..414`, moves at `18px/s`, and preserves phase-based special-enemy pressure.
- Active caps are `32/40/48`; spawn intervals remain `8/7/6s` and formations are admitted whole.
- Do not change enemy descent speed, HP rules, XP, firing caps, bosses, or temporary-orb effect inheritance.

---

### Task 1: Build deterministic procedural formation rules

**Files:**
- Modify: `src/game/encounters/formationRules.ts`
- Modify: `src/game/encounters/formationRules.test.ts`

**Interfaces:**
- Produces:
  - `FormationStyle = 'cluster' | 'pockets' | 'bands' | 'scatter' | 'grid'`
  - `FormationResult { id: string; style: FormationStyle; enemies: EnemySpec[] }`
  - `generateFormation(style, count, seed, originY): EnemySpec[]`
  - `createInitialFormation(runSeed): FormationResult`
  - `createReinforcementFormation(phase, sequence, runSeed): FormationResult`

- [ ] **Step 1: Write failing invariant tests**

Replace exact template assertions with tests covering:

```ts
const ORGANIC = ['cluster', 'pockets', 'bands', 'scatter'] as const;

it.each(ORGANIC)('%s generates exact, unique, safe counts', (style) => {
  for (const count of [9, 15, 20]) {
    const enemies = generateFormation(style, count, 1234, count === 20 ? 80 : -28);
    expect(enemies).toHaveLength(count);
    expect(new Set(enemies.map(({ x, y }) => `${x}:${y}`))).toHaveLength(count);
    expect(enemies.every(({ x }) => x >= 36 && x <= 414)).toBe(true);
    expect(enemies.every(({ speed }) => speed === 18)).toBe(true);
  }
});

it('is deterministic but varies generated coordinates by seed', () => {
  expect(generateFormation('cluster', 20, 7, 80))
    .toEqual(generateFormation('cluster', 20, 7, 80));
  const layouts = new Set(Array.from({ length: 8 }, (_, seed) =>
    JSON.stringify(generateFormation('cluster', 20, seed, 80).map(({ x, y }) => [x, y]))));
  expect(layouts.size).toBeGreaterThan(4);
});

it('creates non-grid 20-enemy initial formations', () => {
  for (let seed = 0; seed < 16; seed += 1) {
    const result = createInitialFormation(seed);
    expect(result.enemies).toHaveLength(20);
    expect(result.style).not.toBe('grid');
  }
});

it.each([[0, 9, 11], [1, 11, 13], [2, 13, 15]] as const)(
  'keeps phase %i within %i..%i', (phase, minimum, maximum) => {
    for (let sequence = 0; sequence < 27; sequence += 1) {
      const size = createReinforcementFormation(phase, sequence, 99).enemies.length;
      expect(size).toBeGreaterThanOrEqual(minimum);
      expect(size).toBeLessThanOrEqual(maximum);
    }
  },
);
```

For every organic style across several seeds, also assert at least one horizontally/vertically adjacent pair and at least one row with occupied columns separated by two or more empty cells. Assert one bag contains `2/2/2/2/1` styles, no adjacent repeat through at least 27 sequences, special-enemy counts do not fall by phase, and invalid count/seed/sequence inputs throw clear `RangeError`s.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm test -- src/game/encounters/formationRules.test.ts`

Expected: FAIL because the new types/functions and procedural behavior do not exist.

- [ ] **Step 3: Implement a bounded seeded generator**

Use a local 32-bit PRNG only; never call `Math.random`. Validate integer `count >= 1`, integer unsigned-compatible seed, and non-negative sequence. Build an 8-column candidate board with:

```ts
const columns = 8;
const rows = Math.max(3, Math.ceil(count / columns) + 2);
const cells = Array.from({ length: rows * columns }, (_, index) => ({
  row: Math.floor(index / columns),
  column: index % columns,
}));
```

Each style returns an ordered list of all candidate cells, then the shared layer takes the first `count` unique cells:

- `cluster`: choose 2 or 3 separated seeded anchors; repeatedly append an unused orthogonal/diagonal neighbor of the growing clusters, occasionally alternating anchors.
- `pockets`: assign each cell a score from distance to 2 seeded hole centers plus small seeded jitter; farthest cells rank first, leaving coherent holes.
- `bands`: create seeded row runs of 2..5 cells with alternating horizontal bias, then append unused cells in seeded order.
- `scatter`: seeded shuffle, but rank candidates so roughly two of every three additions touch an existing cell and the remainder prefer non-touching cells.
- `grid`: checkerboard cells first, opposite parity second, both seeded within parity.

If a style-specific pass ends early, append a seeded shuffle of every unused candidate. Convert cells to enemies with row offset selected from `[-10, 0, 10]`, clamped so x stays `36..414`; use row spacing `42`, `originY`, and seeded mirroring. Assign kinds from phase-independent position order with a passed pressure tier: initial uses the existing 20-enemy composition, reinforcement pressure increases by phase. Keep armored HP `3`, all other HP `1`, speed `18`.

Selection mechanics:

```ts
const BAG = ['cluster','cluster','pockets','pockets','bands','bands','scatter','scatter','grid'] as const;
const SIZE_RANGES = [[9, 11], [11, 13], [13, 15]] as const;
```

Shuffle each bag using `runSeed` plus cycle index. Repair adjacent duplicates inside the bag and at the previous bag boundary by swapping with the first compatible later entry. Do not mix phase into style selection, so a phase transition cannot create a hidden consecutive repeat. Derive separate seeds for count, coordinates, offsets, and kinds. Formation ID must include run seed, sequence, style, and derived layout seed.

- [ ] **Step 4: Run focused and full unit tests**

Run:

```bash
npm test -- src/game/encounters/formationRules.test.ts
npm test
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/encounters/formationRules.ts src/game/encounters/formationRules.test.ts
git commit -m "feat: generate procedural enemy formations"
```

---

### Task 2: Wire run seeds and density into gameplay

**Files:**
- Modify: `src/game/enemies/enemyRules.ts`
- Modify: `src/game/enemies/enemyRules.test.ts`
- Modify: `src/game/enemies/EnemyManager.ts`
- Modify: `src/game/encounters/EncounterDirector.ts`
- Modify: `src/game/encounters/EncounterDirector.test.ts`
- Modify: `src/game/encounters/encounterRules.ts`
- Modify: `src/game/encounters/encounterRules.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`

**Interfaces:**
- Consumes Task 1 `FormationResult` functions.
- `EncounterDirector(runSeed = 0)` returns `EnemySpec[] | null` from `update` and exposes `runSeed` plus `lastFormationId` in its snapshot.

- [ ] **Step 1: Write failing integration tests**

Update director tests to construct `new EncounterDirector(1234)`, verify a phase-0 spawn has `9..11` enemies, consecutive admitted formations differ, and snapshot metadata equals the constructor seed and emitted ID. Update encounter rule assertions to exact caps `32/40/48` while keeping intervals `8000/7000/6000`. Prove `activeEnemies + incomingEnemies === cap` admits and one more blocks the whole formation.

Move the initial-formation shape assertions out of `enemyRules.test.ts`; `enemyRules.ts` must retain only enemy types and `canFire`.

- [ ] **Step 2: Run focused tests and confirm RED**

Run:

```bash
npm test -- src/game/encounters/EncounterDirector.test.ts src/game/encounters/encounterRules.test.ts src/game/enemies/enemyRules.test.ts
```

Expected: FAIL on seed metadata, variable sizes, and caps.

- [ ] **Step 3: Wire production code**

- `EnemyManager` fallback becomes `createInitialFormation(0).enemies`.
- `EncounterDirector` stores constructor `runSeed`, requests `createReinforcementFormation(phase, spawnSequence, runSeed)`, gates on `result.enemies.length`, returns `result.enemies`, and records `result.id` only after admission.
- Rename fixed progression seed to `PROGRESSION_SEED`.
- Add module-scoped formation seed initialized as `(Date.now() ^ 0x5249434f) >>> 0`; increment it once per `CombatScene.create()` with unsigned wrap.
- In `CombatScene.create()`, take one formation run seed, pass it to `new EncounterDirector(seed)` and `createInitialFormation(seed).enemies`, then pass that initial array into `EnemyManager`.
- Debug fallback snapshots must expose `runSeed: 0` and `lastFormationId: null`.

- [ ] **Step 4: Run unit tests and build**

Run:

```bash
npm test
npm run build
```

Expected: all unit tests PASS and Vite build exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/game/enemies src/game/encounters src/game/scenes/CombatScene.ts
git commit -m "feat: vary formations across runs"
```

---

### Task 3: Verify runtime variation and record playtest target

**Files:**
- Modify: `e2e/combat.spec.ts`
- Modify: `docs/playtest/2026-07-15-core-loop-playtest.md`

**Interfaces:**
- Consumes public development debug snapshot only: `encounter.runSeed`, `encounter.lastFormationId`, and enemy positions.

- [ ] **Step 1: Add a browser acceptance test**

Create `varies procedural enemy formations across spawns and restarts`:

1. Load the game and assert 20 initial enemies.
2. Capture initial seed and sorted positions.
3. Remove enough/all enemies through existing debug hooks and advance 8.1 seconds.
4. Assert the first reinforcement size is `9..11`, its ID is non-null, and positions are unique.
5. Remove it, advance another 8.1 seconds, and assert the second ID/style/layout differs.
6. Restart through the existing defeat/restart flow.
7. Assert the run seed and 20-enemy initial position array differ from the first run.

Keep all existing collision, pause, health, level-up, shooter-cap, bullet-cap, and temporary-orb assertions unchanged.

- [ ] **Step 2: Run the focused browser test**

Run: `npm run test:e2e -- --project=desktop-chromium --grep "varies procedural enemy formations"`

Expected: PASS after Task 2 wiring; fix only genuine runtime/debug-contract problems.

- [ ] **Step 3: Run complete verification**

Run:

```bash
npm test
npm run test:e2e
npm run build
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 4: Record manual playtest checklist**

Append the procedural-formation build/test evidence and unchecked manual targets: visible clusters plus gaps, rare grid not becoming familiar, density readability/performance, and no obvious repeated layout.

- [ ] **Step 5: Commit**

```bash
git add e2e/combat.spec.ts docs/playtest/2026-07-15-core-loop-playtest.md
git commit -m "test: verify procedural enemy formations"
```
