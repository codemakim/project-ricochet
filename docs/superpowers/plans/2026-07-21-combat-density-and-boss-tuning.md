# Combat Density and Boss Tuning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the first midboss larger, slower, and continuously threatening between major patterns while replacing fast sparse enemies with slower, denser, tougher formations whose balance values come from one typed tuning source.

**Architecture:** Add `gameTuning.ts` as the only source for adjustable combat numbers and prototype colors. Pure encounter and boss geometry rules consume that object; Phaser managers own runtime scheduling and sprites but do not redeclare tuning values. Keep deterministic formation seeds and the existing hostile-bullet cap, and add only the snapshot detail needed for stable browser acceptance.

**Tech Stack:** TypeScript 5.9, Phaser 3.90 Arcade Physics, Vitest 4.1, Playwright 1.61, Vite 8.1

## Global Constraints

- Use `src/game/config/gameTuning.ts` as the single entry point for gameplay balance and combat-visual tuning touched by this feature.
- Do not duplicate the same semantic value in physics, texture generation, rules, or tests; derive geometry and import tuning values.
- Initial boss body is `168x96px`; weakpoint visual is `18x48px`; weakpoint hitbox is `22x52px`; body overlap is `5px`; movement speed is `35px/s`.
- Boss basic shot fires every `900ms`, flashes for `150ms`, aims at the player's position at actual fire time, travels at `150px/s`, and deals `1` damage.
- A pending basic shot is cancelled when a major warning begins. The next basic shot is scheduled `900ms` after the last major action resolves.
- Basic and major boss bullets share the existing hostile cap `12`; skipped basic shots never accumulate into catch-up bursts.
- Enemy descent speed is `8px/s`; HP is basic `2`, shooter `2`, armored `5`.
- Initial enemy count is `26`; phase formation ranges are `13~15`, `15~18`, `18~21`; active caps are `48`, `60`, `72`.
- Reinforcement release height is `50`; spawn intervals remain `8000/7000/6000ms`.
- Boss entry score `70`, minimum time `120000ms`, hard maximum `210000ms`, boss HP, and existing major-pattern damage/cadence remain unchanged.
- Enemy projectiles use red/orange fill plus dark center/outline; permanent and temporary orbs use white/cyan or cyan/teal.
- Do not implement main-orb personalities, companion themes, or main-orb combination effects in this plan.
- No new runtime dependency.

---

### Task 1: Typed combat tuning foundation

**Files:**
- Create: `src/game/config/gameTuning.ts`
- Create: `src/game/config/gameTuning.test.ts`

**Interfaces:**
- Produces: `GameTuning`, `GAME_TUNING`, and `validateGameTuning(tuning: GameTuning): void`.
- Later tasks consume `GAME_TUNING.boss`, `.enemies`, `.encounter`, `.projectiles`, and `.visual` without redeclaring their values.

- [ ] **Step 1: Write failing value and invariant tests**

Create `src/game/config/gameTuning.test.ts` with exact value assertions and mutations that prove invalid configurations fail:

```ts
import { describe, expect, it } from 'vitest';
import { GAME_TUNING, validateGameTuning, type GameTuning } from './gameTuning';

type Mutable<T> = T extends readonly [unknown, ...unknown[]]
  ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
  : T extends readonly (infer Item)[]
    ? Mutable<Item>[]
    : T extends object
      ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
      : T;

function mutableTuning(): Mutable<GameTuning> {
  return structuredClone(GAME_TUNING) as Mutable<GameTuning>;
}

describe('GAME_TUNING', () => {
  it('defines the approved boss, enemy, and encounter values once', () => {
    expect(GAME_TUNING.boss.body).toEqual({ width: 168, height: 96 });
    expect(GAME_TUNING.boss.movement.maxSpeed).toBe(35);
    expect(GAME_TUNING.enemies).toMatchObject({
      descentSpeed: 8,
      hp: { basic: 2, shooter: 2, armored: 5 },
    });
    expect(GAME_TUNING.encounter.initialFormation).toEqual({
      count: 26, originY: 80, armored: 3, shooters: 3,
    });
    expect(GAME_TUNING.encounter.reinforcementReleaseY).toBe(50);
    expect(GAME_TUNING.encounter.phases).toEqual([
      { formation: { minimum: 13, maximum: 15 }, activeCap: 48, spawnIntervalMs: 8000, armored: 1, shooters: 0 },
      { formation: { minimum: 15, maximum: 18 }, activeCap: 60, spawnIntervalMs: 7000, armored: 2, shooters: 1 },
      { formation: { minimum: 18, maximum: 21 }, activeCap: 72, spawnIntervalMs: 6000, armored: 2, shooters: 2 },
    ]);
  });

  it('accepts the shipped configuration', () => {
    expect(() => validateGameTuning(mutableTuning())).not.toThrow();
  });

  it.each([
    ['non-positive enemy speed', (value: Mutable<GameTuning>) => { value.enemies.descentSpeed = 0; }],
    ['reversed formation range', (value: Mutable<GameTuning>) => { value.encounter.phases[0]!.formation.minimum = 16; }],
    ['cap below formation maximum', (value: Mutable<GameTuning>) => { value.encounter.phases[2]!.activeCap = 20; }],
    ['release height outside ingress band', (value: Mutable<GameTuning>) => { value.encounter.reinforcementReleaseY = 98; }],
    ['boss wider than the game', (value: Mutable<GameTuning>) => { value.boss.body.width = 450; }],
    ['identical friendly and hostile palette', (value: Mutable<GameTuning>) => {
      value.visual.hostile.enemyBullet = { ...value.visual.friendly.temporaryOrb };
    }],
  ])('rejects %s', (_label, mutate) => {
    const tuning = mutableTuning();
    mutate(tuning);
    expect(() => validateGameTuning(tuning)).toThrow();
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run src/game/config/gameTuning.test.ts`

Expected: FAIL because `gameTuning.ts` does not exist.

- [ ] **Step 3: Define the typed grouped tuning object**

Create `src/game/config/gameTuning.ts`. Use mutable interfaces for validation tests and `as const satisfies GameTuning` for the shipped object:

