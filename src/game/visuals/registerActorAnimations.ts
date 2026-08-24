import type Phaser from 'phaser';
import {
  ACTOR_SKIN_PROFILES,
  actorAnimationKey,
  actorSkinProfile,
  type ActorRole,
  type ActorState,
} from './actorVisualProfiles';

export function registerActorAnimations(scene: Phaser.Scene): void {
  for (const profile of ACTOR_SKIN_PROFILES) {
    for (const [state, animation] of Object.entries(profile.states)) {
      if (!animation) continue;
      const key = actorAnimationKey(profile.role, profile.skinId, state as ActorState);
      if (scene.anims.exists(key)) continue;
      scene.anims.create({
        key,
        frames: animation.frames.map((frame) => ({ key: profile.textureKey, frame })),
        frameRate: animation.frameRate,
        repeat: animation.repeat,
      });
    }
  }
}

export function playActorState(
  sprite: Phaser.GameObjects.Sprite,
  role: ActorRole,
  state: ActorState,
  skinId = 'default',
): string {
  const profile = actorSkinProfile(role, skinId);
  const resolved = profile.states[state] ? state : 'idle';
  const key = actorAnimationKey(role, skinId, resolved);
  sprite.play(key, true);
  return key;
}

export function createActorExitVisual(
  scene: Phaser.Scene,
  source: Phaser.GameObjects.Sprite,
  role: ActorRole,
  state: Extract<ActorState, 'fracture' | 'destroyed' | 'broken' | 'defeated'>,
  skinId = 'default',
): Phaser.GameObjects.Sprite {
  const profile = actorSkinProfile(role, skinId);
  const visual = scene.add.sprite(source.x, source.y, profile.textureKey, 0)
    .setDisplaySize(source.displayWidth, source.displayHeight)
    .setAngle(source.angle)
    .setDepth(source.depth);
  const key = playActorState(visual, role, state, skinId);
  visual.once(`animationcomplete-${key}`, () => visual.destroy());
  return visual;
}
