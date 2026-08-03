import { describe, expect, it } from 'vitest';
import { createDefaultMetaProgress } from './metaProgress';
import { MetaStore } from './MetaStore';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length(): number { return this.data.size; }
  clear(): void { this.data.clear(); }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string): void { this.data.delete(key); }
  setItem(key: string, value: string): void { this.data.set(key, value); }
}

describe('MetaStore', () => {
  it('migrates schema 1 loadouts and unlocked discoveries to schema 3', () => {
    const storage = new MemoryStorage();
    storage.setItem('project-ricochet.meta', JSON.stringify({
      schemaVersion: 1,
      parts: 40,
      unlockedCores: ['echo', 'inertia'],
      loadout: ['inertia', 'echo', 'echo'],
      claimedRunIds: [],
      firstBossKills: [],
      firstValidRunClaimed: true,
    }));

    const progress = new MetaStore(storage).load();

    expect(progress).toEqual({
      schemaVersion: 3,
      parts: 40,
      unlockedCores: ['echo', 'inertia'],
      discoveredCores: ['echo', 'inertia'],
      discoveredFusions: [],
      loadout: ['inertia'],
      claimedRunIds: [],
      firstBossKills: [],
      firstValidRunClaimed: true,
    });
    expect(JSON.parse(storage.getItem('project-ricochet.meta')!)).toEqual(progress);
  });

  it('migrates schema 2 unlocked cores as discovered', () => {
    const storage = new MemoryStorage();
    storage.setItem('project-ricochet.meta', JSON.stringify({
      schemaVersion: 2,
      parts: 10,
      unlockedCores: ['echo', 'conduction'],
      loadout: ['conduction'],
      claimedRunIds: [],
      firstBossKills: [],
      firstValidRunClaimed: false,
    }));

    expect(new MetaStore(storage).load()).toMatchObject({
      schemaVersion: 3,
      discoveredCores: ['echo', 'conduction'],
      discoveredFusions: [],
    });
  });

  it('round trips valid progress and ignores unknown fields', () => {
    const storage = new MemoryStorage();
    const store = new MetaStore(storage);
    const progress = { ...createDefaultMetaProgress(), parts: 50 };
    store.save(progress);
    storage.setItem('project-ricochet.meta', JSON.stringify({
      ...JSON.parse(storage.getItem('project-ricochet.meta')!),
      future: true,
    }));
    expect(store.load()).toEqual(progress);
  });

  it('backs up malformed JSON and restores defaults', () => {
    const storage = new MemoryStorage();
    storage.setItem('project-ricochet.meta', '{bad');
    const store = new MetaStore(storage, () => 123);
    expect(store.load()).toEqual(createDefaultMetaProgress());
    expect(storage.getItem('project-ricochet.meta.corrupt.123')).toBe('{bad');
  });

  it('recovers invalid loadouts and rejects invalid saves', () => {
    const storage = new MemoryStorage();
    storage.setItem('project-ricochet.meta', JSON.stringify({
      ...createDefaultMetaProgress(),
      loadout: ['echo', 'conduction', 'echo'],
    }));
    expect(new MetaStore(storage).load()).toEqual(createDefaultMetaProgress());
    expect(() => new MetaStore(storage).save({
      ...createDefaultMetaProgress(),
      parts: -1,
    })).toThrow('invalid meta progress');
  });

  it('recovers schema 3 saves containing unknown discoveries', () => {
    for (const invalid of [
      { discoveredCores: ['echo', 'unknown'], discoveredFusions: [] },
      { discoveredCores: ['echo'], discoveredFusions: ['unknown'] },
    ]) {
      const storage = new MemoryStorage();
      storage.setItem('project-ricochet.meta', JSON.stringify({
        ...createDefaultMetaProgress(),
        ...invalid,
      }));
      expect(new MetaStore(storage).load()).toEqual(createDefaultMetaProgress());
    }
  });
});
