# Orb Discovery Codex Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Persist basic-orb and fusion discovery at run settlement, mask undiscovered rewards, and expose discovered entries and basic-core purchases in the existing workshop.

**Architecture:** Extend the existing run contract and schema-versioned `MetaStore`; do not add a second persistence path. `CombatScene` owns two run-local discovery sets, passes their current state into existing overlays, and returns them through `RunResult`. The existing workshop renders discovery and unlock state from `MetaProgress`.

**Tech Stack:** TypeScript 5.9, Phaser 3.90, DOM templates, localStorage, Vitest 4.1, Playwright 1.61

## Global Constraints

- Discovery persists only through normal victory or defeat settlement; refresh and forced termination do not save it.
- Default permanent discovery is `echo`; schema 1 and 2 saves migrate every unlocked core as discovered and start with no discovered fusions.
- Undiscovered basic cores cannot be purchased; fusion discovery never costs currency.
- Discovery changes display and purchase eligibility only. It does not change reward odds, combat behavior, or tuning.
- Only the three implemented fusions appear in the workshop.
- Reuse the existing `RunResult → settleRun() → MetaStore` path and existing workshop screen.
- Do not add a codex scene, generic registry, framework, dependency, real art, sound, or remaining fusion IDs.
- All repository shell commands begin with `rtk`.

---

### Task 1: Discovery identity, role hints, and run contract

**Files:**
- Modify: `src/game/orbs/orbCoreRules.ts`
- Modify: `src/game/orbs/orbFusionRules.ts`
- Modify: `src/game/run/runContract.ts`
- Modify: `src/game/run/runContract.test.ts`

**Interfaces:**
- Produces: `RunConfig.discoveredCoreTypes: OrbCoreId[]` and `RunConfig.discoveredFusionTypes: FusionOrbId[]`.
- Produces: matching final fields on `RunResult`.
- Produces: `roleHint: string` on every `ORB_CORE_DEFINITIONS` and `ORB_FUSION_DEFINITIONS` entry.
- Produces signature:

```ts
createRunConfig(
  loadout,
  seed?,
  runId?,
  unlockedCoreTypes?,
  discoveredCoreTypes?,
  discoveredFusionTypes?,
): RunConfig
```

- Produces signature:

```ts
createRunResult(
  config,
  success,
  durationMs,
  defeatedBossIds,
  buildRanks,
  discoveredCoreTypes?,
  discoveredFusionTypes?,
): RunResult
```

- [x] **Step 1: Write failing run-contract tests**

Add cases that copy and validate discovery arrays:

```ts
const config = createRunConfig(
  ['echo'], 7, 'run-1', ['echo'],
  ['echo', 'conduction'], ['photon-orbit'],
);
expect(config.discoveredCoreTypes).toEqual(['echo', 'conduction']);
expect(config.discoveredFusionTypes).toEqual(['photon-orbit']);

const result = createRunResult(
  config, false, 10, [], createEmptyAbilityRanks(),
  ['echo', 'conduction', 'split'],
  ['photon-orbit', 'resonant-swarm'],
);
expect(result.discoveredCoreTypes).toEqual(['echo', 'conduction', 'split']);
expect(result.discoveredFusionTypes).toEqual(['photon-orbit', 'resonant-swarm']);
expect(result.discoveredCoreTypes).not.toBe(config.discoveredCoreTypes);
```

Also reject an unknown core, unknown fusion, and an unlocked core missing from permanent discovery:

```ts
expect(() => createRunConfig(
  ['echo'], 1, 'bad-core', ['echo'], ['echo', 'bad' as never], [],
)).toThrow('discovered core list contains an unknown core');
expect(() => createRunConfig(
  ['echo'], 1, 'bad-fusion', ['echo'], ['echo'], ['bad' as never],
)).toThrow('discovered fusion list contains an unknown fusion');
expect(() => createRunConfig(
  ['echo'], 1, 'missing', ['echo', 'inertia'], ['echo'], [],
)).toThrow('unlocked cores must be discovered');
```

- [x] **Step 2: Run the focused test and confirm failure**

