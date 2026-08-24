import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import { orbVisualProfile } from './orbVisualProfiles';
import { OrbVisuals } from './OrbVisuals';

class FakeVisual {
  x = 0;
  y = 0;
  visible = false;
  rotation = 0;
  alpha = 0;
  displayWidth = 0;
  displayHeight = 0;
  destroyed = false;
  frame: string | number = 0;
  readonly texture = { getFrameNames: () => ['0', '1', '2', '3'] };

  setName(): this { return this; }
  setBlendMode(): this { return this; }
  setDepth(): this { return this; }
  setVisible(value: boolean): this { this.visible = value; return this; }
  setPosition(x: number, y: number): this { this.x = x; this.y = y; return this; }
  setRotation(value: number): this { this.rotation = value; return this; }
  setAlpha(value: number): this { this.alpha = value; return this; }
  setDisplaySize(width: number, height: number): this {
    this.displayWidth = width; this.displayHeight = height; return this;
  }
  setFrame(frame: string | number): this { this.frame = frame; return this; }
  destroy(): void { this.destroyed = true; }
}

function boundary() {
  const children: FakeVisual[] = [];
  const add = () => {
    const child = new FakeVisual();
    children.push(child);
    return child;
  };
  const scene = { add: { image: add, sprite: add } } as unknown as Phaser.Scene;
  const owner = {
    x: 120,
    y: 240,
    rotation: 0.5,
    displayWidth: 42,
    displayHeight: 42,
  } as Phaser.Physics.Arcade.Sprite;
  return { scene, owner, children };
}

describe('OrbVisuals', () => {
  it('tracks body and layers to the owner without physics bodies', () => {
    const { scene, owner, children } = boundary();
    const visuals = new OrbVisuals(scene);
    visuals.add(7, owner, orbVisualProfile('conduction'));

    visuals.update(260, [{ id: 7, visible: true, rotation: 0.5 }]);

    expect(children).toHaveLength(3);
    expect(children.every((child) => !('body' in child))).toBe(true);
    expect(children.every((child) => child.x === owner.x && child.y === owner.y)).toBe(true);
    expect(children.some((child) => child.rotation !== 0.5)).toBe(true);
    expect(children.every((child) => child.visible)).toBe(true);
    expect(children.every((child) => child.displayWidth > 0)).toBe(true);
  });

  it('removes one orb or every orb without touching the owner', () => {
    const { scene, owner, children } = boundary();
    const visuals = new OrbVisuals(scene);
    visuals.add(1, owner, orbVisualProfile('echo'));
    visuals.add(2, owner, orbVisualProfile('conduction'));

    visuals.remove(2);
    expect(visuals.activeObjectCount()).toBe(3);
    expect(children.filter(({ destroyed }) => destroyed)).toHaveLength(3);

    visuals.clear();
    expect(visuals.activeObjectCount()).toBe(0);
    expect(children.every(({ destroyed }) => destroyed)).toBe(true);
  });
});
