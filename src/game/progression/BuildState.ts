import { GAME_TUNING } from '../config/gameTuning';
import {
  ORB_PICKUP_RADIUS,
  ORB_RADIUS,
  ORB_SPEED,
  PLAYER_SPEED,
} from '../constants';
import {
  ABILITY_IDS,
  ABILITY_MAX_RANKS,
  createEmptyAbilityRanks,
  type AbilityId,
  type AbilityRanks,
} from './progressionRules';

export interface ExplosionSpec {
  chance: number;
  cooldownMs: number;
  radius: number;
  damage: number;
}

export interface SplitSpec {
  chance: number;
  cooldownMs: number;
  count: number;
}

export interface PermanentDirectHitContext {
  distanceFromPlayer: number;
  wallHits: number;
  speed: number;
  firstHitAfterProximity?: boolean;
  consecutiveHits?: number;
  killOverclockActive?: boolean;
}

export class BuildState {
  private readonly ranks: AbilityRanks;

  constructor(initialRanks: Partial<AbilityRanks> = {}) {
    this.ranks = createEmptyAbilityRanks();

    for (const id of ABILITY_IDS) {
      const rank = initialRanks[id];
      if (rank === undefined) continue;
      const maxRank = ABILITY_MAX_RANKS[id];
      if (!Number.isInteger(rank) || rank < 0 || rank > maxRank) {
        throw new RangeError(`${id} rank must be an integer from 0 through ${maxRank}`);
      }
      this.ranks[id] = rank;
    }
  }

  rank(id: AbilityId): number {
    return this.ranks[id];
  }

  upgrade(id: AbilityId): void {
    const maxRank = ABILITY_MAX_RANKS[id];
    if (this.ranks[id] === maxRank) {
      throw new RangeError(`${id} is already rank ${maxRank}`);
    }
    this.ranks[id] += 1;
  }

  getRanks(): AbilityRanks {
    return { ...this.ranks };
  }

  ownedAbilityKindCount(): number {
    return ABILITY_IDS.filter((id) => this.ranks[id] > 0).length;
  }

  directDamageBonus(): number {
    return this.ranks.firepower * GAME_TUNING.build.firepower.damageBonusPerRank;
  }

  chargedSpeed(): number {
    return ORB_SPEED * (
      1 + this.ranks.kinetic * GAME_TUNING.build.kinetic.speedBonusPerRank
    );
  }

  conditionalDirectDamageBonus(context: PermanentDirectHitContext): number {
    let bonus = 0;
    if (context.distanceFromPlayer <= GAME_TUNING.build.nearAmplification.distance) {
      bonus += this.ranks['near-amplification']
        * GAME_TUNING.build.nearAmplification.damageBonusPerRank;
    }
    if (context.wallHits === 0) {
      bonus += this.ranks['precision-hit']
        * GAME_TUNING.build.precisionHit.damageBonusPerRank;
    }
    const speedSteps = Math.floor(
      Math.max(0, context.speed / ORB_SPEED - 1 + Number.EPSILON)
      / GAME_TUNING.build.kineticConversion.speedStep,
    );
    bonus += Math.min(
      GAME_TUNING.build.kineticConversion.maxDamageBonus,
      speedSteps
        * this.ranks['kinetic-conversion']
        * GAME_TUNING.build.kineticConversion.damageBonusPerStepPerRank,
    );
    if (context.firstHitAfterProximity) {
      bonus += this.ranks['reload-overcharge']
        * GAME_TUNING.build.directHitFlight.reloadDamageBonusPerRank;
    }
    bonus += Math.min(
      this.ranks['consecutive-impact'],
      Math.max(0, Math.trunc(context.consecutiveHits ?? 0)),
    ) * GAME_TUNING.build.directHitFlight.consecutiveDamageBonus;
    if (context.killOverclockActive) {
      bonus += this.ranks['kill-overclock']
        * GAME_TUNING.build.directHitFlight.killOverclockBonusPerRank;
    }
    return Math.min(GAME_TUNING.build.conditionalDamageCap, bonus);
  }

  reloadOverchargeBonus(): number {
    return this.ranks['reload-overcharge']
      * GAME_TUNING.build.directHitFlight.reloadDamageBonusPerRank;
  }

  wallSpeedMultiplier(wallHits: number): number {
    const stacks = Math.min(
      GAME_TUNING.build.wallAcceleration.maxStacks,
      Math.max(0, Math.trunc(wallHits)),
    );
    return 1 + stacks
      * this.ranks['wall-acceleration']
      * GAME_TUNING.build.wallAcceleration.speedBonusPerStack;
  }

  orbLimit(baseLimit: number): number {
    return Math.min(
      GAME_TUNING.build.basicGrowth.maximumOrbs,
      baseLimit + this.ranks['additional-core'],
    );
  }

  orbRadius(): number {
    return ORB_RADIUS * (
      1 + this.ranks['core-expansion']
      * GAME_TUNING.build.basicGrowth.orbRadiusBonusPerRank
    );
  }

  recoveryRadius(): number {
    return ORB_PICKUP_RADIUS + this.ranks['recovery-field']
      * GAME_TUNING.build.basicGrowth.recoveryRadiusPerRank;
  }

  playerSpeed(): number {
    return PLAYER_SPEED * (
      1 + this.ranks['mobility-motor']
      * GAME_TUNING.build.basicGrowth.playerSpeedBonusPerRank
    );
  }

