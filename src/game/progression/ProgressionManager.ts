import type { EnemyKind } from '../enemies/enemyRules';
import {
  ABILITY_IDS,
  selectAbilityOptions,
  xpForEnemy,
  xpRequiredForLevel,
  type AbilityId,
  type AbilityRanks,
} from './progressionRules';

export interface ProgressionSnapshot {
  level: number;
  xp: number;
  xpRequired: number | null;
  pendingChoices: number;
  choices: AbilityId[];
}

function createEmptyRanks(): AbilityRanks {
  return { firepower: 0, kinetic: 0, explosion: 0, split: 0 };
}

export class ProgressionManager {
  private level: number;
  private xp = 0;
  private pendingChoices = 0;
  private choices: AbilityId[] = [];

  constructor(
    private readonly seed: number,
    private readonly ranks: AbilityRanks = createEmptyRanks(),
  ) {
    this.level = ABILITY_IDS.reduce((total, id) => total + ranks[id], 0);
    this.normalizeCompletedBuild();
  }

  gainExperience(amount: number): void {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new RangeError('amount must be a finite non-negative number');
    }
    if (this.isBuildComplete()) return;

    this.xp += amount;
    while (this.xp >= xpRequiredForLevel(this.level)) {
      this.xp -= xpRequiredForLevel(this.level);
      this.level += 1;
      this.pendingChoices += 1;
    }

    this.generateChoices();
  }

  gainEnemyKill(kind: EnemyKind): void {
    this.gainExperience(xpForEnemy(kind));
  }

  choose(ability: AbilityId): boolean {
    if (this.pendingChoices === 0 || !this.choices.includes(ability)) return false;

    this.ranks[ability] += 1;
    this.pendingChoices -= 1;

    if (this.normalizeCompletedBuild()) return true;

    this.choices = [];
    this.generateChoices();
    return true;
  }

  getChoices(): AbilityId[] {
    return [...this.choices];
  }

  getSnapshot(): ProgressionSnapshot {
    return {
      level: this.level,
      xp: this.xp,
      xpRequired: this.isBuildComplete() ? null : xpRequiredForLevel(this.level),
      pendingChoices: this.pendingChoices,
      choices: this.getChoices(),
    };
  }

  private generateChoices(): void {
    if (this.pendingChoices === 0 || this.choices.length > 0) return;

    const choiceLevel = this.level - this.pendingChoices;
    this.choices = selectAbilityOptions(this.ranks, choiceLevel, this.seed);
  }

  private isBuildComplete(): boolean {
    return ABILITY_IDS.every((id) => this.ranks[id] >= 5);
  }

  private normalizeCompletedBuild(): boolean {
    if (!this.isBuildComplete()) return false;

    this.level = 20;
    this.xp = 0;
    this.pendingChoices = 0;
    this.choices = [];
    return true;
  }
}
