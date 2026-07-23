# Second Hive Midboss Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a non-decreasing post-boss threat curve, splitter enemies, a distinct second hive midboss, second-tier boss relics, and continuous play into section 2.

**Architecture:** Keep encounter scheduling data-driven in `EncounterDirector`, keep splitter population accounting inside formation/enemy boundaries, and implement the second boss in a new `HiveBossManager` rather than extending the 773-line first `BossManager`. Both bosses conform to a small lifecycle/damage contract selected by `CombatScene`; pure timing, geometry, rewards, and combat-effect rules remain separately testable.

**Tech Stack:** TypeScript 5.9, Phaser 3.90 Arcade Physics, Vitest 4.1, Playwright 1.61, Vite 8.1.

## Global Constraints

- Authoritative design: `docs/superpowers/specs/2026-07-23-second-midboss-hive-design.md`.
- Node.js must remain `>=24`; add no production or development dependency.
- The first reward choice completes before section 1 time starts; the second reward choice completes before section 2 time starts.
- Section 1 starts at threat phase 2, changes to new phase 3 at `60000ms`, and section 2 starts at phase 3.
- Phase 3 uses formation `21..25`, active population cap `84`, spawn interval `5500ms`, armored `3`, shooters `3`, splitters `2`.
- Second boss entry uses minimum `150000ms`, score `110`, hard maximum `210000ms`, warning `2000ms`.
- Hive timing is shield `4000ms`, telegraph `1500ms`, exposed `7000ms`; large deltas must not skip multiple phases or emit catch-up attacks.
- Hive HP is core `72`, shooter modules `12` each, reflector modules `14` each; HP never scales from the player build.
- Hive prototype geometry starts with core center `(225, 140)`, core visual/hitbox `56/48`, shooter module `34x28`, reflector `18x96` at `y=280`, left travel `x=96..168`, right travel `x=282..354`, reflector speed `30px/s`, and minimum open corridor `96px`.
- Splitter parent is `3 HP`, population cost `2`, score `2`, XP `1`, breach `3`; each fragment is `1 HP`, cost `1`, score `0`, XP `1`, breach `1`.
- Other-enemy overlap is allowed. Fragment centers use `x ± 12` then clamp to the world by fragment half-width. No empty-cell search or displacement.
- All hostile bullets share `GAME_TUNING.projectiles.hostileCap`.
- Temporary-orb cap `12`, lifetime `1500ms`, and all new tunable values move into `GAME_TUNING`; consumers must not duplicate literals.
- Child temporary orbs and aftershocks never recurse. The originating damage event never damages newly spawned splitter fragments.
- Defeat, boss defeat, reward transition, restart, and scene shutdown must remove hive sprites, walls, warnings, bullets, queued aftershocks, and pending hit records.
- Preserve existing experiment switches and all current first-boss behavior.

---

### Task 1: Central Tuning and Threat Phase 3

**Files:**
- Modify: `src/game/config/gameTuning.ts`
- Modify: `src/game/config/gameTuning.test.ts`
- Modify: `src/game/encounters/encounterRules.ts`
- Modify: `src/game/encounters/encounterRules.test.ts`
- Modify: `src/game/orbs/TemporaryOrbManager.ts`
- Modify: `src/game/orbs/TemporaryOrbManager.test.ts`

**Interfaces:**
- Produces:

```ts
export type BossKind = 'sentinel' | 'hive';

export interface BossScheduleTuning {
  section: number;
  kind: BossKind;
  minimumMs: number;
  scoreTarget: number;
  hardMaximumMs: number;
  warningMs: number;
}

export type ThreatPhase = 0 | 1 | 2 | 3;
```

- `PhaseTuning` gains `splitters: number`.
- `GAME_TUNING.encounter.bossSchedule` replaces the singular `bossEntry`.
- `GAME_TUNING.enemies` gains splitter/fragment stats and population/scoring data.
- `GAME_TUNING.temporaryOrbs` owns radius, speed, cap, lifetime, and hit cooldown.
- `GAME_TUNING.hiveBoss`, `projectiles.hiveShooter`, `projectiles.hiveCore`, and second-relic numbers are declared here even before later consumers use them.

- [ ] **Step 1: Write failing tuning and phase tests**

Add exact assertions:

```ts
expect(GAME_TUNING.encounter.phases[3]).toEqual({
  formation: { minimum: 21, maximum: 25 },
  activeCap: 84,
  spawnIntervalMs: 5500,
  armored: 3,
  shooters: 3,
  splitters: 2,
});
expect(GAME_TUNING.encounter.bossSchedule).toEqual([
  { section: 0, kind: 'sentinel', minimumMs: 120000, scoreTarget: 70, hardMaximumMs: 210000, warningMs: 2000 },
  { section: 1, kind: 'hive', minimumMs: 150000, scoreTarget: 110, hardMaximumMs: 210000, warningMs: 2000 },
]);
expect(threatPhaseForSection(1, 0)).toBe(2);
expect(threatPhaseForSection(1, 59_999)).toBe(2);
expect(threatPhaseForSection(1, 60_000)).toBe(3);
expect(threatPhaseForSection(2, 0)).toBe(3);
```

Add invalid-mutation tests for negative splitters, special counts exceeding formation minimum, duplicate/misordered schedule sections, `minimumMs > hardMaximumMs`, hive geometry outside `450x800`, non-positive timing/projectile values, invalid temporary cap/lifetime, and non-finite relic values.

- [ ] **Step 2: Run RED**

Run:

