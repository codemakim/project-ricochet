import type { BossKind } from '../config/gameTuning';
import { GAME_TUNING } from '../config/gameTuning';
import type { EncounterTransition } from '../encounters/encounterProgressionRules';
import type { BuildState } from '../progression/BuildState';
import { BossBuild } from '../progression/BossBuild';
import type { BossRewardId, BossRewardTier } from '../progression/bossRewardRules';
import type {
  BossEncounterSnapshot,
  BossTargetId,
} from '../bosses/bossEncounter';
import type { CombatEffectScheduler } from '../combat/CombatEffectScheduler';
import type { EnemyAreaDamageEffect } from '../enemies/EnemyManager';
import type { Vector } from '../math/vector';

export function shouldFinalizeBossReward(
  bossDefeatPending: boolean,
  defeated: boolean,
  levelUpPaused: boolean,
): boolean {
  return bossDefeatPending && !defeated && !levelUpPaused;
}

export function bossKindAfterTransition(
  current: BossKind | null,
  transition: EncounterTransition,
): BossKind {
  if (
    transition.type === 'bossStarted'
    && current !== null
    && transition.bossKind !== current
  ) {
    throw new Error(
      `boss start kind ${transition.bossKind} does not match pending ${current}`,
    );
  }
  return transition.bossKind;
}

export function rewardTierForBoss(kind: BossKind): BossRewardTier {
  return kind === 'sentinel' ? 'first' : 'second';
}

export function createBossForKind<T>(
  kind: BossKind,
  factories: Record<BossKind, () => T>,
): T {
  return factories[kind]();
}

export interface PlannedAreaEffect {
  kind: 'siege' | 'explosion';
  radius: number;
  damage: number;
}

export interface DirectHitEffectPlan {
  immediateAreas: PlannedAreaEffect[];
  aftershock: { radius: number; damage: number } | null;
  spawnChildren: boolean;
  splitCount: number;
}

export interface ProcDecision {
  explosion: boolean;
  split: boolean;
}

export function planDirectHitEffects(
  event: { source: 'permanent' | 'temporary'; charged: boolean },
  build: Pick<BuildState, 'explosion' | 'split'>,
  bossBuild: Pick<
    BossBuild,
    | 'recordPermanentDirectHit'
    | 'temporaryExplosionEnabled'
    | 'aftershock'
    | 'chainSplitEnabled'
  >,
  decision: ProcDecision,
): DirectHitEffectPlan {
  const immediateAreas: PlannedAreaEffect[] = [];
  if (event.source === 'permanent' && bossBuild.recordPermanentDirectHit()) {
    const { radius, damage } = GAME_TUNING.relics.secondBoss.siegeResonance;
    immediateAreas.push({
      kind: 'siege',
      radius,
      damage,
    });
  }
  const explosion = build.explosion();
  const permanentExplosion = event.source === 'permanent' && decision.explosion;
  const temporaryExplosion = event.source === 'temporary'
    && bossBuild.temporaryExplosionEnabled();
  const explosionTriggered = Boolean(
    explosion && (permanentExplosion || temporaryExplosion),
  );
  if (explosion && explosionTriggered) {
    immediateAreas.push({
      kind: 'explosion',
      radius: explosion.radius,
      damage: explosion.damage,
    });
  }
  const aftershock = event.source === 'permanent' && explosionTriggered
    ? bossBuild.aftershock()
    : null;
  return {
    immediateAreas,
    aftershock: aftershock && explosion
      ? {
        radius: explosion.radius * aftershock.radiusScale,
        damage: explosion.damage * aftershock.damageScale,
      }
      : null,
    spawnChildren: event.source === 'temporary' && bossBuild.chainSplitEnabled(),
    splitCount: event.source === 'permanent' && decision.split
      ? build.split()?.count ?? 0
      : 0,
  };
}

interface AreaEffectSettlement {
  applyEnemyBatch(effects: readonly EnemyAreaDamageEffect[]): unknown;
  applyBossArea(
    position: Vector,
    radius: number,
    damage: number,
    excludedTargetId?: BossTargetId,
  ): unknown;
}

