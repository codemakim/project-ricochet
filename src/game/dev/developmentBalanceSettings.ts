export interface DevelopmentBalanceSettings {
  normalEnemyHpMultiplier: number;
  specialEnemyHpMultiplier: number;
  descentSpeedMultiplier: number;
  reinforcementIntervalMultiplier: number;
  playerDamageMultiplier: number;
  orbSpeedMultiplier: number;
  startingOrbCount: number;
  seed: number;
}

export const DEVELOPMENT_BALANCE_STORAGE_KEY = 'project-ricochet.dev-balance.v2';

const RANGES = {
  normalEnemyHpMultiplier: [0.1, 10],
  specialEnemyHpMultiplier: [0.1, 10],
  descentSpeedMultiplier: [0, 5],
  reinforcementIntervalMultiplier: [0.1, 4],
  playerDamageMultiplier: [0.1, 10],
  orbSpeedMultiplier: [0.25, 4],
  startingOrbCount: [1, 6],
  seed: [0, 0xffff_ffff],
} as const satisfies Record<keyof DevelopmentBalanceSettings, readonly [number, number]>;

export function createDefaultDevelopmentBalanceSettings(
  seed: number,
): DevelopmentBalanceSettings {
  return {
    normalEnemyHpMultiplier: 1,
    specialEnemyHpMultiplier: 1,
    descentSpeedMultiplier: 1,
    reinforcementIntervalMultiplier: 1,
    playerDamageMultiplier: 1,
    orbSpeedMultiplier: 1,
    startingOrbCount: 1,
    seed,
  };
}

export function parseDevelopmentBalanceSettings(
  value: unknown,
): DevelopmentBalanceSettings {
  if (!isRecord(value)) throw new RangeError('development balance must be an object');
  const parsed = {} as DevelopmentBalanceSettings;
  for (const key of Object.keys(RANGES) as (keyof DevelopmentBalanceSettings)[]) {
    const current = value[key];
    const [minimum, maximum] = RANGES[key];
    if (typeof current !== 'number'
      || !Number.isFinite(current)
      || current < minimum
      || current > maximum
      || ((key === 'startingOrbCount' || key === 'seed') && !Number.isInteger(current))) {
      throw new RangeError(`${key} must be within ${minimum}..${maximum}`);
    }
    parsed[key] = current;
  }
  return parsed;
}

export function loadDevelopmentBalanceSettings(
  storage: Storage,
  seed: number,
): DevelopmentBalanceSettings {
  const raw = storage.getItem(DEVELOPMENT_BALANCE_STORAGE_KEY);
  if (raw === null) return createDefaultDevelopmentBalanceSettings(seed);
  try {
    return parseDevelopmentBalanceSettings(JSON.parse(raw));
  } catch {
    return createDefaultDevelopmentBalanceSettings(seed);
  }
}

export function saveDevelopmentBalanceSettings(
  storage: Storage,
  settings: DevelopmentBalanceSettings,
): void {
  storage.setItem(
    DEVELOPMENT_BALANCE_STORAGE_KEY,
    JSON.stringify(parseDevelopmentBalanceSettings(settings)),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
