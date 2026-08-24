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
  elapsedMs: number,
): { index: number; definition: StagePhaseDefinition } {
  let index = stage.phases.length - 1;
  while (index > 0 && elapsedMs < stage.phases[index]!.startsAtMs) index -= 1;
  return { index, definition: stage.phases[index]! };
}

export function canSpawnReinforcement(input: SpawnGateInput): boolean {
  return reinforcementWindowOpen(input)
    && input.activeEnemies + input.incomingEnemies <= input.activeCap;
}
