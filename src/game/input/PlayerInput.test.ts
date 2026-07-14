import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Input: {
      Keyboard: {
        KeyCodes: { W: 87, S: 83, A: 65, D: 68 },
      },
    },
  },
}));

import { PlayerInput } from './PlayerInput';

class FakeEmitter {
  private readonly listeners = new Map<string, Array<(pointer: FakePointer) => void>>();

  on(event: string, callback: (pointer: FakePointer) => void): void {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), callback]);
  }

  off(event: string, callback: (pointer: FakePointer) => void): void {
    this.listeners.set(event, (this.listeners.get(event) ?? []).filter((item) => item !== callback));
  }

  emit(event: string, pointer: FakePointer): void {
    for (const callback of this.listeners.get(event) ?? []) callback(pointer);
  }
}

interface FakePointer {
  id: number;
  x: number;
  y: number;
  worldX: number;
  worldY: number;
}

function createInput() {
  const emitter = new FakeEmitter();
  const mouse = { id: 0, x: 0, y: 0, worldX: 0, worldY: 0 };
  const keys = {
    up: { isDown: false },
    down: { isDown: false },
    left: { isDown: false },
    right: { isDown: false },
  };
  const graphics = () => ({
    setDepth() { return this; },
    clear() { return this; },
    lineStyle() { return this; },
    strokeCircle() { return this; },
    fillStyle() { return this; },
    fillCircle() { return this; },
    destroy() {},
  });
  const scene = {
    input: {
      mousePointer: mouse,
      keyboard: {
        addKeys: () => keys,
        removeKey: () => undefined,
      },
      addPointer: () => undefined,
      on: emitter.on.bind(emitter),
      off: emitter.off.bind(emitter),
    },
    add: { graphics },
  };
  return {
    input: new PlayerInput(scene as never, () => ({ x: 100, y: 100 })),
    emitter,
    mouse,
  };
}

describe('PlayerInput gameplay pointer gate', () => {
  it('preserves mouse aim while disabled and ignores overlay pointer movement', () => {
    const { input, emitter, mouse } = createInput();
    Object.assign(mouse, { worldX: 160, worldY: 40 });
    emitter.emit('pointermove', mouse);
    expect(input.aimCandidate).toEqual({ x: 60, y: -60 });

    input.setGameplayPointerEnabled(false);
    Object.assign(mouse, { worldX: 225, worldY: 530 });
    emitter.emit('pointermove', mouse);

    expect(input.aimCandidate).toEqual({ x: 60, y: -60 });
    expect(input.aimActivated).toBe(true);
  });

  it('resets held touch controls when disabled and leaves releases safe', () => {
    const { input, emitter } = createInput();
    const moveTouch = { id: 7, x: 80, y: 650, worldX: 80, worldY: 650 };
    const aimTouch = { id: 8, x: 360, y: 650, worldX: 360, worldY: 650 };
    emitter.emit('pointerdown', moveTouch);
    emitter.emit('pointerdown', aimTouch);
    Object.assign(moveTouch, { x: 128, y: 650 });
    Object.assign(aimTouch, { x: 312, y: 602 });
    emitter.emit('pointermove', moveTouch);
    emitter.emit('pointermove', aimTouch);
    expect(input.movement.x).toBe(1);
    expect(input.aimActivated).toBe(true);

    input.setGameplayPointerEnabled(false);
    expect(input.movement).toEqual({ x: 0, y: 0 });
    expect(input.aimActivated).toBe(false);
    emitter.emit('pointerup', moveTouch);
    emitter.emit('pointerup', aimTouch);
    input.setGameplayPointerEnabled(true);
    expect(input.movement).toEqual({ x: 0, y: 0 });
  });
});