```bash
npx vitest run src/game/config/gameTuning.test.ts src/game/encounters/encounterRules.test.ts src/game/orbs/TemporaryOrbManager.test.ts
```

Expected: FAIL because phase 3, boss schedule, hive/relic tuning, and `temporaryOrbs` do not exist.

- [ ] **Step 3: Implement the typed configuration and validation**

Use fixed tuple schedules and phases:

```ts
encounter: {
  phases: readonly [PhaseTuning, PhaseTuning, PhaseTuning, PhaseTuning];
  bossSchedule: readonly [BossScheduleTuning, BossScheduleTuning];
  // existing ingress and initial formation fields remain
};
temporaryOrbs: {
  radius: number;
  speed: number;
  cap: number;
  lifetimeMs: number;
  hitCooldownMs: number;
};
```

Implement phase selection exactly:

```ts
export function threatPhaseForSection(section: number, elapsedMs: number): ThreatPhase {
  if (section >= 2) return 3;
  if (section === 1) return elapsedMs >= 60_000 ? 3 : 2;
  if (elapsedMs >= 120_000) return 2;
  if (elapsedMs >= 60_000) return 1;
  return 0;
}
```

Replace all five temporary-orb literals with `GAME_TUNING.temporaryOrbs` references. Do not change behavior.

- [ ] **Step 4: Run GREEN and full type check**

Run:

```bash
npx vitest run src/game/config/gameTuning.test.ts src/game/encounters/encounterRules.test.ts src/game/orbs/TemporaryOrbManager.test.ts
npm run build
```

Expected: focused tests PASS; TypeScript and Vite build PASS with only the existing large-chunk advisory.

- [ ] **Step 5: Commit**

```bash
git add src/game/config/gameTuning.ts src/game/config/gameTuning.test.ts \
  src/game/encounters/encounterRules.ts src/game/encounters/encounterRules.test.ts \
  src/game/orbs/TemporaryOrbManager.ts src/game/orbs/TemporaryOrbManager.test.ts
git commit -m "feat: define second encounter tuning"
```

---

### Task 2: Splitter Rules, Rewards, and Formation Population

**Files:**
- Create: `src/game/enemies/splitterRules.ts`
- Create: `src/game/enemies/splitterRules.test.ts`
- Modify: `src/game/enemies/enemyRules.ts`
- Modify: `src/game/enemies/enemyRules.test.ts`
- Modify: `src/game/encounters/formationRules.ts`
- Modify: `src/game/encounters/formationRules.test.ts`
- Modify: `src/game/encounters/encounterProgressionRules.ts`
- Modify: `src/game/encounters/encounterProgressionRules.test.ts`
- Modify: `src/game/progression/progressionRules.ts`
- Modify: `src/game/progression/progressionRules.test.ts`
- Modify: `src/game/combat/health.ts`
- Modify: `src/game/combat/health.test.ts`

**Interfaces:**
- Produces:

```ts
export type EnemyKind = 'basic' | 'armored' | 'shooter' | 'splitter' | 'fragment';

export interface FormationResult {
  id: string;
  style: FormationStyle;
  enemies: EnemySpec[];
  populationCost: number;
}

export interface FragmentSpec {
  kind: 'fragment';
  hp: number;
  x: number;
  y: number;
  column: number;
  speed: number;
}

export function fragmentSpecsAt(position: Vector, speed: number): readonly [FragmentSpec, FragmentSpec];
export function populationCostForEnemy(kind: EnemyKind): number;
```

- [ ] **Step 1: Write failing pure-rule tests**

Cover left, center, and right parent positions:

```ts
expect(fragmentSpecsAt({ x: 225, y: 180 }, 8).map(({ x }) => x)).toEqual([213, 237]);
expect(fragmentSpecsAt({ x: 0, y: 180 }, 8).every(({ x }) => x >= 11)).toBe(true);
expect(fragmentSpecsAt({ x: 450, y: 180 }, 8).every(({ x }) => x <= 439)).toBe(true);
```

Cover values:

```ts
expect(populationCostForEnemy('splitter')).toBe(2);
expect(populationCostForEnemy('fragment')).toBe(1);
expect(bossProgressForKill('splitter')).toBe(2);
expect(bossProgressForKill('fragment')).toBe(0);
expect(xpForEnemy('splitter')).toBe(1);
expect(xpForEnemy('fragment')).toBe(1);
expect(breachDamage('splitter')).toBe(3);
expect(breachDamage('fragment')).toBe(1);
```

Phase-3 formation tests must assert 2 splitters, 3 armored, 3 shooters, no fragments, count `21..25`, and:

```ts
expect(result.populationCost).toBe(
  result.enemies.reduce((sum, enemy) => sum + populationCostForEnemy(enemy.kind), 0),
);
```

- [ ] **Step 2: Run RED**

Run:

```bash
npx vitest run src/game/enemies/splitterRules.test.ts src/game/enemies/enemyRules.test.ts \
  src/game/encounters/formationRules.test.ts src/game/encounters/encounterProgressionRules.test.ts \
  src/game/progression/progressionRules.test.ts src/game/combat/health.test.ts
```

Expected: FAIL on missing kinds/functions and phase-3 formation support.

- [ ] **Step 3: Implement minimal pure rules and deterministic assignment**

Use `GAME_WIDTH` and configured fragment width:

```ts
const halfWidth = GAME_TUNING.enemies.fragment.width / 2;
const xs = [position.x - GAME_TUNING.enemies.splitter.fragmentOffsetX,
  position.x + GAME_TUNING.enemies.splitter.fragmentOffsetX];
return xs.map((x) => ({
  kind: 'fragment',
  hp: GAME_TUNING.enemies.hp.fragment,
  x: clamp(x, halfWidth, GAME_WIDTH - halfWidth),
  y: position.y,
  column: -1,
  speed,
})) as [FragmentSpec, FragmentSpec];
```