Run: `rtk npm test -- src/game/run/runContract.test.ts`

Expected: TypeScript or assertion failures because discovery fields and arguments do not exist.

- [x] **Step 3: Add role hints and minimal contract validation**

Use these exact role hints:

```ts
// Basic cores
echo: '반사 축적형'
corrosion: '지속 영역형'
conduction: '연쇄 전도형'
inertia: '고속 직격형'
split: '분열 생성형'
explosion: '확률 폭발형'

// Implemented fusions
'photon-orbit': '관통 궤적형'
'resonant-swarm': '군체 연쇄형'
'nano-proliferator': '지역 증식형'
```

Default `discoveredCoreTypes` to `unlockedCoreTypes` and `discoveredFusionTypes` to `[]`. Validate with `ORB_CORE_IDS` and `FUSION_ORB_IDS`, require every unlocked core to be discovered, and clone all arrays. Default final discoveries in `createRunResult()` to the config lists.

- [x] **Step 4: Run the focused test green**

Run: `rtk npm test -- src/game/run/runContract.test.ts`

Expected: all run-contract tests pass.

- [x] **Step 5: Commit**

```bash
rtk git add src/game/orbs/orbCoreRules.ts src/game/orbs/orbFusionRules.ts src/game/run/runContract.ts src/game/run/runContract.test.ts
rtk git commit -m "feat: add orb discovery run contract"
```

### Task 2: Schema 3 persistence, settlement, and purchase gate

**Files:**
- Modify: `src/game/meta/metaProgress.ts`
- Modify: `src/game/meta/metaProgress.test.ts`
- Modify: `src/game/meta/MetaStore.ts`
- Modify: `src/game/meta/MetaStore.test.ts`

**Interfaces:**
- Consumes: discovery arrays on `RunResult` from Task 1.
- Produces: `MetaProgress.schemaVersion: 3`, `discoveredCores`, and `discoveredFusions`.
- Produces: settlement union through existing `settleRun()`.
- Changes: `purchaseCore()` rejects a core absent from `progress.discoveredCores` with `core must be discovered before unlock`.

- [x] **Step 1: Write failing meta-domain tests**

Update default expectations and add settlement coverage:

```ts
expect(createDefaultMetaProgress()).toMatchObject({
  schemaVersion: 3,
  discoveredCores: ['echo'],
  discoveredFusions: [],
});

const discovered = createRunResult(
  createRunConfig(['echo'], 1, 'discover-1'),
  false, 10_000, [], createEmptyAbilityRanks(),
  ['echo', 'conduction'], ['photon-orbit'],
);
const settled = settleRun(createDefaultMetaProgress(), discovered);
expect(settled.progress.discoveredCores).toEqual(['echo', 'conduction']);
expect(settled.progress.discoveredFusions).toEqual(['photon-orbit']);
expect(settleRun(settled.progress, discovered).progress).toEqual(settled.progress);
```

Victory must use the same settlement path:

```ts
const victory = createRunResult(
  createRunConfig(['echo'], 1, 'discover-win'),
  true,
  180_000,
  ['sentinel', 'hive', 'siege'],
  createEmptyAbilityRanks(),
  ['echo', 'split'],
  ['nano-proliferator'],
);
expect(settleRun(createDefaultMetaProgress(), victory).progress).toMatchObject({
  discoveredCores: ['echo', 'split'],
  discoveredFusions: ['nano-proliferator'],
});
```

Purchase tests must use a discovered core and explicitly reject an undiscovered one:

```ts
const progress = { ...createDefaultMetaProgress(), parts: 40 };
expect(() => purchaseCore(progress, 'conduction'))
  .toThrow('core must be discovered before unlock');
expect(purchaseCore({
  ...progress,
  discoveredCores: ['echo', 'conduction'],
}, 'conduction').unlockedCores).toContain('conduction');
```

- [x] **Step 2: Write failing migration and corruption tests**

Change the schema 1 expected result to schema 3 with `discoveredCores` equal to its unlocked cores and no fusions. Add the same assertion for a schema 2 fixture. Add invalid schema 3 fixtures containing unknown basic and fusion IDs and expect recovery to `createDefaultMetaProgress()`.

