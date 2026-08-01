import type { EnemyKind } from '../enemies/enemyRules';
import type { OrbSnapshot } from '../orbs/OrbManager';
import {
  ABILITY_IDS,
  type AbilityEligibilityContext,
  type AbilityId,
  xpForEnemy,
  xpRequiredForLevel,
} from './progressionRules';
import {
  hasEligibleRunReward,
  runRewardChoiceKey,
  selectRunRewardOptions,
  type RunRewardChoice,
} from './runRewardRules';
import { BuildState } from './BuildState';

export interface ProgressionContext extends AbilityEligibilityContext {
  readonly orbs: readonly Pick<OrbSnapshot, 'coreType' | 'level'>[];
}

export interface ProgressionSnapshot {
  level: number;
  xp: number;
  xpRequired: number | null;
  pendingChoices: number;
  choices: RunRewardChoice[];
}

const DEFAULT_CONTEXT: ProgressionContext = {
  coreTypes: ['echo'],
  orbs: [{ coreType: 'echo', level: 1 }],
};

export class ProgressionManager {
  private level: number;
  private xp = 0;
  private pendingChoices = 0;
  private choices: RunRewardChoice[] = [];

  constructor(
    private readonly seed: number,
    private readonly build: BuildState = new BuildState(),
    private readonly getContext: () => ProgressionContext = () => DEFAULT_CONTEXT,
  ) {
    this.level = ABILITY_IDS.reduce((total, id) => total + build.rank(id), 0);
    this.normalizeCompletedProgression();
  }

  gainExperience(amount: number): void {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new RangeError('amount must be a finite non-negative number');
    }
    if (this.isComplete()) return;

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

  canChoose(choice: RunRewardChoice): boolean {
    const key = runRewardChoiceKey(choice);
    return this.pendingChoices > 0
      && this.choices.some((candidate) => runRewardChoiceKey(candidate) === key);
  }

  consume(choice: RunRewardChoice): boolean {
    if (!this.canChoose(choice)) return false;
    if (choice.kind === 'ability') this.build.upgrade(choice.id);
    this.pendingChoices -= 1;
    this.choices = [];

    if (this.normalizeCompletedProgression()) return true;
    this.generateChoices();
    return true;
  }

  choose(ability: AbilityId): boolean {
    const choice = this.choices.find((candidate) => (
      candidate.kind === 'ability' && candidate.id === ability
    ));
    return choice ? this.consume(choice) : false;
  }

  getChoices(): RunRewardChoice[] {
    return this.choices.map((choice) => ({ ...choice }));
  }

  getSnapshot(): ProgressionSnapshot {
    return {
      level: this.level,
      xp: this.xp,
      xpRequired: this.isComplete() ? null : xpRequiredForLevel(this.level),
      pendingChoices: this.pendingChoices,
      choices: this.getChoices(),
    };
  }

  private rewardContext() {
    const context = this.getContext();
    return {
      orbs: context.orbs,
      abilityRanks: this.build.getRanks(),
      abilityEligibility: context,
    };
  }

  private generateChoices(): void {
    if (this.pendingChoices === 0 || this.choices.length > 0) return;
    this.choices = selectRunRewardOptions(
      this.rewardContext(),
      this.level - this.pendingChoices,
      this.seed,
    );
  }

  private isComplete(): boolean {
    return !hasEligibleRunReward(this.rewardContext());
  }

  private normalizeCompletedProgression(): boolean {
    if (!this.isComplete()) return false;
    this.xp = 0;
    this.pendingChoices = 0;
    this.choices = [];
    return true;
  }
}
