# Enemy Descent Tuning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Slow the prototype enemy formation from 26px/s to 22px/s without changing any other combat pressure value.

**Architecture:** Keep descent speed owned by the fixed formation specs in `enemyRules.ts`. `EnemyManager` continues consuming each `EnemySpec.speed` unchanged, so no new setting, branch, or runtime system is needed.

**Tech Stack:** TypeScript 5.9.3, Phaser 3.90.0, Vitest 4.1.10, Playwright 1.61.1

## Global Constraints

- Every prototype enemy descends at exactly `22px/s`.
- The 20-enemy formation, HP, shooter count, 1300ms firing cadence, 350ms warning, and 180px/s bullet speed remain unchanged.
- Player, orb, recovery, reflection, and experiment settings remain unchanged.
- No difficulty curve, settings UI, or per-enemy descent speed is added.

---

### Task 1: Tune Fixed Formation Descent

**Files:**
- Modify: `src/game/enemies/enemyRules.test.ts`
- Modify: `src/game/enemies/EnemyManager.test.ts`
- Modify: `src/game/enemies/enemyRules.ts`

**Interfaces:**
- Consumes: `createPrototypeFormation(): EnemySpec[]` and `EnemySpec.speed`.
- Produces: the same interfaces with every generated `speed` equal to `22`.

- [ ] **Step 1: Change only the two speed expectations**

```ts
// src/game/enemies/enemyRules.test.ts
expect(formation.every((enemy) => enemy.speed === 22)).toBe(true);

// src/game/enemies/EnemyManager.test.ts
expect(groups[0]!.children.every((enemy) => enemy.body.velocity.y === 22)).toBe(true);
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/game/enemies/enemyRules.test.ts src/game/enemies/EnemyManager.test.ts`

Expected: FAIL in the two descent-speed assertions because production still emits `26`.

- [ ] **Step 3: Change the formation speed**

```ts
// src/game/enemies/enemyRules.ts
return {
  id,
  kind,
  column,
  x: xPositions[column]!,
  y,
  hp: kind === 'armored' ? 3 : 1,
  speed: 22,
};
```

- [ ] **Step 4: Verify focused and full behavior**

Run: `npm test -- src/game/enemies/enemyRules.test.ts src/game/enemies/EnemyManager.test.ts`

Expected: both files PASS.

Run: `npm test && npm run test:e2e && npm run build && git diff --check`

Expected: 74 unit tests PASS, 8 Playwright tests PASS, production build exits 0, and no whitespace errors.

- [ ] **Step 5: Commit**

```bash
git add src/game/enemies/enemyRules.ts src/game/enemies/enemyRules.test.ts src/game/enemies/EnemyManager.test.ts
git commit -m "balance: slow enemy descent"
```
