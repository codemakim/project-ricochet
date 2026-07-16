# First Midboss Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one performance-paced midboss, boss reward choice, and stronger post-boss continuous section without a scene transition.

**Architecture:** `EncounterDirector` owns encounter state and timing; pure boss rule modules own movement, parts, and pattern schedules; `BossManager` adapts those rules to Phaser. A separate `BossBuild` owns relics and exposes narrow modifiers to orb systems. `CombatScene` only connects transitions, pause, managers, UI, and debug contracts.

**Tech Stack:** TypeScript 5.9, Phaser 3.90, Vitest 4, Playwright 1.61

## Global Constraints

- Boss entry uses kill score: basic `1`, armored/shooter `2`; target `70`, minimum `120000ms`, hard maximum `210000ms`.
- Warning lasts `2000ms`; normal reinforcement stops and pending formation is discarded immediately.
- Existing enemies and bullets stay through entry. Boss death clears every hostile bullet, falling hazard, and warning.
- First slice spawns one boss only. Post-boss section starts at threat phase 1, reaches phase 2 after 60 seconds, and has no second boss.
- Boss has two `14 HP` weakpoints then a `36 HP` core. Body reflects without damage.
- Body reflection does not consume orb charge, opening-hit bonus, or direct-hit cooldown.
- Pattern intervals are `2800/2300/1900ms`; aimed shot warns `600ms`, support drop warns `800ms`.
- Aimed bullets deal `1`; falling hits deal `2`; existing `600ms` player invulnerability remains authoritative.
- Four relics: `expanded-magazine`, `recovery-capacitor`, `opening-amplifier`, `chain-warhead`. Show three unique valid choices.
- Temporary orbs do not inherit explosion without `chain-warhead`.
- No second boss, final boss, meta progression, new dependency, asset pipeline, or save system.

---

### Task 1: Encounter state, kill score, and post-boss section

**Files:**
- Create: `src/game/encounters/encounterProgressionRules.ts`
- Create: `src/game/encounters/encounterProgressionRules.test.ts`
- Modify: `src/game/encounters/EncounterDirector.ts`
- Modify: `src/game/encounters/EncounterDirector.test.ts`
- Modify: `src/game/encounters/encounterRules.ts`
- Modify: `src/game/encounters/encounterRules.test.ts`

**Interfaces:**

```ts
export type EncounterState = 'running' | 'bossWarning' | 'boss' | 'bossRewardPaused';
export type EncounterTransition = 'bossWarningStarted' | 'bossStarted';
export interface EncounterUpdate {
  formation: EnemySpec[] | null;
  transition: EncounterTransition | null;
}
export function bossProgressForKill(kind: EnemyKind): number;
export function bossEntryReady(elapsedMs: number, score: number): boolean;
export function threatPhaseForSection(section: number, elapsedMs: number): ThreatPhase;
```

`EncounterDirector` adds `recordEnemyKill(kind)`, `markBossDefeated()`, and `resumeAfterBossReward()`. Snapshot adds `state`, `section`, `sectionElapsedMs`, `bossScore`, `warningElapsedMs`, and `bossesDefeated`.

- [ ] Write failing pure tests for exact scores, target/minimum, hard maximum, and section phase mapping: section 0 uses `0/1/2` at `0/60/120s`; section 1 uses `1/2` at `0/60s`.
- [ ] Write failing director tests: score before 120s does not warn; 70 points at 120s returns `bossWarningStarted`; 210s warns without score; warning discards cached formation and emits no more formations; 2000ms later returns `bossStarted`; boss defeat/reward resumes section 1 with reset clocks; section 1 never warns again.
- [ ] Run `npm test -- src/game/encounters/encounterProgressionRules.test.ts src/game/encounters/EncounterDirector.test.ts src/game/encounters/encounterRules.test.ts` and confirm RED on missing APIs.
- [ ] Implement constants and pure rules. Refactor `EncounterDirector.update()` to return `EncounterUpdate`; preserve cheap formation gates and pending cache while `state === 'running'`. On warning, set pending to null before returning. Consume at most one state transition per update even when a large delta crosses both entry and warning thresholds. Validate illegal state transitions with clear errors.
- [ ] Run focused tests, then `npm test`; expect PASS.
- [ ] Commit: `feat: add midboss encounter progression`.

---

### Task 2: Pure boss parts, movement, and attack schedule

**Files:**
- Create: `src/game/bosses/bossRules.ts`
- Create: `src/game/bosses/bossRules.test.ts`
- Create: `src/game/bosses/bossMovementRules.ts`
- Create: `src/game/bosses/bossMovementRules.test.ts`

**Interfaces:**