  maximumHealth(): number {
    return 10 + this.ranks['armor-reinforcement']
      * GAME_TUNING.build.basicGrowth.healthPerRank;
  }

  flightSpeedMultiplier(killOverclockActive: boolean, collisionAccelerationActive: boolean): number {
    return 1
      + (killOverclockActive
        ? this.ranks['kill-overclock']
          * GAME_TUNING.build.directHitFlight.killOverclockBonusPerRank
        : 0)
      + (collisionAccelerationActive
        ? this.ranks['collision-acceleration']
          * GAME_TUNING.build.directHitFlight.collisionAccelerationSpeedPerRank
        : 0);
  }

  trackingRadiusBonus(active: boolean): number {
    return active
      ? this.ranks['tracking-magnet']
        * GAME_TUNING.build.directHitFlight.trackingRadiusPerRank
      : 0;
  }

  highSpeedImpact() {
    if (this.ranks['high-speed-impact'] === 0) return null;
    const effect = GAME_TUNING.build.directHitFlight.highSpeedImpact;
    return {
      ...effect,
      radius: this.circularRadius(effect.radius),
      damage: this.secondaryDamage(effect.damage),
    };
  }

  procChance(base: number): number {
    return Math.min(
      1,
      base + this.ranks['proc-optimization']
        * GAME_TUNING.build.effectModifiers.procChancePerRank,
    );
  }

  secondaryDamage(base: number): number {
    return base * (
      1 + this.ranks['effect-output']
      * GAME_TUNING.build.effectModifiers.secondaryDamagePerRank
    );
  }

  circularRadius(base: number): number {
    return base * (
      1 + this.ranks['area-expansion']
      * GAME_TUNING.build.effectModifiers.circularRadiusPerRank
    );
  }

  durationMs(base: number): number {
    return Math.round(base * (
      1 + this.ranks['duration-module']
      * GAME_TUNING.build.effectModifiers.durationPerRank
    ));
  }

  cutterThickness(base: number): number {
    return base * (
      1 + this.ranks['focusing-lens']
      * GAME_TUNING.build.effectModifiers.cutterThicknessPerRank
    );
  }

  splitCount(base: number): number {
    return base + this.ranks['fragment-expansion']
      * GAME_TUNING.build.effectModifiers.fragmentCountPerRank;
  }

  temporaryDamageMultiplier(): number {
    return 1 + this.ranks['fragment-output']
      * GAME_TUNING.build.effectModifiers.fragmentDamagePerRank;
  }

  temporaryLifetimeMs(base: number): number {
    return base + this.ranks['fragment-stabilization']
      * GAME_TUNING.build.effectModifiers.fragmentLifetimeMsPerRank;
  }

  conductionTargetCount(base: number): number {
    return base + this.ranks['conduction-expansion']
      * GAME_TUNING.build.effectModifiers.conductionTargetsPerRank;
  }

  horizontalCutter() {
    return this.ranks['horizontal-cutter'] > 0 ? this.cutter() : null;
  }

  verticalCutter() {
    return this.ranks['vertical-cutter'] > 0 ? this.cutter() : null;
  }

  destructionReaction() {
    return this.ranks['destruction-reaction'] > 0
      ? {
        ...GAME_TUNING.build.destructionReaction,
        chance: this.procChance(GAME_TUNING.build.destructionReaction.chance),
        radius: this.circularRadius(GAME_TUNING.build.destructionReaction.radius),
        damage: this.secondaryDamage(GAME_TUNING.build.destructionReaction.damage),
      }
      : null;
  }

  microMissile() {
    return this.ranks['micro-missile'] > 0 ? {
      ...GAME_TUNING.build.microMissile,
      damage: this.secondaryDamage(GAME_TUNING.build.microMissile.damage),
    } : null;
  }

  recoveryShockwave() {
    const rank = this.ranks['recovery-shockwave'];
    if (rank === 0) return null;
    return {
      recoveriesRequired: GAME_TUNING.build.recoveryShockwave.recoveriesRequired,
      radius: this.circularRadius(GAME_TUNING.build.recoveryShockwave.radius),
      damage: this.secondaryDamage(GAME_TUNING.build.recoveryShockwave.damageByRank[rank - 1]!),
    };
  }

  explosion(): ExplosionSpec | null {
    if (this.ranks.explosion === 0) return null;
    return {
      ...GAME_TUNING.build.explosion,
      chance: this.procChance(GAME_TUNING.build.explosion.chance),
      radius: this.circularRadius(GAME_TUNING.build.explosion.radius),
      damage: this.secondaryDamage(GAME_TUNING.build.explosion.damage),
    };
  }

  split(): SplitSpec | null {
    if (this.ranks.split === 0) return null;
    return {
      ...GAME_TUNING.build.split,
      chance: this.procChance(GAME_TUNING.build.split.chance),
      count: this.splitCount(GAME_TUNING.build.split.count),
    };
  }

  private cutter() {
    return {
      ...GAME_TUNING.build.cutter,
      chance: this.procChance(GAME_TUNING.build.cutter.chance),
      thickness: this.cutterThickness(GAME_TUNING.build.cutter.thickness),
      damage: this.secondaryDamage(GAME_TUNING.build.cutter.damage),
    };
  }
}
