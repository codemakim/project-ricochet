import type { RecoverySource } from '../orbs/orbRules';
import { GAME_TUNING } from '../config/gameTuning';
import {
  BOSS_REWARD_IDS,
  SECOND_BOSS_REWARD_IDS,
  type BossRewardId,
} from './bossRewardRules';

const SECOND_RELIC_TUNING = GAME_TUNING.relics.secondBoss;

export class BossBuild {
  private readonly rewards: BossRewardId[] = [];
  private permanentHitsSinceSiege = 0;

  acquire(id: BossRewardId): void {
    if (!([
      ...BOSS_REWARD_IDS,
      ...SECOND_BOSS_REWARD_IDS,
    ] as readonly string[]).includes(id)) {
      throw new RangeError(`unknown boss reward: ${id}`);
    }
    if (this.owns(id)) throw new RangeError(`${id} is already owned`);
    this.rewards.push(id);
  }

  owns(id: BossRewardId): boolean {
    return this.rewards.includes(id);
  }

  orbLimitBonus(): number {
    return Number(this.owns('expanded-magazine')) + Number(this.owns('auxiliary-orbit'));
  }

  restoredCharges(source: RecoverySource): number {
    return source === 'proximity' && this.owns('recovery-capacitor') ? 5 : 3;
  }

  openingHitBonus(source: RecoverySource, firstHitPending: boolean): number {
    return source === 'proximity' && firstHitPending && this.owns('opening-amplifier') ? 1 : 0;
  }

  temporaryExplosionEnabled(): boolean {
    return this.owns('chain-warhead');
  }

  recoverySalvoCount(source: RecoverySource): number {
    return source === 'proximity' && this.owns('recovery-salvo')
      ? SECOND_RELIC_TUNING.recoverySalvo.temporaryOrbCount
      : 0;
  }

  recordPermanentDirectHit(): boolean {
    if (!this.owns('siege-resonance')) return false;
    if (this.permanentHitsSinceSiege >= SECOND_RELIC_TUNING.siegeResonance.hitsRequired) {
      this.permanentHitsSinceSiege = 0;
      return true;
    }
    this.permanentHitsSinceSiege += 1;
    return false;
  }

  chargedDamageBonus(): number {
    return this.owns('hyperpressure-core')
      ? SECOND_RELIC_TUNING.hyperpressureCore.chargedDamageBonus
      : 0;
  }

  chargedKillPierces(): boolean {
    return this.owns('inertial-penetration');
  }

  aftershock(): { delayMs: number; radiusScale: number; damageScale: number } | null {
    if (!this.owns('aftershock-explosion')) return null;
    const { delayMs, radiusScale, damageScale } = SECOND_RELIC_TUNING.aftershockExplosion;
    return { delayMs, radiusScale, damageScale };
  }

  chainSplitEnabled(): boolean {
    return this.owns('chain-split');
  }

  resetTransientState(): void {
    this.permanentHitsSinceSiege = 0;
  }

  snapshot(): BossRewardId[] {
    return [...this.rewards];
  }

  temporaryProcChance(baseChance: number): number {
    return this.owns('auxiliary-link')
      ? baseChance * GAME_TUNING.relics.auxiliaryLink.procScale
      : 0;
  }

  crossCutDamage(baseDamage: number): number {
    return this.owns('cross-cut')
      ? baseDamage * GAME_TUNING.relics.crossCut.damageScale
      : 0;
  }

  gasIgnitionFraction(): number {
    return this.owns('gas-ignition')
      ? GAME_TUNING.relics.gasIgnition.remainingDamageFraction
      : 0;
  }

  recursiveSplit(): { chance: number; childCount: number } | null {
    return this.owns('recursive-split')
      ? { ...GAME_TUNING.relics.recursiveSplit }
      : null;
  }

  inertiaHitLimit(): number {
    return this.owns('inertia-retention')
      ? GAME_TUNING.relics.inertiaRetention.directHits
      : 1;
  }

  completeCycleEnabled(): boolean {
    return this.owns('complete-cycle');
  }

  reloadSecondaryBonus(overchargeBonus: number): number {
    return this.owns('direct-link')
      ? overchargeBonus * GAME_TUNING.relics.directLink.overchargeScale
      : 0;
  }

  conductionHitsRequired(base: number): number {
    return this.owns('superconducting-circuit')
      ? Math.max(1, base - GAME_TUNING.relics.superconductingCircuit.hitReduction)
      : base;
  }

  conductionDamage(base: number): number {
    return this.owns('superconducting-circuit')
      ? base * (1 + GAME_TUNING.relics.superconductingCircuit.damageBonus)
      : base;
  }

  resonanceRupture(
    maximumStacks: number,
    stacks: number,
  ): { radius: number; damage: number } | null {
    return this.owns('resonance-rupture') && stacks >= maximumStacks
      ? { ...GAME_TUNING.relics.resonanceRupture }
      : null;
  }
}
