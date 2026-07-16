import type { RecoverySource } from '../orbs/orbRules';
import { BOSS_REWARD_IDS, type BossRewardId } from './bossRewardRules';

export class BossBuild {
  private readonly rewards: BossRewardId[] = [];

  acquire(id: BossRewardId): void {
    if (!BOSS_REWARD_IDS.includes(id)) throw new RangeError(`unknown boss reward: ${id}`);
    if (this.owns(id)) throw new RangeError(`${id} is already owned`);
    this.rewards.push(id);
  }

  owns(id: BossRewardId): boolean {
    return this.rewards.includes(id);
  }

  orbLimit(): number {
    return this.owns('expanded-magazine') ? 4 : 3;
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

  snapshot(): BossRewardId[] {
    return [...this.rewards];
  }
}
