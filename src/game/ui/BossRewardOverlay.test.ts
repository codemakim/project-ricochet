import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: { Input: { Keyboard: { KeyCodes: { ONE: 49, TWO: 50, THREE: 51 } } } },
}));

import { BossRewardOverlay } from './BossRewardOverlay';

class FakeEmitter {
  private readonly listeners = new Map<string, Array<() => void>>();
  on(event: string, callback: () => void): this {
    this.listeners.set(event, [...this.listeners.get(event) ?? [], callback]);
    return this;
  }
  off(event: string, callback: () => void): this {
    this.listeners.set(event, (this.listeners.get(event) ?? []).filter((item) => item !== callback));
    return this;
  }
  emit(event: string): void {
    for (const callback of this.listeners.get(event) ?? []) callback();
  }
}

class FakeObject extends FakeEmitter {
  destroyed = false;
  interactive = false;
  constructor(
    readonly kind: 'rectangle' | 'text',
    readonly y: number,
    readonly width?: number,
    readonly text?: string,
  ) { super(); }
  setDepth(): this { return this; }
  setOrigin(): this { return this; }
  setInteractive(): this { this.interactive = true; return this; }
  destroy(): void { this.destroyed = true; }
}

function makeScene() {
  const objects: FakeObject[] = [];
  const keys = new Map<number, FakeEmitter>();
  return {
    objects,
    keys,
    scene: {
      add: {
        rectangle: (_x: number, y: number, width: number) => {
          const object = new FakeObject('rectangle', y, width);
          objects.push(object);
          return object;
        },
        text: (_x: number, y: number, text: string) => {
          const object = new FakeObject('text', y, undefined, text);
          objects.push(object);
          return object;
        },
      },
      input: {
        keyboard: {
          addKey: (code: number) => {
            const key = new FakeEmitter();
            keys.set(code, key);
            return key;
          },
        },
      },
    },
  };
}

describe('BossRewardOverlay', () => {
  it('shows tagged relic and ability-rank choices with Korean copy', () => {
    const { scene, objects } = makeScene();
    const overlay = new BossRewardOverlay(scene as never);

    overlay.show([
      { kind: 'relic', id: 'cross-cut' },
      { kind: 'relic', id: 'resonance-rupture' },
      { kind: 'ability-rank', id: 'firepower' },
    ], () => true);

    const text = objects.filter(({ kind }) => kind === 'text').map(({ text: value }) => value);
    expect(text).toEqual(expect.arrayContaining([
      expect.stringContaining('교차 절단'),
      expect.stringContaining('반대 방향 절단선'),
      expect.stringContaining('공명 파열'),
      expect.stringContaining('화력 증폭 +1등급'),
    ]));
  });

  it('consumes touch or keyboard selection exactly once', () => {
    const { scene, objects, keys } = makeScene();
    const overlay = new BossRewardOverlay(scene as never);
    const onSelect = vi.fn(() => true);
    const choices = [
      { kind: 'relic', id: 'auxiliary-link' },
      { kind: 'relic', id: 'recursive-split' },
      { kind: 'ability-rank', id: 'kinetic' },
    ] as const;

    overlay.show(choices, onSelect);
    const cards = objects.filter(({ kind, width }) => kind === 'rectangle' && width === 380);
    cards[1]!.emit('pointerup');
    keys.get(49)!.emit('down');

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith(choices[1]);
    expect(overlay.isVisible()).toBe(false);
  });

  it('stays open when selection is rejected', () => {
    const { scene, objects } = makeScene();
    const overlay = new BossRewardOverlay(scene as never);
    const onSelect = vi.fn(() => false);

    overlay.show([
      { kind: 'relic', id: 'auxiliary-link' },
      { kind: 'relic', id: 'recursive-split' },
      { kind: 'ability-rank', id: 'kinetic' },
    ], onSelect);
    objects.find(({ kind, width }) => kind === 'rectangle' && width === 380)!.emit('pointerup');

    expect(overlay.isVisible()).toBe(true);
  });
});