- [x] **Step 3: Run focused tests and confirm failure**

Run: `rtk npm test -- src/game/meta/metaProgress.test.ts src/game/meta/MetaStore.test.ts`

Expected: failures for schema 3 and missing discovery behavior.

- [x] **Step 4: Implement schema 3 and settlement union**

Use insertion-order unique arrays:

```ts
function union<T>(left: readonly T[], right: readonly T[]): T[] {
  return [...new Set([...left, ...right])];
}
```

`createDefaultMetaProgress()` returns `discoveredCores: ['echo']` and `discoveredFusions: []`. `settleRun()` appends discoveries only after the duplicate `runId` guard. `copy()` clones both lists. `purchaseCore()` checks discovery before price.

In `MetaStore.parseProgress()`:

```ts
const discoveredCores = value.schemaVersion === 3
  ? coreArray(value.discoveredCores)
  : unlockedCores;
const discoveredFusions = value.schemaVersion === 3
  ? fusionArray(value.discoveredFusions)
  : [];
if (unlockedCores.some((core) => !discoveredCores.includes(core))) {
  throw new Error('unlocked core is not discovered');
}
```

Accept schema versions 1, 2, and 3; save migrated values whenever the loaded version is not 3. `fusionArray()` validates through `FUSION_ORB_IDS`.

- [x] **Step 5: Run focused tests green**

Run: `rtk npm test -- src/game/meta/metaProgress.test.ts src/game/meta/MetaStore.test.ts`

Expected: all meta tests pass.

- [x] **Step 6: Commit**

```bash
rtk git add src/game/meta/metaProgress.ts src/game/meta/metaProgress.test.ts src/game/meta/MetaStore.ts src/game/meta/MetaStore.test.ts
rtk git commit -m "feat: persist orb discoveries"
```

### Task 3: Mask undiscovered reward and fusion UI

**Files:**
- Modify: `src/game/ui/LevelUpOverlay.ts`
- Modify: `src/game/ui/LevelUpOverlay.test.ts`
- Modify: `src/game/ui/OrbFusionOverlay.ts`
- Modify: `src/game/ui/OrbFusionOverlay.test.ts`

**Interfaces:**
- Consumes: `roleHint` from Task 1.
- Changes `LevelUpOverlay.show()` to accept two optional final arguments, defaulting to all IDs discovered so existing isolated callers remain unchanged:

```ts
show(
  choices,
  build,
  orbs,
  onSelect,
  discoveredCoreTypes = ORB_CORE_IDS,
  discoveredFusionTypes = FUSION_ORB_IDS,
): void
```

- Changes `OrbFusionOverlay.show()` to accept final `discovered = true`.

- [x] **Step 1: Write failing level-up masking tests**

Render an undiscovered basic add and fusion card:

```ts
overlay.show(
  [
    { kind: 'orb-add', coreType: 'conduction' },
    { kind: 'orb-fusion', fusionType: 'photon-orbit' },
  ],
  new BuildState(),
  [],
  vi.fn(),
  ['echo'],
  [],
);
const text = objects.flatMap(({ text }) => text ?? []).join(' ');
expect(text).toContain('1. ??? Lv1');
expect(text).toContain('2. ??? 융합');
expect(text).not.toContain('전도 구슬');
expect(text).not.toContain('광자 궤도');
```

Focus each card and assert its detail shows only `연쇄 전도형` or the fusion material labels plus `관통 궤적형`, never the hidden result summary.

- [x] **Step 2: Write failing fusion-picker masking test**

```ts
overlay.show(
  'photon-orbit',
  [orb(0, 'inertia', 4), orb(1, 'conduction', 2)],
  vi.fn(),
  vi.fn(),
  false,
);
const text = objects.map(({ text }) => text ?? '').join(' ');
expect(text).toContain('??? 재료 선택');
expect(text).toContain('→ ??? Lv5');
expect(text).not.toContain('광자 궤도');
```

- [x] **Step 3: Run UI tests and confirm failure**

