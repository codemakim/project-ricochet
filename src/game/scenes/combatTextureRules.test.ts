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

it('keeps only stable base-orb fallbacks and does not fabricate level textures', () => {
  const textures = combatProjectileTextureDescriptors();
  const cores = [
    textures['orb-echo'],
    textures['orb-corrosion'],
    textures['orb-conduction'],
    textures['orb-inertia'],
    textures['orb-split'],
    textures['orb-explosion'],
  ];

  expect(cores).toEqual([
    expect.objectContaining({ shape: 'outlinedCircle', fill: 0x74c8ff }),
    expect.objectContaining({ shape: 'outlinedCircle', fill: 0x9be564 }),
    expect.objectContaining({ shape: 'outlinedCircle', fill: 0xc58cff }),
    expect.objectContaining({ shape: 'outlinedCircle', fill: 0xffbd59 }),
    expect.objectContaining({ shape: 'outlinedCircle', fill: 0x52d6b4 }),
    expect.objectContaining({ shape: 'outlinedCircle', fill: 0xff8f3d }),
  ]);
  expect(new Set(cores.map((core) => `${core?.fill}:${core?.accent}`)).size).toBe(6);
  expect(new Set(cores.map((core) => core?.symbol)).size).toBe(6);
  expect(Object.keys(textures).filter((key) => key.startsWith('orb-') && key.includes('-lv')))
    .toEqual([]);
});

it('defines distinct prototype textures for a splitter and complementary fragments', () => {
  const textures = combatProjectileTextureDescriptors();

  expect(textures['enemy-splitter']).toMatchObject({
    shape: 'crackedRoundedRect', width: 140, height: 60, deferred: true,
  });

  expect(textures['enemy-fragment-left']).toMatchObject({
    shape: 'fragmentLeft', width: 70, height: 60, deferred: true,
  });
  expect(textures['enemy-fragment-right']).toMatchObject({
    shape: 'fragmentRight', width: 70, height: 60, deferred: true,
  });
});

it('leaves fusion identities to static production assets', () => {
  const textures = combatProjectileTextureDescriptors();
  expect(Object.keys(textures).filter((key) => key.startsWith('orb-photon-orbit')))
    .toEqual([]);
});

it('renders splitter and fragment prototype descriptors for runtime managers', () => {
  const textures = renderableCombatTextureDescriptors();

  expect(textures).toHaveProperty('enemy-splitter');
  expect(textures).toHaveProperty('enemy-fragment-left');
  expect(textures).toHaveProperty('enemy-fragment-right');
  expect(textures).toHaveProperty('enemy-bullet');
  expect(textures).not.toHaveProperty('secondary-damage-feedback');
  expect(textures).not.toHaveProperty('secondary-kill-feedback');
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
    shape: 'hiveShooter', width: 70, height: 56,
  });
  expect(textures['hive-right-shooter']).toMatchObject({
    shape: 'hiveShooter', width: 70, height: 56,
  });
  expect(textures['hive-left-reflector']).toMatchObject({
    shape: 'reflectorWall', width: 36, height: 192,
  });
  expect(textures['hive-right-reflector']).toMatchObject({
    shape: 'reflectorWall', width: 36, height: 192,
  });
});
