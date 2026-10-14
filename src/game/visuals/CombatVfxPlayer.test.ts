import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import { COMBAT_VFX_PROFILES } from './combatVfxProfiles';
import { CombatVfxPlayer } from './CombatVfxPlayer';

class FakeSprite {
  active = true;
  destroyed = false;
  alpha = 0;
  rotation = 0;
  scale = 0;
  scaleY = 0;
  name = '';
  animation = '';
  complete?: () => void;
  paused = false;
  anims = {
    pause: () => { this.paused = true; },
    resume: () => { this.paused = false; },
  };
  constructor(public x: number, public y: number, readonly textureKey: string) {}
  setName(value: string): this { this.name = value; return this; }
  setDepth(): this { return this; }
  setBlendMode(): this { return this; }
  setScale(x: number, y = x): this { this.scale = x; this.scaleY = y; return this; }
  setAlpha(value: number): this { this.alpha = value; return this; }
  setRotation(value: number): this { this.rotation = value; return this; }
  play(value: string): this { this.animation = value; return this; }
  once(_event: string, callback: () => void): this { this.complete = callback; return this; }
  destroy(): void { this.active = false; this.destroyed = true; }
}

function boundary() {
  const objects: FakeSprite[] = [];
  const animationKeys = new Set<string>();
  const scene = {
    add: {
      sprite: (x: number, y: number, textureKey: string) => {
        const sprite = new FakeSprite(x, y, textureKey);
        objects.push(sprite);
        return sprite;
      },
    },
    anims: {
      exists: (key: string) => animationKeys.has(key),
      create: ({ key }: { key: string }) => animationKeys.add(key),
    },
    game: { device: { os: { desktop: false } } },
  } as unknown as Phaser.Scene;
  return { scene, objects };
}

describe('CombatVfxPlayer', () => {
  it('creates no physics body, enforces per-effect cap, and expires', () => {
    const { scene, objects } = boundary();
    const player = new CombatVfxPlayer(scene);
    for (let index = 0; index < 20; index += 1) {
      player.play('orb-direct-hit', {
        position: { x: index, y: 40 }, direction: { x: 1, y: 0 }, intensity: 1,
      });
    }

    expect(objects.every((object) => !('body' in object))).toBe(true);
    expect(player.activeCount('orb-direct-hit')).toBe(
      COMBAT_VFX_PROFILES['orb-direct-hit'].maximumConcurrent,
    );
    objects.forEach((sprite) => sprite.complete?.());
    expect(player.activeCount()).toBe(0);
    expect(objects.every(({ destroyed }) => destroyed)).toBe(true);
  });

  it('clears effects for a transition, remains usable, and refuses work after destroy', () => {
    const { scene, objects } = boundary();
    const player = new CombatVfxPlayer(scene);
    expect(player.play('player-hit', { position: { x: 1, y: 2 }, intensity: 0.5 })).toBe(true);

    player.clear();

    expect(player.activeCount()).toBe(0);
    expect(objects[0]?.destroyed).toBe(true);
    expect(player.play('boss-defeat', { position: { x: 1, y: 2 } })).toBe(true);
    objects[0]?.complete?.();
    expect(player.activeCount('boss-defeat')).toBe(1);
    player.destroy();
    expect(player.activeCount()).toBe(0);
    expect(player.play('player-hit', { position: { x: 1, y: 2 }, intensity: 1 })).toBe(false);
  });

  it('pauses current and newly created animations while hidden', () => {
    const { scene, objects } = boundary();
    const player = new CombatVfxPlayer(scene);
    player.play('boss-defeat', { position: { x: 1, y: 2 } });
    player.setPaused(true);
    player.play('boss-core-rage', { position: { x: 1, y: 2 } });
    expect(objects.every((sprite) => sprite.paused)).toBe(true);
    player.setPaused(false);
    expect(objects.every((sprite) => !sprite.paused)).toBe(true);
    objects.forEach((sprite) => sprite.complete?.());
    expect(player.activeCount()).toBe(0);
  });

  it('stretches directional lightning without thickening it', () => {
    const { scene, objects } = boundary();
    const player = new CombatVfxPlayer(scene);

    player.play('conduction-arc', {
      position: { x: 20, y: 40 }, direction: { x: 0, y: 1 }, scaleX: 3, scaleY: 1,
    });

    expect(COMBAT_VFX_PROFILES['conduction-arc']).toMatchObject({
      frameWidth: 256,
      frameHeight: 256,
    });
    expect(objects[0]).toMatchObject({ rotation: Math.PI / 2, scale: 0.9375, scaleY: 0.3125 });
  });
});
