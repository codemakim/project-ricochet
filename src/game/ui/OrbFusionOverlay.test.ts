import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Input: { Keyboard: { KeyCodes: {
      ONE: 49, TWO: 50, THREE: 51, FOUR: 52, FIVE: 53, SIX: 54, ENTER: 13,
    } } },
  },
}));

import { OrbFusionOverlay } from './OrbFusionOverlay';

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
  constructor(readonly kind: 'rectangle' | 'text', readonly text?: string) { super(); }
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
        rectangle: () => {
          const object = new FakeObject('rectangle');
          objects.push(object);
          return object;
        },
        text: (_x: number, _y: number, value: string) => {
          const object = new FakeObject('text', value);
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

const orb = (id: number, coreType: string, level: number) => ({ id, coreType, level }) as never;

describe('OrbFusionOverlay', () => {
  it('shows physical material pairs and confirms the exact selected pair', () => {
    const { scene, objects, keys } = makeScene();
    const overlay = new OrbFusionOverlay(scene as never);
    const confirm = vi.fn();

    overlay.show('photon-orbit', [
      orb(0, 'inertia', 4),
      orb(1, 'conduction', 2),
      orb(2, 'conduction', 5),
    ], confirm, vi.fn());

    expect(objects.map(({ text }) => text)).toEqual(expect.arrayContaining([
      expect.stringContaining('슬롯 1 · 관성 구슬 Lv4 + 슬롯 2 · 전도 구슬 Lv2 → 광자 궤도 Lv5'),
      expect.stringContaining('슬롯 1 · 관성 구슬 Lv4 + 슬롯 3 · 전도 구슬 Lv5 → 광자 궤도 Lv8'),
    ]));
    keys.get(50)!.emit('down');
    keys.get(13)!.emit('down');
    expect(confirm).toHaveBeenCalledWith(0, 2);
  });

  it('cancels when materials became stale before the picker opens', () => {
    const { scene } = makeScene();
    const overlay = new OrbFusionOverlay(scene as never);
    const cancel = vi.fn();

    overlay.show('photon-orbit', [orb(0, 'inertia', 1)], vi.fn(), cancel);

    expect(cancel).toHaveBeenCalledOnce();
    expect(overlay.isVisible()).toBe(false);
  });
});
