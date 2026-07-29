# Meta Core Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap the three-boss combat in a persistent deploy, result, parts, core-unlock, and redeploy loop.

**Architecture:** Keep serializable progress and settlement in pure TypeScript. Use one versioned localStorage adapter and a small DOM controller around the existing Phaser game; pass run configuration into `CombatScene` and emit one terminal `RunResult`.

**Tech Stack:** TypeScript 5.9, DOM, localStorage, Phaser 3.90, Vitest 4.1, Playwright 1.61.

## Global Constraints

- First valid run pays at least 40 parts.
- Echo core starts unlocked; other core prices are `40 / 100 / 160`.
- Start loadout contains exactly three unlocked cores and permits duplicates.
- A `runId` settles once.
- Corrupt save data is backed up before default recovery.
- No router, state library, database, ads, store, records, research, or placeholder tabs.

---

### Task 1: Meta data, settlement, and purchases

**Files:**
- Create: `src/game/meta/metaTuning.ts`
- Create: `src/game/meta/metaProgress.ts`
- Create: `src/game/meta/metaProgress.test.ts`
- Create: `src/game/run/runContract.ts`
- Create: `src/game/run/runContract.test.ts`

**Interfaces:**
- Produces: `RunIdentity`, `RunResult`, `MetaProgress`, `Settlement`, `createDefaultMetaProgress`, `settleRun`, `purchaseCore`, and `setLoadout`.
- Consumes: `OrbCoreId`, `AbilityRanks`, and boss IDs.

- [ ] **Step 1: Write failing pure tests**

```ts
expect(settleRun(defaults, threeMinuteRun).earned).toBe(40);
expect(settleRun(settled.progress, threeMinuteRun).earned).toBe(0);
expect(purchaseCore(settled.progress, 'conduction').parts).toBe(0);
expect(setLoadout(progress, ['resonance', 'resonance', 'conduction']).loadout).toHaveLength(3);
```

Also cover short failure, boss rewards, first kills, clear reward, insufficient parts, locked loadout, and negative balance rejection.

- [ ] **Step 2: Run the focused test**

Run: `rtk npx vitest run src/game/meta/metaProgress.test.ts`

Expected: FAIL because the meta modules do not exist.

- [ ] **Step 3: Implement pure immutable rules**

```ts
export interface RunResult {
  identity: RunIdentity;
  success: boolean;
  durationMs: number;
  defeatedBossIds: string[];
  loadout: [OrbCoreId, OrbCoreId, OrbCoreId];
  buildRanks: AbilityRanks;
}

export interface MetaProgress {
  schemaVersion: 1;
  parts: number;
  unlockedCores: OrbCoreId[];
  loadout: [OrbCoreId, OrbCoreId, OrbCoreId];
  claimedRunIds: string[];
  firstBossKills: string[];
  firstValidRunClaimed: boolean;
}
```

Use `META_TUNING` as the only reward and cost source.

- [ ] **Step 4: Run focused tests**

Run: `rtk npx vitest run src/game/meta/metaProgress.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/game/meta/metaTuning.ts src/game/meta/metaProgress.ts src/game/meta/metaProgress.test.ts src/game/run/runContract.ts src/game/run/runContract.test.ts
rtk git commit -m "feat: add persistent meta rules"
```

### Task 2: Versioned local storage

**Files:**
- Create: `src/game/meta/MetaStore.ts`
- Create: `src/game/meta/MetaStore.test.ts`

**Interfaces:**
- Consumes: `MetaProgress`.
- Produces: `MetaStore.load(): MetaProgress`, `save(progress): void`, and `clear(): void`.

- [ ] **Step 1: Write failing storage tests**

Use an in-memory `Storage` fake to prove round trip, unknown-field tolerance, invalid loadout recovery, malformed JSON backup, and default creation.

- [ ] **Step 2: Run the focused test**

Run: `rtk npx vitest run src/game/meta/MetaStore.test.ts`

Expected: FAIL because `MetaStore` is missing.

- [ ] **Step 3: Implement one-key versioned storage**

Use `project-ricochet.meta` and backup key `project-ricochet.meta.corrupt.<timestamp>`. Validate trust-boundary fields before returning them.

- [ ] **Step 4: Run the focused test**

Run: `rtk npx vitest run src/game/meta/MetaStore.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/game/meta/MetaStore.ts src/game/meta/MetaStore.test.ts
rtk git commit -m "feat: persist meta progression"
```

