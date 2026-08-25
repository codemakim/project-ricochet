import type { StageDefinition, StagePhaseDefinition } from './stageDefinitions';

export interface SpawnGateInput {
  elapsedSinceSpawnMs: number;
  spawnIntervalMs: number;
  emptyRespawnMs: number;
  topmostEnemyY: number;
  requiredTopmostY: number;
  activeEnemies: number;
  incomingEnemies: number;
  activeCap: number;
}

export function reinforcementWindowOpen(
  input: Omit<SpawnGateInput, 'incomingEnemies' | 'activeCap'>,
): boolean {
  return input.activeEnemies === 0 && input.elapsedSinceSpawnMs >= input.emptyRespawnMs
    || input.elapsedSinceSpawnMs >= input.spawnIntervalMs
      && input.topmostEnemyY >= input.requiredTopmostY;
}

export function phaseAt(
  stage: StageDefinition,
  score: number,
): { index: number; definition: StagePhaseDefinition } {
  let index = 0;
  for (let candidate = 1; candidate < stage.phases.length; candidate += 1) {
    const phase = stage.phases[candidate]!;
    if (score >= phase.startsAtScore) index = candidate;
  }
  return { index, definition: stage.phases[index]! };
}

export function canSpawnReinforcement(input: SpawnGateInput): boolean {
  return reinforcementWindowOpen(input)
    && input.activeEnemies + input.incomingEnemies <= input.activeCap;
}