```ts
export type BossPartId = 'leftWeakpoint' | 'rightWeakpoint' | 'core';
export type BossPhase = 'twoWeakpoints' | 'oneWeakpoint' | 'core' | 'defeated';
export type BossPattern = 'aimedShot' | 'supportDrop';
export interface BossState { leftWeakpointHp: number; rightWeakpointHp: number; coreHp: number; attackIndex: number; }
export function createBossState(): BossState;
export function damageBossPart(state: BossState, part: BossPartId, damage: number): BossState;
export function bossPhase(state: BossState): BossPhase;
export function exposedBossParts(state: BossState): BossPartId[];
export function nextBossAttack(state: BossState): { patterns: BossPattern[]; intervalMs: number; state: BossState };

export interface HorizontalInterval { minimum: number; maximum: number; }
export interface BossMotion { x: number; direction: -1 | 0 | 1; }
export function updateBossMotion(
  current: BossMotion,
  deltaMs: number,
  obstacles: readonly HorizontalInterval[],
  bounds?: HorizontalInterval,
): BossMotion;
```

- [ ] Write failing tests for `14/14/36` HP, hidden core rejection, one-part area damage selection, phase changes, `2800/2300/1900ms` intervals, alternating patterns, and every third core attack returning both patterns.
- [ ] Write failing movement tests for free full-width motion at `55px/s`, padded obstacle clipping, reversal before overlap, stop when both sides block, and range expansion after obstacle removal. Use boss half-width `60` and obstacle padding `12`.
- [ ] Run focused tests and confirm RED.
- [ ] Implement immutable boss state rules and deterministic interval subtraction. No Phaser imports in these files.
- [ ] Run focused tests and full unit suite; expect PASS.
- [ ] Commit: `feat: add deterministic midboss rules`.

---

### Task 3: Phaser BossManager and hostile patterns

**Files:**
- Create: `src/game/bosses/BossManager.ts`
- Create: `src/game/bosses/BossManager.test.ts`
- Modify: `src/game/enemies/EnemyManager.ts`
- Modify: `src/game/enemies/EnemyManager.test.ts`

**Interfaces:**

```ts
export interface BossManagerOptions {
  player: Phaser.Physics.Arcade.Sprite;
  orbManager: OrbManager;
  temporaryOrbManager: TemporaryOrbManager;
  getEnemies(): readonly EnemySnapshot[];
  getEnemyBulletCount(): number;
  getGameplayElapsedMs(): number;
  onPlayerHit(damage: number): void;
  onDirectHit(event: BossDirectHitEvent): void;
  onDefeated(): void;
}
export interface BossManagerSnapshot {
  active: boolean;
  phase: BossPhase | null;
  position: Vector | null;
  parts: Record<BossPartId, number> | null;
  aimedBullets: number;
  fallingHazards: number;
  warnings: number;
}
```

`BossDirectHitEvent` includes `partId`, `source`, `position`, `charged`, and `direction`. `applyAreaDamage(center, radius, damage, excludedPartId?)` may damage only the nearest exposed part not equal to the direct-hit part.

`EnemyManager` adds `getBulletCount()` and `clearBullets()`, plus optional `getExternalBulletCount()` so normal shooters and boss bullets share the cap of 12.

- [ ] Build failing manager tests with existing fake Phaser patterns. Cover spawn/teardown, body reflection without damage or charge/bonus consumption, weakpoint priority, hidden core, one-hit-per-frame, permanent/temporary damage, movement obstacle snapshots, bullet-cap sharing, `600/800ms` telegraphs, aimed three-shot, vertical two-drop, player damage `1/2`, and `clearHostileActions()`.
- [ ] Run focused tests and confirm RED.
- [ ] Implement boss sprites and colliders. Keep weakpoints outside the solid body overlap; disable body collision and enable the core target when both weakpoints die. Use negative numeric hit IDs only inside orb cooldown maps so they cannot collide with normal enemy IDs.
- [ ] Implement pattern timers from gameplay delta, not wall time. Boss bullets use a private group but consult total external count before spawning. Support drops choose two deterministic x positions from attack index and player x; markers remain visible for 800ms. Map only enemies vertically overlapping the boss movement band into forbidden boss-center intervals using boss half-width `60`, enemy half-width `22`, and padding `12`.
- [ ] Add `applyAreaDamage(center, radius, damage, excludedPartId?)` that damages at most the nearest eligible exposed part once.
- [ ] Run focused tests, `npm test`, and `npm run build`; expect PASS.
- [ ] Commit: `feat: add first midboss combat`.

---

### Task 4: Boss relic state and orb modifiers

**Files:**
- Create: `src/game/progression/BossBuild.ts`
- Create: `src/game/progression/BossBuild.test.ts`
- Create: `src/game/progression/bossRewardRules.ts`
- Create: `src/game/progression/bossRewardRules.test.ts`
- Modify: `src/game/orbs/OrbManager.ts`
- Modify: `src/game/orbs/OrbManager.test.ts`

**Interfaces:**