```ts
import { GAME_HEIGHT, GAME_WIDTH, PLAYER_MIN_Y } from '../constants';

export interface RangeTuning { minimum: number; maximum: number }
export interface PhaseTuning {
  formation: RangeTuning;
  activeCap: number;
  spawnIntervalMs: number;
  armored: number;
  shooters: number;
}

export interface ProjectileVisualTuning {
  fill: number;
  accent: number;
  width: number;
  height: number;
}

export interface GameTuning {
  boss: {
    y: number;
    body: { width: number; height: number };
    weakpoint: {
      visual: { width: number; height: number };
      hitbox: { width: number; height: number };
      edgeOverlap: number;
      hp: number;
    };
    core: { visualSize: number; hitboxSize: number; hp: number };
    movement: { maxSpeed: number; minimumTurnSpeed: number; obstaclePadding: number; enemyHalfSize: number };
    majorIntervalsMs: { twoWeakpoints: number; oneWeakpoint: number; core: number };
  };
  enemies: {
    descentSpeed: number;
    hp: { basic: number; shooter: number; armored: number };
    shooter: { intervalMs: number; warningMs: number; bulletSpeed: number; damage: number };
  };
  encounter: {
    reinforcementOriginY: number;
    reinforcementReleaseY: number;
    initialFormation: { count: number; originY: number; armored: number; shooters: number };
    phases: readonly [PhaseTuning, PhaseTuning, PhaseTuning];
    bossEntry: { scoreTarget: number; minimumMs: number; hardMaximumMs: number; warningMs: number };
  };
  projectiles: {
    hostileCap: number;
    offscreenMargin: number;
    bossBasic: { intervalMs: number; warningMs: number; speed: number; damage: number; radius: number };
    bossAimed: { warningMs: number; speed: number; damage: number; radius: number; fanDegrees: readonly [number, number, number] };
    bossSupport: { warningMs: number; speed: number; damage: number; width: number; height: number };
  };
  visual: {
    friendly: { permanentOrb: ProjectileVisualTuning; temporaryOrb: ProjectileVisualTuning };
    hostile: {
      enemyBullet: ProjectileVisualTuning;
      bossBasic: ProjectileVisualTuning;
      bossAimed: ProjectileVisualTuning;
      bossHazard: ProjectileVisualTuning;
      bossMuzzleFlash: ProjectileVisualTuning;
    };
  };
}

export const GAME_TUNING = {
  boss: {
    y: 120,
    body: { width: 168, height: 96 },
    weakpoint: {
      visual: { width: 18, height: 48 },
      hitbox: { width: 22, height: 52 },
      edgeOverlap: 5,
      hp: 14,
    },
    core: { visualSize: 32, hitboxSize: 28, hp: 36 },
    movement: { maxSpeed: 35, minimumTurnSpeed: 15, obstaclePadding: 12, enemyHalfSize: 22 },
    majorIntervalsMs: { twoWeakpoints: 2800, oneWeakpoint: 2300, core: 1900 },
  },
  enemies: {
    descentSpeed: 8,
    hp: { basic: 2, shooter: 2, armored: 5 },
    shooter: { intervalMs: 1300, warningMs: 350, bulletSpeed: 180, damage: 1 },
  },
  encounter: {
    initialFormation: { count: 26, originY: 80, armored: 3, shooters: 3 },
    reinforcementOriginY: -28,
    reinforcementReleaseY: 50,
    phases: [
      { formation: { minimum: 13, maximum: 15 }, activeCap: 48, spawnIntervalMs: 8000, armored: 1, shooters: 0 },
      { formation: { minimum: 15, maximum: 18 }, activeCap: 60, spawnIntervalMs: 7000, armored: 2, shooters: 1 },
      { formation: { minimum: 18, maximum: 21 }, activeCap: 72, spawnIntervalMs: 6000, armored: 2, shooters: 2 },
    ],
    bossEntry: { scoreTarget: 70, minimumMs: 120000, hardMaximumMs: 210000, warningMs: 2000 },
  },
  projectiles: {
    hostileCap: 12,
    offscreenMargin: 20,
    bossBasic: { intervalMs: 900, warningMs: 150, speed: 150, damage: 1, radius: 5 },
    bossAimed: { warningMs: 600, speed: 220, damage: 1, radius: 5, fanDegrees: [-12, 0, 12] },
    bossSupport: { warningMs: 800, speed: 240, damage: 2, width: 16, height: 24 },
  },
  visual: {
    friendly: {
      permanentOrb: { fill: 0xffffff, accent: 0x4ddcff, width: 16, height: 16 },
      temporaryOrb: { fill: 0x8cf7ff, accent: 0x167d9a, width: 12, height: 12 },
    },
    hostile: {
      enemyBullet: { fill: 0xff4d5a, accent: 0x4a0710, width: 10, height: 10 },
      bossBasic: { fill: 0xff704d, accent: 0x4a0710, width: 10, height: 10 },
      bossAimed: { fill: 0xff704d, accent: 0x4a0710, width: 10, height: 10 },
      bossHazard: { fill: 0xff7b55, accent: 0x4a0710, width: 16, height: 24 },
      bossMuzzleFlash: { fill: 0xff704d, accent: 0xffd6a3, width: 20, height: 20 },
    },
  },
} as const satisfies GameTuning;
```

Implement `validateGameTuning()` with named `RangeError` messages. Use the same weakpoint-offset formula as `bossGeometry.ts` will use later:

```ts
function positive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be finite and positive`);
}

