import type { BossKind } from '../config/gameTuning';
import type { EnemyKind } from '../enemies/enemyRules';
import { populationCostForEnemy } from '../enemies/splitterRules';
import type { FormationStyle } from './formationRules';

export type BattlefieldId = 'default';
export type StageId = 'default-1' | 'default-2' | 'default-3';
export type EnemyTag = 'standard' | 'armored' | 'shooter' | 'splitter';

export interface EnemyCatalogEntry {
  kind: Exclude<EnemyKind, 'fragment'>;
  minStage: number;
  battlefields: readonly BattlefieldId[];
  tags: readonly EnemyTag[];
  weight: number;
  maxPerFormation?: number;
}

export interface FormationProfile {
  id: string;
  styleWeights: Readonly<Partial<Record<FormationStyle, number>>>;
  minimum: number;
  maximum: number;
  allowedTags: readonly EnemyTag[];
  excludedKinds?: readonly EnemyKind[];
}

export interface StagePhaseDefinition {
  startsAtMs: number;
  activeCap: number;
  spawnIntervalMs: number;
  formationProfileId: string;
  allowedTags?: readonly EnemyTag[];
  excludedKinds?: readonly EnemyKind[];
  enemyWeightMultipliers?: Readonly<Partial<Record<EnemyKind, number>>>;
  maxPerFormationOverrides?: Readonly<Partial<Record<EnemyKind, number>>>;
}

export interface StageBossDefinition {
  kind: BossKind;
  minimumMs: number;
  scoreTarget: number;
  hardMaximumMs: number;
  warningMs: number;
}

export interface StageDefinition {
  id: StageId;
  number: number;
  battlefield: BattlefieldId;
  hpMultiplier: number;
  descentSpeedMultiplier: number;
  allowedTags?: readonly EnemyTag[];
  excludedKinds?: readonly EnemyKind[];
  phases: readonly StagePhaseDefinition[];
  boss: StageBossDefinition;
}

const STYLE_WEIGHTS = { cluster: 2, pockets: 2, bands: 2, scatter: 2, grid: 1 } as const;

export const ENEMY_CATALOG: readonly EnemyCatalogEntry[] = [
  { kind: 'basic', minStage: 1, battlefields: ['default'], tags: ['standard'], weight: 1 },
  { kind: 'armored', minStage: 1, battlefields: ['default'], tags: ['armored'], weight: 1, maxPerFormation: 3 },
  { kind: 'shooter', minStage: 1, battlefields: ['default'], tags: ['shooter'], weight: 1, maxPerFormation: 3 },
  { kind: 'splitter', minStage: 2, battlefields: ['default'], tags: ['splitter'], weight: 1, maxPerFormation: 2 },
] as const;

export const FORMATION_PROFILES = [
  { id: 'opening', styleWeights: STYLE_WEIGHTS, minimum: 13, maximum: 15, allowedTags: [] },
  { id: 'pressure', styleWeights: STYLE_WEIGHTS, minimum: 15, maximum: 18, allowedTags: [] },
  { id: 'assault', styleWeights: STYLE_WEIGHTS, minimum: 18, maximum: 21, allowedTags: [] },
  { id: 'onslaught', styleWeights: STYLE_WEIGHTS, minimum: 21, maximum: 25, allowedTags: [] },
] as const satisfies readonly FormationProfile[];

const phase = (
  startsAtMs: number,
  activeCap: number,
  spawnIntervalMs: number,
  formationProfileId: string,
  enemyWeightMultipliers: Readonly<Partial<Record<EnemyKind, number>>>,
  maxPerFormationOverrides: Readonly<Partial<Record<EnemyKind, number>>>,
): StagePhaseDefinition => ({
  startsAtMs,
  activeCap,
  spawnIntervalMs,
  formationProfileId,
  enemyWeightMultipliers,
  maxPerFormationOverrides,
});

