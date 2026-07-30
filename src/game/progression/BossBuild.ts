import { GAME_TUNING } from '../config/gameTuning';
import { BOSS_REWARD_IDS, type BossRewardId } from './bossRewardRules';

export class BossBuild {
  private readonly rewards: BossRewardId[] = [];
  acquire(id: BossRewardId): void {
    if (!(BOSS_REWARD_IDS as readonly string[]).includes(id)) {
      throw new RangeError(`unknown boss reward: ${id}`);
    }
    if (this.owns(id)) throw new RangeError(`${id} is already owned`);
    this.rewards.push(id);
  }

  owns(id: BossRewardId): boolean {
    return this.rewards.includes(id);
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
