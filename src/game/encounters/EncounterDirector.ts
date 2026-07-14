import { PLAYER_MIN_Y } from '../constants';
import type { EnemySpec } from '../enemies/enemyRules';
import { canSpawnReinforcement, threatConfigAt } from './encounterRules';
import { createReinforcementFormation } from './formationRules';

export interface EncounterEnemyState {
  activeEnemies: number;
  topmostEnemyY: number;
}

export class EncounterDirector {
  private elapsedMs = 0;
  private elapsedSinceSpawnMs = 0;
  private spawnSequence = 0;

  update(deltaMs: number, enemyState: EncounterEnemyState): EnemySpec[] | null {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) {
      throw new RangeError('deltaMs must be finite and non-negative');
    }
    this.elapsedMs += deltaMs;
    this.elapsedSinceSpawnMs += deltaMs;
    const threat = threatConfigAt(this.elapsedMs);
    const formation = createReinforcementFormation(threat.phase, this.spawnSequence);
    if (!canSpawnReinforcement({
      elapsedSinceSpawnMs: this.elapsedSinceSpawnMs,
      spawnIntervalMs: threat.spawnIntervalMs,
      topmostEnemyY: enemyState.topmostEnemyY,
      requiredTopmostY: PLAYER_MIN_Y,
      activeEnemies: enemyState.activeEnemies,
      incomingEnemies: formation.length,
      activeCap: threat.activeCap,
    })) return null;

    this.elapsedSinceSpawnMs = 0;
    this.spawnSequence += 1;
    return formation;
  }

  getSnapshot() {
    return {
      elapsedMs: this.elapsedMs,
      elapsedSinceSpawnMs: this.elapsedSinceSpawnMs,
      phase: threatConfigAt(this.elapsedMs).phase,
      spawnSequence: this.spawnSequence,
    } as const;
  }
}
