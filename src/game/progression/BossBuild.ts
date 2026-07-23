import type { RecoverySource } from '../orbs/orbRules';
import { GAME_TUNING } from '../config/gameTuning';
import {
  BOSS_REWARD_IDS,
  SECOND_BOSS_REWARD_IDS,
  type BossRewardId,
} from './bossRewardRules';

const ALL_BOSS_REWARD_IDS: readonly BossRewardId[] = [
  ...BOSS_REWARD_IDS,
  ...SECOND_BOSS_REWARD_IDS,
];
const SECOND_RELIC_TUNING = GAME_TUNING.relics.secondBoss;

export class BossBuild {
  private readonly rewards: BossRewardId[] = [];
  private permanentHitsSinceSiege = 0;

  acquire(id: BossRewardId): void {
    if (!ALL_BOSS_REWARD_IDS.includes(id)) throw new RangeError(`unknown boss reward: ${id}`);
    if (this.owns(id)) throw new RangeError(`${id} is already owned`);
    this.rewards.push(id);
  }

  owns(id: BossRewardId): boolean {
    return this.rewards.includes(id);
  }

  orbLimit(): number {
    const bonuses = Number(this.owns('expanded-magazine')) + Number(this.owns('auxiliary-orbit'));
    return Math.min(SECOND_RELIC_TUNING.auxiliaryOrbit.orbLimit, 3 + bonuses);
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
}
