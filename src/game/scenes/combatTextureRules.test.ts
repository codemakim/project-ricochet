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

  it('defines six permanent orb colors, symbols, and five same-size level notches', () => {
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
  expect([1, 2, 3, 4, 5].map((level) => textures[`orb-conduction-lv${level}`]))
    .toEqual([1, 2, 3, 4, 5].map((notches) => expect.objectContaining({
      notches,
      width: cores[2]!.width,
      height: cores[2]!.height,
    })));
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

it('defines six distinct fusion silhouettes across all nine levels', () => {
  const textures = combatProjectileTextureDescriptors();
  const fusions = [
    textures['orb-photon-orbit-lv1']!,
    textures['orb-resonant-swarm-lv1']!,
    textures['orb-nano-proliferator-lv1']!,
    textures['orb-mass-collapse-lv1']!,
    textures['orb-reactor-orb-lv1']!,
    textures['orb-cluster-bombardment-lv1']!,
  ];

  expect(fusions.map(({ fill, symbol }) => ({ fill, symbol }))).toEqual([
    { fill: 0x70e8ff, symbol: 'beam' },
    { fill: 0x9d8cff, symbol: 'swarm' },
    { fill: 0x72e69b, symbol: 'seed' },
    { fill: 0x59647a, symbol: 'collapse' },
    { fill: 0xff4f57, symbol: 'reactor' },
    { fill: 0xffb347, symbol: 'cluster' },
  ]);
  expect(textures['orb-photon-orbit-lv9']).toMatchObject({ notches: 9 });
  expect(textures['orb-reactor-orb-lv9']).toMatchObject({ notches: 9 });
  expect(textures['orb-cluster-bombardment-lv4']).toMatchObject({ notches: 4 });
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
    shape: 'hiveShooter', width: 68, height: 56,
  });
  expect(textures['hive-right-shooter']).toMatchObject({
    shape: 'hiveShooter', width: 68, height: 56,
  });
  expect(textures['hive-left-reflector']).toMatchObject({
    shape: 'reflectorWall', width: 36, height: 192,
  });
  expect(textures['hive-right-reflector']).toMatchObject({
    shape: 'reflectorWall', width: 36, height: 192,
  });
});
