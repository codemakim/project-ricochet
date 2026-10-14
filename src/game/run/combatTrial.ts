import type { AuthoredFormation } from '../encounters/authoredFormations';
import type { StageDefinition } from '../encounters/stageDefinitions';
import type { OrbCoreId } from '../orbs/orbCoreRules';

// A single playable slice. The original campaign remains available in development.
export const COMBAT_TRIAL = {
  coreTypes: ['explosion', 'split', 'corrosion'] as readonly OrbCoreId[],
  startingOrbCount: 3,
  maximumOrbs: 6,
  recoveryRadius: 72,
  recoveryDamageBonus: 0.5,
  autoReturnAfterMs: 4800,
  waveMinimumMs: 10000,
  waveMaximumMs: 20000,
  clearBreatherMs: 1200,
  bossAtMs: 120000,
  bossHp: { weakpoint: 12, core: 30 },
  shooter: { intervalMs: 2200, warningMs: 650, bulletSpeed: 155, damage: 1 },
  xpSteps: [4, 8, 12, 16, 20],
} as const;

export const TRIAL_FORMATIONS: readonly AuthoredFormation[] = [
  { id: 'trial-aim', rows: 2, role: 'corridor', slots: [
    { kind: 'basic', column: 1, row: 0 }, { kind: 'basic', column: 2, row: 0 },
    { kind: 'basic', column: 3, row: 0 }, { kind: 'basic', column: 4, row: 0 },
    { kind: 'basic', column: 2, row: 1 }, { kind: 'basic', column: 3, row: 1 },
  ] },
  { id: 'trial-bank', rows: 2, role: 'pockets', slots: [
    { kind: 'basic', column: 0, row: 0 }, { kind: 'basic', column: 1, row: 0 },
    { kind: 'basic', column: 4, row: 0 }, { kind: 'basic', column: 5, row: 0 },
    { kind: 'basic', column: 0, row: 1 }, { kind: 'basic', column: 5, row: 1 },
  ] },
  { id: 'trial-dodge', rows: 2, role: 'corridor', slots: [
    { kind: 'basic', column: 1, row: 0 }, { kind: 'shooter', column: 3, row: 0 },
    { kind: 'basic', column: 4, row: 0 }, { kind: 'basic', column: 1, row: 1 },
    { kind: 'basic', column: 3, row: 1 }, { kind: 'basic', column: 4, row: 1 },
  ] },
  { id: 'trial-armor', rows: 3, role: 'corridor', slots: [
    { kind: 'armored', column: 0, row: 0 }, { kind: 'shooter', column: 4, row: 0 },
    { kind: 'basic', column: 3, row: 1 }, { kind: 'basic', column: 5, row: 1 },
    { kind: 'basic', column: 1, row: 2 }, { kind: 'basic', column: 4, row: 2 },
  ] },
  { id: 'trial-crossfire', rows: 2, role: 'crossfire', slots: [
    { kind: 'shooter', column: 0, row: 0 }, { kind: 'shooter', column: 5, row: 0 },
    { kind: 'basic', column: 1, row: 0 }, { kind: 'basic', column: 4, row: 0 },
    { kind: 'basic', column: 0, row: 1 }, { kind: 'basic', column: 2, row: 1 },
    { kind: 'basic', column: 3, row: 1 }, { kind: 'basic', column: 5, row: 1 },
  ] },
  { id: 'trial-final', rows: 3, role: 'wall', slots: [
    { kind: 'armored', column: 2, row: 0 },
    { kind: 'shooter', column: 0, row: 0 }, { kind: 'shooter', column: 5, row: 0 },
    { kind: 'basic', column: 0, row: 1 }, { kind: 'basic', column: 5, row: 1 },
    { kind: 'basic', column: 1, row: 2 }, { kind: 'basic', column: 4, row: 2 },
  ] },
];

export const TRIAL_STAGE: StageDefinition = {
  id: 'default-1', number: 1, battlefield: 'default', descentSpeedMultiplier: 0.85,
  powerBand: { expectedOrbCount: 3, normalHpMultiplier: 0.38, eliteHpMultiplier: 0.5, largeEnemyRatio: 0.1 },
  // One formation per paragraph keeps the teaching order deterministic.
  paragraphs: TRIAL_FORMATIONS.map((formation, index) => ({
    id: index < 2 ? 'opening' : index < 4 ? 'pressure' : 'climax',
    formationIds: [formation.id], activeCap: 18,
    targetDepthRatio: index < 2 ? 0.34 : 0.4,
    normalHpMultiplier: index < 2 ? 1 : 1.4, eliteHpMultiplier: 1,
  })),
  boss: { kind: 'sentinel', warningMs: 2400 },
};