Extend `assignKinds()` to select non-overlapping armored, shooter, and splitter indices from the seeded shuffle. Include `splitters` in `generateWithPressure()` and return `populationCost` from both initial and reinforcement formations. Fragments are runtime-only and never appear in generated formations.

- [ ] **Step 4: Run GREEN**

Run the focused command from Step 2. Expected: all focused tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/enemies/splitterRules.ts src/game/enemies/splitterRules.test.ts \
  src/game/enemies/enemyRules.ts src/game/enemies/enemyRules.test.ts \
  src/game/encounters/formationRules.ts src/game/encounters/formationRules.test.ts \
  src/game/encounters/encounterProgressionRules.ts src/game/encounters/encounterProgressionRules.test.ts \
  src/game/progression/progressionRules.ts src/game/progression/progressionRules.test.ts \
  src/game/combat/health.ts src/game/combat/health.test.ts
git commit -m "feat: add splitter enemy rules"
```

---

### Task 3: Runtime Splitter Enemy

**Files:**
- Modify: `src/game/enemies/EnemyManager.ts`
- Modify: `src/game/enemies/EnemyManager.test.ts`
- Modify: `src/game/scenes/combatTextureRules.ts`
- Modify: `src/game/scenes/combatTextureRules.test.ts`

**Interfaces:**
- Consumes: `fragmentSpecsAt()`, `populationCostForEnemy()`, expanded `EnemyKind`.
- Produces:

```ts
export interface EnemyManagerSnapshot {
  enemies: EnemySnapshot[];
  activePopulation: number;
  topmostEnemyY: number;
  activeShooters: number;
  bullets: number;
}
```

- [ ] **Step 1: Write failing manager tests**

Add tests proving:

1. A direct lethal hit creates exactly two fragment sprites once.
2. Area damage uses its pre-damage snapshot, so the parent-killing event does not damage new fragments.
3. A second damage event can kill fragments normally.
4. Parent/fragment overlap with an existing enemy is allowed.
5. Left/right boundary fragments remain inside `[11, 439]`.
6. Parent active population `2` equals the two child costs after splitting.
7. `destroy()`, defeat cleanup, and debug removal do not split enemies.

Assert the callback sequence:

```ts
expect(onEnemyKilled.mock.calls.map(([event]) => event.kind))
  .toEqual(['splitter', 'fragment', 'fragment']);
```

- [ ] **Step 2: Run RED**

Run:

```bash
npx vitest run src/game/enemies/EnemyManager.test.ts src/game/scenes/combatTextureRules.test.ts
```

Expected: FAIL because runtime splitting, population snapshot, and texture descriptors do not exist.

- [ ] **Step 3: Implement splitting in the single kill path**

Keep all lethal paths converged:

```ts
private killEnemy(enemy: EnemySprite, event: EnemyKilledEvent): void {
  const fragments = enemy.kind === 'splitter'
    ? fragmentSpecsAt(event.position, GAME_TUNING.enemies.descentSpeed)
    : [];
  this.destroyEnemy(enemy);
  this.options.onEnemyKilled?.(event);
  if (!this.destroyed) this.spawnFormation(fragments);
}
```

Do not call `killEnemy()` from debug removal, breach, scene shutdown, or generic cleanup. Compute `activePopulation` from active enemy kinds. Add distinct prototype descriptors: a cracked `38x30` parent and two complementary `22x18` fragments. `CombatScene.createTextures()` will consume these descriptors in Task 10.

- [ ] **Step 4: Run focused and full unit tests**

```bash
npx vitest run src/game/enemies/EnemyManager.test.ts src/game/scenes/combatTextureRules.test.ts
npm test
```

Expected: focused and full unit suites PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/enemies/EnemyManager.ts src/game/enemies/EnemyManager.test.ts \
  src/game/scenes/combatTextureRules.ts src/game/scenes/combatTextureRules.test.ts
git commit -m "feat: spawn splitter fragments"
```

---

### Task 4: Data-Driven Two-Boss Encounter Progression

**Files:**
- Modify: `src/game/encounters/encounterProgressionRules.ts`
- Modify: `src/game/encounters/encounterProgressionRules.test.ts`
- Modify: `src/game/encounters/EncounterDirector.ts`
- Modify: `src/game/encounters/EncounterDirector.test.ts`

**Interfaces:**
- Produces:

```ts
export type EncounterTransition =
  | { type: 'bossWarningStarted'; bossKind: BossKind }
  | { type: 'bossStarted'; bossKind: BossKind };

export interface EncounterEnemyState {
  activePopulation: number;
  topmostEnemyY: number;
}

export function bossEntryForSection(section: number): BossScheduleTuning | null;
export function bossEntryReady(entry: BossScheduleTuning, elapsedMs: number, score: number): boolean;
```

- [ ] **Step 1: Write failing lifecycle tests**

Add exact cases:

- First reward pause consumes no section-1 time.
- Section 1 starts at phase 2, score 0, spawn clock 0.
- `149999ms + 110` does not warn; `150000ms + 110` warns for `hive`.
- `210000ms + 0` warns for `hive`.
- `2000ms` warning starts `hive`.
- Fragment kills add 0 score; splitter kills add 2.
- Second defeat/reward increments `bossesDefeated` to 2 and starts section 2 at phase 3.
- Section 2 never schedules a third boss.
- Existing enemies remain through both warning transitions while reinforcement generation stays disabled.
- A large delta returns at most one transition.
- Capacity uses current and incoming population costs, not sprite counts.