export function validateGameTuning(tuning: GameTuning): void {
  const { boss, enemies, encounter, projectiles, visual } = tuning;
  positive(boss.body.width, 'boss.body.width');
  positive(boss.body.height, 'boss.body.height');
  positive(boss.weakpoint.visual.width, 'boss.weakpoint.visual.width');
  positive(boss.weakpoint.visual.height, 'boss.weakpoint.visual.height');
  positive(boss.weakpoint.hitbox.width, 'boss.weakpoint.hitbox.width');
  positive(boss.weakpoint.hitbox.height, 'boss.weakpoint.hitbox.height');
  positive(boss.weakpoint.edgeOverlap, 'boss.weakpoint.edgeOverlap');
  positive(boss.weakpoint.hp, 'boss.weakpoint.hp');
  positive(boss.core.visualSize, 'boss.core.visualSize');
  positive(boss.core.hitboxSize, 'boss.core.hitboxSize');
  positive(boss.core.hp, 'boss.core.hp');
  positive(boss.movement.maxSpeed, 'boss.movement.maxSpeed');
  positive(boss.movement.minimumTurnSpeed, 'boss.movement.minimumTurnSpeed');
  if (boss.movement.minimumTurnSpeed > boss.movement.maxSpeed) {
    throw new RangeError('boss minimum turn speed must not exceed max speed');
  }
  for (const [phase, interval] of Object.entries(boss.majorIntervalsMs)) {
    positive(interval, `boss.majorIntervalsMs.${phase}`);
  }
  positive(enemies.descentSpeed, 'enemies.descentSpeed');
  for (const [kind, hp] of Object.entries(enemies.hp)) positive(hp, `enemies.hp.${kind}`);
  positive(enemies.shooter.intervalMs, 'enemies.shooter.intervalMs');
  positive(enemies.shooter.warningMs, 'enemies.shooter.warningMs');
  positive(enemies.shooter.bulletSpeed, 'enemies.shooter.bulletSpeed');
  positive(enemies.shooter.damage, 'enemies.shooter.damage');
  positive(encounter.initialFormation.count, 'encounter.initialFormation.count');
  if (![encounter.initialFormation.armored, encounter.initialFormation.shooters].every(Number.isInteger)
    || encounter.initialFormation.armored < 0 || encounter.initialFormation.shooters < 0
    || encounter.initialFormation.armored + encounter.initialFormation.shooters
      > encounter.initialFormation.count) {
    throw new RangeError('encounter initial special counts must fit the formation');
  }
  for (const [index, phase] of encounter.phases.entries()) {
    positive(phase.formation.minimum, `encounter.phases.${index}.formation.minimum`);
    if (phase.formation.maximum < phase.formation.minimum) {
      throw new RangeError(`encounter.phases.${index}.formation must be ordered`);
    }
    if (phase.activeCap < phase.formation.maximum) {
      throw new RangeError(`encounter.phases.${index}.activeCap must fit one formation`);
    }
    positive(phase.spawnIntervalMs, `encounter.phases.${index}.spawnIntervalMs`);
    if (![phase.armored, phase.shooters].every(Number.isInteger)
      || phase.armored < 0 || phase.shooters < 0
      || phase.armored + phase.shooters > phase.formation.minimum) {
      throw new RangeError(`encounter.phases.${index} special counts must fit the minimum formation`);
    }
  }
  if (!(encounter.reinforcementOriginY < encounter.reinforcementReleaseY
    && encounter.reinforcementReleaseY < PLAYER_MIN_Y)) {
    throw new RangeError('encounter reinforcement heights must be ordered below PLAYER_MIN_Y');
  }
  const weakpointOffset = (boss.body.width + boss.weakpoint.visual.width) / 2
    - boss.weakpoint.edgeOverlap;
  const collisionWidth = 2 * (weakpointOffset + boss.weakpoint.hitbox.width / 2);
  if (collisionWidth >= GAME_WIDTH) throw new RangeError('boss collision width must fit GAME_WIDTH');
  if (boss.y - boss.body.height / 2 < 0 || boss.y + boss.body.height / 2 > GAME_HEIGHT) {
    throw new RangeError('boss body must fit GAME_HEIGHT');
  }
  positive(projectiles.hostileCap, 'projectiles.hostileCap');
  positive(projectiles.offscreenMargin, 'projectiles.offscreenMargin');
  for (const [name, projectile] of Object.entries({
    bossBasic: projectiles.bossBasic,
    bossAimed: projectiles.bossAimed,
    bossSupport: projectiles.bossSupport,
  })) {
    positive(projectile.warningMs, `projectiles.${name}.warningMs`);
    positive(projectile.speed, `projectiles.${name}.speed`);
    positive(projectile.damage, `projectiles.${name}.damage`);
  }
  positive(projectiles.bossBasic.intervalMs, 'projectiles.bossBasic.intervalMs');
  positive(projectiles.bossBasic.radius, 'projectiles.bossBasic.radius');
  positive(projectiles.bossAimed.radius, 'projectiles.bossAimed.radius');
  positive(projectiles.bossSupport.width, 'projectiles.bossSupport.width');
  positive(projectiles.bossSupport.height, 'projectiles.bossSupport.height');
  if (!projectiles.bossAimed.fanDegrees.every(Number.isFinite)) {
    throw new RangeError('projectiles.bossAimed.fanDegrees must be finite');
  }
  for (const [name, friendly] of Object.entries(visual.friendly)) {
    positive(friendly.width, `visual.friendly.${name}.width`);
    positive(friendly.height, `visual.friendly.${name}.height`);
  }
  const friendlyPairs = Object.values(visual.friendly).map(({ fill, accent }) => `${fill}:${accent}`);
  for (const [name, hostile] of Object.entries(visual.hostile)) {
    positive(hostile.width, `visual.hostile.${name}.width`);
    positive(hostile.height, `visual.hostile.${name}.height`);
    if (friendlyPairs.includes(`${hostile.fill}:${hostile.accent}`)) {
      throw new RangeError(`visual.hostile.${name} must differ from friendly projectiles`);
    }
  }
}
```

Call validation only in development builds:

```ts
if (import.meta.env.DEV) validateGameTuning(GAME_TUNING);
```

- [ ] **Step 4: Run focused tests and build**

Run: `npx vitest run src/game/config/gameTuning.test.ts && npm run build`

Expected: config tests PASS; TypeScript and Vite build PASS.

- [ ] **Step 5: Commit the tuning foundation**

```bash
git add src/game/config/gameTuning.ts src/game/config/gameTuning.test.ts
git commit -m "feat: centralize combat tuning"
```

---

### Task 2: Slow, tough, dense deterministic enemy ingress

**Files:**
- Modify: `src/game/encounters/formationRules.ts`
- Modify: `src/game/encounters/formationRules.test.ts`
- Modify: `src/game/encounters/encounterRules.ts`
- Modify: `src/game/encounters/encounterRules.test.ts`
- Modify: `src/game/encounters/encounterProgressionRules.ts`
- Modify: `src/game/encounters/encounterProgressionRules.test.ts`
- Modify: `src/game/encounters/EncounterDirector.ts`
- Modify: `src/game/encounters/EncounterDirector.test.ts`
- Modify: `src/game/enemies/EnemyManager.ts`
- Modify: `src/game/enemies/EnemyManager.test.ts`

**Interfaces:**
- Consumes: `GAME_TUNING.enemies` and `GAME_TUNING.encounter`.
- Preserves: `createInitialFormation(runSeed)`, `createReinforcementFormation(phase, sequence, runSeed)`, `threatConfigAt()`, and `EncounterDirector.update()` signatures.
- Extends: `EnemySnapshot` with `speed: number`, populated from the live Arcade body velocity for browser evidence.

- [ ] **Step 1: Change tests to the approved enemy values**

Add or update assertions so tests prove values come from tuning rather than copied literals:

```ts
const initial = createInitialFormation(0).enemies;
expect(initial).toHaveLength(GAME_TUNING.encounter.initialFormation.count);
expect(initial.every(({ speed }) => speed === GAME_TUNING.enemies.descentSpeed)).toBe(true);
expect(initial.every(({ kind, hp }) => hp === GAME_TUNING.enemies.hp[kind])).toBe(true);

