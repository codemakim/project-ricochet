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

export function threatPhaseForSection(section: number, elapsedMs: number): ThreatPhase {
  if (section > 0) return elapsedMs >= 60_000 ? 2 : 1;
  if (elapsedMs >= 120_000) return 2;
  if (elapsedMs >= 60_000) return 1;
  return 0;
}

export function threatConfigAt(elapsedMs: number, section = 0): ThreatConfig {
  const phase = threatPhaseForSection(section, elapsedMs);
  if (phase === 2) return { phase, activeCap: 48, spawnIntervalMs: 6_000 };
  if (phase === 1) return { phase, activeCap: 40, spawnIntervalMs: 7_000 };
  return { phase: 0, activeCap: 32, spawnIntervalMs: 8_000 };
}

export function canSpawnReinforcement(input: SpawnGateInput): boolean {
  return input.elapsedSinceSpawnMs >= input.spawnIntervalMs
    && input.topmostEnemyY >= input.requiredTopmostY
    && input.activeEnemies + input.incomingEnemies <= input.activeCap;
}
