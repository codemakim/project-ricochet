import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Input: {
      Keyboard: {
        KeyCodes: { ONE: 49, TWO: 50, THREE: 51, ENTER: 13 },
      },
    },
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
  setFillStyle(): this { return this; }
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

describe('LevelUpOverlay', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows compact cards and confirms only after a selected card', () => {
    const { scene, objects, keys } = makeScene();
    const overlay = new LevelUpOverlay(scene as never);
    const onSelect = vi.fn();

    overlay.show(['firepower', 'explosion', 'split'], new BuildState(), onSelect);

    const cards = objects.filter((object) => object.kind === 'rectangle' && object.width === 360);
    expect(cards.map(({ y }) => y)).toEqual([210, 310, 410]);
    expect(cards.every((card) => card.height === 76 && card.interactive)).toBe(true);
    expect(objects.flatMap(({ text }) => text ?? []).join(' ')).not.toContain('px');

    cards[1]!.emit('pointerup');
    expect(onSelect).not.toHaveBeenCalled();
    expect(objects.some(({ text }) => text?.includes('직격 시 20% 확률로 충격 폭발')))
      .toBe(true);

    keys.get(13)!.emit('down');
    keys.get(13)!.emit('down');
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith('explosion');

    overlay.hide();
    expect(objects.every((object) => object.destroyed)).toBe(true);
    expect([...keys.values()].every((key) => key.listenerCount('down') === 0)).toBe(true);
  });

  it('does not render a detail panel before selection', () => {
    const { scene, objects } = makeScene();
    const overlay = new LevelUpOverlay(scene as never);

    overlay.show(['kinetic'], new BuildState(), vi.fn());

    expect(objects.some(({ text }) => text === '획득')).toBe(false);
    expect(objects.flatMap(({ text }) => text ?? []).join(' ')).not.toContain('px/s');
  });

  it('makes destroyed cards unable to invoke stale pointer callbacks', () => {
    const { scene, objects } = makeScene();
    const overlay = new LevelUpOverlay(scene as never);
    const onSelect = vi.fn();
    overlay.show(['firepower'], new BuildState(), onSelect);
    const card = objects.find((object) => object.kind === 'rectangle' && object.width === 360)!;

    card.emit('pointerup');
    overlay.hide();
    card.emit('pointerup');

    expect(card.destroyed).toBe(true);
    expect(card.listenerCount('pointerup')).toBe(0);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('does not expose floating-point noise in kinetic speed text', () => {
    const { scene, objects } = makeScene();
    const overlay = new LevelUpOverlay(scene as never);

    overlay.show(['kinetic'], new BuildState({ kinetic: 1 }), vi.fn());

    const card = objects.find((object) => object.kind === 'rectangle' && object.width === 360)!;
    card.emit('pointerup');

    expect(objects.find((object) => object.text?.includes('구슬 속도'))?.text)
      .toContain('구슬 속도 14% 증가');
    expect(objects.flatMap(({ text }) => text ?? []).join(' ')).not.toContain('000000');
  });

  it('shows concise next-rank values for flight and effect modifiers', () => {
    const { scene, objects } = makeScene();
    const overlay = new LevelUpOverlay(scene as never);

    overlay.show(
      ['reload-overcharge', 'effect-output'],
      new BuildState(),
      vi.fn(),
    );

    const cards = objects.filter((object) => object.kind === 'rectangle' && object.width === 360);
    cards[0]!.emit('pointerup');
    cards[1]!.emit('pointerup');
    const labels = objects.flatMap(({ text }) => text ?? []);
    expect(labels).toEqual(expect.arrayContaining([
      expect.stringContaining('근접 회수 첫타 피해 +20%'),
      expect.stringContaining('보조 효과 피해 +15%'),
    ]));
  });
});
