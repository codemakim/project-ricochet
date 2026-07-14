# First Balance Tuning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delay level growth while making enemies descend more slowly and reinforcement groups denser.

**Architecture:** Keep this as a data-only balance change inside existing pure rule modules. `ProgressionManager`, `EncounterDirector`, `EnemyManager`, and `CombatScene` continue consuming the same interfaces; only rule outputs and their exact tests change.

**Tech Stack:** TypeScript 5.9.3, Phaser 3.90.0, Vitest 4.1.10, Playwright 1.61.1

## Global Constraints

- Level cost is exactly `12 + level * 5`, producing `12, 17, 22, 27, 32...`.
- Initial and reinforcement enemies descend at exactly `18px/s`.
- Reinforcement sizes are exactly `8`, `10`, and `12` for phases 0, 1, and 2.
- Active caps are exactly `28`, `34`, and `40` for phases 0, 1, and 2.
- Spawn intervals stay `8_000`, `7_000`, and `6_000ms`.
- Initial formation count, enemy HP, enemy XP, shooter/bullet caps, controls, and ability values stay unchanged.
- No enemy-level system, boss, dependency, or new runtime abstraction is added.

---

### Task 1: Apply the approved progression and density values

**Files:**
- Modify: `src/game/progression/progressionRules.test.ts`
- Modify: `src/game/progression/progressionRules.ts`
- Modify: `src/game/enemies/enemyRules.test.ts`
- Modify: `src/game/enemies/enemyRules.ts`
- Modify: `src/game/encounters/formationRules.test.ts`
- Modify: `src/game/encounters/formationRules.ts`
- Modify: `src/game/encounters/encounterRules.test.ts`
- Modify: `src/game/encounters/encounterRules.ts`
- Modify: `src/game/encounters/EncounterDirector.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `e2e/combat.spec.ts`
- Modify: `docs/playtests/2026-07-13-core-redesign-prototype.md`

**Interfaces:**
- Consumes: `xpRequiredForLevel(level): number`, `createPrototypeFormation(): EnemySpec[]`, `createReinforcementFormation(phase, sequence): EnemySpec[]`, `threatConfigAt(elapsedMs): ThreatConfig`.
- Produces: the same signatures with only approved numeric outputs changed.

- [ ] **Step 1: Change exact rule expectations first**

```ts
// src/game/progression/progressionRules.test.ts
expect([0, 1, 2, 3, 4].map(xpRequiredForLevel)).toEqual([12, 17, 22, 27, 32]);

// src/game/enemies/enemyRules.test.ts
expect(formation.every((enemy) => enemy.speed === 18)).toBe(true);

// src/game/encounters/formationRules.test.ts
it.each([
  [0, 8],
  [1, 10],
  [2, 12],
] as const)('creates phase %i with %i enemies', (phase, size) => {
  const formation = createReinforcementFormation(phase, 0);
  expect(formation).toHaveLength(size);
  expect(formation.every((enemy) => enemy.speed === 18)).toBe(true);
});