export const STAGES = [
  {
    id: 'default-1',
    number: 1,
    battlefield: 'default',
    hpMultiplier: 1,
    descentSpeedMultiplier: 1,
    phases: [
      phase(0, 48, 8_000, 'opening', { basic: 12, armored: 1, shooter: 0, splitter: 0 }, { armored: 1, shooter: 0, splitter: 0 }),
      phase(60_000, 60, 7_000, 'pressure', { basic: 15, armored: 2, shooter: 1, splitter: 0 }, { armored: 2, shooter: 1, splitter: 0 }),
      phase(120_000, 72, 6_000, 'assault', { basic: 18, armored: 2, shooter: 2, splitter: 0 }, { armored: 2, shooter: 2, splitter: 0 }),
    ],
    boss: { kind: 'sentinel', minimumMs: 120_000, scoreTarget: 70, hardMaximumMs: 210_000, warningMs: 2_000 },
  },
  {
    id: 'default-2',
    number: 2,
    battlefield: 'default',
    hpMultiplier: 1,
    descentSpeedMultiplier: 1,
    phases: [
      phase(0, 72, 6_000, 'assault', { basic: 18, armored: 2, shooter: 2, splitter: 0 }, { armored: 2, shooter: 2, splitter: 0 }),
      phase(60_000, 84, 5_500, 'onslaught', { basic: 21, armored: 3, shooter: 3, splitter: 2 }, { armored: 3, shooter: 3, splitter: 2 }),
    ],
    boss: { kind: 'hive', minimumMs: 150_000, scoreTarget: 110, hardMaximumMs: 210_000, warningMs: 2_000 },
  },
  {
    id: 'default-3',
    number: 3,
    battlefield: 'default',
    hpMultiplier: 1.3,
    descentSpeedMultiplier: 1,
    phases: [
      phase(0, 84, 5_500, 'onslaught', { basic: 20, armored: 3, shooter: 3, splitter: 2 }, { armored: 3, shooter: 3, splitter: 2 }),
      phase(60_000, 96, 5_000, 'onslaught', { basic: 18, armored: 4, shooter: 4, splitter: 3 }, { armored: 4, shooter: 4, splitter: 3 }),
      phase(120_000, 108, 4_500, 'onslaught', { basic: 16, armored: 5, shooter: 5, splitter: 4 }, { armored: 5, shooter: 5, splitter: 4 }),
    ],
    boss: { kind: 'siege', minimumMs: 150_000, scoreTarget: 140, hardMaximumMs: 210_000, warningMs: 2_000 },
  },
] as const satisfies readonly StageDefinition[];

function positive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be finite and positive`);
}

function nonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be finite and non-negative`);
}

function nonNegativeInteger(value: number, name: string): void {
  nonNegative(value, name);
  if (!Number.isInteger(value)) throw new RangeError(`${name} must be an integer`);
}

function positiveInteger(value: number, name: string): void {
  positive(value, name);
  if (!Number.isInteger(value)) throw new RangeError(`${name} must be an integer`);
}

function eligibleEnemies(
  stage: StageDefinition,
  profile: FormationProfile,
  phase: StagePhaseDefinition,
  catalog: readonly EnemyCatalogEntry[],
): EnemyCatalogEntry[] {
  const allowedTags = [...(stage.allowedTags ?? []), ...profile.allowedTags, ...(phase.allowedTags ?? [])];
  const excludedKinds = new Set([...stage.excludedKinds ?? [], ...profile.excludedKinds ?? [], ...phase.excludedKinds ?? []]);
  return catalog.filter((entry) => entry.minStage <= stage.number
    && entry.battlefields.includes(stage.battlefield)
    && allowedTags.every((tag) => entry.tags.includes(tag))
    && !excludedKinds.has(entry.kind)
    && entry.weight * (phase.enemyWeightMultipliers?.[entry.kind] ?? 1) > 0
    && (phase.maxPerFormationOverrides?.[entry.kind] ?? entry.maxPerFormation ?? Infinity) > 0);
}

function formationCapacity(entry: EnemyCatalogEntry, phase: StagePhaseDefinition, maximum: number): number {
  return Math.min(phase.maxPerFormationOverrides?.[entry.kind] ?? entry.maxPerFormation ?? maximum, maximum);
}

