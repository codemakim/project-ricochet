import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Input: { Keyboard: { KeyCodes: { ONE: 49, TWO: 50, THREE: 51 } } },
  },
}));

import { BossRewardOverlay } from './BossRewardOverlay';

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

  removeAllListeners(): void {
    this.listeners.clear();
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
  destroy(): void {
    this.destroyed = true;
    this.removeAllListeners();
  }
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

describe('BossRewardOverlay', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows three Korean reward cards and consumes touch or keyboard selection once', () => {
    const { scene, objects, keys } = makeScene();
    const overlay = new BossRewardOverlay(scene as never);
    const onSelect = vi.fn();

    overlay.show(
      ['expanded-magazine', 'recovery-capacitor', 'opening-amplifier'],
      onSelect,
    );

    const cards = objects.filter((object) => object.kind === 'rectangle' && object.width === 380);
    expect(cards.map(({ y }) => y)).toEqual([270, 400, 530]);
    expect(cards.every((card) => card.height === 104 && card.interactive)).toBe(true);
    expect(objects.filter((object) => object.kind === 'text').map(({ text }) => text)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('증설 탄창'),
        expect.stringContaining('영구 구슬 +1'),
        expect.stringContaining('회수 축전기'),
        expect.stringContaining('근접 회수 충전 3 → 5'),
        expect.stringContaining('초동 증폭기'),
        expect.stringContaining('근접 회수 후 첫 적중 직접 피해 +1'),
      ]),
    );

    cards[1]!.emit('pointerup');
    cards[1]!.emit('pointerup');
    keys.get(49)!.emit('down');
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith('recovery-capacitor');
  });

  it('labels chain warhead and removes stale card and key callbacks on cleanup', () => {
    const { scene, objects, keys } = makeScene();
    const overlay = new BossRewardOverlay(scene as never);
    const onSelect = vi.fn();

    overlay.show(['chain-warhead', 'expanded-magazine', 'opening-amplifier'], onSelect);
    expect(objects.filter((object) => object.kind === 'text').map(({ text }) => text)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('연쇄 탄두'),
        expect.stringContaining('임시 분열 구슬도 폭발 효과 상속'),
      ]),
    );
    const firstCard = objects.find((object) => object.kind === 'rectangle' && object.width === 380)!;

    overlay.destroy();
    firstCard.emit('pointerup');
    keys.get(49)!.emit('down');

    expect(overlay.isVisible()).toBe(false);
    expect(objects.every((object) => object.destroyed)).toBe(true);
    expect([...keys.values()].every((key) => key.listenerCount('down') === 0)).toBe(true);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
