import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Input: { Keyboard: { KeyCodes: { ENTER: 13 } } },
  },
}));

import { RunCompleteOverlay } from './RunCompleteOverlay';

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
  const enter = new FakeEmitter();
  return {
    objects,
    enter,
    scene: {
      add: {
        rectangle: () => {
          const object = new FakeObject('rectangle');
          objects.push(object);
          return object;
        },
        text: (_x: number, _y: number, text: string) => {
          const object = new FakeObject('text', text);
          objects.push(object);
          return object;
        },
      },
      input: { keyboard: { addKey: () => enter } },
    },
  };
}

describe('RunCompleteOverlay', () => {
  it('shows RUN COMPLETE and exposes a one-shot RESTART action', () => {
    const { scene, objects, enter } = makeScene();
    const restart = vi.fn();
    const overlay = new RunCompleteOverlay(scene as never);

    overlay.show(restart);

    expect(overlay.isVisible()).toBe(true);
    expect(objects.filter(({ kind }) => kind === 'text').map(({ text }) => text))
      .toEqual(expect.arrayContaining(['RUN COMPLETE', 'RESTART']));
    const action = objects.find(({ text }) => text === 'RESTART')!;
    expect(action.interactive).toBe(true);

    action.emit('pointerup');
    enter.emit('down');
    expect(restart).toHaveBeenCalledOnce();
    expect(overlay.isVisible()).toBe(false);
  });

  it('removes visible objects and keyboard input on destroy', () => {
    const { scene, objects, enter } = makeScene();
    const restart = vi.fn();
    const overlay = new RunCompleteOverlay(scene as never);
    overlay.show(restart);

    overlay.destroy();
    enter.emit('down');

    expect(overlay.isVisible()).toBe(false);
    expect(objects.every(({ destroyed }) => destroyed)).toBe(true);
    expect(enter.listenerCount('down')).toBe(0);
    expect(restart).not.toHaveBeenCalled();
  });
});
