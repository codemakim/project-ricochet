import { expect, it } from 'vitest';
import { combatProjectileTextureDescriptors } from './combatTextureRules';

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
