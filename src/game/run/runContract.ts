import type { BossKind } from '../config/gameTuning';
import { ORB_CORE_IDS, type OrbCoreId } from '../orbs/orbCoreRules';
import { FUSION_ORB_IDS, type FusionOrbId } from '../orbs/orbFusionRules';
import type { AbilityRanks } from '../progression/progressionRules';

export type CoreLoadout = [OrbCoreId];

export interface RunIdentity {
  runId: string;
  battlefieldId: 'default';
  threatId: 'normal';
  seed: number;
}

export interface RunConfig {
  identity: RunIdentity;
  loadout: CoreLoadout;
  unlockedCoreTypes: OrbCoreId[];
  discoveredCoreTypes: OrbCoreId[];
  discoveredFusionTypes: FusionOrbId[];
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
  unlockedCoreTypes: readonly OrbCoreId[] = loadout,
  discoveredCoreTypes: readonly OrbCoreId[] = unlockedCoreTypes,
  discoveredFusionTypes: readonly FusionOrbId[] = [],
): RunConfig {
  if (loadout.length !== 1) throw new RangeError('run loadout must contain exactly one core');
  if (unlockedCoreTypes.some((core) => !ORB_CORE_IDS.includes(core))) {
    throw new Error('unlocked core list contains an unknown core');
  }
  if (discoveredCoreTypes.some((core) => !ORB_CORE_IDS.includes(core))) {
    throw new Error('discovered core list contains an unknown core');
  }
  if (discoveredFusionTypes.some((fusion) => !FUSION_ORB_IDS.includes(fusion))) {
    throw new Error('discovered fusion list contains an unknown fusion');
  }
  if (unlockedCoreTypes.some((core) => !discoveredCoreTypes.includes(core))) {
    throw new Error('unlocked cores must be discovered');
  }
  if (!unlockedCoreTypes.includes(loadout[0]!)) throw new Error('starting core must be unlocked');
  if (!Number.isInteger(seed) || seed < 0) throw new RangeError('run seed must be a non-negative integer');
  if (!runId) throw new Error('run id is required');
  return {
    identity: { runId, battlefieldId: 'default', threatId: 'normal', seed },
    loadout: [...loadout] as CoreLoadout,
    unlockedCoreTypes: [...unlockedCoreTypes],
    discoveredCoreTypes: [...discoveredCoreTypes],
    discoveredFusionTypes: [...discoveredFusionTypes],
  };
}

export function createRunResult(
  config: RunConfig,
  success: boolean,
  durationMs: number,
  defeatedBossIds: readonly BossKind[],
  buildRanks: Readonly<AbilityRanks>,
  discoveredCoreTypes: readonly OrbCoreId[] = config.discoveredCoreTypes,
  discoveredFusionTypes: readonly FusionOrbId[] = config.discoveredFusionTypes,
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
    unlockedCoreTypes: [...config.unlockedCoreTypes],
    discoveredCoreTypes: [...discoveredCoreTypes],
    discoveredFusionTypes: [...discoveredFusionTypes],
    success,
    durationMs,
    defeatedBossIds: [...defeatedBossIds],
    buildRanks: { ...buildRanks },
  };
}