for (const phase of [0, 1, 2] as const) {
  const counts = Array.from({ length: 64 }, (_, sequence) =>
    createReinforcementFormation(phase, sequence, 808).enemies.length);
  expect(Math.min(...counts)).toBe(GAME_TUNING.encounter.phases[phase].formation.minimum);
  expect(Math.max(...counts)).toBe(GAME_TUNING.encounter.phases[phase].formation.maximum);
}
```

In `EncounterDirector.test.ts`, prove all three gates and the new release height:

```ts
director.update(8000, { activeEnemies: 20, topmostEnemyY: 49 });
expect(director.getSnapshot().spawnSequence).toBe(0);
const released = director.update(0, { activeEnemies: 20, topmostEnemyY: 50 });
expect(released.formation).not.toBeNull();
expect(director.getSnapshot().spawnSequence).toBe(1);
```

Update `EnemyManager.test.ts` to expect initial sprites with `velocity.y === 8`, configured HP, and `getSnapshot().enemies[*].speed === 8`.

- [ ] **Step 2: Run the enemy/encounter tests and verify RED**

Run:

```bash
npx vitest run \
  src/game/encounters/formationRules.test.ts \
  src/game/encounters/encounterRules.test.ts \
  src/game/encounters/encounterProgressionRules.test.ts \
  src/game/encounters/EncounterDirector.test.ts \
  src/game/enemies/EnemyManager.test.ts
```

Expected: FAIL on old counts `20`, speed `18`, HP `1/1/3`, caps `32/40/48`, and release height `98`.

- [ ] **Step 3: Make formation generation consume tuning**

Remove `SPEED`, `SIZE_RANGES`, and `specialPressure` from `formationRules.ts`. Use:

```ts
const phaseTuning = GAME_TUNING.encounter.phases[phase];
const { minimum, maximum } = phaseTuning.formation;
const count = minimum + countSeed % (maximum - minimum + 1);

return enemies.map((enemy, index) => {
  const kind: EnemyKind = armoredIndices.has(index)
    ? 'armored'
    : shooterIndices.has(index) ? 'shooter' : 'basic';
  return { ...enemy, kind, hp: GAME_TUNING.enemies.hp[kind] };
});
```

Use `GAME_TUNING.encounter.initialFormation`, `GAME_TUNING.encounter.reinforcementOriginY`, the phase armored/shooter counts, and `GAME_TUNING.enemies.descentSpeed` in the appropriate initial and reinforcement paths. Preserve seed mixing, style bag order, coordinates, organic-shape guarantees, and IDs.

- [ ] **Step 4: Make encounter rules and director consume tuning**

Map phase config without changing public types:

```ts
export function threatConfigAt(elapsedMs: number, section = 0): ThreatConfig {
  const phase = threatPhaseForSection(section, elapsedMs);
  const tuning = GAME_TUNING.encounter.phases[phase];
  return { phase, activeCap: tuning.activeCap, spawnIntervalMs: tuning.spawnIntervalMs };
}
```

Replace progression constants with aliases sourced from tuning so existing imports remain compatible:

```ts
export const BOSS_PROGRESS_TARGET = GAME_TUNING.encounter.bossEntry.scoreTarget;
export const BOSS_ENTRY_MIN_MS = GAME_TUNING.encounter.bossEntry.minimumMs;
export const BOSS_ENTRY_HARD_MAX_MS = GAME_TUNING.encounter.bossEntry.hardMaximumMs;
export const BOSS_WARNING_MS = GAME_TUNING.encounter.bossEntry.warningMs;
```

In `EncounterDirector.update()`, replace both `PLAYER_MIN_Y` spawn checks with `GAME_TUNING.encounter.reinforcementReleaseY`. Do not change player movement limits.

- [ ] **Step 5: Move enemy shooter tuning and expose live speed**

Replace `SHOOTER_INTERVAL_MS`, `SHOOTER_WARNING_MS`, and `BULLET_SPEED` uses in `EnemyManager.ts` with `GAME_TUNING.enemies.shooter`. Keep contact separation and cleanup-only constants local. Add speed to snapshots:

```ts
export interface EnemySnapshot {
  // existing fields
  speed: number;
}

speed: (enemy.body as Phaser.Physics.Arcade.Body).velocity.y,
```

Use configured shooter damage in `onBulletHit()` instead of a copied `1`.

- [ ] **Step 6: Run focused and full unit tests**

Run the focused command from Step 2, then `npm test`.

Expected: all focused tests PASS; all unit tests PASS. Update tests that intentionally construct explicit `EnemySnapshot` fixtures by adding `speed`, not by weakening their assertions.

- [ ] **Step 7: Commit enemy density tuning**

```bash
git add src/game/encounters src/game/enemies
git commit -m "feat: slow and densify enemy ingress"
```

---

### Task 3: Derived boss geometry and slower movement

**Files:**
- Create: `src/game/bosses/bossGeometry.ts`
- Create: `src/game/bosses/bossGeometry.test.ts`
- Modify: `src/game/bosses/bossMovementRules.ts`
- Modify: `src/game/bosses/bossMovementRules.test.ts`
- Modify: `src/game/bosses/bossRules.ts`
- Modify: `src/game/bosses/bossRules.test.ts`
- Modify: `src/game/bosses/BossManager.ts`
- Modify: `src/game/bosses/BossManager.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`

**Interfaces:**
- Consumes: `GAME_TUNING.boss`.
- Produces: `BOSS_GEOMETRY` with body halves, weakpoint offset, total collision halves, and movement bounds.
- Preserves: `updateBossMotion()` signature and the BossManager public API.

- [ ] **Step 1: Write failing geometry, speed, and sprite tests**

Create `bossGeometry.test.ts`:

```ts
import { expect, it } from 'vitest';
import { BOSS_GEOMETRY } from './bossGeometry';