Representative assertion:

```ts
expect(director.update(150_000, clearTop)).toEqual({
  formation: null,
  transition: { type: 'bossWarningStarted', bossKind: 'hive' },
});
```

- [ ] **Step 2: Run RED**

```bash
npx vitest run src/game/encounters/encounterProgressionRules.test.ts \
  src/game/encounters/EncounterDirector.test.ts
```

Expected: FAIL because transitions are strings, section 1 has no boss, and capacity uses enemy length.

- [ ] **Step 3: Implement schedule lookup and typed transitions**

Replace the section-0 guard with:

```ts
const entry = bossEntryForSection(this.section);
if (entry && bossEntryReady(entry, this.sectionElapsedMs, this.bossScore)) {
  this.state = 'bossWarning';
  this.pendingBossKind = entry.kind;
  this.pendingFormation = null;
  return { formation: null, transition: { type: 'bossWarningStarted', bossKind: entry.kind } };
}
```

Store `pendingBossKind` through warning and boss states, clear it only after reward resume/defeat reset, and expose it in the debug snapshot. Use `formation.populationCost` in the spawn gate. Keep monotonic total `elapsedMs`.

Store the selected schedule entry's `warningMs` with the pending boss and compare `warningElapsedMs` against that value. Do not retain the old singular `BOSS_WARNING_MS` constant.

- [ ] **Step 4: Run GREEN and build**

```bash
npx vitest run src/game/encounters/encounterProgressionRules.test.ts \
  src/game/encounters/EncounterDirector.test.ts
npm run build
```

Expected: focused tests and build PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/encounters/encounterProgressionRules.ts \
  src/game/encounters/encounterProgressionRules.test.ts \
  src/game/encounters/EncounterDirector.ts src/game/encounters/EncounterDirector.test.ts
git commit -m "feat: schedule second midboss"
```

---

### Task 5: Common Boss Contract and Pure Hive Rules

**Files:**
- Create: `src/game/bosses/bossEncounter.ts`
- Create: `src/game/bosses/hiveBossRules.ts`
- Create: `src/game/bosses/hiveBossRules.test.ts`
- Create: `src/game/bosses/hiveBossGeometry.ts`
- Create: `src/game/bosses/hiveBossGeometry.test.ts`
- Modify: `src/game/bosses/BossManager.ts`
- Modify: `src/game/bosses/BossManager.test.ts`

**Interfaces:**
- Produces:

```ts
export type BossTargetId = string;

export interface BossDirectHitEvent {
  bossKind: BossKind;
  targetId: BossTargetId;
  source: 'permanent' | 'temporary';
  position: Vector;
  charged: boolean;
  direction: Vector;
}

export interface BossEncounterSnapshot {
  kind: BossKind;
  active: boolean;
  phase: string | null;
  position: Vector | null;
  parts: Record<string, number> | null;
  bullets: number;
  warnings: number;
  projectiles: BossProjectileSnapshot[];
}

export interface BossEncounter {
  update(): void;
  getSnapshot(): BossEncounterSnapshot;
  getBulletCount(): number;
  applyAreaDamage(center: Vector, radius: number, damage: number, excludedTargetId?: string): string | null;
  clearHostileActions(): void;
  destroy(): void;
}
```

Hive pure types:

```ts
export type HivePartId =
  | 'core' | 'leftShooter' | 'rightShooter' | 'leftReflector' | 'rightReflector';
export type HivePhase = 'shielded' | 'telegraph' | 'exposed' | 'permanentlyExposed' | 'defeated';

export interface HiveBossState {
  phase: HivePhase;
  phaseElapsedMs: number;
  parts: Record<HivePartId, number>;
  deploymentIndex: number;
}
```

- [ ] **Step 1: Write failing pure state/geometry tests**

Test all boundaries at `3999/4000`, `1499/1500`, `6999/7000`; destroyed modules stay at 0; all modules dead causes permanent exposure; core damage is ignored while shielded and accepted while exposed; core 0 causes defeat; one call advances at most one phase even with a `60000ms` delta.

Geometry tests assert two shooter positions, two reflector paths, minimum corridor, no overlap with the configured core, and all bodies inside `450x800`.

- [ ] **Step 2: Run RED**

```bash
npx vitest run src/game/bosses/hiveBossRules.test.ts src/game/bosses/hiveBossGeometry.test.ts
```

Expected: FAIL because the hive modules do not exist.

- [ ] **Step 3: Implement immutable pure rules**

Expose explicit operations:

```ts
export function createHiveBossState(): HiveBossState;
export function advanceHiveCycle(state: HiveBossState, deltaMs: number): HiveBossState;
export function damageHivePart(state: HiveBossState, partId: HivePartId, damage: number): HiveBossState;
export function exposedHiveParts(state: HiveBossState): HivePartId[];
export function aliveHiveModules(state: HiveBossState): HivePartId[];
```

Validate finite non-negative delta/damage. Reset `phaseElapsedMs` to 0 on one transition rather than carrying enough remainder to skip another phase.

- [ ] **Step 4: Adapt first boss to the contract**

Make `BossManager implements BossEncounter`, add `kind: 'sentinel'`, map `partId` to `targetId`, preserve the existing detailed snapshot fields only as optional debug extensions, and rerun its full test file. Do not alter first-boss timing or collision semantics.

- [ ] **Step 5: Run GREEN**

```bash
npx vitest run src/game/bosses/hiveBossRules.test.ts src/game/bosses/hiveBossGeometry.test.ts \
  src/game/bosses/BossManager.test.ts
