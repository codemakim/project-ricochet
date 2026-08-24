import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import { COMBAT_VFX_PROFILES } from './combatVfxProfiles';
import { CombatVfxPlayer } from './CombatVfxPlayer';

class FakeTimer {
  removed = false;
  constructor(readonly dueAt: number, readonly callback: () => void) {}
  remove(): void { this.removed = true; }
}

class FakeSprite {
  active = true;
  destroyed = false;
  alpha = 0;
  rotation = 0;
  scale = 0;
  name = '';
  animation = '';
  constructor(public x: number, public y: number, readonly textureKey: string) {}
  setName(value: string): this { this.name = value; return this; }
  setDepth(): this { return this; }
  setBlendMode(): this { return this; }
  setScale(value: number): this { this.scale = value; return this; }
  setAlpha(value: number): this { this.alpha = value; return this; }
  setRotation(value: number): this { this.rotation = value; return this; }
  play(value: string): this { this.animation = value; return this; }
  destroy(): void { this.active = false; this.destroyed = true; }
}

function boundary() {
  const objects: FakeSprite[] = [];
  const timers: FakeTimer[] = [];
  let now = 0;
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
    time: {
      delayedCall: (delay: number, callback: () => void) => {
        const timer = new FakeTimer(now + delay, callback);
        timers.push(timer);
        return timer;
      },
    },
    game: { device: { os: { desktop: false } } },
  } as unknown as Phaser.Scene;
  const advance = (deltaMs: number) => {
    now += deltaMs;
    for (const timer of timers) {
      if (!timer.removed && timer.dueAt <= now) {
        timer.removed = true;
        timer.callback();
      }
    }
  };
  return { scene, objects, timers, advance };
}

describe('CombatVfxPlayer', () => {
  it('creates no physics body, enforces per-effect cap, and expires', () => {
    const { scene, objects, advance } = boundary();
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
    advance(COMBAT_VFX_PROFILES['orb-direct-hit'].durationMs);
    expect(player.activeCount()).toBe(0);
    expect(objects.every(({ destroyed }) => destroyed)).toBe(true);
  });

  it('clears active timers and refuses work after destroy', () => {
    const { scene, objects, timers } = boundary();
    const player = new CombatVfxPlayer(scene);
    expect(player.play('player-hit', { position: { x: 1, y: 2 }, intensity: 0.5 })).toBe(true);

    player.destroy();

    expect(player.activeCount()).toBe(0);
    expect(objects[0]?.destroyed).toBe(true);
    expect(timers[0]?.removed).toBe(true);
    expect(player.play('player-hit', { position: { x: 1, y: 2 }, intensity: 1 })).toBe(false);
  });
});