export function validateStageContent(
  stages: readonly StageDefinition[] = STAGES,
  catalog: readonly EnemyCatalogEntry[] = ENEMY_CATALOG,
  profiles: readonly FormationProfile[] = FORMATION_PROFILES,
): void {
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  if (profileById.size !== profiles.length) throw new RangeError('formation profile IDs must be unique');
  for (const profile of profiles) {
    if (!profile.id) throw new RangeError('formation profile ID is required');
    nonNegativeInteger(profile.minimum, `${profile.id}.minimum`);
    nonNegativeInteger(profile.maximum, `${profile.id}.maximum`);
    if (profile.minimum < 1 || profile.maximum < profile.minimum) throw new RangeError(`${profile.id} range must be ordered and positive`);
    if (Object.keys(profile.styleWeights).length === 0) throw new RangeError(`${profile.id} needs a style`);
    const styleWeights = Object.entries(profile.styleWeights);
    for (const [style, weight] of styleWeights) positiveInteger(weight!, `${profile.id}.${style}`);
    const totalStyleWeight = styleWeights.reduce((sum, [, weight]) => sum + weight!, 0);
    const maximumStyleWeight = Math.max(...styleWeights.map(([, weight]) => weight!));
    if (styleWeights.length > 1 && maximumStyleWeight > totalStyleWeight - maximumStyleWeight) {
      throw new RangeError(`${profile.id} style weights cannot avoid repeats`);
    }
  }
  const catalogKinds = new Set<EnemyKind>();
  for (const entry of catalog) {
    if (catalogKinds.has(entry.kind)) throw new RangeError('enemy catalog kinds must be unique');
    catalogKinds.add(entry.kind);
    nonNegativeInteger(entry.minStage, `${entry.kind}.minStage`);
    if (entry.minStage < 1 || entry.battlefields.length === 0) throw new RangeError(`${entry.kind} must be eligible somewhere`);
    positive(entry.weight, `${entry.kind}.weight`);
    if (entry.maxPerFormation !== undefined) nonNegativeInteger(entry.maxPerFormation, `${entry.kind}.maxPerFormation`);
  }
  const ids = new Set<StageId>();
  const numbers = new Set<number>();
  for (const stage of stages) {
    if (ids.has(stage.id) || numbers.has(stage.number)) throw new RangeError('stage IDs and numbers must be unique');
    ids.add(stage.id);
    numbers.add(stage.number);
    nonNegativeInteger(stage.number, `${stage.id}.number`);
    if (stage.number < 1) throw new RangeError(`${stage.id}.number must be positive`);
    positive(stage.hpMultiplier, `${stage.id}.hpMultiplier`);
    positive(stage.descentSpeedMultiplier, `${stage.id}.descentSpeedMultiplier`);
    if (stage.phases.length === 0 || stage.phases[0]!.startsAtMs !== 0) throw new RangeError(`${stage.id} must start at zero`);
    let previousStart = -1;
    for (const [index, stagePhase] of stage.phases.entries()) {
      nonNegativeInteger(stagePhase.startsAtMs, `${stage.id}.phases.${index}.startsAtMs`);
      if (stagePhase.startsAtMs <= previousStart) throw new RangeError(`${stage.id} phase times must increase`);
      previousStart = stagePhase.startsAtMs;
      const profile = profileById.get(stagePhase.formationProfileId);
      if (!profile) throw new RangeError(`${stage.id} phase profile must exist`);
      nonNegativeInteger(stagePhase.activeCap, `${stage.id}.phases.${index}.activeCap`);
      if (stagePhase.activeCap < profile.maximum) throw new RangeError(`${stage.id} phase cap must fit its profile`);
      positive(stagePhase.spawnIntervalMs, `${stage.id}.phases.${index}.spawnIntervalMs`);
      for (const [kind, multiplier] of Object.entries(stagePhase.enemyWeightMultipliers ?? {})) {
        nonNegative(multiplier!, `${stage.id}.${kind}.weight`);
      }
      for (const [kind, cap] of Object.entries(stagePhase.maxPerFormationOverrides ?? {})) {
        nonNegativeInteger(cap!, `${stage.id}.${kind}.cap`);
      }
      const eligible = eligibleEnemies(stage, profile, stagePhase, catalog);
      if (eligible.length === 0) throw new RangeError(`${stage.id} phase needs an eligible enemy`);
      const capacities = eligible.map((entry) => formationCapacity(entry, stagePhase, profile.maximum));
      if (capacities.reduce((sum, capacity) => sum + capacity, 0) < profile.maximum) {
        throw new RangeError(`${stage.id} phase cannot fill its profile`);
      }
      const worstPopulation = eligible.flatMap((entry) =>
        Array.from({ length: formationCapacity(entry, stagePhase, profile.maximum) }, () => populationCostForEnemy(entry.kind)))
        .sort((left, right) => right - left)
        .slice(0, profile.maximum)
        .reduce((sum, population) => sum + population, 0);
      if (stagePhase.activeCap < worstPopulation) {
        throw new RangeError(`${stage.id} phase cap must fit worst population`);
      }
    }
    if (!stage.boss?.kind) throw new RangeError(`${stage.id} must have a boss`);
    positive(stage.boss.minimumMs, `${stage.id}.boss.minimumMs`);
    positive(stage.boss.scoreTarget, `${stage.id}.boss.scoreTarget`);
    positive(stage.boss.hardMaximumMs, `${stage.id}.boss.hardMaximumMs`);
    positive(stage.boss.warningMs, `${stage.id}.boss.warningMs`);
    if (stage.boss.minimumMs > stage.boss.hardMaximumMs) throw new RangeError(`${stage.id} boss timing must be ordered`);
  }
}

validateStageContent();