npm run build
```

Expected: focused tests and build PASS.

- [ ] **Step 6: Commit**

```bash
git add src/game/bosses/bossEncounter.ts \
  src/game/bosses/hiveBossRules.ts src/game/bosses/hiveBossRules.test.ts \
  src/game/bosses/hiveBossGeometry.ts src/game/bosses/hiveBossGeometry.test.ts \
  src/game/bosses/BossManager.ts src/game/bosses/BossManager.test.ts
git commit -m "feat: define hive boss rules"
```

---

### Task 6: Hive Core, Modules, and Reflector Runtime

**Files:**
- Create: `src/game/bosses/HiveBossManager.ts`
- Create: `src/game/bosses/HiveBossManager.test.ts`

**Interfaces:**
- Consumes: `BossEncounter`, pure hive state/geometry, both orb managers.
- Produces:

```ts
export interface HiveBossManagerOptions {
  player: Phaser.Physics.Arcade.Sprite;
  orbManager: OrbManager;
  temporaryOrbManager: TemporaryOrbManager;
  getEnemyBulletCount(): number;
  getGameplayElapsedMs(): number;
  onPlayerHit(damage: number): void;
  onDirectHit(event: BossDirectHitEvent): void;
  onPhaseChanged?(phase: HivePhase): void;
  onDefeated(): void;
}

export class HiveBossManager implements BossEncounter {
  // common contract methods
}
```

- [ ] **Step 1: Write failing construction/cycle/collision tests**

Using the existing Phaser fakes as a base, prove:

- Creates one core and four module bodies with configured HP.
- Shielded core reflects permanent and temporary orbs without consuming a charge or emitting direct-hit events.
- Modules accept permanent and temporary direct hits in every non-defeated phase.
- Telegraph changes visuals but does not expose core early.
- Exposed core accepts damage for exactly `7000ms`.
- The fixed exposure window neither forces orb recovery nor extends itself from current orb state.
- Destroyed modules never become visible/collidable after recall.
- Destroying all modules immediately exposes the core permanently.
- Reflector bodies move only on configured paths, maintain the corridor, and reflect orbs.
- Player and hostile bullets have no reflector collider.
- Same orb/module pair cannot deal damage twice inside `80ms`.
- Area damage selects the nearest eligible part once and can exclude the direct target.

- [ ] **Step 2: Run RED**

```bash
npx vitest run src/game/bosses/HiveBossManager.test.ts
```

Expected: FAIL with missing `HiveBossManager`.

- [ ] **Step 3: Implement sprites and collision ownership**

Use separate core, module, warning, and reflector groups. Register permanent-orb colliders at construction and through `orbManager.onOrbAdded()`. Register one temporary-orb collider per target. Keep pending reflected hits keyed by source and target, matching the proven first-boss pattern.

The reflector module sprite is both the destructible target and the reflecting wall. Never create a second invisible wall body.

- [ ] **Step 4: Implement cycle synchronization and cleanup**

`update()` derives `deltaMs` from gameplay elapsed time, calls `advanceHiveCycle()` once, updates sprites, and removes offscreen hostile objects. `clearHostileActions()` clears warnings/bullets but leaves boss parts; `destroy()` additionally removes colliders, listeners, sprites, groups, accepted-hit maps, and pending hits.

- [ ] **Step 5: Run GREEN and full unit suite**

```bash
npx vitest run src/game/bosses/HiveBossManager.test.ts
npm test
npm run build
```

Expected: focused, full unit, and build PASS.

- [ ] **Step 6: Commit**

```bash
git add src/game/bosses/HiveBossManager.ts src/game/bosses/HiveBossManager.test.ts
git commit -m "feat: add hive boss modules"
```

---

### Task 7: Hive Shooter and Core Attacks

**Files:**
- Modify: `src/game/bosses/HiveBossManager.ts`
- Modify: `src/game/bosses/HiveBossManager.test.ts`
- Modify: `src/game/scenes/combatTextureRules.ts`
- Modify: `src/game/scenes/combatTextureRules.test.ts`

**Interfaces:**
- Produces snapshot projectile kinds `hiveShooter` and `hiveCore`.
- `getBulletCount()` returns all active hive bullets so enemy shooters and both bosses share the configured cap.

- [ ] **Step 1: Write failing scheduler/projectile tests**

Prove:

- Left/right shooters use `1400ms` intervals offset by `700ms`.
- Each `300ms` warning locks the player position at warning creation.
- Destroying one shooter removes its pending warning and future schedule.
- A large update emits no attack burst.
- Each deployment emits exactly one 5-shot core fan at `[-36, -18, 0, 18, 36]`.
- Permanent exposure emits one fan per `7000ms`.
- Combined enemy plus hive bullets never exceed `hostileCap`.
- Bullets deal `1` once, respect scene invulnerability externally, and clean up offscreen.
- Pause does not advance warnings because gameplay elapsed time is unchanged.
- `clearHostileActions()`, defeat, and destroy remove warnings and bullets.

- [ ] **Step 2: Run RED**

```bash
npx vitest run src/game/bosses/HiveBossManager.test.ts src/game/scenes/combatTextureRules.test.ts
```

Expected: FAIL because attacks and hive projectile descriptors are missing.

- [ ] **Step 3: Implement warnings and shots**

Model warnings as data with immutable targets:

```ts
type HiveWarning =
  | { kind: 'shooter'; moduleId: HivePartId; dueAt: number; target: Vector; marker: BossSprite }
  | { kind: 'coreFan'; dueAt: number; marker: BossSprite };
