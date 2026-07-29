import type { BossKind } from '../config/gameTuning';
import type { OrbCoreId } from '../orbs/orbCoreRules';
import type { AbilityRanks } from '../progression/progressionRules';

export type CoreLoadout = [OrbCoreId, OrbCoreId, OrbCoreId];

export interface RunIdentity {
  runId: string;
  battlefieldId: 'default';
  threatId: 'normal';
  seed: number;
}

export interface RunConfig {
  identity: RunIdentity;
  loadout: CoreLoadout;
}

export interface RunResult extends RunConfig {
  success: boolean;
  durationMs: number;
  defeatedBossIds: BossKind[];
  buildRanks: AbilityRanks;
}

export function createRunConfig(
  loadout: readonly OrbCoreId[],
  seed = Date.now() >>> 0,
  runId: string = crypto.randomUUID(),
): RunConfig {
  if (loadout.length !== 3) throw new RangeError('run loadout must contain exactly three cores');
  if (!Number.isInteger(seed) || seed < 0) throw new RangeError('run seed must be a non-negative integer');
  if (!runId) throw new Error('run id is required');
  return {
    identity: { runId, battlefieldId: 'default', threatId: 'normal', seed },
    loadout: [...loadout] as CoreLoadout,
  };
}

export function createRunResult(
  config: RunConfig,
  success: boolean,
  durationMs: number,
  defeatedBossIds: readonly BossKind[],
  buildRanks: Readonly<AbilityRanks>,
): RunResult {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    throw new RangeError('run duration must be finite and non-negative');
  }
  if (success && !defeatedBossIds.includes('siege')) {
    throw new Error('successful run must defeat siege');
  }
  return {
    identity: { ...config.identity },
    loadout: [...config.loadout],
    success,
    durationMs,
    defeatedBossIds: [...defeatedBossIds],
    buildRanks: { ...buildRanks },
  };
}