it('derives every boss extent from tuning', () => {
  expect(BOSS_GEOMETRY).toMatchObject({
    bodyHalfWidth: 84,
    bodyHalfHeight: 48,
    weakpointOffsetX: 88,
    collisionHalfWidth: 99,
    collisionHalfHeight: 48,
    movementBounds: { minimum: 99, maximum: 351 },
  });
});
```

Update movement tests to expect one second of free movement from `x=225` to `x=260`. Update `BossManager.test.ts` to expect body `168x96`, weakpoints `22x52`, weakpoint centers at `x=137/313` when boss center is `225`, and debug bounds `99..351`. Keep and update seam tests so the larger body cannot steal a weakpoint hit.

- [ ] **Step 2: Run boss tests and verify RED**

Run:

```bash
npx vitest run \
  src/game/bosses/bossGeometry.test.ts \
  src/game/bosses/bossMovementRules.test.ts \
  src/game/bosses/bossRules.test.ts \
  src/game/bosses/BossManager.test.ts
```

Expected: FAIL because geometry is absent and runtime still uses `120x72`, offset `64`, bounds `60..390`, and speed `55`.

- [ ] **Step 3: Add the pure derived geometry module**

Create `bossGeometry.ts`:

```ts
import { GAME_WIDTH } from '../constants';
import { GAME_TUNING } from '../config/gameTuning';

const { body, weakpoint } = GAME_TUNING.boss;
const bodyHalfWidth = body.width / 2;
const bodyHalfHeight = body.height / 2;
const weakpointOffsetX = (body.width + weakpoint.visual.width) / 2 - weakpoint.edgeOverlap;
const collisionHalfWidth = weakpointOffsetX + weakpoint.hitbox.width / 2;
const collisionHalfHeight = Math.max(bodyHalfHeight, weakpoint.hitbox.height / 2);

export const BOSS_GEOMETRY = {
  bodyHalfWidth,
  bodyHalfHeight,
  weakpointOffsetX,
  collisionHalfWidth,
  collisionHalfHeight,
  movementBounds: { minimum: collisionHalfWidth, maximum: GAME_WIDTH - collisionHalfWidth },
} as const;
```

- [ ] **Step 4: Migrate pure boss rules and movement to tuning**

Use configured HP in `createBossState()` and configured phase intervals in `nextBossAttack()`. In `bossMovementRules.ts`, replace default bounds and both speed constants with `BOSS_GEOMETRY.movementBounds`, `GAME_TUNING.boss.movement.maxSpeed`, and `.minimumTurnSpeed`.

Do not change pattern order, core attack-index reset, damage rules, or boundary deceleration semantics.

- [ ] **Step 5: Migrate BossManager physics and obstacle geometry**

Remove `BOSS_Y`, body halves, weakpoint offset, weakpoint hitbox, enemy half-size, and obstacle padding duplicates. Configure sprites from tuning and `BOSS_GEOMETRY`:

```ts
this.body.setSize(GAME_TUNING.boss.body.width, GAME_TUNING.boss.body.height);
this.partSprites.leftWeakpoint.setSize(
  GAME_TUNING.boss.weakpoint.hitbox.width,
  GAME_TUNING.boss.weakpoint.hitbox.height,
);
```

Use `BOSS_GEOMETRY.collisionHalfWidth + enemyHalfSize + obstaclePadding` for horizontal obstacle margins, and the total collision height for the vertical obstacle band. Validate `debugSetPosition` against `BOSS_GEOMETRY.movementBounds`. Position weakpoints with `BOSS_GEOMETRY.weakpointOffsetX`.

- [ ] **Step 6: Make prototype boss textures use the same geometry source**

In `CombatScene.createTextures()`, replace body and weakpoint dimensions with `GAME_TUNING.boss.body` and `.weakpoint.visual`. Derive rounded-rectangle stroke bounds from width/height instead of copying `164`, `92`, `16`, or `46` literals. Keep core size from tuning and existing colors until Task 4.

- [ ] **Step 7: Run focused tests, full unit tests, and build**

Run the focused command from Step 2, then:

```bash
npm test
npm run build
```

Expected: all tests and build PASS. Existing large-chunk advisory is allowed; new TypeScript or runtime warnings are not.

- [ ] **Step 8: Commit boss geometry tuning**

```bash
git add src/game/bosses src/game/scenes/CombatScene.ts
git commit -m "feat: enlarge and slow first midboss"
```

---

### Task 4: Distinct friendly and hostile projectile visuals

**Files:**
- Modify: `src/game/config/gameTuning.test.ts`
- Create: `src/game/scenes/combatTextureRules.ts`
- Create: `src/game/scenes/combatTextureRules.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`

**Interfaces:**
- Consumes: `GAME_TUNING.visual` and projectile dimensions.
- Produces: `combatProjectileTextureDescriptors()` and texture keys `orb-charged`, `orb-temporary`, `enemy-bullet`, `boss-basic-bullet`, `boss-aimed-bullet`, `boss-falling-hazard`, and `boss-muzzle-flash`.
- Task 5 consumes `boss-basic-bullet` and `boss-muzzle-flash`.

- [ ] **Step 1: Add failing palette separation tests**

Extend `gameTuning.test.ts`:

```ts
it('uses shape and palette separation for friendly and hostile projectiles', () => {
  const { friendly, hostile } = GAME_TUNING.visual;
  expect(friendly.temporaryOrb).toEqual({
    fill: 0x8cf7ff, accent: 0x167d9a, width: 12, height: 12,
  });
  expect(hostile.enemyBullet).toEqual({
    fill: 0xff4d5a, accent: 0x4a0710, width: 10, height: 10,
  });
  expect(hostile.enemyBullet.fill).not.toBe(friendly.temporaryOrb.fill);
  expect(hostile.enemyBullet.accent).not.toBe(friendly.temporaryOrb.accent);
  expect(hostile.bossHazard.height).toBeGreaterThan(hostile.bossHazard.width);
});
```

Create `combatTextureRules.test.ts` with a failing import and exact shape assertions:

```ts
import { expect, it } from 'vitest';
import { combatProjectileTextureDescriptors } from './combatTextureRules';

