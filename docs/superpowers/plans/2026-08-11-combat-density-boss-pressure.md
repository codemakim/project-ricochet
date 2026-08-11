# Combat Density And Boss Pressure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the tense opening, then raise stage 1–2 enemy pressure, make the first boss easier to engage, and make the exposed Hive core move and attack aggressively.

**Architecture:** Keep encounter balance in `stageDefinitions.ts`, shared enemy/boss tuning in `gameTuning.ts`, and reuse the existing formation, boss movement, attack-pattern, enemy snapshot, and Phaser feedback paths. Add only one phase field (`reinforcementReleaseY`) and one Hive-only movement branch. Stage 3, orb rewards, enemy descent speed, formation shapes, and attack types do not change.

**Tech Stack:** TypeScript 5.9, Phaser 3.90, Vitest 4.1, Playwright 1.61

## Global Constraints

- Initial stage formations remain unchanged.
- `GAME_TUNING.enemies.descentSpeed` remains `8`.
- Stage 3 power bands, phase caps, intervals, release lines, and shooter composition remain unchanged.
- Adjustable stage/phase values live only in `src/game/encounters/stageDefinitions.ts`.
- Shared enemy and boss values live only in `src/game/config/gameTuning.ts`.
- No new enemy kinds, boss attack patterns, rewards, assets, sound, or dynamic difficulty.
- Do not introduce a second movement engine; extend `updateBossMotion()` with an optional speed argument.
- Browser automation runs once after the integrated slice, not after each task.

---

### Task 1: Raise stage 1–2 reinforcement pressure

**Files:**
- Modify: `src/game/encounters/stageDefinitions.ts`
- Modify: `src/game/encounters/stageDefinitions.test.ts`
- Modify: `src/game/encounters/EncounterDirector.ts`
- Modify: `src/game/encounters/EncounterDirector.test.ts`
- Modify: `src/game/config/gameTuning.ts`
- Modify: `src/game/config/gameTuning.test.ts`
- Modify: `docs/TUNING.md`

**Interface:**

```ts
export interface StagePhaseDefinition {
  startsAtMs: number;
  activeCap: number;
  spawnIntervalMs: number;
  reinforcementReleaseY: number;
  formationProfileId: string;
  // existing optional formation controls remain unchanged
}
```

- [ ] **Step 1: Write failing stage-table tests**

Replace old exact-value assertions with the approved values:

```ts
expect(STAGES.map(({ powerBand }) => [
  powerBand.normalHpMultiplier,
  powerBand.eliteHpMultiplier,
])).toEqual([
  [1.3, 1.5],
  [1.9, 2.2],
  [2.4, 2.8],
]);

expect(STAGES.map(({ phases }) => phases.map((phase) => ({
  activeCap: phase.activeCap,
  spawnIntervalMs: phase.spawnIntervalMs,
  reinforcementReleaseY: phase.reinforcementReleaseY,
  shooterWeight: phase.enemyWeightMultipliers?.shooter,
  shooterMaximum: phase.maxPerFormationOverrides?.shooter,
})))).toEqual([
  [
    { activeCap: 28, spawnIntervalMs: 8_000, reinforcementReleaseY: 50, shooterWeight: 1, shooterMaximum: 1 },
    { activeCap: 40, spawnIntervalMs: 5_500, reinforcementReleaseY: 0, shooterWeight: 3, shooterMaximum: 2 },
    { activeCap: 48, spawnIntervalMs: 5_000, reinforcementReleaseY: 0, shooterWeight: 4, shooterMaximum: 3 },
  ],
  [
    { activeCap: 48, spawnIntervalMs: 5_000, reinforcementReleaseY: 0, shooterWeight: 4, shooterMaximum: 3 },
    { activeCap: 56, spawnIntervalMs: 4_500, reinforcementReleaseY: 0, shooterWeight: 5, shooterMaximum: 4 },
  ],
  [
    { activeCap: 44, spawnIntervalMs: 5_500, reinforcementReleaseY: 50, shooterWeight: 3, shooterMaximum: 3 },
    { activeCap: 48, spawnIntervalMs: 5_000, reinforcementReleaseY: 50, shooterWeight: 4, shooterMaximum: 4 },
    { activeCap: 52, spawnIntervalMs: 4_500, reinforcementReleaseY: 50, shooterWeight: 5, shooterMaximum: 5 },
  ],
]);
```