export function settlePlannedAreaEffects(
  position: Vector,
  effects: readonly Pick<PlannedAreaEffect, 'radius' | 'damage'>[],
  excludedEnemyId: number,
  excludedBossTargetId: BossTargetId | undefined,
  settlement: AreaEffectSettlement,
): void {
  settlement.applyEnemyBatch(effects.map(({ radius, damage }) => ({
    center: { ...position },
    radius,
    damage,
    excludedEnemyId,
  })));
  for (const { radius, damage } of effects) {
    settlement.applyBossArea(
      position,
      radius,
      damage,
      excludedBossTargetId,
    );
  }
}

export function schedulePlannedAftershock(
  plan: Pick<DirectHitEffectPlan, 'aftershock'>,
  scheduler: Pick<CombatEffectScheduler, 'scheduleAftershock'>,
  gameplayElapsedMs: number,
  position: Vector,
  excludedBossTargetId?: BossTargetId,
): void {
  if (!plan.aftershock) return;
  scheduler.scheduleAftershock(
    gameplayElapsedMs,
    position,
    plan.aftershock.radius,
    plan.aftershock.damage,
    excludedBossTargetId,
  );
}

export function bossOrbModifiers(
  bossBuild: Pick<BossBuild, 'chargedDamageBonus' | 'chargedKillPierces'>,
): { chargedDamageBonus: number; chargedKillPierces: boolean } {
  return {
    chargedDamageBonus: bossBuild.chargedDamageBonus(),
    chargedKillPierces: bossBuild.chargedKillPierces(),
  };
}

export function rewardAddsPermanentOrb(id: BossRewardId): boolean {
  return id === 'expanded-magazine' || id === 'auxiliary-orbit';
}

export type CombatLifecycleReason =
  | 'defeat'
  | 'rewardOpened'
  | 'rewardCompleted'
  | 'restart'
  | 'shutdown';

interface CombatLifecycleBoss {
  clearHostileActions(): void;
  destroy(): void;
}

export interface CombatLifecycleState<TBoss extends CombatLifecycleBoss = CombatLifecycleBoss> {
  activeBoss?: TBoss;
  activeBossKind?: BossKind;
  bossRewardTier: BossRewardTier | null;
  bossRewardChoices: readonly BossRewardId[];
  bossDefeatPending: boolean;
  bossBuild: BossBuild;
}

export interface CombatLifecycleDependencies {
  scheduler: Pick<CombatEffectScheduler, 'clear'>;
  clearEnemyHostileActions(): void;
  clearWarning(): void;
  clearTemporaryOrbs(): void;
  hideRewardOverlay(): void;
}

export function finalizeCombatLifecycle<TBoss extends CombatLifecycleBoss>(
  reason: CombatLifecycleReason,
  state: CombatLifecycleState<TBoss>,
  dependencies: CombatLifecycleDependencies,
): CombatLifecycleState<TBoss> {
  dependencies.clearEnemyHostileActions();
  dependencies.clearWarning();
  dependencies.scheduler.clear();
  state.activeBoss?.clearHostileActions();
  dependencies.clearTemporaryOrbs();
  if (reason !== 'rewardOpened') dependencies.hideRewardOverlay();
  state.bossBuild.resetTransientState();
  state.activeBoss?.destroy();
  const preservesRun = reason === 'rewardOpened' || reason === 'rewardCompleted';
  return {
    activeBoss: undefined,
    activeBossKind: undefined,
    bossRewardTier: reason === 'rewardOpened' ? state.bossRewardTier : null,
    bossRewardChoices: reason === 'rewardOpened' ? [...state.bossRewardChoices] : [],
    bossDefeatPending: false,
    bossBuild: preservesRun ? state.bossBuild : new BossBuild(),
  };
}

export function inactiveBossSnapshot(kind: BossKind | null): BossEncounterSnapshot {
  return {
    kind: kind ?? 'sentinel',
    active: false,
    phase: null,
    position: null,
    parts: null,
    bullets: 0,
    warnings: 0,
    projectiles: [],
  };
}