it('maps tuning to distinct friendly and hostile texture descriptors', () => {
  const textures = combatProjectileTextureDescriptors();
  expect(textures['orb-temporary']).toMatchObject({
    shape: 'outlinedCircle', fill: 0x8cf7ff, accent: 0x167d9a,
  });
  expect(textures['enemy-bullet']).toMatchObject({
    shape: 'centeredCircle', fill: 0xff4d5a, accent: 0x4a0710,
  });
  expect(textures['boss-falling-hazard']).toMatchObject({
    shape: 'outlinedRoundedRect', width: 16, height: 24,
  });
  expect(textures['boss-muzzle-flash']).toMatchObject({ shape: 'flash' });
});
```

- [ ] **Step 2: Run the descriptor test and verify RED**

Run: `npx vitest run src/game/scenes/combatTextureRules.test.ts`

Expected: FAIL because `combatTextureRules.ts` does not exist.

- [ ] **Step 3: Implement typed texture descriptors**

Create `combatTextureRules.ts` with a discriminated union and no copied color/size values:

```ts
import { GAME_TUNING, type ProjectileVisualTuning } from '../config/gameTuning';

type TextureShape = 'outlinedCircle' | 'centeredCircle' | 'outlinedRoundedRect' | 'flash';
export type CombatTextureDescriptor = ProjectileVisualTuning & { shape: TextureShape };

export function combatProjectileTextureDescriptors(): Record<string, CombatTextureDescriptor> {
  const { friendly, hostile } = GAME_TUNING.visual;
  return {
    'orb-charged': { ...friendly.permanentOrb, shape: 'outlinedCircle' },
    'orb-temporary': { ...friendly.temporaryOrb, shape: 'outlinedCircle' },
    'enemy-bullet': { ...hostile.enemyBullet, shape: 'centeredCircle' },
    'boss-basic-bullet': { ...hostile.bossBasic, shape: 'centeredCircle' },
    'boss-aimed-bullet': { ...hostile.bossAimed, shape: 'centeredCircle' },
    'boss-falling-hazard': { ...hostile.bossHazard, shape: 'outlinedRoundedRect' },
    'boss-muzzle-flash': { ...hostile.bossMuzzleFlash, shape: 'flash' },
  };
}
```

Run: `npx vitest run src/game/config/gameTuning.test.ts src/game/scenes/combatTextureRules.test.ts`

Expected: both files PASS.

- [ ] **Step 4: Generate every projectile texture from descriptors**

In `CombatScene.createTextures()`, iterate `combatProjectileTextureDescriptors()` and draw each discriminated shape. Use centered circles for enemy, basic-boss, and aimed-boss bullets; outlined circles for permanent/temporary orbs; and the vertical rounded rectangle for the hazard.

Create `boss-muzzle-flash` as a compact star/cross centered in a `20x20` transparent texture using the hostile boss-basic fill and a pale highlight. Do not reuse the temporary-orb texture for any hostile object.

- [ ] **Step 5: Build and manually inspect a development screenshot**

Run: `npm run build`

Then run the existing development server and use the browser acceptance flow to capture `output/playwright/projectile-contrast.png` with temporary orbs and at least one hostile projectile visible. This file is evidence only and must not be committed.

Expected: build PASS; hostile bullets are red/orange with a dark center, temporary orbs are cyan/teal, and the hazard has a distinct vertical silhouette.

- [ ] **Step 6: Commit projectile visual separation**

```bash
git add src/game/config/gameTuning.test.ts src/game/scenes/combatTextureRules.ts src/game/scenes/combatTextureRules.test.ts src/game/scenes/CombatScene.ts
git commit -m "feat: distinguish hostile projectiles"
```

---

### Task 5: Frequent basic shot between major boss patterns

**Files:**
- Modify: `src/game/bosses/BossManager.ts`
- Modify: `src/game/bosses/BossManager.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`

**Interfaces:**
- Consumes: `GAME_TUNING.projectiles.bossBasic`, `.bossAimed`, `.bossSupport`, and `.hostileCap`.
- Extends: internal `Warning` with `{ kind: 'basicShot'; dueAt: number; marker: BossSprite }`.
- Extends: `BossManagerSnapshot` with `basicBullets: number` and `projectiles: BossProjectileSnapshot[]` where each projectile includes kind, position, and velocity.
- Preserves: total `getBulletCount()` contract used by `EnemyManager` and the boss/enemy shared cap.

- [ ] **Step 1: Write failing scheduler and cleanup tests**

Add focused `BossManager.test.ts` cases using its fake gameplay clock:

```ts
it('flashes at 750ms and fires one aimed basic bullet at 900ms', () => {
  const boundary = createBoundary();
  boundary.gameplay.now = 749;
  boundary.manager.update();
  expect(boundary.manager.getSnapshot()).toMatchObject({ warnings: 0, basicBullets: 0 });

  boundary.gameplay.now = 750;
  boundary.manager.update();
  expect(boundary.manager.getSnapshot().warnings).toBe(1);

  boundary.player.setPosition(300, 600);
  boundary.gameplay.now = 900;
  boundary.manager.update();
  const [shot] = boundary.manager.getSnapshot().projectiles;
  expect(shot.kind).toBe('basic');
  expect(Math.hypot(shot.velocity.x, shot.velocity.y)).toBeCloseTo(150);
});
```

Add exact timeline tests. Reuse a helper that assigns `gameplay.now`, calls `update()`, and returns the snapshot:

```ts
function updateAt(boundary: ReturnType<typeof createBoundary>, now: number) {
  boundary.gameplay.now = now;
  boundary.manager.update();
  return boundary.manager.getSnapshot();
}

it('fires the second basic shot at 1800ms without early catch-up', () => {
  const boundary = createBoundary();
  updateAt(boundary, 900);
  expect(updateAt(boundary, 1799).basicBullets).toBe(1);
  expect(updateAt(boundary, 1800).basicBullets).toBe(2);
});

it('cancels a late pending basic flash when a major warning starts', () => {
  const boundary = createBoundary();
  updateAt(boundary, 900);
  updateAt(boundary, 1800);
  updateAt(boundary, 2600);
  expect(boundary.manager.getSnapshot().warnings).toBe(1);
  const major = updateAt(boundary, 2800);
  expect(major.basicBullets).toBe(2);
  expect(major.warnings).toBe(1);
});

