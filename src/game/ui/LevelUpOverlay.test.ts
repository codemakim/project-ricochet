import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Input: { Keyboard: { KeyCodes: { ONE: 49, TWO: 50, THREE: 51 } } },
  },
}));

import { BuildState } from '../progression/BuildState';
import { LevelUpOverlay } from './LevelUpOverlay';

class FakeEmitter {
  private readonly listeners = new Map<string, Array<(...args: unknown[]) => void>>();

  on(event: string, callback: (...args: unknown[]) => void): this {
    const callbacks = this.listeners.get(event) ?? [];
    callbacks.push(callback);
    this.listeners.set(event, callbacks);
    return this;
  }

  off(event: string, callback: (...args: unknown[]) => void): this {
    this.listeners.set(event, (this.listeners.get(event) ?? []).filter((item) => item !== callback));
    return this;
  }

  emit(event: string): void {
    for (const callback of this.listeners.get(event) ?? []) callback();
  }

  listenerCount(event: string): number {
    return this.listeners.get(event)?.length ?? 0;
  }
}

class FakeObject extends FakeEmitter {
  destroyed = false;
  interactive = false;

  constructor(
    readonly kind: 'rectangle' | 'text',
    readonly x: number,
    readonly y: number,
    readonly width?: number,
    readonly height?: number,
    readonly text?: string,
  ) {
    super();
  }

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
        rectangle: (x: number, y: number, width: number, height: number) => {
          const object = new FakeObject('rectangle', x, y, width, height);
          objects.push(object);
          return object;
        },
        text: (x: number, y: number, text: string) => {
          const object = new FakeObject('text', x, y, undefined, undefined, text);
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

describe('LevelUpOverlay', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates three cards and consumes pointer or keyboard selection once per show', () => {
    const { scene, objects, keys } = makeScene();
    const overlay = new LevelUpOverlay(scene as never);
    const first = vi.fn();

    overlay.show(['firepower', 'explosion', 'split'], new BuildState(), first);

    const cards = objects.filter((object) => object.kind === 'rectangle' && object.width === 360);
    expect(cards.map(({ y }) => y)).toEqual([270, 400, 530]);
    expect(cards.every((card) => card.height === 104 && card.interactive)).toBe(true);
    expect(objects.filter((object) => object.kind === 'text').map(({ text }) => text)).toEqual(expect.arrayContaining([
      expect.stringContaining('화력 증폭'),
      expect.stringContaining('직접 피해 +0.25'),
      expect.stringContaining('폭발'),
      expect.stringContaining('반경 48px · 피해 0.5'),
      expect.stringContaining('분열'),
      expect.stringContaining('임시 구슬 1개'),
    ]));

    cards[1]!.emit('pointerup');
    cards[1]!.emit('pointerup');
    keys.get(49)!.emit('down');
    expect(first).toHaveBeenCalledOnce();
    expect(first).toHaveBeenCalledWith('explosion');

    overlay.hide();
    expect(objects.every((object) => object.destroyed)).toBe(true);
    expect([...keys.values()].every((key) => key.listenerCount('down') === 0)).toBe(true);

    const second = vi.fn();
    overlay.show(['firepower', 'explosion', 'split'], new BuildState(), second);
    keys.get(52)?.emit('down');
    expect(second).not.toHaveBeenCalled();
    keys.get(51)!.emit('down');
    keys.get(51)!.emit('down');
    expect(second).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledWith('split');

    overlay.hide();
    expect(overlay.isVisible()).toBe(false);
    expect([...keys.values()].every((key) => key.listenerCount('down') === 0)).toBe(true);
  });
});
