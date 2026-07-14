import { ABILITY_IDS, type AbilityId, type AbilityRanks } from './progressionRules';

const EXPLOSIONS = [
  null,
  { radius: 48, damage: 0.5 },
  { radius: 56, damage: 0.75 },
  { radius: 64, damage: 1 },
  { radius: 72, damage: 1.25 },
  { radius: 80, damage: 1.5 },
] as const;

const SPLIT_COUNTS = [0, 1, 1, 2, 2, 3] as const;

export class BuildState {
  private readonly ranks: AbilityRanks;

  constructor(initialRanks: Partial<AbilityRanks> = {}) {
    this.ranks = { firepower: 0, kinetic: 0, explosion: 0, split: 0 };

    for (const id of ABILITY_IDS) {
      const rank = initialRanks[id];
      if (rank === undefined) continue;
      if (!Number.isInteger(rank) || rank < 0 || rank > 5) {
        throw new RangeError(`${id} rank must be an integer from 0 through 5`);
      }
      this.ranks[id] = rank;
    }
  }

  rank(id: AbilityId): number {
    return this.ranks[id];
  }

  upgrade(id: AbilityId): void {
    if (this.ranks[id] === 5) throw new RangeError(`${id} is already rank 5`);
    this.ranks[id] += 1;
  }

  getRanks(): AbilityRanks {
    return { ...this.ranks };
  }

  directDamageBonus(): number {
    return this.ranks.firepower * 0.25;
  }

  chargedSpeed(): number {
    return 400 + this.ranks.kinetic * 40;
  }

  explosion(): { radius: number; damage: number } | null {
    const explosion = EXPLOSIONS[this.ranks.explosion];
    return explosion ? { ...explosion } : null;
  }

  splitCount(): number {
    return SPLIT_COUNTS[this.ranks.split]!;
  }
}
