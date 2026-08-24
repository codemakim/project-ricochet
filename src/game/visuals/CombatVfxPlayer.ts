import type Phaser from 'phaser';
import { GAME_TUNING } from '../config/gameTuning';
import type { Vector } from '../math/vector';
import type { CombatVfxId } from './combatVfxIds';
import { COMBAT_VFX_PROFILES } from './combatVfxProfiles';

interface PlayCombatVfxOptions {
  position: Vector;
  direction?: Vector;
  intensity?: number;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
}

interface ActiveVfx {
  id: CombatVfxId;
  sprite: Phaser.GameObjects.Sprite;
  timer: Phaser.Time.TimerEvent;
}

export class CombatVfxPlayer {
  private readonly active = new Set<ActiveVfx>();
  private destroyed = false;

  constructor(private readonly scene: Phaser.Scene) {}

  play(id: CombatVfxId, options: PlayCombatVfxOptions): boolean {
    if (this.destroyed) return false;
    const profile = COMBAT_VFX_PROFILES[id];
    const totalCap = this.scene.game.device.os.desktop
      ? GAME_TUNING.visual.productionVfx.desktopMaximumTotal
      : GAME_TUNING.visual.productionVfx.mobileMaximumTotal;
    if (this.active.size >= totalCap || this.activeCount(id) >= profile.maximumConcurrent) {
      return false;
    }
    const animationKey = `production-vfx-${id}`;
    if (!this.scene.anims.exists(animationKey)) {
      this.scene.anims.create({
        key: animationKey,
        frames: Array.from({ length: profile.frameCount }, (_, frame) => ({
          key: profile.textureKey,
          frame,
        })),
        frameRate: profile.frameRate,
        repeat: 0,
      });
    }
    const intensity = Math.max(0, options.intensity ?? 1);
    const alpha = Math.min(
      GAME_TUNING.visual.productionVfx.maximumAlpha,
      Math.max(GAME_TUNING.visual.productionVfx.minimumAlpha, profile.alpha * intensity),
    );
    const rotation = options.direction
      ? Math.atan2(options.direction.y, options.direction.x)
      : 0;
    const scale = Math.max(0.1, options.scale ?? 1) * profile.scale;
    const sprite = this.scene.add.sprite(
      options.position.x,
      options.position.y,
      profile.textureKey,
    ).setName(`production-vfx-${id}`)
      .setDepth(profile.depth)
      .setBlendMode(profile.blendMode)
      .setScale(
        scale * Math.max(0.1, options.scaleX ?? 1),
        scale * Math.max(0.1, options.scaleY ?? 1),
      )
      .setAlpha(alpha)
      .setRotation(rotation)
      .play(animationKey);
    const entry = {} as ActiveVfx;
    const timer = this.scene.time.delayedCall(profile.durationMs, () => this.remove(entry));
    Object.assign(entry, { id, sprite, timer });
    this.active.add(entry);
    return true;
  }

  activeCount(id?: CombatVfxId): number {
    if (!id) return this.active.size;
    let count = 0;
    for (const effect of this.active) if (effect.id === id) count += 1;
    return count;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const effect of [...this.active]) this.remove(effect);
  }

  private remove(effect: ActiveVfx): void {
    if (!this.active.delete(effect)) return;
    effect.timer.remove(false);
    effect.sprite.destroy();
  }
}
