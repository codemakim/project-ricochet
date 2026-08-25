import { describe, expect, it } from 'vitest';
import {
  DEVELOPMENT_BALANCE_STORAGE_KEY,
  createDefaultDevelopmentBalanceSettings,
  loadDevelopmentBalanceSettings,
  parseDevelopmentBalanceSettings,
  saveDevelopmentBalanceSettings,
} from './developmentBalanceSettings';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

describe('development balance settings', () => {
  it('loads defaults and persists a valid balance', () => {
    const storage = new MemoryStorage();
    const defaults = loadDevelopmentBalanceSettings(storage, 17);
    expect(defaults).toEqual({
      normalEnemyHpMultiplier: 1,
      specialEnemyHpMultiplier: 1,
      descentSpeedMultiplier: 1,
      reinforcementIntervalMultiplier: 1,
      playerDamageMultiplier: 1,
      orbSpeedMultiplier: 1,
      startingOrbCount: 1,
      seed: 17,
    });

    saveDevelopmentBalanceSettings(storage, {
      ...defaults,
      playerDamageMultiplier: 2,
    });

    expect(loadDevelopmentBalanceSettings(storage, 99).playerDamageMultiplier).toBe(2);
  });

  it('recovers from malformed and out-of-range storage', () => {
    const storage = new MemoryStorage();
    storage.setItem(DEVELOPMENT_BALANCE_STORAGE_KEY, '{bad');
    expect(loadDevelopmentBalanceSettings(storage, 23).seed).toBe(23);
    storage.setItem(DEVELOPMENT_BALANCE_STORAGE_KEY, JSON.stringify({
      ...createDefaultDevelopmentBalanceSettings(1),
      startingOrbCount: 9,
    }));
    expect(loadDevelopmentBalanceSettings(storage, 24)).toEqual(
      createDefaultDevelopmentBalanceSettings(24),
    );
  });

  it('rejects every invalid trust-boundary value', () => {
    const valid = createDefaultDevelopmentBalanceSettings(1);
    expect(() => parseDevelopmentBalanceSettings({ ...valid, normalEnemyHpMultiplier: 0 }))
      .toThrow(RangeError);
    expect(() => parseDevelopmentBalanceSettings({ ...valid, descentSpeedMultiplier: 6 }))
      .toThrow(RangeError);
    expect(() => parseDevelopmentBalanceSettings({ ...valid, reinforcementIntervalMultiplier: 0 }))
      .toThrow(RangeError);
    expect(() => parseDevelopmentBalanceSettings({ ...valid, playerDamageMultiplier: Infinity }))
      .toThrow(RangeError);
    expect(() => parseDevelopmentBalanceSettings({ ...valid, orbSpeedMultiplier: 4.1 }))
      .toThrow(RangeError);
    expect(() => parseDevelopmentBalanceSettings({ ...valid, startingOrbCount: 1.5 }))
      .toThrow(RangeError);
    expect(() => parseDevelopmentBalanceSettings({ ...valid, seed: -1 }))
      .toThrow(RangeError);
  });
});
