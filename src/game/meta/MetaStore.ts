import { ORB_CORE_IDS, type OrbCoreId } from '../orbs/orbCoreRules';
import type { BossKind } from '../config/gameTuning';
import { createDefaultMetaProgress, type MetaProgress } from './metaProgress';

const KEY = 'project-ricochet.meta';
const BOSS_IDS: BossKind[] = ['sentinel', 'hive', 'siege'];

export class MetaStore {
  constructor(
    private readonly storage: Storage = localStorage,
    private readonly now: () => number = Date.now,
  ) {}

  load(): MetaProgress {
    const raw = this.storage.getItem(KEY);
    if (raw === null) {
      const defaults = createDefaultMetaProgress();
      this.save(defaults);
      return defaults;
    }
    try {
      const value: unknown = JSON.parse(raw);
      const progress = parseProgress(value);
      if (isRecord(value) && value.schemaVersion === 1) this.save(progress);
      return progress;
    } catch {
      this.storage.setItem(`${KEY}.corrupt.${this.now()}`, raw);
      const defaults = createDefaultMetaProgress();
      this.save(defaults);
      return defaults;
    }
  }

  save(progress: MetaProgress): void {
    let validated: MetaProgress;
    try {
      validated = parseProgress(progress);
    } catch {
      throw new Error('invalid meta progress');
    }
    this.storage.setItem(KEY, JSON.stringify(validated));
  }

  clear(): void {
    this.storage.removeItem(KEY);
  }
}

function parseProgress(value: unknown): MetaProgress {
  if (!isRecord(value)
    || (value.schemaVersion !== 1 && value.schemaVersion !== 2)
    || !Number.isFinite(value.parts)
    || !Number.isInteger(value.parts)
    || (value.parts as number) < 0
    || typeof value.firstValidRunClaimed !== 'boolean'
  ) throw new Error('invalid meta progress');

  const unlockedCores = coreArray(value.unlockedCores);
  const loadout = coreArray(value.loadout);
  const expectedLength = value.schemaVersion === 1 ? 3 : 1;
  if (loadout.length !== expectedLength || loadout.some((core) => !unlockedCores.includes(core))) {
    throw new Error('invalid loadout');
  }
  const claimedRunIds = stringArray(value.claimedRunIds);
  const firstBossKills = bossArray(value.firstBossKills);
  return {
    schemaVersion: 2,
    parts: value.parts as number,
    unlockedCores,
    loadout: [loadout[0]!],
    claimedRunIds,
    firstBossKills,
    firstValidRunClaimed: value.firstValidRunClaimed,
  };
}

function coreArray(value: unknown): OrbCoreId[] {
  if (!Array.isArray(value) || value.some((item) => !ORB_CORE_IDS.includes(item))) {
    throw new Error('invalid core array');
  }
  return [...value] as OrbCoreId[];
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.length === 0)) {
    throw new Error('invalid string array');
  }
  return [...value];
}

function bossArray(value: unknown): BossKind[] {
  if (!Array.isArray(value) || value.some((item) => !BOSS_IDS.includes(item))) {
    throw new Error('invalid boss array');
  }
  return [...value] as BossKind[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
