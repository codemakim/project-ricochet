import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Input: {
      Keyboard: {
        KeyCodes: { ONE: 49, TWO: 50, THREE: 51, FOUR: 52, FIVE: 53, SIX: 54, ENTER: 13 },
      },
    },
  },
}));

import { OrbUpgradeOverlay } from './OrbUpgradeOverlay';

class FakeEmitter {
  private readonly listeners = new Map<string, Array<() => void>>();
  on(event: string, callback: () => void): this {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), callback]);
    return this;
  }
  off(event: string, callback: () => void): this {
    this.listeners.set(event, (this.listeners.get(event) ?? []).filter((item) => item !== callback));
    return this;
  }
  emit(event: string): void { for (const callback of this.listeners.get(event) ?? []) callback(); }
  removeAllListeners(): void { this.listeners.clear(); }
}

class FakeObject extends FakeEmitter {
  destroyed = false;
  constructor(readonly kind: 'rectangle' | 'text', readonly width?: number, readonly text?: string) {
    super();
  }
  setDepth(): this { return this; }
  setOrigin(): this { return this; }
  setInteractive(): this { return this; }
  setFillStyle(): this { return this; }
  destroy(): void { this.destroyed = true; this.removeAllListeners(); }
}

function makeScene() {
  const objects: FakeObject[] = [];
  const keys = new Map<number, FakeEmitter>();
  return {
    objects,
    keys,
    scene: {
      add: {
        rectangle: (_x: number, _y: number, width: number) => {
          const object = new FakeObject('rectangle', width);
          objects.push(object);
          return object;
        },
        text: (_x: number, _y: number, value: string) => {
          const object = new FakeObject('text', undefined, value);
          objects.push(object);
          return object;
        },
      },
      input: { keyboard: { addKey: (code: number) => {
        const key = new FakeEmitter();
        keys.set(code, key);
        return key;
      } } },
    },
  };
}

const snapshot = (id: number, coreType: string, level: number) => ({
  id, coreType, level,
}) as never;

describe('OrbUpgradeOverlay', () => {
  it('shows duplicate physical targets separately and confirms the exact selected id', () => {
    const { scene, objects, keys } = makeScene();
    const overlay = new OrbUpgradeOverlay(scene as never);
    const confirm = vi.fn();

    overlay.show('conduction', [
      snapshot(0, 'echo', 1),
      snapshot(1, 'conduction', 1),
      snapshot(2, 'conduction', 4),
      snapshot(3, 'conduction', 5),
    ], confirm, vi.fn());

    expect(objects.map(({ text }) => text)).toEqual(expect.arrayContaining([
      '슬롯 2 · 전도 구슬 Lv1',
      '슬롯 3 · 전도 구슬 Lv4',
    ]));
    expect(objects.some(({ text }) => text?.includes('Lv5'))).toBe(false);

    keys.get(50)!.emit('down');
    keys.get(13)!.emit('down');
    expect(confirm).toHaveBeenCalledWith(2);
  });

  it('preselects a sole target but still requires final confirmation', () => {
    const { scene, keys } = makeScene();
    const overlay = new OrbUpgradeOverlay(scene as never);
    const confirm = vi.fn();

    overlay.show('split', [snapshot(4, 'split', 2)], confirm, vi.fn());
    expect(confirm).not.toHaveBeenCalled();
    keys.get(13)!.emit('down');
    expect(confirm).toHaveBeenCalledWith(4);
  });

  it('cancels immediately when no valid target remains', () => {
    const { scene } = makeScene();
    const overlay = new OrbUpgradeOverlay(scene as never);
    const cancel = vi.fn();

    overlay.show('echo', [snapshot(0, 'echo', 5)], vi.fn(), cancel);

    expect(cancel).toHaveBeenCalledOnce();
    expect(overlay.isVisible()).toBe(false);
  });
});