it('waits a full basic interval after the major action resolves', () => {
  const boundary = createBoundary();
  updateAt(boundary, 2800);
  updateAt(boundary, 3400);
  expect(updateAt(boundary, 4149).warnings).toBe(0);
  expect(updateAt(boundary, 4150).warnings).toBe(1);
  expect(updateAt(boundary, 4299).basicBullets).toBe(0);
  expect(updateAt(boundary, 4300).basicBullets).toBe(1);
});

it('skips a capped shot and never releases it as a burst', () => {
  const boundary = createBoundary();
  boundary.setExternalBullets(12);
  expect(updateAt(boundary, 900).basicBullets).toBe(0);
  boundary.setExternalBullets(0);
  expect(updateAt(boundary, 901).basicBullets).toBe(0);
  expect(updateAt(boundary, 1800).basicBullets).toBe(1);
});

it('clears basic bullets, muzzle flashes, and reservations', () => {
  const boundary = createBoundary();
  updateAt(boundary, 900);
  updateAt(boundary, 1650);
  boundary.manager.clearHostileActions();
  expect(boundary.manager.getSnapshot()).toMatchObject({
    basicBullets: 0, aimedBullets: 0, warnings: 0, projectiles: [],
  });
});
```

Keep the existing defeat/destroy cleanup tests and extend their expected snapshots with the new fields. For pause coverage, call `update()` repeatedly without changing `gameplay.now` and assert the snapshot is unchanged.

- [ ] **Step 2: Run BossManager tests and verify RED**

Run: `npx vitest run src/game/bosses/BossManager.test.ts`

Expected: FAIL because the snapshot lacks basic bullets/projectiles and no basic scheduler exists.

- [ ] **Step 3: Tag boss projectiles and expose deterministic snapshots**

Define:

```ts
type BossProjectileKind = 'basic' | 'aimed';
type BossProjectileSprite = BossSprite & { bossProjectileKind: BossProjectileKind };

export interface BossProjectileSnapshot {
  kind: BossProjectileKind;
  position: Vector;
  velocity: Vector;
}
```

Set the kind when creating basic or aimed bullets. Build `projectiles` from active children and derive `basicBullets`/`aimedBullets` by kind. Keep `getBulletCount()` as the total active children count.

- [ ] **Step 4: Implement one non-accumulating basic-shot clock**

Add `nextBasicShotAt`, initialized to `now + intervalMs`. Extend `Warning` with `basicShot`. Add helpers with these exact responsibilities:

```ts
private scheduleBasicAttack(now: number): void;
private beginBasicWarning(dueAt: number): void;
private cancelPendingBasicAttack(): void;
private deferBasicUntil(lastMajorDueAt: number): void;
private fireBasicShot(now: number): void;
private hasMajorWarnings(): boolean;
```

Call major scheduling before basic scheduling. When a major pattern starts, cancel the pending basic warning and compute the maximum due time among the created major warnings. Set `nextBasicShotAt = lastMajorDueAt + intervalMs`.

`scheduleBasicAttack()` starts one muzzle flash when `now >= nextBasicShotAt - warningMs`, only if there is no basic warning, no major warning, and the basic due time precedes the next major start. `resolveWarnings()` fires a basic shot at its due time, samples the player's position then, and sets `nextBasicShotAt = now + intervalMs` so a delayed frame cannot create catch-up shots.

The new shot uses the live boss center, normalized player direction, `boss-basic-bullet`, configured radius/speed, boss action depth, and the existing aimed-bullet group. If the shared cap is full, destroy the marker and set the same next interval without creating a bullet.

Use this scheduling shape inside `BossManager`; adapt only field names needed by the existing class:

```ts
private nextBasicShotAt: number;

private scheduleBasicAttack(now: number): void {
  const tuning = GAME_TUNING.projectiles.bossBasic;
  const basicPending = this.warnings.some(({ kind }) => kind === 'basicShot');
  if (basicPending || this.hasMajorWarnings() || this.nextBasicShotAt >= this.nextAttackAt) return;
  if (now >= this.nextBasicShotAt - tuning.warningMs) {
    this.beginBasicWarning(this.nextBasicShotAt);
  }
}

private beginBasicWarning(dueAt: number): void {
  const marker = this.warningGroup.create(
    this.motion.x,
    GAME_TUNING.boss.y,
    'boss-muzzle-flash',
  ) as BossSprite;
  marker.setDepth(BOSS_ACTION_DEPTH);
  this.warnings.push({ kind: 'basicShot', dueAt, marker });
}

private cancelPendingBasicAttack(): void {
  this.warnings = this.warnings.filter((warning) => {
    if (warning.kind !== 'basicShot') return true;
    warning.marker.destroy();
    return false;
  });
}

private deferBasicUntil(lastMajorDueAt: number): void {
  this.cancelPendingBasicAttack();
  this.nextBasicShotAt = lastMajorDueAt + GAME_TUNING.projectiles.bossBasic.intervalMs;
}

private hasMajorWarnings(): boolean {
  return this.warnings.some(({ kind }) => kind !== 'basicShot');
}