Add one invalid-content case:

```ts
const invalid = structuredClone(STAGES);
invalid[0]!.phases[0]!.reinforcementReleaseY = Number.NaN;
expect(() => validateStageContent(invalid)).toThrow(
  'default-1.reinforcementReleaseY must be finite and non-negative',
);
```

- [ ] **Step 2: Write a failing director test for phase-specific release lines**

Use one director instance and a fixed topmost enemy at `25`:

```ts
const director = new EncounterDirector(7);

expect(director.update(8_000, {
  activePopulation: 0,
  topmostEnemyY: 25,
}).formation).toBeNull();

const pressure = director.update(52_000, {
  activePopulation: 0,
  topmostEnemyY: 25,
});
expect(director.getSnapshot().phase).toBe(1);
expect(pressure.formation).not.toBeNull();
```

Update existing gate tests to derive their boundary from `STAGES[0]!.phases[0]!.reinforcementReleaseY` rather than a global tuning value.

- [ ] **Step 3: Run focused tests red**

Run:

```bash
rtk npm test -- src/game/encounters/stageDefinitions.test.ts src/game/encounters/EncounterDirector.test.ts src/game/config/gameTuning.test.ts
```

Expected: the phase field and new table values are absent; the director still reads the global release line.

- [ ] **Step 4: Move the release line into phase data and apply the approved table**

Change the phase helper signature once:

```ts
const phase = (
  startsAtMs: number,
  activeCap: number,
  spawnIntervalMs: number,
  reinforcementReleaseY: number,
  formationProfileId: string,
  enemyWeightMultipliers: Readonly<Partial<Record<EnemyKind, number>>>,
  maxPerFormationOverrides: Readonly<Partial<Record<EnemyKind, number>>>,
): StagePhaseDefinition => ({
  startsAtMs,
  activeCap,
  spawnIntervalMs,
  reinforcementReleaseY,
  formationProfileId,
  enemyWeightMultipliers,
  maxPerFormationOverrides,
});
```

Use the exact table from Step 1. Do not change `FORMATION_PROFILES`, templates, grid sizes, row ranges, or `descentSpeedMultiplier`.

In `validateStageContent()` add:

```ts
finiteNonNegative(
  stagePhase.reinforcementReleaseY,
  `${stage.id}.reinforcementReleaseY`,
);
```

In `EncounterDirector.update()` replace both reads of `GAME_TUNING.encounter.reinforcementReleaseY` with `phase.definition.reinforcementReleaseY`. Remove the now-unused `GAME_TUNING` import.

Delete `encounter.reinforcementReleaseY` from the `GameTuning` interface, data, validation, and its unit tests. Remove `PLAYER_MIN_Y` from the config import if unused afterward.

- [ ] **Step 5: Document the two balance sources**

Update `docs/TUNING.md`:

- stage HP, phase caps, intervals, release lines, and shooter weights/caps → `stageDefinitions.ts`
- common descent speed and base HP → `gameTuning.ts`
- note that the initial formation has its own recipe and is intentionally unaffected

- [ ] **Step 6: Run focused tests green and commit**

Run:

```bash
rtk npm test -- src/game/encounters/stageDefinitions.test.ts src/game/encounters/EncounterDirector.test.ts src/game/config/gameTuning.test.ts
rtk npm run build
```

Commit:

```bash
rtk git add src/game/encounters/stageDefinitions.ts src/game/encounters/stageDefinitions.test.ts src/game/encounters/EncounterDirector.ts src/game/encounters/EncounterDirector.test.ts src/game/config/gameTuning.ts src/game/config/gameTuning.test.ts docs/TUNING.md
rtk git commit -m "balance: raise early combat pressure"
```

---

### Task 2: Enlarge first-boss weakpoints without changing its health or speed

**Files:**
- Modify: `src/game/config/gameTuning.ts`
- Modify: `src/game/config/gameTuning.test.ts`
- Modify: `src/game/bosses/BossManager.test.ts`

**Derived geometry:**

```text
weakpointOffsetX = (176 + 30) / 2 - 12 = 91
left center at boss x 225 = 134
right center at boss x 225 = 316
collisionHalfWidth = 91 + 38 / 2 = 110
movement bounds = 110..340
```

