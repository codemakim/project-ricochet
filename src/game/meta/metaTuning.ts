import type { BossKind } from '../config/gameTuning';

export const META_TUNING = {
  validDurationMs: 180_000,
  participation: 10,
  firstValidRun: 30,
  bossRewards: {
    sentinel: 12,
    hive: 18,
    siege: 25,
  } satisfies Record<BossKind, number>,
  firstBossKill: 20,
  clear: 30,
  corePrices: [40, 100, 160, 220, 280] as const,
} as const;