private fireBasicShot(now: number): void {
  const tuning = GAME_TUNING.projectiles.bossBasic;
  this.nextBasicShotAt = now + tuning.intervalMs;
  if (this.options.getEnemyBulletCount() + this.getBulletCount()
    >= GAME_TUNING.projectiles.hostileCap) return;
  const origin = { x: this.motion.x, y: GAME_TUNING.boss.y };
  const direction = normalize({
    x: this.options.player.x - origin.x,
    y: this.options.player.y - origin.y,
  });
  const bullet = this.aimedBulletGroup.create(
    origin.x, origin.y, 'boss-basic-bullet',
  ) as BossProjectileSprite;
  bullet.bossProjectileKind = 'basic';
  bullet.setCircle(tuning.radius).setDepth(BOSS_ACTION_DEPTH).setVelocity(
    direction.x * tuning.speed,
    direction.y * tuning.speed,
  );
}
```

Make `beginAimedWarning()` and `beginSupportWarnings()` return their due time. In `scheduleAttacks()`, take the maximum returned due time for that major attack, then call `deferBasicUntil(lastMajorDueAt)`. In `resolveWarnings(now)`, dispatch `basicShot` to `fireBasicShot(now)` and preserve the stored-target behavior of existing aimed warnings.

- [ ] **Step 5: Migrate existing boss projectile constants to tuning**

Replace aimed warning, support warning, aimed speed, hazard speed, hostile cap, and offscreen margin constants in `BossManager.ts`. Use configured fan angles and projectile radii. Use configured basic/aimed/support damage in collision handling; if basic and aimed share a group, read damage from the projectile kind rather than a hardcoded callback value.

During `positionBossSprites()`, move any active basic muzzle marker to the live boss center so the `150ms` flash follows the slower moving boss.

- [ ] **Step 6: Keep the empty scene snapshot type-correct**

Update the fallback boss object in `CombatScene.getDebugSnapshot()`:

```ts
boss: this.bossManager?.getSnapshot() ?? {
  active: false,
  phase: null,
  position: null,
  parts: null,
  basicBullets: 0,
  aimedBullets: 0,
  fallingHazards: 0,
  warnings: 0,
  projectiles: [],
},
```

- [ ] **Step 7: Run focused tests, full units, and build**

Run:

```bash
npx vitest run src/game/bosses/BossManager.test.ts
npm test
npm run build
```

Expected: all commands PASS; no attack catch-up or cleanup regression.

- [ ] **Step 8: Commit basic boss attack**

```bash
git add src/game/bosses/BossManager.ts src/game/bosses/BossManager.test.ts src/game/scenes/CombatScene.ts
git commit -m "feat: add midboss basic shots"
```

---

### Task 6: Browser acceptance and playtest handoff

**Files:**
- Modify: `e2e/combat.spec.ts`
- Modify: `docs/playtest/2026-07-16-midboss-playtest.md`
- Modify: `.superpowers/sdd/progress.md`

**Interfaces:**
- Consumes: `EnemySnapshot.speed`, `BossManagerSnapshot.basicBullets`, and `.projectiles` from earlier tasks.
- Produces: durable acceptance evidence for the new tuning and an updated manual checklist.

- [ ] **Step 1: Update E2E snapshot types and initial-count expectations**

Add `speed` to the E2E enemy type. Add `basicBullets` and typed projectile snapshots to the boss type. Change `loadCanvas()` from `20` to `GAME_TUNING`'s shipped count represented in the acceptance contract (`26`); E2E must not import source modules into browser code.

- [ ] **Step 2: Add a deterministic enemy-density acceptance test**

Create a desktop test that asserts:

```ts
const initial = await snapshot(page);
expect(initial.enemies).toHaveLength(26);
expect(initial.enemies.every(({ speed }) => speed === 8)).toBe(true);
expect(initial.enemies.every(({ kind, hp }) => (
  kind === 'armored' ? hp === 5 : hp === 2
))).toBe(true);
```

Use existing DEV enemy positioning and `debugAdvanceEncounter()` to prove `topmostEnemyY=49` blocks a due formation, `50` releases it, the added formation has `13~15` members in phase 0, and total active enemies are greater than the old initial count while remaining at or below `48`.

- [ ] **Step 3: Add boss size, movement, and basic-shot acceptance**

Enter the boss with existing deterministic helpers. Assert movement over sampled snapshots is consistent with `35px/s` and existing obstacle constraints. Use the boss projectile snapshot with `expect.poll()` to observe at least two `basic` shots before the first test-forced major cycle.

For one basic shot, compare its normalized velocity to the vector from the boss origin to the player's position sampled immediately before actual fire, allowing a small numeric tolerance. Place the player on the bullet path, record health, and assert exactly `1` damage with the existing invulnerability semantics.

Advance or wait through a major warning and assert `basicBullets` does not increase from new firing while the warning remains. After the major action resolves, assert no new basic shot before `900ms` and one appears after the reset interval. Use condition polling, not fixed sleeps as the pass condition.

- [ ] **Step 4: Preserve and update all existing acceptance tests**

Run focused tests first:

```bash
npx playwright test e2e/combat.spec.ts --project=desktop-chromium \
  --grep "density|midboss basic|midboss movement|midboss reward"
```

Expected: new focused tests PASS. If existing tests depended on exactly 20 enemies, update only their setup assumptions; do not weaken collision, level-up, split, boss reward, mobile, or restart assertions.

- [ ] **Step 5: Update manual evidence and clear stale progress state**

Append these unchecked items to `docs/playtest/2026-07-16-midboss-playtest.md`:

```md
- [ ] `900ms` 기본탄이 자주 느껴지지만 큰 패턴과 겹쳐 억울하지 않은가.
- [ ] `150ms` 총구 점멸만으로 기본탄 발사를 읽을 수 있는가.
- [ ] 붉고 어두운 적대 탄환과 청록색 임시 구슬을 즉시 구분할 수 있는가.
- [ ] `168x96`, `35px/s` 보스가 묵직하지만 지나치게 쉬워지지 않는가.
- [ ] `8px/s`, HP `2/2/5` 적 무리가 정체되지 않고 연쇄 처치 감각을 유지하는가.
- [ ] 최대 적 `48/60/72`에서 모바일 성능과 판독성이 유지되는가.
- [ ] 보스가 주로 `120~210초` 사이에 진입하는가.
```

Record fresh focused/full counts. Update `.superpowers/sdd/progress.md` so the previous midboss Task 6 and final verification are no longer incorrectly marked pending, then add this tuning slice's task/verification status without rewriting historical commit hashes.

- [ ] **Step 6: Run fresh full verification**

Run:

```bash
npm test
npm run test:e2e
npm run build
git diff --check
git status --short
```

Expected: unit tests PASS, every desktop/mobile browser test PASS, build PASS, diff check PASS, and only intended Task 6 files remain uncommitted. The existing Vite chunk-size advisory is acceptable.

- [ ] **Step 7: Commit acceptance and handoff docs**

```bash
git add e2e/combat.spec.ts docs/playtest/2026-07-16-midboss-playtest.md .superpowers/sdd/progress.md
git commit -m "test: verify combat density tuning"
```

---

## Final Review Gate

- [ ] Request a whole-diff review from the commit before Task 1 through Task 6 HEAD. Resolve every Critical and Important finding with focused regression evidence.
- [ ] Re-run `npm test`, `npm run test:e2e`, `npm run build`, `git diff --check`, and `git status --short` after the final fix.
- [ ] Confirm the manual playtest items remain unchecked until a human plays the tuned build.
- [ ] Use `superpowers:finishing-a-development-branch` to choose merge, PR, keep, or discard. Do not merge or push before that choice.