- [ ] **Step 1: Write failing tuning and geometry assertions**

```ts
expect(GAME_TUNING.boss.weakpoint).toEqual({
  visual: { width: 30, height: 64 },
  hitbox: { width: 38, height: 72 },
  edgeOverlap: 12,
  hp: 14,
});
```

In `BossManager.test.ts`, update explicit body assertions to `38 × 72`, weakpoint centers to `134` and `316`, and movement-limit assertions to reject x positions outside `110..340`. Retain assertions for boss body size `176 × 96`, HP `14`, and speed `35`.

- [ ] **Step 2: Run focused tests red**

Run:

```bash
rtk npm test -- src/game/config/gameTuning.test.ts src/game/bosses/bossGeometry.test.ts src/game/bosses/BossManager.test.ts
```

Expected: old weakpoint visual, hitbox, overlap, centers, and derived bounds fail.

- [ ] **Step 3: Change only the central weakpoint tuning**

```ts
weakpoint: {
  visual: { width: 30, height: 64 },
  hitbox: { width: 38, height: 72 },
  edgeOverlap: 12,
  hp: 14,
},
```

Do not edit `bossGeometry.ts`; its existing derivation must produce the new positions and bounds.

- [ ] **Step 4: Run focused tests green and commit**

Run:

```bash
rtk npm test -- src/game/config/gameTuning.test.ts src/game/bosses/bossGeometry.test.ts src/game/bosses/BossManager.test.ts
```

Commit:

```bash
rtk git add src/game/config/gameTuning.ts src/game/config/gameTuning.test.ts src/game/bosses/BossManager.test.ts
rtk git commit -m "balance: enlarge sentinel weakpoints"
```

---

### Task 3: Move and enrage the exposed Hive core

