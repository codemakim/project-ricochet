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

it('excludes deferred prototype descriptors from immediate texture rendering', () => {
  const textures = renderableCombatTextureDescriptors();

  expect(textures).not.toHaveProperty('enemy-splitter');
  expect(textures).not.toHaveProperty('enemy-fragment-left');
  expect(textures).not.toHaveProperty('enemy-fragment-right');
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
  expect(renderableCombatTextureDescriptors()).not.toHaveProperty('hive-core-bullet');
});
