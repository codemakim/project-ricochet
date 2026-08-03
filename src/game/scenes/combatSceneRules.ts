import type { BossKind } from '../config/gameTuning';
import type { EncounterTransition } from '../encounters/encounterProgressionRules';
import type { BuildState } from '../progression/BuildState';
import { BossBuild } from '../progression/BossBuild';
import type { BossRewardId, BossRewardTier } from '../progression/bossRewardRules';
import type {
  BossEncounterSnapshot,
  BossTargetId,
} from '../bosses/bossEncounter';
import type { EnemyAreaDamageEffect } from '../enemies/EnemyManager';
import type { Vector } from '../math/vector';
import type { OrbTypeId } from '../orbs/orbFusionRules';
import {
  clusterBombardmentProfile,
  massCollapseProfile,
  meltdownCoreProfile,
  nanoFusionProfile,
  photonFusionProfile,
  resonantSwarmProfile,
  vectorBladeProfile,
  type NanoFusionProfile,
  type ClusterBombardmentProfile,
  type MassCollapseProfile,
  type MeltdownCoreProfile,
  type ResonantSwarmProfile,
  type VectorBladeProfile,
} from '../combat/FusionCombatState';
import type { ExplosionProfile, SplitProfile } from '../orbs/orbCoreRules';

export function recordDiscovery<T extends string>(
  current: ReadonlySet<T>,
  value: T,
): Set<T> {
  return new Set([...current, value]);
}

export function pendingRunRewardKind(
  pendingLevelUps: number,
  cooldownReady: boolean,
): 'levelUp' | null {
  if (!cooldownReady) return null;
  return pendingLevelUps > 0 ? 'levelUp' : null;
}

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
  kind: 'explosion';
  radius: number;
  damage: number;
}

export interface DirectHitEffectPlan {
  immediateAreas: PlannedAreaEffect[];
  spawnChildren: boolean;
  splitCount: number;
}

export interface ProcDecision {
  explosion: boolean;
  split: boolean;
}

export interface OrbCoreEffectPlan {
  spawnCorrosion: boolean;
  dischargeConduction: boolean;
}

export function planOrbCoreEffects(
  event: {
    source: 'permanent' | 'temporary';
    coreType?: OrbTypeId;
    conductionTriggered?: boolean;
  },
  corrosionTriggered: boolean,
): OrbCoreEffectPlan {
  if (event.source !== 'permanent') {
    return { spawnCorrosion: false, dischargeConduction: false };
  }
  return {
    spawnCorrosion: event.coreType === 'corrosion' && corrosionTriggered,
    dischargeConduction: event.coreType === 'conduction'
      && event.conductionTriggered === true,
  };
}

export interface FusionDirectHitPlan {
  photonBeam: ReturnType<typeof photonFusionProfile>['beam'] | null;
  resonantSwarm: ResonantSwarmProfile | null;
  nanoSeeds: NanoFusionProfile | null;
  massCollapse: (MassCollapseProfile & { addedStacks: number }) | null;
  clusterBombardment: ClusterBombardmentProfile | null;
  meltdownCore: MeltdownCoreProfile | null;
  vectorBlade: VectorBladeProfile | null;
}

export function planFusionDirectHitEffects(
  event: {
    source: 'permanent' | 'temporary';
    coreType?: OrbTypeId;
    coreLevel?: number;
    speedRatio?: number;
    precisionHit?: boolean;
  },
  procTriggered: boolean,
): FusionDirectHitPlan {
  const empty: FusionDirectHitPlan = {
    photonBeam: null,
    resonantSwarm: null,
    nanoSeeds: null,
    massCollapse: null,
    clusterBombardment: null,
    meltdownCore: null,
    vectorBlade: null,
  };
  if (event.source !== 'permanent' || event.coreLevel === undefined) return empty;
  if (event.coreType === 'photon-orbit') {
    return { ...empty, photonBeam: photonFusionProfile(event.coreLevel).beam };
  }
  if (event.coreType === 'resonant-swarm' && procTriggered) {
    return { ...empty, resonantSwarm: resonantSwarmProfile(event.coreLevel) };
  }
  if (event.coreType === 'nano-proliferator' && procTriggered) {
    return { ...empty, nanoSeeds: nanoFusionProfile(event.coreLevel) };
  }
  if (event.coreType === 'mass-collapse') {
    const profile = massCollapseProfile(event.coreLevel);
    if ((event.speedRatio ?? 0) < profile.minimumSpeedRatio) return empty;
    return {
      ...empty,
      massCollapse: {
        ...profile,
        addedStacks: profile.stacksPerHit
          + (event.precisionHit ? profile.precisionBonusStacks : 0),
      },
    };
  }
  if (event.coreType === 'cluster-bombardment' && procTriggered) {
    return { ...empty, clusterBombardment: clusterBombardmentProfile(event.coreLevel) };
  }
  if (event.coreType === 'meltdown-core' && procTriggered) {
    return { ...empty, meltdownCore: meltdownCoreProfile(event.coreLevel) };
  }
  if (event.coreType === 'vector-blade') {
    return { ...empty, vectorBlade: vectorBladeProfile(event.coreLevel) };
  }
  return empty;
}

export function planDirectHitEffects(
  event: { source: 'permanent' | 'temporary'; charged: boolean },
  build: Pick<BuildState, 'explosion' | 'split'>,
  decision: ProcDecision,
  profiles?: { explosion: ExplosionProfile | null; split: SplitProfile | null },
): DirectHitEffectPlan {
  const explosion = profiles?.explosion ?? build.explosion();
  const split = profiles?.split ?? build.split();
  const centerBlast = profiles?.explosion?.centerBlast;
  return {
    immediateAreas: explosion && decision.explosion
      ? [
        { kind: 'explosion', radius: explosion.radius, damage: explosion.damage },
        ...(centerBlast
          ? [{ kind: 'explosion' as const, radius: centerBlast.radius, damage: centerBlast.damage }]
          : []),
      ]
      : [],
    spawnChildren: event.source === 'temporary' && decision.split,
    splitCount: event.source === 'permanent' && decision.split
      ? split?.count ?? 0
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

export interface CombatLifecycleState<
  TBoss extends CombatLifecycleBoss = CombatLifecycleBoss,
  TChoice = BossRewardId,
> {
  activeBoss?: TBoss;
  activeBossKind?: BossKind;
  bossRewardTier: BossRewardTier | null;
  bossRewardChoices: readonly TChoice[];
  bossDefeatPending: boolean;
  bossBuild: BossBuild;
}

export interface CombatLifecycleDependencies {
  clearEnemyHostileActions(): void;
  clearWarning(): void;
  clearTemporaryOrbs(): void;
  hideRewardOverlay(): void;
}

export function finalizeCombatLifecycle<TBoss extends CombatLifecycleBoss, TChoice>(
  reason: CombatLifecycleReason,
  state: CombatLifecycleState<TBoss, TChoice>,
  dependencies: CombatLifecycleDependencies,
): CombatLifecycleState<TBoss, TChoice> {
  dependencies.clearEnemyHostileActions();
  dependencies.clearWarning();
  state.activeBoss?.clearHostileActions();
  dependencies.clearTemporaryOrbs();
  if (reason !== 'rewardOpened') dependencies.hideRewardOverlay();
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