// src/game/encounters/encounterRules.test.ts
it.each([
  [0, { phase: 0, activeCap: 28, spawnIntervalMs: 8_000 }],
  [59_999, { phase: 0, activeCap: 28, spawnIntervalMs: 8_000 }],
  [60_000, { phase: 1, activeCap: 34, spawnIntervalMs: 7_000 }],
  [120_000, { phase: 2, activeCap: 40, spawnIntervalMs: 6_000 }],
  [180_000, { phase: 2, activeCap: 40, spawnIntervalMs: 6_000 }],
] as const)('maps %ims to its threat config', (elapsedMs, expected) => {
  expect(threatConfigAt(elapsedMs)).toEqual(expected);
});
```

Update `EncounterDirector.test.ts` phase-0 formation results from length `6` to `8`. Update its capacity fixture to use `activeEnemies: 20`, incoming `8`, and cap `28`; one additional active enemy must block the spawn.

Update fixed progression fixtures in `ProgressionManager.test.ts` and `e2e/combat.spec.ts`: first level `8` becomes `12`, level 1 with 1 overflow XP `9` becomes `13`, and two pending choices with 1 overflow XP `21` becomes `30`. Update the development snapshot fallback in `CombatScene.ts` from `xpRequired: 8` to `xpRequired: 12`.

- [ ] **Step 2: Run focused tests and prove RED**

Run:

```bash
npm test -- src/game/progression/progressionRules.test.ts src/game/enemies/enemyRules.test.ts src/game/encounters/formationRules.test.ts src/game/encounters/encounterRules.test.ts src/game/encounters/EncounterDirector.test.ts
```

Expected: FAIL on old costs `8,12,16,20,24`, speed `22`, sizes `6/8/10`, caps `22/26/30`, and phase-0 director length `6`.

- [ ] **Step 3: Change the pure rule outputs**

```ts
// src/game/progression/progressionRules.ts
return 12 + level * 5;

// src/game/enemies/enemyRules.ts
speed: 18,

// src/game/encounters/encounterRules.ts
if (elapsedMs >= 120_000) return { phase: 2, activeCap: 40, spawnIntervalMs: 6_000 };
if (elapsedMs >= 60_000) return { phase: 1, activeCap: 34, spawnIntervalMs: 7_000 };
return { phase: 0, activeCap: 28, spawnIntervalMs: 8_000 };
```

In `formationRules.ts`, set `PHASE_SIZES` to `[8, 10, 12]`, `SPEED` to `18`, and use these exact entries:

```ts
const TEMPLATES: Readonly<Record<ThreatPhase, readonly Entry[]>> = {
  0: [
    [0, 0, 'basic'], [0, 2, 'armored'], [0, 4, 'basic'], [0, 6, 'basic'],
    [1, 1, 'basic'], [1, 3, 'basic'], [1, 5, 'basic'], [1, 7, 'basic'],
  ],
  1: [
    [0, 0, 'basic'], [0, 2, 'armored'], [0, 4, 'basic'], [0, 6, 'shooter'], [0, 7, 'basic'],
    [1, 0, 'basic'], [1, 1, 'basic'], [1, 3, 'armored'], [1, 5, 'basic'], [1, 7, 'basic'],
  ],
  2: [
    [0, 0, 'basic'], [0, 1, 'armored'], [0, 3, 'basic'], [0, 5, 'shooter'], [0, 6, 'basic'], [0, 7, 'basic'],
    [1, 0, 'basic'], [1, 2, 'shooter'], [1, 3, 'basic'], [1, 4, 'basic'], [1, 6, 'armored'], [1, 7, 'basic'],
  ],
};
```

- [ ] **Step 4: Run focused and full verification**

Run:

```bash
npm test -- src/game/progression/progressionRules.test.ts src/game/enemies/enemyRules.test.ts src/game/encounters/formationRules.test.ts src/game/encounters/encounterRules.test.ts src/game/encounters/EncounterDirector.test.ts
npm test
npm run test:e2e
npm run build
git diff --check
```

Expected: focused tests PASS; all unit and desktop/mobile E2E tests PASS; production build exits 0; diff check prints nothing. Existing Vite chunk-size warning may remain.

- [ ] **Step 5: Record the tuning evidence**

Append a dated section to `docs/playtests/2026-07-13-core-redesign-prototype.md` containing the four approved changes, fresh automated command results, and these manual items still pending: first-level time, visible density, 1–3 minute pressure, and explosion/split clear feel.

- [ ] **Step 6: Commit**

```bash
git add src/game/progression src/game/enemies src/game/encounters src/game/scenes/CombatScene.ts e2e/combat.spec.ts docs/playtests/2026-07-13-core-redesign-prototype.md docs/superpowers/plans/2026-07-14-first-balance-tuning.md
git commit -m "balance: slow growth and increase enemy density"
```
