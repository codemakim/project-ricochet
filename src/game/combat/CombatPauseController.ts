export type PauseReason = 'visibility' | 'levelUp' | 'defeated';

export class CombatPauseController {
  private readonly reasons = new Set<PauseReason>();
  private discardNextDelta = false;

  add(reason: PauseReason): void {
    this.reasons.add(reason);
  }

  remove(reason: PauseReason): void {
    const wasPaused = this.isPaused();
    this.reasons.delete(reason);
    if (wasPaused && !this.isPaused()) this.discardNextDelta = true;
  }

  has(reason: PauseReason): boolean {
    return this.reasons.has(reason);
  }

  isPaused(): boolean {
    return this.reasons.size > 0;
  }

  consumeGameplayDelta(delta: number): number {
    if (this.isPaused()) return 0;
    if (!this.discardNextDelta) return delta;
    this.discardNextDelta = false;
    return 0;
  }
}
