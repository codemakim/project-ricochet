export type ThreatPhase = 0 | 1 | 2;

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

export function threatConfigAt(elapsedMs: number): ThreatConfig {
  if (elapsedMs >= 120_000) return { phase: 2, activeCap: 30, spawnIntervalMs: 6_000 };
  if (elapsedMs >= 60_000) return { phase: 1, activeCap: 26, spawnIntervalMs: 7_000 };
  return { phase: 0, activeCap: 22, spawnIntervalMs: 8_000 };
}

export function canSpawnReinforcement(input: SpawnGateInput): boolean {
  return input.elapsedSinceSpawnMs >= input.spawnIntervalMs
    && input.topmostEnemyY >= input.requiredTopmostY
    && input.activeEnemies + input.incomingEnemies <= input.activeCap;
}