Run: `rtk npm test -- src/game/ui/LevelUpOverlay.test.ts src/game/ui/OrbFusionOverlay.test.ts`

Expected: missing arguments or exposed labels make the new assertions fail.

- [x] **Step 4: Implement display-only masking**

Keep the original choice object and callbacks unchanged. Only card labels and details branch on discovery arrays. Basic upgrade cards are already owned and therefore use the actual label. Fusion material labels remain visible; the result label and summary remain hidden until discovered.

- [x] **Step 5: Run UI tests green**

Run: `rtk npm test -- src/game/ui/LevelUpOverlay.test.ts src/game/ui/OrbFusionOverlay.test.ts`

Expected: all overlay tests pass.

- [x] **Step 6: Commit**

```bash
rtk git add src/game/ui/LevelUpOverlay.ts src/game/ui/LevelUpOverlay.test.ts src/game/ui/OrbFusionOverlay.ts src/game/ui/OrbFusionOverlay.test.ts
rtk git commit -m "feat: mask undiscovered orb rewards"
```

### Task 4: Wire run-local discovery and extend the workshop

**Files:**
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `src/game/meta/AppController.ts`
- Modify: `src/game/scenes/combatSceneRules.test.ts`
- Modify: `src/game/scenes/combatSceneRules.ts`

**Interfaces:**
- Consumes: run discovery fields, overlay parameters, and schema 3 fields from Tasks 1–3.
- Produces debug snapshot fields `discoveredCoreTypes` and `discoveredFusionTypes` for integration verification.
- Produces pure helper in `combatSceneRules.ts`:

```ts
export function recordDiscovery<T extends string>(
  current: ReadonlySet<T>,
  value: T,
): Set<T>
```

- [x] **Step 1: Write failing immutable discovery helper test**

```ts
const current = new Set(['echo']);
const next = recordDiscovery(current, 'conduction');
expect([...next]).toEqual(['echo', 'conduction']);
expect([...current]).toEqual(['echo']);
expect(recordDiscovery(next, 'conduction')).toEqual(next);
```

- [x] **Step 2: Run the rule test and confirm failure**

Run: `rtk npm test -- src/game/scenes/combatSceneRules.test.ts`

Expected: `recordDiscovery` is not exported.

- [x] **Step 3: Implement the helper and scene-local sets**

Initialize production runs from `runConfig.discoveredCoreTypes` and `runConfig.discoveredFusionTypes`. For direct development combat without a run config, initialize all current basic and fusion IDs as discovered to preserve existing prototype behavior.

Record only after a reward transaction succeeds:

```ts
// orb-add after addOrb() and consume()
this.discoveredCoreTypes = recordDiscovery(
  this.discoveredCoreTypes,
  choice.coreType,
);

// orb-fusion after fuseOrbs() and consume()
this.discoveredFusionTypes = recordDiscovery(
  this.discoveredFusionTypes,
  choice.fusionType,
);
```

Pass current arrays to `LevelUpOverlay.show()`. Pass the pre-confirmation fusion discovery boolean to `OrbFusionOverlay.show()`. Pass final arrays into `createRunResult()` for both victory and defeat. Clone them in `setRunConfig()` and clear them on a fresh `create()`.

- [x] **Step 4: Extend the existing workshop template**

`AppController.deploy()` passes `progress.discoveredCores` and `progress.discoveredFusions` to `createRunConfig()`.

In `renderWorkshop()` render two headings and preserve the existing buy handler:

```html
<h2>기본 구슬</h2>
<!-- ORB_CORE_IDS entries -->
<h2>융합 기록</h2>
<!-- FUSION_ORB_IDS entries -->
```

Basic entry rules:

- undiscovered: `<strong>???</strong><span>{roleHint} · 미발견</span>` and no `data-buy-core`
- discovered locked: real label, summary, and current price button
- unlocked: real label, summary, and `해금됨`

Fusion entry rules:

- undiscovered: `???`, material labels, role hint, `미발견`
- discovered: real label, summary, and material labels

- [x] **Step 5: Run focused unit tests and build**

