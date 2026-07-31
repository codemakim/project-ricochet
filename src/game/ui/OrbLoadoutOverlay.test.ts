import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Input: {
      Keyboard: {
        KeyCodes: {
          ONE: 49,
          TWO: 50,
          THREE: 51,
          FOUR: 52,
          ENTER: 13,
          R: 82,
        },
      },
    },
  },
}));

import { OrbCoreSelection, OrbLoadoutOverlay } from './OrbLoadoutOverlay';

class FakeEmitter {
  private readonly listeners = new Map<string, Array<() => void>>();

  on(event: string, callback: () => void): this {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push(callback);
    this.listeners.set(event, listeners);
    return this;
  }

  off(event: string, callback: () => void): this {
    this.listeners.set(
      event,
      (this.listeners.get(event) ?? []).filter((listener) => listener !== callback),
    );
    return this;
  }

  emit(event: string): void {
    for (const listener of this.listeners.get(event) ?? []) listener();
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
    readonly width?: number,
    readonly text?: string,
  ) {
    super();
  }

  setDepth(): this { return this; }
  setOrigin(): this { return this; }
  setInteractive(): this { this.interactive = true; return this; }
  setText(): this { return this; }
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
        rectangle: (
          _x: number,
          _y: number,
          width: number,
        ) => {
          const object = new FakeObject('rectangle', width);
          objects.push(object);
          return object;
        },
        text: (_x: number, _y: number, text: string) => {
          const object = new FakeObject('text', undefined, text);
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

describe('OrbCoreSelection', () => {
  it('accepts duplicate cores up to its exact capacity', () => {
    const selection = new OrbCoreSelection(3);

    expect(selection.add('echo')).toBe(true);
    expect(selection.add('echo')).toBe(true);
    expect(selection.add('inertia')).toBe(true);
    expect(selection.add('conduction')).toBe(false);
    expect(selection.confirm()).toEqual(['echo', 'echo', 'inertia']);
  });

  it('confirms only a full selection and can reset', () => {
    const selection = new OrbCoreSelection(1);

    expect(selection.confirm()).toBeNull();
    selection.add('corrosion');
    expect(selection.confirm()).toEqual(['corrosion']);
    selection.reset();
    expect(selection.confirm()).toBeNull();
    expect(selection.getSelection()).toEqual([]);
  });

  it.each([0, -1, 1.5])('rejects invalid capacity %s', (capacity) => {
    expect(() => new OrbCoreSelection(capacity)).toThrow(
      new RangeError('core selection capacity must be a positive integer'),
    );
  });
});

describe('OrbLoadoutOverlay', () => {
  it('confirms one available starting core once', () => {
    const { scene, objects } = makeScene();
    const overlay = new OrbLoadoutOverlay(scene as never);
    const confirm = vi.fn(() => true);

    overlay.showStarting(['echo', 'inertia'], confirm);
    const coreCards = objects.filter((object) => object.kind === 'rectangle' && object.width === 180);
    const confirmButton = objects.find(
      (object) => object.kind === 'rectangle' && object.width === 220,
    )!;
    coreCards[0]!.emit('pointerup');
    confirmButton.emit('pointerup');
    confirmButton.emit('pointerup');

    expect(confirm).toHaveBeenCalledOnce();
    expect(confirm).toHaveBeenCalledWith(['echo']);
    expect(coreCards).toHaveLength(2);
    expect(overlay.isVisible()).toBe(false);
    expect(objects.every((object) => object.destroyed)).toBe(true);
  });

  it('reuses the same overlay for one additional core', () => {
    const { scene, objects } = makeScene();
    const overlay = new OrbLoadoutOverlay(scene as never);
    const confirm = vi.fn(() => true);

    overlay.showAdditional(['echo', 'conduction'], confirm);
    const coreCards = objects.filter((object) => object.kind === 'rectangle' && object.width === 180);
    const confirmButton = objects.find(
      (object) => object.kind === 'rectangle' && object.width === 220,
    )!;
    expect(objects.filter(({ kind }) => kind === 'text').map(({ text }) => text))
      .toEqual(expect.arrayContaining(['1. 반향', '2. 전도']));
    expect(objects.some(({ text }) => text?.includes('4회 직격마다 주변 연쇄 피해')))
      .toBe(false);

    coreCards[1]!.emit('pointerup');
    expect(objects.some(
      ({ destroyed, text }) => !destroyed && text?.includes('4회 직격마다 주변 연쇄 피해'),
    )).toBe(true);
    confirmButton.emit('pointerup');

    expect(confirm).toHaveBeenCalledWith('conduction');
    expect(overlay.getSelection()).toEqual([]);
  });
});
