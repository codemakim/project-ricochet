import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import {
  createActorExitVisual,
  registerActorAnimations,
  playActorState,
} from './registerActorAnimations';

describe('actor animation runtime', () => {
  it('registers every declared state once', () => {
    const created: Array<{ key: string; frames: unknown[]; frameRate: number; repeat: number }> = [];
    const keys = new Set<string>();
    const scene = {
      anims: {
        exists: (key: string) => keys.has(key),
        create: (config: typeof created[number]) => {
          created.push(config);
          keys.add(config.key);
        },
      },
    } as unknown as Phaser.Scene;

    registerActorAnimations(scene);
    const count = created.length;
    registerActorAnimations(scene);

    expect(created.map(({ key }) => key)).toContain('actor:player:default:launch');
    expect(created.map(({ key }) => key)).toContain('actor:enemy-shooter:default:charge');
    expect(created.map(({ key }) => key)).toContain('actor:hive-core:default:enraged');
    expect(created).toHaveLength(count);
    expect(created.every(({ frames }) => frames.length > 0)).toBe(true);
  });

  it('plays a declared state and falls back only to idle', () => {
    const played: string[] = [];
    const sprite = {
      play: (key: string) => {
        played.push(key);
        return sprite;
      },
    } as unknown as Phaser.Physics.Arcade.Sprite;

    expect(playActorState(sprite, 'enemy-shooter', 'charge'))
      .toBe('actor:enemy-shooter:default:charge');
    expect(playActorState(sprite, 'enemy-basic', 'charge'))
      .toBe('actor:enemy-basic:default:idle');
    expect(played).toEqual([
      'actor:enemy-shooter:default:charge',
      'actor:enemy-basic:default:idle',
    ]);
  });

  it('creates a body-free terminal visual and destroys it after its animation', () => {
    let completed: (() => void) | undefined;
    const visual = {
      x: 0, y: 0, displayWidth: 0, displayHeight: 0, angle: 0, depth: 0,
      destroyed: false,
      setDisplaySize(width: number, height: number) {
        this.displayWidth = width; this.displayHeight = height; return this;
      },
      setAngle(angle: number) { this.angle = angle; return this; },
      setDepth(depth: number) { this.depth = depth; return this; },
      play() { return this; },
      once(_event: string, callback: () => void) { completed = callback; return this; },
      destroy() { this.destroyed = true; },
    };
    const scene = {
      add: { sprite: () => visual },
    } as unknown as Phaser.Scene;
    const source = {
      x: 12, y: 34, displayWidth: 70, displayHeight: 60, angle: 2, depth: 3,
    } as Phaser.GameObjects.Sprite;

    expect(createActorExitVisual(scene, source, 'enemy-basic', 'destroyed'))
      .toMatchObject({ displayWidth: 70, displayHeight: 60, angle: 2, depth: 3 });
    expect(visual.destroyed).toBe(false);
    completed?.();
    expect(visual.destroyed).toBe(true);
  });
});
