import type Phaser from 'phaser';
import { GAME_TUNING } from '../config/gameTuning';
import {
  renderableCombatTextureDescriptors,
  type CombatTextureDescriptor,
} from '../scenes/combatTextureRules';

export const FALLBACK_COMBAT_TEXTURE_KEYS = [
  'player', 'enemy-basic', 'enemy-armored', 'enemy-shooter',
  'boss-body', 'boss-left-weakpoint', 'boss-right-weakpoint', 'boss-core',
  'boss-aim-marker', 'boss-drop-marker',
  ...Object.keys(renderableCombatTextureDescriptors()),
] as const;

export function missingCombatTextureKeys(
  hasTexture: (key: string) => boolean,
): string[] {
  return FALLBACK_COMBAT_TEXTURE_KEYS.filter((key) => !hasTexture(key));
}

export function createCombatFallbackTextures(scene: Phaser.Scene): void {
  const missing = new Set(missingCombatTextureKeys((key) => scene.textures.exists(key)));
  if (missing.size === 0) return;

  const graphics = scene.add.graphics();
  const shouldCreate = (key: string): boolean => missing.has(key);
  const { cellWidth, cellHeight } = GAME_TUNING.encounter.grid;

  if (shouldCreate('player')) {
    const { width, height } = GAME_TUNING.player.visual;
    graphics.fillStyle(0x4ddcff).fillCircle(width / 2, height / 2, width / 2);
    graphics.fillStyle(0x061225)
      .fillCircle(width / 3, height * 0.42, width / 18)
      .fillCircle(width * 2 / 3, height * 0.42, width / 18);
    graphics.lineStyle(width / 18, 0x061225).lineBetween(
      width / 3, height * 0.68, width * 2 / 3, height * 0.68,
    );
    graphics.generateTexture('player', width, height);
  }
  if (shouldCreate('enemy-basic')) {
    graphics.clear().fillStyle(0xff5c70).fillRoundedRect(0, 0, cellWidth, cellHeight, 5)
      .generateTexture('enemy-basic', cellWidth, cellHeight);
  }
  if (shouldCreate('enemy-armored')) {
    graphics.clear().fillStyle(0x9b6dff).fillRoundedRect(0, 0, cellWidth * 2, cellHeight * 2, 5);
    graphics.lineStyle(3, 0xd8c8ff).strokeRoundedRect(2, 2, cellWidth * 2 - 4, cellHeight * 2 - 4, 4)
      .generateTexture('enemy-armored', cellWidth * 2, cellHeight * 2);
  }
  if (shouldCreate('enemy-shooter')) {
    graphics.clear().fillStyle(0xffa23a).fillRoundedRect(0, 0, cellWidth, cellHeight, 5);
    graphics.fillStyle(0x4c2400).fillCircle(cellWidth / 2, cellHeight / 2, 5)
      .generateTexture('enemy-shooter', cellWidth, cellHeight);
  }

  for (const [key, descriptor] of Object.entries(renderableCombatTextureDescriptors())) {
    if (shouldCreate(key)) createProjectileTexture(graphics, key, descriptor);
  }

  const { body, weakpoint, core } = GAME_TUNING.boss;
  if (shouldCreate('boss-body')) {
    const strokeInset = 2;
    graphics.clear().fillStyle(0x3b315d).fillRoundedRect(0, 0, body.width, body.height, 12);
    graphics.lineStyle(4, 0x7d6ab3).strokeRoundedRect(
      strokeInset,
      strokeInset,
      body.width - strokeInset * 2,
      body.height - strokeInset * 2,
      10,
    ).generateTexture('boss-body', body.width, body.height);
  }
  for (const key of ['boss-left-weakpoint', 'boss-right-weakpoint'] as const) {
    if (!shouldCreate(key)) continue;
    const strokeInset = 1;
    graphics.clear().fillStyle(0xff6c8c).fillRoundedRect(
      0,
      0,
      weakpoint.visual.width,
      weakpoint.visual.height,
      6,
    );
    graphics.lineStyle(2, 0xffd1dc).strokeRoundedRect(
      strokeInset,
      strokeInset,
      weakpoint.visual.width - strokeInset * 2,
      weakpoint.visual.height - strokeInset * 2,
      5,
    ).generateTexture(key, weakpoint.visual.width, weakpoint.visual.height);
  }
  if (shouldCreate('boss-core')) {
    const center = core.visualSize / 2;
    graphics.clear().fillStyle(0xffd15c).fillCircle(center, center, center - 2);
    graphics.lineStyle(3, 0xffffff).strokeCircle(center, center, center - 3)
      .generateTexture('boss-core', core.visualSize, core.visualSize);
  }
  if (shouldCreate('boss-aim-marker')) {
    graphics.clear().lineStyle(2, 0xffe45c, 0.9).strokeCircle(16, 16, 14)
      .generateTexture('boss-aim-marker', 32, 32);
  }
  if (shouldCreate('boss-drop-marker')) {
    graphics.clear().lineStyle(3, 0xff704d, 0.9).strokeRoundedRect(1, 1, 30, 10, 4)
      .generateTexture('boss-drop-marker', 32, 12);
  }
  graphics.destroy();
}

