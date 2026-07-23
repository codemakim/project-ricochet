import { expect, it } from 'vitest';
import {
  combatProjectileTextureDescriptors,
  renderableCombatTextureDescriptors,
} from './combatTextureRules';

it('maps tuning to distinct friendly and hostile texture descriptors', () => {
  const textures = combatProjectileTextureDescriptors();
  expect(textures['orb-temporary']).toMatchObject({
    shape: 'outlinedCircle', fill: 0x8cf7ff, accent: 0x167d9a,
  });
  expect(textures['enemy-bullet']).toMatchObject({
    shape: 'centeredCircle', fill: 0xff4d5a, accent: 0x4a0710,
  });
  expect(textures['boss-falling-hazard']).toMatchObject({
    shape: 'outlinedRoundedRect', width: 16, height: 24,
  });
  expect(textures['boss-muzzle-flash']).toMatchObject({ shape: 'flash' });
});

it('defines distinct prototype textures for a splitter and complementary fragments', () => {
  const textures = combatProjectileTextureDescriptors();

  expect(textures['enemy-splitter']).toMatchObject({
    shape: 'crackedRoundedRect', width: 38, height: 30, deferred: true,
  });
  expect(textures['enemy-fragment-left']).toMatchObject({
    shape: 'fragmentLeft', width: 22, height: 18, deferred: true,
  });
  expect(textures['enemy-fragment-right']).toMatchObject({
    shape: 'fragmentRight', width: 22, height: 18, deferred: true,
  });
});

it('renders splitter and fragment prototype descriptors for runtime managers', () => {
  const textures = renderableCombatTextureDescriptors();

  expect(textures).toHaveProperty('enemy-splitter');
  expect(textures).toHaveProperty('enemy-fragment-left');
  expect(textures).toHaveProperty('enemy-fragment-right');
  expect(textures).toHaveProperty('enemy-bullet');
});

it('defines deferred red/orange centered hive bullets and warning markers', () => {
  const textures = combatProjectileTextureDescriptors();

  expect(textures['hive-shooter-bullet']).toMatchObject({
    shape: 'centeredCircle', fill: 0xff4d5a, width: 10, height: 10, deferred: true,
  });
  expect(textures['hive-core-bullet']).toMatchObject({
    shape: 'centeredCircle', fill: 0xff8a3d, width: 10, height: 10, deferred: true,
  });
  expect(textures['hive-shooter-warning']).toMatchObject({
    shape: 'flash', deferred: true,
  });
  expect(textures['hive-core-warning']).toMatchObject({
    shape: 'flash', deferred: true,
  });
  expect(renderableCombatTextureDescriptors()).toHaveProperty('hive-core-bullet');
});

it('defines hostile hive body modules with a clear reflector wall silhouette', () => {
  const textures = combatProjectileTextureDescriptors();

  expect(textures['hive-core']).toMatchObject({
    shape: 'hiveCore', fill: 0xff5c70, accent: 0xffd19a,
  });
  expect(textures['hive-left-shooter']).toMatchObject({
    shape: 'hiveShooter', width: 34, height: 28,
  });
  expect(textures['hive-right-shooter']).toMatchObject({
    shape: 'hiveShooter', width: 34, height: 28,
  });
  expect(textures['hive-left-reflector']).toMatchObject({
    shape: 'reflectorWall', width: 18, height: 96,
  });
  expect(textures['hive-right-reflector']).toMatchObject({
    shape: 'reflectorWall', width: 18, height: 96,
  });
});
