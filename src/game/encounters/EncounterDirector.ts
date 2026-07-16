import { PLAYER_MIN_Y } from '../constants';
import type { EnemyKind, EnemySpec } from '../enemies/enemyRules';
import { canSpawnReinforcement, threatConfigAt, type ThreatPhase } from './encounterRules';
import {
  BOSS_WARNING_MS,
  bossEntryReady,
  bossProgressForKill,
  type EncounterState,
  type EncounterTransition,
} from './encounterProgressionRules';
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

export interface EncounterUpdate {
  formation: EnemySpec[] | null;
  transition: EncounterTransition | null;
}

const NO_UPDATE: EncounterUpdate = { formation: null, transition: null };

export class EncounterDirector {
  private state: EncounterState = 'running';
  private section = 0;
  private sectionElapsedMs = 0;
  private elapsedSinceSpawnMs = 0;
  private bossScore = 0;
  private warningElapsedMs = 0;
  private bossesDefeated = 0;
  private spawnSequence = 0;
  private lastFormationId: string | null = null;
  private pendingFormation: PendingFormation | null = null;

  constructor(private readonly runSeed = 0) {}

  update(deltaMs: number, enemyState: EncounterEnemyState): EncounterUpdate {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) {
      throw new RangeError('deltaMs must be finite and non-negative');
    }

    if (this.state === 'bossWarning') {
      this.warningElapsedMs += deltaMs;
      if (this.warningElapsedMs >= BOSS_WARNING_MS) {
        this.state = 'boss';
        return { formation: null, transition: 'bossStarted' };
      }
      return NO_UPDATE;
    }
    if (this.state !== 'running') return NO_UPDATE;

    this.sectionElapsedMs += deltaMs;
    this.elapsedSinceSpawnMs += deltaMs;
    if (this.section === 0 && bossEntryReady(this.sectionElapsedMs, this.bossScore)) {
      this.state = 'bossWarning';
      this.pendingFormation = null;
      return { formation: null, transition: 'bossWarningStarted' };
    }

    const threat = threatConfigAt(this.sectionElapsedMs, this.section);
    if (this.elapsedSinceSpawnMs < threat.spawnIntervalMs
      || enemyState.topmostEnemyY < PLAYER_MIN_Y) return NO_UPDATE;

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
    })) return NO_UPDATE;

    this.elapsedSinceSpawnMs = 0;
    this.spawnSequence += 1;
    this.lastFormationId = formation.id;
    this.pendingFormation = null;
    return { formation: formation.enemies, transition: null };
  }

  recordEnemyKill(kind: EnemyKind): void {
    if (this.state === 'running' && this.section === 0) {
      this.bossScore += bossProgressForKill(kind);
    }
  }

  markBossDefeated(): void {
    if (this.state !== 'boss') {
      throw new Error(`cannot mark boss defeated while encounter state is ${this.state}`);
    }
    this.state = 'bossRewardPaused';
    this.bossesDefeated += 1;
  }

  resumeAfterBossReward(): void {
    if (this.state !== 'bossRewardPaused') {
      throw new Error(`cannot resume after boss reward while encounter state is ${this.state}`);
    }
    this.state = 'running';
    this.section += 1;
    this.sectionElapsedMs = 0;
    this.elapsedSinceSpawnMs = 0;
    this.bossScore = 0;
    this.warningElapsedMs = 0;
    this.pendingFormation = null;
  }

  getSnapshot() {
    const phase = threatConfigAt(this.sectionElapsedMs, this.section).phase;
    return {
      elapsedMs: this.sectionElapsedMs,
      elapsedSinceSpawnMs: this.elapsedSinceSpawnMs,
      phase,
      spawnSequence: this.spawnSequence,
      runSeed: this.runSeed,
      lastFormationId: this.lastFormationId,
      state: this.state,
      section: this.section,
      sectionElapsedMs: this.sectionElapsedMs,
      bossScore: this.bossScore,
      warningElapsedMs: this.warningElapsedMs,
      bossesDefeated: this.bossesDefeated,
    } as const;
  }
}