```

Before creating a warning and again before firing, compare:

```ts
options.getEnemyBulletCount() + getBulletCount() < GAME_TUNING.projectiles.hostileCap
```

Never use a hardcoded `12`. Generate visually distinct red/orange centered bullets and hive warning markers through descriptors.

- [ ] **Step 4: Run GREEN**

```bash
npx vitest run src/game/bosses/HiveBossManager.test.ts src/game/scenes/combatTextureRules.test.ts
npm run build
```

Expected: focused tests and build PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/bosses/HiveBossManager.ts src/game/bosses/HiveBossManager.test.ts \
  src/game/scenes/combatTextureRules.ts src/game/scenes/combatTextureRules.test.ts
git commit -m "feat: add hive boss attacks"
```

---

### Task 8: Second-Tier Reward Selection, Build State, and UI

**Files:**
- Modify: `src/game/progression/bossRewardRules.ts`
- Modify: `src/game/progression/bossRewardRules.test.ts`
- Modify: `src/game/progression/BossBuild.ts`
- Modify: `src/game/progression/BossBuild.test.ts`
- Modify: `src/game/ui/BossRewardOverlay.ts`
- Modify: `src/game/ui/BossRewardOverlay.test.ts`

**Interfaces:**
- Produces:

```ts
export const SECOND_BOSS_REWARD_IDS = [
  'auxiliary-orbit',
  'recovery-salvo',
  'siege-resonance',
  'hyperpressure-core',
  'inertial-penetration',
  'aftershock-explosion',
  'chain-split',
] as const;

export type BossRewardTier = 'first' | 'second';
export type BossRewardId = FirstBossRewardId | SecondBossRewardId;

export function selectBossRewardOptions(
  tier: BossRewardTier,
  owned: ReadonlySet<BossRewardId>,
  ranks: Readonly<AbilityRanks>,
  seed: number,
): BossRewardId[];
```

`BossBuild` produces:

```ts
orbLimit(): number;
recoverySalvoCount(source: RecoverySource): number;
recordPermanentDirectHit(): boolean;
chargedDamageBonus(): number;
chargedKillPierces(): boolean;
aftershock(): { delayMs: number; radiusScale: number; damageScale: number } | null;
chainSplitEnabled(): boolean;
resetTransientState(): void;
```

- [ ] **Step 1: Write failing selection/build tests**

Test deterministic no-duplicate second choices, three universal fallbacks, at least one eligible evolution when any rank is positive, no ineligible evolution, all seven ownership effects, orb limit capped at 6, siege triggering on the hit after 10 accumulated permanent hits, and transient counter reset on restart.

UI tests assert Korean labels/effects for all seven IDs and a second-tier heading while preserving touch/keyboard one-shot selection.

- [ ] **Step 2: Run RED**

```bash
npx vitest run src/game/progression/bossRewardRules.test.ts \
  src/game/progression/BossBuild.test.ts src/game/ui/BossRewardOverlay.test.ts
```

Expected: FAIL because the second pool and derived effects do not exist.

- [ ] **Step 3: Implement tiered selection**

For tier two:

1. Filter owned IDs.
2. Build eligible evolutions from ranks `>=1`.
3. Deterministically select one eligible evolution when the list is non-empty.
4. Fill remaining positions from a seeded shuffle of unowned universal/eligible rewards.
5. Use universal-only fallback when no evolution is eligible.
6. Return exactly three distinct IDs or throw a descriptive invariant error.

- [ ] **Step 4: Implement build derivations and UI copy**

Keep reward IDs as storage; expose behavior only through named methods. Do not put combat counters in `CombatScene` except delayed-effect queues. Pass `tier` to `BossRewardOverlay.show()` so the title can distinguish the stronger reward without duplicating card behavior.

- [ ] **Step 5: Run GREEN**

```bash
npx vitest run src/game/progression/bossRewardRules.test.ts \
  src/game/progression/BossBuild.test.ts src/game/ui/BossRewardOverlay.test.ts
npm run build
```

Expected: focused tests and build PASS.

- [ ] **Step 6: Commit**

```bash
git add src/game/progression/bossRewardRules.ts src/game/progression/bossRewardRules.test.ts \
  src/game/progression/BossBuild.ts src/game/progression/BossBuild.test.ts \
  src/game/ui/BossRewardOverlay.ts src/game/ui/BossRewardOverlay.test.ts
git commit -m "feat: add second boss relic pool"
```

---

### Task 9: Runtime Relic Combat Effects

**Files:**
- Create: `src/game/combat/CombatEffectScheduler.ts`
- Create: `src/game/combat/CombatEffectScheduler.test.ts`
- Modify: `src/game/orbs/orbRules.ts`
- Modify: `src/game/orbs/orbRules.test.ts`
- Modify: `src/game/orbs/OrbManager.ts`
- Modify: `src/game/orbs/OrbManager.test.ts`
- Modify: `src/game/orbs/TemporaryOrbManager.ts`
- Modify: `src/game/orbs/TemporaryOrbManager.test.ts`

**Interfaces:**
- Produces:

```ts
export interface ScheduledAreaEffect {
  id: number;
  dueAt: number;
  position: Vector;
  radius: number;
  damage: number;
  kind: 'aftershock';
}

export class CombatEffectScheduler {
  scheduleAftershock(nowMs: number, position: Vector, radius: number, damage: number): void;
  drainDue(nowMs: number): ScheduledAreaEffect[];
  clear(): void;
  getSnapshot(): ScheduledAreaEffect[];
}
```

