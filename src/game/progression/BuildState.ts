import { GAME_TUNING } from '../config/gameTuning';
import {
  ABILITY_IDS,
  ABILITY_MAX_RANKS,
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

export class BuildState {
  private readonly ranks: AbilityRanks;

  constructor(initialRanks: Partial<AbilityRanks> = {}) {
    this.ranks = { firepower: 0, kinetic: 0, explosion: 0, split: 0 };

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

  directDamageBonus(): number {
    return this.ranks.firepower * 0.25;
  }

  chargedSpeed(): number {
    return 400 + this.ranks.kinetic * 40;
  }

  explosion(): ExplosionSpec | null {
    return this.ranks.explosion === 0 ? null : { ...GAME_TUNING.build.explosion };
  }

  split(): SplitSpec | null {
    return this.ranks.split === 0 ? null : { ...GAME_TUNING.build.split };
  }
}
