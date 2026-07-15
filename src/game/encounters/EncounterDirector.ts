import { PLAYER_MIN_Y } from '../constants';
import type { EnemySpec } from '../enemies/enemyRules';
import { canSpawnReinforcement, threatConfigAt, type ThreatPhase } from './encounterRules';
import { createReinforcementFormation, type FormationResult } from './formationRules';

export interface EncounterEnemyState {
  activeEnemies: number;
  topmostEnemyY: number;
}

interface PendingFormation {
  phase: ThreatPhase;
  sequence: number;
  result: FormationResult;
}

export class EncounterDirector {
  private elapsedMs = 0;
  private elapsedSinceSpawnMs = 0;
  private spawnSequence = 0;
  private lastFormationId: string | null = null;
  private pendingFormation: PendingFormation | null = null;

  constructor(private readonly runSeed = 0) {}

  update(deltaMs: number, enemyState: EncounterEnemyState): EnemySpec[] | null {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) {
      throw new RangeError('deltaMs must be finite and non-negative');
    }
    this.elapsedMs += deltaMs;
    this.elapsedSinceSpawnMs += deltaMs;
    const threat = threatConfigAt(this.elapsedMs);
    if (this.elapsedSinceSpawnMs < threat.spawnIntervalMs
      || enemyState.topmostEnemyY < PLAYER_MIN_Y) return null;

    if (this.pendingFormation?.phase !== threat.phase
      || this.pendingFormation.sequence !== this.spawnSequence) {
      this.pendingFormation = {
        phase: threat.phase,
        sequence: this.spawnSequence,
        result: createReinforcementFormation(threat.phase, this.spawnSequence, this.runSeed),
      };
    }
    const formation = this.pendingFormation.result;
    if (!canSpawnReinforcement({
      elapsedSinceSpawnMs: this.elapsedSinceSpawnMs,
      spawnIntervalMs: threat.spawnIntervalMs,
      topmostEnemyY: enemyState.topmostEnemyY,
      requiredTopmostY: PLAYER_MIN_Y,
      activeEnemies: enemyState.activeEnemies,
      incomingEnemies: formation.enemies.length,
      activeCap: threat.activeCap,
    })) return null;

    this.elapsedSinceSpawnMs = 0;
    this.spawnSequence += 1;
    this.lastFormationId = formation.id;
    this.pendingFormation = null;
    return formation.enemies;
  }

  getSnapshot() {
    return {
      elapsedMs: this.elapsedMs,
      elapsedSinceSpawnMs: this.elapsedSinceSpawnMs,
      phase: threatConfigAt(this.elapsedMs).phase,
      spawnSequence: this.spawnSequence,
      runSeed: this.runSeed,
      lastFormationId: this.lastFormationId,
    } as const;
  }
}
