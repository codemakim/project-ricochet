import type { BossKind } from '../config/gameTuning';
import { ORB_CORE_IDS, type OrbCoreId } from '../orbs/orbCoreRules';
import type { RunResult, CoreLoadout } from '../run/runContract';
import { META_TUNING } from './metaTuning';

export interface MetaProgress {
  schemaVersion: 1;
  parts: number;
  unlockedCores: OrbCoreId[];
  loadout: CoreLoadout;
  claimedRunIds: string[];
  firstBossKills: BossKind[];
  firstValidRunClaimed: boolean;
}

export interface Settlement {
  progress: MetaProgress;
  earned: number;
  breakdown: {
    participation: number;
    firstValidRun: number;
    bosses: number;
    firstKills: number;
    clear: number;
  };
}

export function createDefaultMetaProgress(): MetaProgress {
  return {
    schemaVersion: 1,
    parts: 0,
    unlockedCores: ['echo'],
    loadout: ['echo', 'echo', 'echo'],
    claimedRunIds: [],
    firstBossKills: [],
    firstValidRunClaimed: false,
  };
}

export function settleRun(progress: Readonly<MetaProgress>, result: RunResult): Settlement {
  if (progress.claimedRunIds.includes(result.identity.runId)) {
    return { progress: copy(progress), earned: 0, breakdown: emptyBreakdown() };
  }
  const valid = result.durationMs >= META_TUNING.validDurationMs
    || result.defeatedBossIds.length > 0;
  const newBossKills = [...new Set(result.defeatedBossIds)]
    .filter((id) => !progress.firstBossKills.includes(id));
  const breakdown = {
    participation: result.durationMs >= META_TUNING.validDurationMs ? META_TUNING.participation : 0,
    firstValidRun: valid && !progress.firstValidRunClaimed ? META_TUNING.firstValidRun : 0,
    bosses: result.defeatedBossIds.reduce(
      (total, id) => total + META_TUNING.bossRewards[id],
      0,
    ),
    firstKills: newBossKills.length * META_TUNING.firstBossKill,
    clear: result.success ? META_TUNING.clear : 0,
  };
  const earned = Object.values(breakdown).reduce((total, value) => total + value, 0);
  return {
    earned,
    breakdown,
    progress: {
      ...copy(progress),
      parts: progress.parts + earned,
      claimedRunIds: [...progress.claimedRunIds, result.identity.runId],
      firstBossKills: [...progress.firstBossKills, ...newBossKills],
      firstValidRunClaimed: progress.firstValidRunClaimed || valid,
    },
  };
}

export function purchaseCore(progress: Readonly<MetaProgress>, core: OrbCoreId): MetaProgress {
  if (!ORB_CORE_IDS.includes(core)) throw new Error('unknown core');
  if (progress.unlockedCores.includes(core)) throw new Error('core already unlocked');
  const price = META_TUNING.corePrices[progress.unlockedCores.length - 1];
  if (price === undefined) throw new Error('all core unlocks purchased');
  if (progress.parts < price) throw new Error('insufficient parts');
  return {
    ...copy(progress),
    parts: progress.parts - price,
    unlockedCores: [...progress.unlockedCores, core],
  };
}

export function setLoadout(
  progress: Readonly<MetaProgress>,
  loadout: readonly OrbCoreId[],
): MetaProgress {
  if (loadout.length !== 3) throw new Error('loadout must contain exactly three cores');
  if (loadout.some((core) => !progress.unlockedCores.includes(core))) {
    throw new Error('locked core cannot be equipped');
  }
  return { ...copy(progress), loadout: [...loadout] as CoreLoadout };
}

function copy(progress: Readonly<MetaProgress>): MetaProgress {
  if (!Number.isFinite(progress.parts) || progress.parts < 0) throw new Error('parts cannot be negative');
  return {
    ...progress,
    unlockedCores: [...progress.unlockedCores],
    loadout: [...progress.loadout],
    claimedRunIds: [...progress.claimedRunIds],
    firstBossKills: [...progress.firstBossKills],
  };
}

function emptyBreakdown(): Settlement['breakdown'] {
  return { participation: 0, firstValidRun: 0, bosses: 0, firstKills: 0, clear: 0 };
}
