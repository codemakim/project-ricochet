import { GAME_TUNING, type ThreatPhase } from '../config/gameTuning';

export type { ThreatPhase } from '../config/gameTuning';

export interface ThreatConfig {
  phase: ThreatPhase;
  activeCap: number;
  spawnIntervalMs: number;
}

export interface SpawnGateInput {
  elapsedSinceSpawnMs: number;
  spawnIntervalMs: number;
  topmostEnemyY: number;
  requiredTopmostY: number;
  activeEnemies: number;
  incomingEnemies: number;
  activeCap: number;
}

export function threatPhaseForSection(section: number, elapsedMs: number): ThreatPhase {
  if (section >= 2) return 3;
  if (section === 1) return elapsedMs >= 60_000 ? 3 : 2;
  if (elapsedMs >= 120_000) return 2;
  if (elapsedMs >= 60_000) return 1;
  return 0;
}

export function threatConfigAt(elapsedMs: number, section = 0): ThreatConfig {
  const phase = threatPhaseForSection(section, elapsedMs);
  const tuning = GAME_TUNING.encounter.phases[phase];
  return { phase, activeCap: tuning.activeCap, spawnIntervalMs: tuning.spawnIntervalMs };
}

export function canSpawnReinforcement(input: SpawnGateInput): boolean {
  return input.elapsedSinceSpawnMs >= input.spawnIntervalMs
    && input.topmostEnemyY >= input.requiredTopmostY
    && input.activeEnemies + input.incomingEnemies <= input.activeCap;
}
