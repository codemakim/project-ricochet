import type { OrbTypeId } from '../orbs/orbFusionRules';
import type { CombatVfxId } from './combatVfxIds';

export type OrbLayerMotion =
  | { kind: 'spin'; direction: 1 | -1; radiansPerSecond: number }
  | { kind: 'pulse'; periodMs: number; alphaMinimum: number; alphaMaximum: number }
  | { kind: 'orbit'; periodMs: number; radius: number; phase: number }
  | { kind: 'frames'; frameRate: number };

export interface OrbVisualLayerProfile {
  id: string;
  textureKey: string;
  url: string;
  frameConfig?: { frameWidth: number; frameHeight: number };
  motion: OrbLayerMotion;
  blendMode: 'ADD' | 'NORMAL';
  scale: number;
}

export interface OrbVisualProfile {
  id: OrbTypeId;
  identity: string;
  bodyTextureKey: string;
  bodyUrl: string;
  layers: readonly OrbVisualLayerProfile[];
  trailVfx: CombatVfxId;
  hitVfx: CombatVfxId;
  procVfx: CombatVfxId;
}

type Layer = Omit<OrbVisualLayerProfile, 'textureKey' | 'url'>;

function profile(
  id: OrbTypeId,
  identity: string,
  procVfx: CombatVfxId,
  layers: readonly Layer[],
): OrbVisualProfile {
  const directory = '/assets/combat/pc/orbs';
  return {
    id,
    identity,
    bodyTextureKey: `orb-visual-${id}`,
    bodyUrl: `${directory}/${id}/body.png`,
    layers: layers.map((layer) => ({
      ...layer,
      textureKey: `orb-${id}-${layer.id}`,
      url: `${directory}/${id}/${layer.id}.png`,
    })),
    trailVfx: 'orb-ricochet',
    hitVfx: 'orb-direct-hit',
    procVfx,
  };
}

const spin = (id: string, direction: 1 | -1, radiansPerSecond: number): Layer => ({
  id,
  motion: { kind: 'spin', direction, radiansPerSecond },
  blendMode: 'ADD',
  scale: 1,
});

const pulse = (id: string, periodMs: number): Layer => ({
  id,
  motion: { kind: 'pulse', periodMs, alphaMinimum: 0.24, alphaMaximum: 0.72 },
  blendMode: 'ADD',
  scale: 1,
});

const echoProfile = profile('echo', 'pulsing-optical-lens', 'echo-ring', [
  pulse('energy', 720),
]);
const corrosionProfile = profile('corrosion', 'orbiting-liquid-nanites', 'corrosion-cloud', [
  spin('energy', 1, 0.7),
]);
const conductionProfile = profile('conduction', 'flickering-electric-nucleus', 'conduction-arc', [
  pulse('energy', 340),
]);
const inertiaProfile = profile('inertia', 'rotating-kinetic-belt', 'inertia-compression', [
  spin('energy', -1, 2.2),
]);
const splitProfile = profile('split', 'dual-orbiting-nuclei', 'split-burst', [
  spin('energy', -1, 1.2),
]);
const explosionProfile = profile('explosion', 'breathing-heat-core', 'explosion-burst', [
  pulse('energy', 620),
]);
const photonOrbitProfile = profile('photon-orbit', 'narrow-photon-axis', 'photon-beam', [
  spin('energy', 1, 1.8),
]);
const resonantSwarmProfile = profile('resonant-swarm', 'coordinated-nucleus-triad', 'resonant-spawn', [
  spin('energy', -1, 1.3),
]);
const nanoProliferatorProfile = profile('nano-proliferator', 'budding-nanite-seed', 'nano-seed', [
  pulse('energy', 840),
]);
const massCollapseProfile = profile('mass-collapse', 'dark-compressed-gravity-core', 'mass-collapse', [
  pulse('energy', 620),
]);
const reactorOrbProfile = profile('reactor-orb', 'opposed-reactor-caps', 'reactor-blast', [
  pulse('energy', 540),
]);
const clusterBombardmentProfile = profile('cluster-bombardment', 'separated-six-pearl-cluster', 'cluster-impact', [
  spin('energy', 1, 0.8),
]);
const mirrorCircuitProfile = profile('mirror-circuit', 'opposed-flat-mirror-slabs', 'mirror-node', [
  pulse('energy', 900),
]);
const meltdownCoreProfile = profile('meltdown-core', 'asymmetric-molten-droplet', 'meltdown-eruption', [
  spin('energy', 1, 1.1),
]);
const vectorBladeProfile = profile('vector-blade', 'crossed-directional-blades', 'vector-blade', [
  pulse('energy', 380),
]);

export const ORB_VISUAL_PROFILES = {
  echo: echoProfile,
  corrosion: corrosionProfile,
  conduction: conductionProfile,
  inertia: inertiaProfile,
  split: splitProfile,
  explosion: explosionProfile,
  'photon-orbit': photonOrbitProfile,
  'resonant-swarm': resonantSwarmProfile,
  'nano-proliferator': nanoProliferatorProfile,
  'mass-collapse': massCollapseProfile,
  'reactor-orb': reactorOrbProfile,
  'cluster-bombardment': clusterBombardmentProfile,
  'mirror-circuit': mirrorCircuitProfile,
  'meltdown-core': meltdownCoreProfile,
  'vector-blade': vectorBladeProfile,
} as const satisfies Record<OrbTypeId, OrbVisualProfile>;

export function orbVisualProfile(id: OrbTypeId): OrbVisualProfile {
  return ORB_VISUAL_PROFILES[id];
}