Orb additions:

```ts
getChargedDamageBonus?(): number;
chargedKillPierces?(): boolean;
```

Temporary additions:

```ts
export interface TemporaryOrbSnapshot {
  // existing fields
  generation: 0 | 1;
  splitConsumed: boolean;
}

spawnChildren(parentId: number, position: Vector, direction: Vector): number;
```

- `DirectHitEvent` and `BossDirectHitEvent` both carry the source orb ID so a temporary root can split after hitting either an enemy or a boss target.

- [ ] **Step 1: Write failing effect tests**

Cover:

- `hyperpressure-core` adds `0.75` only when the permanent orb is charged.
- `inertial-penetration` passes through only a charged lethal hit and still consumes one charge.
- Proximity recovery reports once so the scene can launch exactly two salvo orbs; floor/timeout recovery reports no salvo.
- Root temporary orb can create two children once at `±25°`.
- Child generation cannot split.
- Cap truncates child creation deterministically.
- Scheduler releases an aftershock at `350ms`, not `349ms`; gameplay time pause holds it; clear removes it.

- [ ] **Step 2: Run RED**

```bash
npx vitest run src/game/combat/CombatEffectScheduler.test.ts \
  src/game/orbs/orbRules.test.ts src/game/orbs/OrbManager.test.ts \
  src/game/orbs/TemporaryOrbManager.test.ts
```

Expected: FAIL on missing scheduler and modifier/child APIs.

- [ ] **Step 3: Implement charged damage and penetration**

Extend `directHit()` with explicit modifier values:

```ts
const charged = charges > 0;
const damage = (charged ? 1.5 : 1)
  + directDamageBonus
  + (charged ? chargedDamageBonus : 0);
const killed = enemyHp <= damage;
const rewardPiercing = charged && killed && chargedKillPierces;
const reflect = piercing ? false : !(killed && (settings.passThroughOnKill || rewardPiercing));
```

Keep existing experiment semantics unchanged.

- [ ] **Step 4: Implement generation-safe temporary children and scheduler**

Store generation and split consumption in `TemporaryOrbManager`, not in sprite ad-hoc properties. `spawnChildren()` rejects unknown/inactive/child/already-consumed parents and uses the configured cap/lifetime. The scheduler uses passed gameplay milliseconds only; never call `scene.time.delayedCall()` for aftershocks.

- [ ] **Step 5: Run GREEN and full unit tests**

```bash
npx vitest run src/game/combat/CombatEffectScheduler.test.ts \
  src/game/orbs/orbRules.test.ts src/game/orbs/OrbManager.test.ts \
  src/game/orbs/TemporaryOrbManager.test.ts
npm test
```

Expected: focused and full unit suites PASS.

- [ ] **Step 6: Commit**

```bash
git add src/game/combat/CombatEffectScheduler.ts src/game/combat/CombatEffectScheduler.test.ts \
  src/game/orbs/orbRules.ts src/game/orbs/orbRules.test.ts \
  src/game/orbs/OrbManager.ts src/game/orbs/OrbManager.test.ts \
  src/game/orbs/TemporaryOrbManager.ts src/game/orbs/TemporaryOrbManager.test.ts
git commit -m "feat: apply second relic combat effects"
```

---

### Task 10: Scene Integration, Textures, and Full Lifecycle

**Files:**
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `src/game/scenes/combatSceneRules.ts`
- Modify: `src/game/scenes/combatSceneRules.test.ts`
- Modify: `src/game/scenes/combatTextureRules.ts`
- Modify: `src/game/scenes/combatTextureRules.test.ts`

**Interfaces:**
- Consumes: typed encounter transitions, `BossEncounter`, both boss managers, second rewards, effect scheduler, active population.
- Produces debug state for browser tests:

```ts
boss: BossEncounterSnapshot;
encounter: EncounterDirectorSnapshot;
bossRewardTier: BossRewardTier | null;
scheduledEffects: ScheduledAreaEffect[];
activePopulation: number;
```

- [ ] **Step 1: Write failing scene-rule tests**

Extract and test pure selection:

```ts
export function rewardTierForBoss(kind: BossKind): BossRewardTier {
  return kind === 'sentinel' ? 'first' : 'second';
}
```

Test pending boss kind retention, correct manager selection, correct reward tier, reward finalization after queued level-ups, and second reward resuming section 2.

- [ ] **Step 2: Run RED**

```bash
npx vitest run src/game/scenes/combatSceneRules.test.ts src/game/scenes/combatTextureRules.test.ts
npm run build
```

Expected: tests/type check fail on old string transitions and `BossManager`-specific scene state.

- [ ] **Step 3: Replace the scene’s concrete boss field**

Use:

```ts
private activeBoss?: BossEncounter;
private activeBossKind?: BossKind;
private bossRewardTier: BossRewardTier | null = null;
private readonly combatEffects = new CombatEffectScheduler();
```

On `bossStarted`, construct `BossManager` for `sentinel` and `HiveBossManager` for `hive`. Route common update, bullet count, area damage, cleanup, snapshot, and defeat through `activeBoss`. Keep first-boss debug helpers guarded by `kind`; add hive target debug damage without exposing a production bypass.

- [ ] **Step 4: Wire population, rewards, and combat effects**

