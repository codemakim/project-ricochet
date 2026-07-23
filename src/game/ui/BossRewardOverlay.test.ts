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
    const onSelect = vi.fn(() => true);

    overlay.show(
      'first',
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
    const onSelect = vi.fn(() => true);

    overlay.show('first', ['chain-warhead', 'expanded-magazine', 'opening-amplifier'], onSelect);
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

  it('keeps selection active when the callback rejects it', () => {
    const { scene, objects, keys } = makeScene();
    const overlay = new BossRewardOverlay(scene as never);
    const onSelect = vi.fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    overlay.show('first', ['expanded-magazine', 'recovery-capacitor', 'opening-amplifier'], onSelect);
    const firstCard = objects.find((object) => object.kind === 'rectangle' && object.width === 380)!;

    firstCard.emit('pointerup');
    expect(onSelect).toHaveBeenCalledOnce();
    expect(overlay.isVisible()).toBe(true);
    expect(firstCard.destroyed).toBe(false);

    keys.get(50)!.emit('down');
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onSelect).toHaveBeenLastCalledWith('recovery-capacitor');
    expect(overlay.isVisible()).toBe(false);
    expect(objects.every((object) => object.destroyed)).toBe(true);
  });

  it('shows the stronger second-tier heading and Korean copy for all seven rewards', () => {
    const rewards = [
      ['auxiliary-orbit', '보조 궤도', '영구 구슬 한도 +1'],
      ['recovery-salvo', '회수 일제사', '좌우 임시 구슬 2개'],
      ['siege-resonance', '공성 공명', '반경 80px · 피해 2'],
      ['hyperpressure-core', '초고압 탄심', '충전 직접 피해 +0.75'],
      ['inertial-penetration', '관성 관통', '반사 없이 방향·속도 유지'],
      ['aftershock-explosion', '잔향 폭발', '반경 80% · 피해 50%'],
      ['chain-split', '연쇄 분열', '±25° 자식 구슬 2개'],
    ] as const;

    for (const [id, label, effect] of rewards) {
      const { scene, objects } = makeScene();
      const overlay = new BossRewardOverlay(scene as never);
      overlay.show('second', [id, 'auxiliary-orbit', 'recovery-salvo'], () => true);
      const text = objects.filter((object) => object.kind === 'text').map((object) => object.text);
      expect(text).toEqual(expect.arrayContaining([
        expect.stringContaining('상위 유물'),
        expect.stringContaining(label),
        expect.stringContaining(effect),
      ]));
    }
  });

  it('keeps second-tier touch and keyboard selection one-shot', () => {
    const { scene, objects, keys } = makeScene();
    const overlay = new BossRewardOverlay(scene as never);
    const onSelect = vi.fn(() => true);
    overlay.show(
      'second',
      ['auxiliary-orbit', 'recovery-salvo', 'siege-resonance'],
      onSelect,
    );
    const firstCard = objects.find((object) => object.kind === 'rectangle' && object.width === 380)!;

    keys.get(50)!.emit('down');
    firstCard.emit('pointerup');
    keys.get(51)!.emit('down');

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith('recovery-salvo');
  });
});