function createProjectileTexture(
  graphics: Phaser.GameObjects.Graphics,
  key: string,
  descriptor: CombatTextureDescriptor,
): void {
  const centerX = descriptor.width / 2;
  const centerY = descriptor.height / 2;
  const radius = Math.max(1, Math.min(centerX, centerY) - 1);
  const strokeWidth = Math.max(1, Math.floor(radius / 3));

  graphics.clear();
  switch (descriptor.shape) {
    case 'outlinedCircle':
      graphics.fillStyle(descriptor.fill).fillCircle(centerX, centerY, radius);
      graphics.lineStyle(strokeWidth, descriptor.accent).strokeCircle(centerX, centerY, radius);
      if (descriptor.symbol) {
        graphics.lineStyle(1.5, descriptor.accent).beginPath();
        switch (descriptor.symbol) {
          case 'wave':
            graphics.moveTo(centerX - 5, centerY).lineTo(centerX - 2, centerY - 3)
              .lineTo(centerX + 1, centerY + 3).lineTo(centerX + 5, centerY);
            break;
          case 'drop':
            graphics.moveTo(centerX, centerY - 5).lineTo(centerX - 4, centerY + 2)
              .lineTo(centerX, centerY + 5).lineTo(centerX + 4, centerY + 2)
              .lineTo(centerX, centerY - 5);
            break;
          case 'bolt':
            graphics.moveTo(centerX + 1, centerY - 6).lineTo(centerX - 3, centerY)
              .lineTo(centerX + 1, centerY).lineTo(centerX - 1, centerY + 6)
              .lineTo(centerX + 4, centerY - 1).lineTo(centerX, centerY - 1);
            break;
          case 'arrow':
            graphics.moveTo(centerX - 5, centerY + 4).lineTo(centerX + 4, centerY - 5)
              .moveTo(centerX, centerY - 5).lineTo(centerX + 4, centerY - 5)
              .lineTo(centerX + 4, centerY - 1);
            break;
          case 'fork':
            graphics.moveTo(centerX, centerY + 5).lineTo(centerX, centerY)
              .lineTo(centerX - 4, centerY - 4).moveTo(centerX, centerY)
              .lineTo(centerX + 4, centerY - 4);
            break;
          case 'burst':
            graphics.moveTo(centerX - 5, centerY).lineTo(centerX + 5, centerY)
              .moveTo(centerX, centerY - 5).lineTo(centerX, centerY + 5)
              .moveTo(centerX - 4, centerY - 4).lineTo(centerX + 4, centerY + 4)
              .moveTo(centerX + 4, centerY - 4).lineTo(centerX - 4, centerY + 4);
            break;
          case 'beam':
            graphics.moveTo(centerX - 5, centerY + 3).lineTo(centerX + 5, centerY - 3)
              .moveTo(centerX - 4, centerY - 4).lineTo(centerX + 4, centerY + 4);
            break;
          case 'swarm':
            graphics.moveTo(centerX - 5, centerY).lineTo(centerX, centerY - 4)
              .lineTo(centerX + 5, centerY).lineTo(centerX, centerY + 4)
              .lineTo(centerX - 5, centerY);
            break;
          case 'seed':
            graphics.moveTo(centerX, centerY - 5).lineTo(centerX + 4, centerY)
              .lineTo(centerX, centerY + 5).lineTo(centerX - 4, centerY)
              .lineTo(centerX, centerY - 5)
              .moveTo(centerX - 3, centerY).lineTo(centerX + 3, centerY);
            break;
          case 'collapse':
            graphics.strokeCircle(centerX, centerY, 4)
              .moveTo(centerX - 6, centerY).lineTo(centerX - 2, centerY)
              .moveTo(centerX + 6, centerY).lineTo(centerX + 2, centerY);
            break;
          case 'reactor':
            graphics.strokeCircle(centerX, centerY, 4)
              .moveTo(centerX, centerY - 6).lineTo(centerX, centerY - 3)
              .moveTo(centerX, centerY + 6).lineTo(centerX, centerY + 3);
            break;
          case 'cluster':
            graphics.strokeCircle(centerX, centerY, 2)
              .moveTo(centerX - 5, centerY).lineTo(centerX - 3, centerY)
              .moveTo(centerX + 5, centerY).lineTo(centerX + 3, centerY)
              .moveTo(centerX, centerY - 5).lineTo(centerX, centerY - 3)
              .moveTo(centerX, centerY + 5).lineTo(centerX, centerY + 3);
            break;
          case 'mirror':
            graphics.strokeRect(centerX - 5, centerY - 5, 4, 10)
              .strokeRect(centerX + 1, centerY - 5, 4, 10);
            break;
          case 'melt':
            graphics.moveTo(centerX, centerY - 6).lineTo(centerX + 5, centerY + 2)
              .lineTo(centerX, centerY + 6).lineTo(centerX - 5, centerY + 2)
              .lineTo(centerX, centerY - 6);
            break;
          case 'blade':
            graphics.moveTo(centerX - 6, centerY + 5).lineTo(centerX + 6, centerY - 5)
              .moveTo(centerX + 1, centerY - 4).lineTo(centerX + 5, centerY)
              .lineTo(centerX + 6, centerY - 5);
            break;
        }
        graphics.strokePath();
      }
      if (descriptor.notches) {
        graphics.fillStyle(descriptor.accent);
        for (let notch = 0; notch < descriptor.notches; notch += 1) {
          const angle = Math.PI + notch * Math.PI / 4;
          graphics.fillCircle(
            centerX + Math.cos(angle) * (radius - 2),
            centerY + Math.sin(angle) * (radius - 2),
            0.8,
          );
        }
      }
      break;
    case 'centeredCircle':
      graphics.fillStyle(descriptor.fill).fillCircle(centerX, centerY, radius);
      graphics.fillStyle(descriptor.accent).fillCircle(centerX, centerY, radius / 2);
      break;
    case 'outlinedRoundedRect': {
      const inset = strokeWidth / 2;
      const cornerRadius = Math.max(1, Math.min(descriptor.width, descriptor.height) / 3);
      graphics.fillStyle(descriptor.fill).fillRoundedRect(
        0,
        0,
        descriptor.width,
        descriptor.height,
        cornerRadius,
      );
      graphics.lineStyle(strokeWidth, descriptor.accent).strokeRoundedRect(
        inset,
        inset,
        descriptor.width - strokeWidth,
        descriptor.height - strokeWidth,
        cornerRadius - inset,
      );
      break;
    }
    case 'flash': {
      const armLength = radius;
      const armWidth = Math.max(1, radius / 3);
      graphics.fillStyle(descriptor.fill)
        .fillRect(centerX - armWidth / 2, centerY - armLength, armWidth, armLength * 2)
        .fillRect(centerX - armLength, centerY - armWidth / 2, armLength * 2, armWidth);
      graphics.lineStyle(strokeWidth, descriptor.accent)
        .beginPath()
        .moveTo(centerX - armLength, centerY - armLength)
        .lineTo(centerX + armLength, centerY + armLength)
        .moveTo(centerX + armLength, centerY - armLength)
        .lineTo(centerX - armLength, centerY + armLength)
        .strokePath();
      break;
    }
    case 'crackedRoundedRect':
      graphics.fillStyle(descriptor.fill)
        .fillRoundedRect(0, 0, descriptor.width, descriptor.height, 5);
      graphics.lineStyle(3, descriptor.accent)
        .beginPath()
        .moveTo(centerX - 2, 1)
        .lineTo(centerX + 3, centerY - 3)
        .lineTo(centerX - 3, centerY + 3)
        .lineTo(centerX + 2, descriptor.height - 1)
        .strokePath();
      break;
    case 'fragmentLeft':
    case 'fragmentRight': {
      const isLeft = descriptor.shape === 'fragmentLeft';
      const innerX = isLeft ? descriptor.width : 0;
      const outerX = isLeft ? 0 : descriptor.width;
      graphics.fillStyle(descriptor.fill)
        .beginPath()
        .moveTo(outerX, 1)
        .lineTo(innerX, 1)
        .lineTo(innerX + (isLeft ? -5 : 5), centerY)
        .lineTo(innerX, descriptor.height - 1)
        .lineTo(outerX, descriptor.height - 1)
        .closePath()
        .fillPath();
      graphics.lineStyle(2, descriptor.accent)
        .beginPath()
        .moveTo(innerX, 1)
        .lineTo(innerX + (isLeft ? -5 : 5), centerY)
        .lineTo(innerX, descriptor.height - 1)
        .strokePath();
      break;
    }
    case 'hiveCore':
      graphics.fillStyle(descriptor.fill)
        .fillCircle(centerX, centerY, radius);
      graphics.lineStyle(4, descriptor.accent)
        .strokeCircle(centerX, centerY, radius - 2)
        .strokeCircle(centerX, centerY, radius * 0.45);
      break;
    case 'hiveShooter':
      graphics.fillStyle(descriptor.fill)
        .fillRoundedRect(0, 0, descriptor.width, descriptor.height, 7);
      graphics.lineStyle(2, descriptor.accent)
        .strokeRoundedRect(1, 1, descriptor.width - 2, descriptor.height - 2, 6);
      graphics.fillStyle(descriptor.accent)
        .fillCircle(centerX, descriptor.height - 5, 4);
      break;
    case 'reflectorWall':
      graphics.fillStyle(descriptor.fill)
        .fillRoundedRect(0, 0, descriptor.width, descriptor.height, 4);
      graphics.lineStyle(3, descriptor.accent)
        .strokeRoundedRect(2, 1, descriptor.width - 4, descriptor.height - 2, 3);
      for (let y = 9; y < descriptor.height; y += 16) {
        graphics.lineStyle(2, descriptor.accent)
          .beginPath()
          .moveTo(3, y)
          .lineTo(descriptor.width - 3, y + 7)
          .strokePath();
      }
      break;
  }
  graphics.generateTexture(key, descriptor.width, descriptor.height);
}
