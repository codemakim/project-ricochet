import { isBasicOrbCoreId, type OrbTypeId } from '../orbs/orbFusionRules';
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
  const directory = isBasicOrbCoreId(id)
    ? '/assets/combat/pc/orbs' : '/assets/combat/orbs';
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

const orbit = (id: string, periodMs: number, phase: number): Layer => ({
  id,
  motion: { kind: 'orbit', periodMs, radius: 5, phase },
  blendMode: 'ADD',
  scale: 1,
});

const frames = (id: string, frameRate = 10): Layer => ({
  id,
  frameConfig: { frameWidth: 256, frameHeight: 256 },
  motion: { kind: 'frames', frameRate },
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
const photonOrbitProfile = profile('photon-orbit', 'orbiting-halo-axis', 'photon-beam', [
  spin('halo', 1, 1.8),
  spin('axis', -1, 1.2),
]);
const resonantSwarmProfile = profile('resonant-swarm', 'phase-shifted-triple-orbit', 'resonant-spawn', [
  orbit('nuclei', 680, 0),
  pulse('phase', 560),
]);
const nanoProliferatorProfile = profile('nano-proliferator', 'branch-growth-cycle', 'nano-seed', [
  frames('branches', 8),
  pulse('growth', 840),
]);
const massCollapseProfile = profile('mass-collapse', 'contracting-gravity-shadow', 'mass-collapse', [
  pulse('gravity-ring', 620),
  spin('shadow', -1, 0.8),
]);
const reactorOrbProfile = profile('reactor-orb', 'flowing-reactor-charge', 'reactor-blast', [
  spin('channels', 1, 1.4),
  pulse('charge', 540),
]);
const clusterBombardmentProfile = profile('cluster-bombardment', 'sequential-outer-pods', 'cluster-impact', [
  spin('pods', 1, 0.8),
  frames('sequence', 7),
]);
const mirrorCircuitProfile = profile('mirror-circuit', 'switching-mirror-circuit', 'mirror-node', [
  frames('mirror', 8),
  spin('circuit', 1, 1.3),
]);
const meltdownCoreProfile = profile('meltdown-core', 'circulating-molten-band', 'meltdown-eruption', [
  spin('molten-band', 1, 1.1),
  pulse('heat', 480),
]);
const vectorBladeProfile = profile('vector-blade', 'rotating-blade-direction', 'vector-blade', [
  spin('blade-axis', 1, 2),
  orbit('direction', 720, 0),
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
