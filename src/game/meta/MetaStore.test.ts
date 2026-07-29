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
});