**Files:**
- Modify: `src/game/config/gameTuning.ts`
- Modify: `src/game/config/gameTuning.test.ts`
- Modify: `src/game/bosses/bossMovementRules.ts`
- Modify: `src/game/bosses/bossMovementRules.test.ts`
- Modify: `src/game/bosses/HiveBossManager.ts`
- Modify: `src/game/bosses/HiveBossManager.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `docs/TUNING.md`

**Central tuning:**

```ts
hiveEnrage: {
  hostileCap: 16,
  fan: {
    intervalMs: 2_200,
    warningMs: 350,
    speed: 150,
    damage: 1,
    radius: 5,
    count: 9,
    arcDegrees: 96,
    alternatingOffsetDegrees: 6,
  },
  aimedBurst: {
    intervalMs: 1_100,
    warningMs: 350,
    speed: 190,
    damage: 1,
    radius: 5,
    count: 4,
    spreadDegrees: 18,
  },
},
hiveBoss: {
  core: {
    x: 225,
    y: 140,
    visualSize: 112,
    hitboxSize: 96,
    hp: 120,
    enrage: {
      travel: { minimum: 110, maximum: 340 },
      maxSpeed: 42,
      minimumTurnSpeed: 15,
      obstaclePadding: 12,
      enemyHalfSize: 22,
      pulseScale: 0.1,
      pulsePeriodMs: 160,
    },
  },
  // existing shooter, reflector, and timing values unchanged
},
```

- [ ] **Step 1: Write failing tuning and movement-helper tests**

Assert the exact central values above and invalid cases for unordered travel bounds, `minimumTurnSpeed > maxSpeed`, non-positive pulse period, and non-positive hostile cap.

Extend `updateBossMotion()` tests with a custom speed argument:

```ts
expect(updateBossMotion(
  { x: 225, direction: 1 },
  1_000,
  [],
  { minimum: 110, maximum: 340 },
  { maxSpeed: 42, minimumTurnSpeed: 15 },
)).toEqual({ x: 267, direction: 1 });
```

- [ ] **Step 2: Write failing Hive manager tests**

Add mutable enemy snapshots to `createBoundary()` and pass `getEnemies()` into the manager. Cover only behavior boundaries:

1. Core remains at `{ x: 225, y: 140 }` while any structure is alive.
2. Destroying all four structures enters `permanentlyExposed`; one second of update moves the core from `225` to `267`.
3. An enemy overlapping the core's vertical band limits rightward travel; removing it allows movement into the newly opened range.
4. Warning markers and fired projectile origins use the current core x.
5. Normal phases still cap all hostile bullets at `12`; permanent exposure caps them at `16`.
6. Enraged pulse reaches approximately `1.10` rather than `1.05`.

- [ ] **Step 3: Run focused tests red**

Run:

```bash
rtk npm test -- src/game/config/gameTuning.test.ts src/game/bosses/bossMovementRules.test.ts src/game/bosses/HiveBossManager.test.ts
```

Expected: custom speed, Hive motion, dynamic origins, new cadence, and enrage cap are absent.

- [ ] **Step 4: Parameterize the existing movement helper**

Add one optional argument; keep the current boss behavior as the default:

```ts
export function updateBossMotion(
  current: BossMotion,
  deltaMs: number,
  obstacles: readonly HorizontalInterval[],
  bounds: HorizontalInterval = BOSS_GEOMETRY.movementBounds,
  speed: { maxSpeed: number; minimumTurnSpeed: number } = GAME_TUNING.boss.movement,
): BossMotion {
  // existing validation and interval subtraction
  const travelSpeed = Math.min(
    speed.maxSpeed,
    Math.max(speed.minimumTurnSpeed, remaining),
  );
  // existing distance calculation using travelSpeed
}
```

Validate both speed values as finite and positive, and reject `minimumTurnSpeed > maxSpeed`. Do not add another movement class.

- [ ] **Step 5: Wire one Hive motion state to existing enemy snapshots**

In `HiveBossManagerOptions` add:

```ts
getEnemies(): readonly EnemySnapshot[];
```

Import `EnemySnapshot`, `updateBossMotion`, `BossMotion`, and `HorizontalInterval`. Add one field:

```ts
private coreMotion: BossMotion = {
  x: GAME_TUNING.hiveBoss.core.x,
  direction: 1,
};
```

Call `moveCore(deltaMs)` only when `state.phase === 'permanentlyExposed'`. Build obstacle intervals from enemies whose y-range overlaps the core's visual vertical band:

```ts
private coreEnemyObstacles(): HorizontalInterval[] {
  const { core } = GAME_TUNING.hiveBoss;
  const { enemyHalfSize, obstaclePadding } = core.enrage;
  const halfCore = core.visualSize / 2;
  const horizontalMargin = halfCore + enemyHalfSize + obstaclePadding;
  return this.options.getEnemies()
    .filter(({ position }) => (
      position.y + enemyHalfSize >= core.y - halfCore
      && position.y - enemyHalfSize <= core.y + halfCore
    ))
    .map(({ position }) => ({
      minimum: position.x - horizontalMargin,
      maximum: position.x + horizontalMargin,
    }));
}
```

Use the configured `travel`, `maxSpeed`, and `minimumTurnSpeed` when calling `updateBossMotion()`. Set only the core sprite's x; destroyed modules remain destroyed and no other Hive part moves with it.

In `CombatScene.createBoss()`, put the existing enemy snapshot callback in `commonOptions` and remove the duplicate sentinel/siege callbacks:

```ts
getEnemies: () => this.enemyManager?.getSnapshot().enemies ?? [],
```

- [ ] **Step 6: Make all core effects follow the sprite**

Replace fixed `HIVE_BOSS_GEOMETRY.core` origins in current-core behavior with `this.parts.core`:

- snapshot `position`
- core/enrage warning marker creation
- warning marker synchronization during movement
- `fireCoreFan()` bullet origins
- `fireEnrageAimedBurst()` aiming origin
- `createEnrageBullet()` origins

Keep `HIVE_BOSS_GEOMETRY` for static dimensions and initial placement only.

Select hostile capacity by phase:

```ts
private hostileCap(): number {
  return this.state.phase === 'permanentlyExposed'
    ? GAME_TUNING.projectiles.hiveEnrage.hostileCap
    : GAME_TUNING.projectiles.hostileCap;
}
```

Use `hostileCap()` from the existing `hasHostileCapacity()` path. Drive pulse amplitude and period from `core.enrage`:

```ts
const scale = this.state.phase === 'permanentlyExposed'
  ? 1 + Math.sin(
    this.state.phaseElapsedMs * Math.PI * 2 / core.enrage.pulsePeriodMs,
  ) * core.enrage.pulseScale
  : 1;