```ts
export const BOSS_REWARD_IDS = ['expanded-magazine','recovery-capacitor','opening-amplifier','chain-warhead'] as const;
export type BossRewardId = typeof BOSS_REWARD_IDS[number];
export function selectBossRewardOptions(
  owned: ReadonlySet<BossRewardId>,
  ranks: Readonly<AbilityRanks>,
  seed: number,
): BossRewardId[];

export class BossBuild {
  acquire(id: BossRewardId): void;
  owns(id: BossRewardId): boolean;
  orbLimit(): number;
  restoredCharges(source: RecoverySource): number;
  openingHitBonus(source: RecoverySource, firstHitPending: boolean): number;
  temporaryExplosionEnabled(): boolean;
  snapshot(): BossRewardId[];
}
```

`OrbManagerOptions` adds `getRestoredCharges(source)` and `getOpeningHitBonus(source, firstHitPending)`. Defaults preserve 3 restored charges and zero opening bonus when no boss build is supplied.

- [ ] Write failing reward tests: three unique choices; universal three always valid; `chain-warhead` requires split and explosion rank 1; owned rewards excluded; same seed deterministic.
- [ ] Write failing modifier tests: magazine limit 4, proximity charges 5 while floor/timeout remain 3, opening hit `+1` once per proximity recovery, chain-warhead flag false/true, duplicate acquisition rejected.
- [ ] Write failing OrbManager tests for runtime `addOrb()` up to 6, queued launch of the new orb, source-dependent restored charges, and one-time opening bonus consumed by the first boss or enemy hit.
- [ ] Implement `BossBuild`, reward selection, `OrbStore.addOrb()`, `OrbManager.addOrb()`, source-aware charge restoration, and first-hit bonus callbacks. Preserve current three-orb constructor default.
- [ ] Run focused tests, full unit suite, and build; expect PASS.
- [ ] Commit: `feat: add midboss relic modifiers`.

---

### Task 5: Reward overlay and CombatScene vertical flow

**Files:**
- Create: `src/game/ui/BossRewardOverlay.ts`
- Create: `src/game/ui/BossRewardOverlay.test.ts`
- Modify: `src/game/combat/CombatPauseController.ts`
- Modify: `src/game/combat/CombatPauseController.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `e2e/combat.spec.ts` debug snapshot typings only

**Runtime contract:**

- Add pause reason `bossReward`.
- Scene constructs `BossBuild` and reward overlay each run.
- Enemy kills call both XP gain and `EncounterDirector.recordEnemyKill`.
- `bossWarningStarted` shows a non-interactive warning; `bossStarted` creates `BossManager`.
- Boss defeat clears normal bullets and boss actions, pauses, and opens three reward cards.
- Reward selection acquires once, applies magazine immediately with `orbManager.addOrb()`, resumes section 1, and hides overlay.
- Temporary direct hits trigger explosion only when `BossBuild.temporaryExplosionEnabled()`; permanent hits keep existing explosion behavior.
- Any allowed explosion applies once to normal enemies and at most one boss part. A boss-part direct hit excludes that part from its own area damage.
- Debug snapshot adds boss state, owned rewards, reward choices/visibility, and encounter state. DEV hooks add deterministic score/time advance and boss-part damage for E2E; production paths remain inaccessible.

- [ ] Write failing overlay tests for three cards, keyboard/touch selection once, Korean labels/effects, and cleanup.
- [ ] Extend pause tests for `bossReward` composition with visibility/level-up.
- [ ] Integrate scene flow and generated prototype textures for body, weakpoints, core, aimed bullet, drop, and marker. No external assets.
- [ ] Ensure shutdown/defeat destroys boss objects, warning, overlay, and resets `BossBuild`; gameplay pointers stay disabled during both selection overlays.
- [ ] Update existing scene-facing unit/E2E types without weakening assertions.
- [ ] Run `npm test` and `npm run build`; expect PASS.
- [ ] Commit: `feat: connect midboss reward loop`.

---

### Task 6: Browser acceptance and playtest handoff

**Files:**
- Modify: `e2e/combat.spec.ts`
- Create: `docs/playtest/2026-07-16-midboss-playtest.md`

- [ ] Add focused desktop tests for kill-score entry, hard-time entry, no formations during warning/boss, existing enemies constraining movement, obstacle removal expanding motion, ordered weakpoint/core defeat, reward pause, reward selection, stronger section-1 resume, and restart reset.
- [ ] Add chain-warhead regression: temporary explosion absent before relic and present after acquisition. Preserve all prior collision, level-up, split, explosion, mobile, and restart assertions.
- [ ] Run focused E2E with `--grep "midboss|boss reward|chain warhead"`; fix only evidence-backed failures using systematic debugging.
- [ ] Run fresh full verification:

```bash
npm test
npm run test:e2e
npm run build
git diff --check
```

- [ ] Record automatic evidence and leave manual checks open: `45~75s` duration, weakpoint generosity, obstacle-constrained motion readability, support-fire source clarity, dodge fairness, and reward impact.
- [ ] Commit: `test: verify first midboss reward loop`.