Run: `rtk npm test -- src/game/scenes/combatSceneRules.test.ts src/game/run/runContract.test.ts src/game/meta/metaProgress.test.ts src/game/ui/LevelUpOverlay.test.ts src/game/ui/OrbFusionOverlay.test.ts`

Run: `rtk npm run build`

Expected: all focused tests pass and TypeScript/Vite build succeeds.

- [x] **Step 6: Commit**

```bash
rtk git add src/game/scenes/CombatScene.ts src/game/scenes/combatSceneRules.ts src/game/scenes/combatSceneRules.test.ts src/game/meta/AppController.ts
rtk git commit -m "feat: connect orb discovery to combat and workshop"
```

### Task 5: Integrated persistence proof, worklog, and delivery

**Files:**
- Modify: `e2e/meta-loop.spec.ts`
- Modify: `docs/WORKLOG.md`

**Interfaces:**
- Consumes: debug discovery snapshot fields and workshop markup from Task 4.
- Updates all handwritten E2E `RunResult` fixtures with discovery arrays.

- [x] **Step 1: Add one production-run masking/reveal check**

Extend `combatSnapshot()` with `levelUpVisible`, `progression.choices`, `discoveredCoreTypes`, and `discoveredFusionTypes`. In the existing AppController settlement test, deploy with the default `echo` discovery, call `debugGrantXp(8)`, and inspect active scene text:

```ts
await page.evaluate(() => {
  const game = window.__RICHOCHET_GAME__!;
  game.scene.getScene('combat').debugGrantXp(8);
});
await expect.poll(async () => (await combatSnapshot(page)).levelUpVisible).toBe(true);
await expect.poll(() => page.evaluate(() => (
  window.__RICHOCHET_GAME__!.scene.getScene('combat').children.list
    .some((child) => child.active && child.text?.includes('??? Lv1'))
))).toBe(true);
await page.keyboard.press('Digit1');
await page.keyboard.press('Enter');
await expect.poll(async () => (await combatSnapshot(page)).discoveredCoreTypes.length).toBe(2);
```

Read the acquired core type from the chosen reward/snapshot and use that exact type in the terminal result and workshop assertions. Keep existing mobile input tests unchanged.

- [x] **Step 2: Extend the meta-loop settlement test**

The manual terminal result must include the acquired basic type and:

```ts
discoveredCoreTypes: ['echo', acquiredCoreType],
discoveredFusionTypes: ['photon-orbit'],
```

After settlement and `계속`, assert:

```ts
await page.getByRole('button', { name: '코어 작업장' }).click();
await expect(page.getByText(ORB_CORE_DEFINITIONS[acquiredCoreType].label)).toBeVisible();
await expect(page.locator(`[data-buy-core="${acquiredCoreType}"]`)).toBeEnabled();
await expect(page.getByText('광자 궤도')).toBeVisible();
await expect(page.getByText('공명 군체')).toHaveCount(0);
```

Purchase the acquired core, redeploy, reload, and retain the existing persistence assertion. Update schema migration E2E to expect version 3 and discovery fields.

- [x] **Step 3: Run only the new/changed browser paths**

Run: `rtk npm run test:e2e -- --grep "discovery|settles, unlocks|migrates"`

Expected: all matched desktop tests pass.

- [x] **Step 4: Update worklog**

Add a `2026-08-03 — 구슬 발견·도감 기반` entry documenting schema 3, run-end persistence, reward masking, discovery-gated core purchase, fusion records, verification counts, and deferred remaining six fusions/balance/art/sound.

- [x] **Step 5: Run final verification**

Run: `rtk npm test`

Run: `rtk npm run build`

Run: `rtk npm run test:e2e`

Expected: zero failures. The existing Vite chunk-size warning may remain.

- [x] **Step 6: Review and commit**

Run: `rtk git diff --check`

```bash
rtk git add e2e/meta-loop.spec.ts docs/WORKLOG.md
rtk git commit -m "test: verify orb discovery loop"
```

- [x] **Step 7: Merge, push, and clean up after user-approved integration**

Expected feature branch: `codex/orb-discovery-codex`.