- Pass `enemySnapshot.activePopulation` into `EncounterDirector`.
- Call tiered reward selection using the defeated boss kind.
- `auxiliary-orbit`: call `orbManager.addOrb()` once.
- `recovery-salvo`: on proximity recovery, spawn two root temporary orbs from player position/current aim.
- `siege-resonance`: on permanent direct hit, emit configured area damage only when `BossBuild.recordPermanentDirectHit()` returns true.
- `aftershock`: enqueue from permanent explosion only; drain by gameplay elapsed time during unpaused updates.
- `chain-split`: after a root temporary direct hit, call `spawnChildren()` once.
- Apply every area effect to enemies and the active boss once, excluding the direct target where required.
- Clear queued aftershocks before opening either boss reward and on defeat, restart, or shutdown.

- [ ] **Step 5: Add prototype textures**

Generate splitter/fragment textures from Task 3 descriptors and hive body/module/warning/projectile textures from Task 7 descriptors. Keep friendly cyan/white and hostile red/orange separation. Reflector modules must have a clear wall silhouette; destroyed modules must disappear.

- [ ] **Step 6: Prove cleanup and restart**

Unit-test or scene-rule-test that defeat, reward selection, restart, and shutdown clear `activeBoss`, boss kind/tier, combat scheduler, warnings, temporary orbs, and transient `BossBuild` counters. Preserve permanent build/rewards only across normal section transitions.

- [ ] **Step 7: Run focused, full unit, and build**

```bash
npx vitest run src/game/scenes/combatSceneRules.test.ts src/game/scenes/combatTextureRules.test.ts
npm test
npm run build
git diff --check
```

Expected: all commands PASS; only existing Vite chunk advisory remains.

- [ ] **Step 8: Commit**

```bash
git add src/game/scenes/CombatScene.ts src/game/scenes/combatSceneRules.ts \
  src/game/scenes/combatSceneRules.test.ts src/game/scenes/combatTextureRules.ts \
  src/game/scenes/combatTextureRules.test.ts
git commit -m "feat: integrate second hive encounter"
```

---

### Task 11: Browser Acceptance and Playtest Handoff

**Files:**
- Modify: `e2e/combat.spec.ts`
- Create: `docs/playtest/2026-07-23-second-hive-midboss-playtest.md`
- Modify: `.superpowers/sdd/progress.md`

**Interfaces:**
- Uses the existing development-only debug surface to accelerate clocks and position real physics objects.
- Does not introduce production cheats or test-only branches in production builds.

- [ ] **Step 1: Add failing focused browser cases**

Add named desktop cases for:

1. `@desktop splitter reserves population, clamps fragments, and settles rewards`
2. `@desktop enters hive from section-local score and hard time`
3. `@desktop hive cycles shield, telegraph, exposure, and permanent exposure`
4. `@desktop hive reflector changes a real orb trajectory without blocking player bullets`
5. `@desktop hive attacks share hostile cap and clean up on defeat`
6. `@desktop second relics apply once without recursive temporary growth`
7. `@desktop completes first boss through second reward and resumes section two`
8. `@mobile keeps movement and retained aim during phase-three density and hive combat`

Use exact boundary assertions (`149999/150000`, `209999/210000`, `3999/4000`, `1499/1500`, `6999/7000`). Assert that existing enemies survive warning entry and no reinforcement appears during either boss. At least one hive defeat must come from real orb collisions; debug damage may prepare HP but cannot be the sole proof.

- [ ] **Step 2: Run RED**

```bash
npx playwright test e2e/combat.spec.ts --project=desktop-chromium \
  --grep "splitter|hive|second relic|second reward"
```

Expected: new cases FAIL until debug snapshots and runtime integration expose the implemented behavior.

- [ ] **Step 3: Complete only testability gaps**

Add read-only snapshot fields or narrowly validated development-only positioning helpers when a real collision cannot be arranged deterministically. Do not add direct “defeat hive” or “grant reward” production paths.

- [ ] **Step 4: Run focused repeatedly**

```bash
npx playwright test e2e/combat.spec.ts --project=desktop-chromium \
  --grep "splitter|hive|second relic|second reward" --repeat-each=3
```

Expected: every focused case PASS three consecutive times.

- [ ] **Step 5: Write playtest handoff**

Include unchecked fields for:

- first reward to second warning time
- second boss fight duration and remaining HP
- missed `7s` exposure opportunities
- reflector usefulness/frustration
- splitter overlap and wall-edge readability
- shooter/core-bullet dodge space
- module-first versus core-first viability
- second reward power spike
- temporary-orb readability/performance

Record exact launch command and mobile LAN command, but do not mark subjective checks complete.

- [ ] **Step 6: Run final verification**

```bash
npm test
npm run test:e2e
npm run build
git diff --check
git status --short
```

Expected: all unit tests PASS, all Playwright projects PASS, production build PASS, diff check clean, and only intended plan-progress/report artifacts remain.

- [ ] **Step 7: Commit**

```bash
git add e2e/combat.spec.ts docs/playtest/2026-07-23-second-hive-midboss-playtest.md
git add -u .superpowers/sdd/progress.md
git commit -m "test: verify second hive encounter"
```

---

## Final Review Gate

- [ ] Generate a whole-range review package from the plan base to `HEAD`.
- [ ] Request a read-only senior review against the design and this plan.
- [ ] Fix all Critical and Important findings in one focused fix task with regression tests.
- [ ] Re-request review of the fix range until no Critical or Important findings remain.
- [ ] Run fresh `npm test`, `npm run test:e2e`, `npm run build`, `git diff --check`, and `git status --short`.
- [ ] Use `superpowers:finishing-a-development-branch` and let the user choose merge, PR, keep, or discard.
