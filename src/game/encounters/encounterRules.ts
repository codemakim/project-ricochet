import { GAME_TUNING } from '../config/gameTuning';

export function formationDepleted(initial: number, remaining: number): boolean {
  if (!Number.isFinite(initial) || initial <= 0) {
    throw new RangeError('initial population must be finite and positive');
  }
  if (!Number.isFinite(remaining) || remaining < 0) {
    throw new RangeError('remaining population must be finite and non-negative');
  }
  return remaining / initial <= GAME_TUNING.encounter.nextFormationRemainingRatio;
}

export function canReleaseFormation(
  activePopulation: number,
  incomingPopulation: number,
  activeCap: number,
): boolean {
  return activePopulation + incomingPopulation <= activeCap;
}