```

- [ ] **Step 7: Validate and document all Hive knobs**

Use existing validation helpers. Validate the travel range is finite, ordered, and keeps the visual core inside `0..GAME_WIDTH`; speeds and period are positive; minimum speed does not exceed maximum speed; hostile cap is a positive integer.

Update `docs/TUNING.md` with:

- Hive movement/pulse → `GAME_TUNING.hiveBoss.core.enrage`
- Hive enrage cadence/count/cap → `GAME_TUNING.projectiles.hiveEnrage`

- [ ] **Step 8: Run focused tests green and commit**

Run:

```bash
rtk npm test -- src/game/config/gameTuning.test.ts src/game/bosses/bossMovementRules.test.ts src/game/bosses/HiveBossManager.test.ts
rtk npm run build
```

Commit:

```bash
rtk git add src/game/config/gameTuning.ts src/game/config/gameTuning.test.ts src/game/bosses/bossMovementRules.ts src/game/bosses/bossMovementRules.test.ts src/game/bosses/HiveBossManager.ts src/game/bosses/HiveBossManager.test.ts src/game/scenes/CombatScene.ts docs/TUNING.md
rtk git commit -m "feat: enrage exposed hive core"
```

---

### Task 4: Verify the full slice once and record the balance pass

**Files:**
- Modify: `e2e/combat.spec.ts`
- Modify: `docs/WORKLOG.md`

- [ ] **Step 1: Update the existing density browser contract**

Keep the current initial-formation assertions: base HP, speed `8`, valid grid footprints, and initial population. Update the opening release gate to interval `8_000` and cap `28`.

Add the phase-boundary assertion without adding a new debug API:

```ts
const pressure = await sceneCall(page, (scene) => {
  for (const enemy of scene.getDebugSnapshot().enemies) {
    scene.debugSetEnemy(enemy.id, { x: enemy.position.x, y: 25 }, enemy.hp);
  }
  scene.debugAdvanceEncounter(52_000);
  return scene.getDebugSnapshot();
});
expect(pressure.encounter).toMatchObject({ phase: 1, spawnSequence: 1 });
expect(pressure.activePopulation).toBeLessThanOrEqual(40);
```

This proves the opening release line remains `50` while stage-1 pressure releases at `0`.

- [ ] **Step 2: Update the existing permanent-exposure browser contract**

Extend the existing Hive test rather than creating a second long setup:

- capture the core x before destroying structures
- destroy all four structures and assert `permanentlyExposed`
- advance gameplay by `1_000ms` and assert core x increased but remains within `110..340`
- advance through the configured warning/fire cadence and assert both `hiveEnrageFan` and `hiveEnrageAimedBurst` appear
- assert emitted projectile x matches the moving core x within one pixel
- retain reward visibility after core death

Update the hostile-cap test to retain the normal `<= 12` assertion and add a permanent-exposure `<= 16` assertion.

- [ ] **Step 3: Run one integrated verification pass**

Run in this order:

```bash
rtk npm test
rtk npm run build
rtk npm run test:e2e -- e2e/combat.spec.ts
rtk git diff --check
```

Expected:

- all Vitest tests pass
- TypeScript and Vite build pass; the existing bundle-size warning is acceptable
- all combat Playwright scenarios pass
- no whitespace errors

- [ ] **Step 4: Record the work and commit**

Append one dated `docs/WORKLOG.md` entry covering:

- stage 1–2 density/HP/shooter changes
- stage 3 intentionally unchanged
- larger first-boss weakpoints
- mobile Hive core movement and stronger enrage
- central tuning locations
- the four verification commands and results

Commit:

```bash
rtk git add e2e/combat.spec.ts docs/WORKLOG.md
rtk git commit -m "test: verify combat pressure pass"
```

## Completion Checklist

- [ ] Opening formation and descent speed are unchanged.
- [ ] Stage 1–2 pressure values exactly match the approved table.
- [ ] Stage 3 values remain unchanged.
- [ ] First-boss weakpoint HP and movement speed remain unchanged.
- [ ] Hive core moves only in `permanentlyExposed`.
- [ ] Remaining enemies constrain Hive movement; removing them expands it.
- [ ] Hive warnings and projectiles originate from the moving core.
- [ ] All adjustable values are discoverable from `stageDefinitions.ts`, `gameTuning.ts`, and `docs/TUNING.md`.
- [ ] Full unit, build, combat E2E, and diff checks pass.