### Task 3: Combat run contract

**Files:**
- Modify: `src/game/run/runContract.ts`
- Modify: `src/game/run/runContract.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `src/game/scenes/combatSceneRules.ts`
- Modify: `src/game/scenes/combatSceneRules.test.ts`
- Modify: `src/game/ui/RunCompleteOverlay.ts`

**Interfaces:**
- Produces: `RunConfig`, `RunResult`, `CombatScene.setRunConfig(config)`, and Phaser event `ricochet:run-ended`.
- Consumes: encounter snapshot, build ranks, boss rewards, health defeat, and selected core loadout.

- [ ] **Step 1: Write failing contract and scene-rule tests**

Prove unique run IDs, copied three-core configuration, success only after siege defeat, failure result on health defeat, and one terminal event.

- [ ] **Step 2: Run focused tests**

Run: `rtk npx vitest run src/game/run/runContract.test.ts src/game/scenes/combatSceneRules.test.ts`

Expected: FAIL because the contract and result builder are missing.

- [ ] **Step 3: Thread configuration and terminal result through CombatScene**

Replace the initial loadout overlay with supplied `RunConfig.loadout` for product runs. Keep the overlay in explicit E2E experiment mode so existing combat tests can still choose cores. Emit exactly one result before pausing the terminal scene.

- [ ] **Step 4: Run focused tests and existing combat E2E smoke**

Run: `rtk npx vitest run src/game/run/runContract.test.ts src/game/scenes/combatSceneRules.test.ts`

Run: `rtk npm run test:e2e -- --grep "moves, retains mouse aim"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/game/run/runContract.ts src/game/run/runContract.test.ts src/game/scenes/CombatScene.ts src/game/scenes/combatSceneRules.ts src/game/scenes/combatSceneRules.test.ts src/game/ui/RunCompleteOverlay.ts
rtk git commit -m "feat: expose combat run results"
```

### Task 4: Deploy, result, and core workshop UI

**Files:**
- Create: `src/game/meta/AppController.ts`
- Create: `src/game/meta/AppController.test.ts`
- Modify: `src/main.ts`
- Modify: `src/styles.css`
- Modify: `index.html`

**Interfaces:**
- Consumes: `MetaStore`, pure meta rules, `RunConfig`, and `ricochet:run-ended`.
- Produces: deploy screen, result overlay, core workshop, and Phaser lifecycle.

- [ ] **Step 1: Write failing DOM-controller tests**

Assert initial deploy copy, three loadout selectors, locked-core rejection, start callback, result breakdown, first core purchase, and return to deploy.

- [ ] **Step 2: Run the focused test**

Run: `rtk npx vitest run src/game/meta/AppController.test.ts`

Expected: FAIL because the controller is missing.

- [ ] **Step 3: Implement the smallest DOM controller**

Keep one `#app-root` with menu and `#game-root`. Create Phaser only on deploy, destroy it after result capture, save settlement before rendering results, and use native buttons/selects.

- [ ] **Step 4: Run unit tests and build**

Run: `rtk npm test`

Run: `rtk npm run build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/game/meta/AppController.ts src/game/meta/AppController.test.ts src/main.ts src/styles.css index.html
rtk git commit -m "feat: add deploy and workshop loop"
```

### Task 5: Persistent full-cycle verification

**Files:**
- Create: `e2e/meta-loop.spec.ts`
- Modify: `playwright.config.ts` only if project matching needs the new file.

**Interfaces:**
- Consumes: complete three-boss run and browser localStorage.
- Produces: desktop and mobile end-to-end evidence.

- [ ] **Step 1: Add full-cycle browser tests**

Use debug combat controls to reach results without real-time waiting. Assert deploy → three bosses → result → 40+ parts → core purchase → mixed three-core loadout → redeploy → reload persistence. Add a failure-run settlement case and duplicate result event case.

- [ ] **Step 2: Run all unit tests and production build**

Run: `rtk npm test`

Run: `rtk npm run build`

Expected: PASS.

- [ ] **Step 3: Run the complete browser suite once**

Run: `rtk npm run test:e2e`

Expected: all desktop and mobile projects PASS.

- [ ] **Step 4: Inspect and commit**

Run: `rtk git diff --check`

Run: `rtk git status --short`

```bash
rtk git add e2e/meta-loop.spec.ts playwright.config.ts
rtk git commit -m "test: verify persistent three-boss loop"
```
