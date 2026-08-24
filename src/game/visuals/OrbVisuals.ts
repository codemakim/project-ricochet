import type Phaser from 'phaser';
import type { OrbVisualLayerProfile, OrbVisualProfile } from './orbVisualProfiles';

export interface OrbVisualState {
  id: number;
  visible: boolean;
  rotation: number;
}

interface LayerVisual {
  object: Phaser.GameObjects.Image;
  profile: OrbVisualLayerProfile;
  frames: readonly string[];
}

interface OrbVisualEntry {
  owner: Phaser.Physics.Arcade.Sprite;
  body: Phaser.GameObjects.Image;
  layers: LayerVisual[];
}

export class OrbVisuals {
  private readonly entries = new Map<number, OrbVisualEntry>();

  constructor(private readonly scene: Phaser.Scene) {}

  add(
    id: number,
    owner: Phaser.Physics.Arcade.Sprite,
    profile: OrbVisualProfile,
  ): void {
    this.remove(id);
    const body = this.scene.add.image(0, 0, profile.bodyTextureKey)
      .setName(`orb-body-${id}`)
      .setVisible(false);
    const layers = profile.layers.map((layer) => {
      const object = layer.motion.kind === 'frames'
        ? this.scene.add.sprite(0, 0, layer.textureKey)
        : this.scene.add.image(0, 0, layer.textureKey);
      object.setName(`orb-layer-${id}-${layer.id}`)
        .setBlendMode(layer.blendMode)
        .setVisible(false);
      return {
        object,
        profile: layer,
        frames: object.texture.getFrameNames().filter((frame) => frame !== '__BASE'),
      };
    });
    this.entries.set(id, { owner, body, layers });
  }

  update(nowMs: number, states: readonly OrbVisualState[]): void {
    const stateById = new Map(states.map((state) => [state.id, state]));
    for (const [id, entry] of this.entries) {
      const state = stateById.get(id);
      const visible = state?.visible ?? false;
      const rotation = state?.rotation ?? entry.owner.rotation;
      entry.body
        .setPosition(entry.owner.x, entry.owner.y)
        .setDisplaySize(entry.owner.displayWidth, entry.owner.displayHeight)
        .setRotation(rotation)
        .setVisible(visible);
      for (const layer of entry.layers) {
        const { object, profile } = layer;
        const width = entry.owner.displayWidth * profile.scale;
        const height = entry.owner.displayHeight * profile.scale;
        let x = entry.owner.x;
        let y = entry.owner.y;
        let layerRotation = rotation;
        let alpha = 1;
        if (profile.motion.kind === 'spin') {
          layerRotation += nowMs / 1000
            * profile.motion.radiansPerSecond
            * profile.motion.direction;
        } else if (profile.motion.kind === 'pulse') {
          const phase = (Math.sin(nowMs / profile.motion.periodMs * Math.PI * 2) + 1) / 2;
          alpha = profile.motion.alphaMinimum
            + (profile.motion.alphaMaximum - profile.motion.alphaMinimum) * phase;
        } else if (profile.motion.kind === 'orbit') {
          const angle = nowMs / profile.motion.periodMs * Math.PI * 2 + profile.motion.phase;
          x += Math.cos(angle) * profile.motion.radius;
          y += Math.sin(angle) * profile.motion.radius;
        } else if (layer.frames.length > 0) {
          const index = Math.floor(nowMs / 1000 * profile.motion.frameRate) % layer.frames.length;
          object.setFrame(layer.frames[index]!);
        }
        object.setPosition(x, y)
          .setDisplaySize(width, height)
          .setRotation(layerRotation)
          .setAlpha(alpha)
          .setVisible(visible);
      }
    }
  }

  remove(id: number): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.body.destroy();
    for (const { object } of entry.layers) object.destroy();
    this.entries.delete(id);
  }

  clear(): void {
    for (const id of [...this.entries.keys()]) this.remove(id);
  }

  activeObjectCount(): number {
    let total = 0;
    for (const entry of this.entries.values()) total += 1 + entry.layers.length;
    return total;
  }
}
