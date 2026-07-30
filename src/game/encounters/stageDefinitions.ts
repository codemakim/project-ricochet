import type { BossKind } from '../config/gameTuning';
import type { EnemyKind } from '../enemies/enemyRules';
import { occupyFootprint, type GridFootprint } from './formationGrid';
import type { FormationStyle } from './formationRules';

export type BattlefieldId = 'default';
export type StageId = 'default-1' | 'default-2' | 'default-3';
export type EnemyTag = 'standard' | 'armored' | 'shooter' | 'splitter';
export type FormationTemplateId =
  | 'staggered-lanes'
  | 'side-fort'
  | 'split-gate'
  | 'broken-wall';

export interface EnemyCatalogEntry {
  kind: Exclude<EnemyKind, 'fragment'>;
  minStage: number;
  battlefields: readonly BattlefieldId[];
  tags: readonly EnemyTag[];
  weight: number;
  width: number;
  height: number;
  maxPerFormation?: number;
}

export interface FormationTemplateSlot extends GridFootprint {
  kind?: Exclude<EnemyKind, 'fragment'>;
  optional?: boolean;
}

export interface FormationTemplate {
  id: string;
  mode: 'fixed' | 'mixed';
  rows: number;
  slots: readonly FormationTemplateSlot[];
  minStage: number;
  weight: number;
}

export interface FormationProfile {
  id: string;
  styleWeights: Readonly<Partial<Record<FormationStyle, number>>>;
  proceduralWeight: number;
  templateWeights: Readonly<Partial<Record<FormationTemplateId, number>>>;
  cellMinimum: number;
  cellMaximum: number;
  rowMinimum: number;
  rowMaximum: number;
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
const TEMPLATE_WEIGHTS = {
  'staggered-lanes': 2,
  'side-fort': 2,
  'broken-wall': 2,
  'split-gate': 1,
} as const;

export const ENEMY_CATALOG: readonly EnemyCatalogEntry[] = [
  {
    kind: 'basic', minStage: 1, battlefields: ['default'], tags: ['standard'],
    weight: 12, width: 1, height: 1,
  },
  {
    kind: 'armored', minStage: 1, battlefields: ['default'], tags: ['armored'],
    weight: 2, width: 2, height: 2, maxPerFormation: 3,
  },
  {
    kind: 'shooter', minStage: 1, battlefields: ['default'], tags: ['shooter'],
    weight: 2, width: 1, height: 1, maxPerFormation: 3,
  },
  {
    kind: 'splitter', minStage: 2, battlefields: ['default'], tags: ['splitter'],
    weight: 2, width: 2, height: 1, maxPerFormation: 2,
  },
] as const;

export const FORMATION_TEMPLATES = [
  {
    id: 'staggered-lanes',
    mode: 'mixed',
    rows: 3,
    minStage: 1,
    weight: 1,
    slots: [
      { column: 0, row: 0, width: 1, height: 1 },
      { column: 1, row: 0, width: 1, height: 1, optional: true },
      { column: 4, row: 0, width: 1, height: 1 },
      { column: 5, row: 0, width: 1, height: 1 },
      { column: 2, row: 1, width: 1, height: 1 },
      { column: 6, row: 1, width: 1, height: 1, optional: true },
      { column: 0, row: 2, width: 1, height: 1 },
      { column: 4, row: 2, width: 1, height: 1 },
      { column: 5, row: 2, width: 1, height: 1, optional: true },
    ],
  },
  {
    id: 'side-fort',
    mode: 'mixed',
    rows: 4,
    minStage: 1,
    weight: 1,
    slots: [
      { column: 0, row: 0, width: 2, height: 2 },
      { column: 3, row: 0, width: 1, height: 1 },
      { column: 6, row: 0, width: 1, height: 1, optional: true },
      { column: 4, row: 1, width: 1, height: 1 },
      { column: 2, row: 2, width: 1, height: 1 },
      { column: 5, row: 2, width: 1, height: 1 },
      { column: 7, row: 3, width: 1, height: 1, optional: true },
    ],
  },
  {
    id: 'split-gate',
    mode: 'fixed',
    rows: 3,
    minStage: 2,
    weight: 1,
    slots: [
      { kind: 'basic', column: 0, row: 0, width: 1, height: 1 },
      { kind: 'splitter', column: 3, row: 0, width: 2, height: 1 },
      { kind: 'basic', column: 7, row: 0, width: 1, height: 1 },
      { kind: 'shooter', column: 1, row: 2, width: 1, height: 1 },
      { kind: 'shooter', column: 6, row: 2, width: 1, height: 1 },
    ],
  },
  {
    id: 'broken-wall',
    mode: 'mixed',
    rows: 5,
    minStage: 1,
    weight: 1,
    slots: [
      { column: 0, row: 0, width: 1, height: 1 },
      { column: 1, row: 0, width: 1, height: 1 },
      { column: 6, row: 0, width: 1, height: 1 },
      { column: 7, row: 0, width: 1, height: 1 },
      { column: 0, row: 1, width: 1, height: 1, optional: true },
      { column: 6, row: 1, width: 1, height: 1 },
      { column: 1, row: 3, width: 1, height: 1 },
      { column: 7, row: 3, width: 1, height: 1, optional: true },
      { column: 0, row: 4, width: 1, height: 1 },
      { column: 1, row: 4, width: 1, height: 1 },
      { column: 5, row: 4, width: 1, height: 1 },
      { column: 6, row: 4, width: 1, height: 1 },
    ],
  },
] as const satisfies readonly FormationTemplate[];

export const FORMATION_PROFILES = [
  {
    id: 'opening', styleWeights: STYLE_WEIGHTS, proceduralWeight: 3,
    templateWeights: TEMPLATE_WEIGHTS, cellMinimum: 8, cellMaximum: 12,
    rowMinimum: 2, rowMaximum: 3, allowedTags: [],
  },
  {
    id: 'pressure', styleWeights: STYLE_WEIGHTS, proceduralWeight: 3,
    templateWeights: TEMPLATE_WEIGHTS, cellMinimum: 11, cellMaximum: 16,
    rowMinimum: 3, rowMaximum: 4, allowedTags: [],
  },
  {
    id: 'assault', styleWeights: STYLE_WEIGHTS, proceduralWeight: 3,
    templateWeights: TEMPLATE_WEIGHTS, cellMinimum: 14, cellMaximum: 20,
    rowMinimum: 3, rowMaximum: 5, allowedTags: [],
  },
  {
    id: 'onslaught', styleWeights: STYLE_WEIGHTS, proceduralWeight: 3,
    templateWeights: TEMPLATE_WEIGHTS, cellMinimum: 17, cellMaximum: 24,
    rowMinimum: 4, rowMaximum: 5, allowedTags: [],
  },
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
      phase(0, 24, 9_000, 'opening', { basic: 12, armored: 1, shooter: 0, splitter: 0 }, { armored: 1, shooter: 0, splitter: 0 }),
      phase(60_000, 30, 8_000, 'pressure', { basic: 15, armored: 2, shooter: 1, splitter: 0 }, { armored: 2, shooter: 1, splitter: 0 }),
      phase(120_000, 36, 7_000, 'assault', { basic: 18, armored: 2, shooter: 2, splitter: 0 }, { armored: 2, shooter: 2, splitter: 0 }),
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
      phase(0, 36, 6_000, 'assault', { basic: 18, armored: 2, shooter: 2, splitter: 0 }, { armored: 2, shooter: 2, splitter: 0 }),
      phase(60_000, 44, 5_500, 'onslaught', { basic: 21, armored: 3, shooter: 3, splitter: 2 }, { armored: 3, shooter: 3, splitter: 2 }),
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
      phase(0, 44, 5_500, 'onslaught', { basic: 20, armored: 3, shooter: 3, splitter: 2 }, { armored: 3, shooter: 3, splitter: 2 }),
      phase(60_000, 48, 5_000, 'onslaught', { basic: 18, armored: 4, shooter: 4, splitter: 3 }, { armored: 4, shooter: 4, splitter: 3 }),
      phase(120_000, 52, 4_500, 'onslaught', { basic: 16, armored: 5, shooter: 5, splitter: 4 }, { armored: 5, shooter: 5, splitter: 4 }),
    ],
    boss: { kind: 'siege', minimumMs: 150_000, scoreTarget: 140, hardMaximumMs: 210_000, warningMs: 2_000 },
  },
] as const satisfies readonly StageDefinition[];

function finiteNonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be finite and non-negative`);
  }
}

function positiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer`);
  }
}

function eligibleEnemies(
  stage: StageDefinition,
  profile: FormationProfile,
  stagePhase: StagePhaseDefinition,
  catalog: readonly EnemyCatalogEntry[],
): EnemyCatalogEntry[] {
  const allowedTags = [
    ...(stage.allowedTags ?? []),
    ...profile.allowedTags,
    ...(stagePhase.allowedTags ?? []),
  ];
  const excludedKinds = new Set([
    ...(stage.excludedKinds ?? []),
    ...(profile.excludedKinds ?? []),
    ...(stagePhase.excludedKinds ?? []),
  ]);
  return catalog.filter((entry) => (
    entry.minStage <= stage.number
    && entry.battlefields.includes(stage.battlefield)
    && allowedTags.every((tag) => entry.tags.includes(tag))
    && !excludedKinds.has(entry.kind)
    && entry.weight * (stagePhase.enemyWeightMultipliers?.[entry.kind] ?? 1) > 0
    && (stagePhase.maxPerFormationOverrides?.[entry.kind]
      ?? entry.maxPerFormation
      ?? Number.POSITIVE_INFINITY) > 0
  ));
}

export function validateStageContent(
  stages: readonly StageDefinition[] = STAGES,
  catalog: readonly EnemyCatalogEntry[] = ENEMY_CATALOG,
  profiles: readonly FormationProfile[] = FORMATION_PROFILES,
  templates: readonly FormationTemplate[] = FORMATION_TEMPLATES,
): void {
  const catalogByKind = new Map(catalog.map((entry) => [entry.kind, entry]));
  if (catalogByKind.size !== catalog.length) throw new RangeError('enemy catalog kinds must be unique');
  for (const entry of catalog) {
    positiveInteger(entry.minStage, `${entry.kind}.minStage`);
    positiveInteger(entry.width, `${entry.kind}.width`);
    positiveInteger(entry.height, `${entry.kind}.height`);
    if (entry.width > 8) throw new RangeError(`${entry.kind}.width must fit the grid`);
    if (!Number.isFinite(entry.weight) || entry.weight <= 0) {
      throw new RangeError(`${entry.kind}.weight must be positive`);
    }
  }

  const templateById = new Map(templates.map((template) => [template.id, template]));
  if (templateById.size !== templates.length) throw new RangeError('formation template IDs must be unique');
  for (const template of templates) {
    if (template.rows < 2 || template.rows > 5) {
      throw new RangeError(`${template.id} rows must stay between two and five`);
    }
    positiveInteger(template.minStage, `${template.id}.minStage`);
    positiveInteger(template.weight, `${template.id}.weight`);
    const occupied = new Set<string>();
    for (const slot of template.slots) {
      occupyFootprint(occupied, slot, template.rows);
      if (template.mode === 'fixed') {
        if (!slot.kind) throw new RangeError(`${template.id} fixed slots need kinds`);
        const entry = catalogByKind.get(slot.kind);
        if (!entry || entry.width !== slot.width || entry.height !== slot.height) {
          throw new RangeError(`${template.id} fixed slot must match its enemy footprint`);
        }
      }
    }
  }

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  if (profileById.size !== profiles.length) throw new RangeError('formation profile IDs must be unique');
  for (const profile of profiles) {
    if (profile.rowMinimum < 2 || profile.rowMaximum > 5
      || profile.rowMinimum > profile.rowMaximum) {
      throw new RangeError(`${profile.id} rows must stay between two and five`);
    }
    positiveInteger(profile.cellMinimum, `${profile.id}.cellMinimum`);
    positiveInteger(profile.cellMaximum, `${profile.id}.cellMaximum`);
    if (profile.cellMinimum > profile.cellMaximum) {
      throw new RangeError(`${profile.id} cell range must be ordered`);
    }
    finiteNonNegative(profile.proceduralWeight, `${profile.id}.proceduralWeight`);
    const totalSourceWeight = profile.proceduralWeight
      + Object.values(profile.templateWeights).reduce((sum, weight) => sum + (weight ?? 0), 0);
    if (totalSourceWeight <= 0) throw new RangeError(`${profile.id} needs a formation source`);
    for (const [id, weight] of Object.entries(profile.templateWeights)) {
      positiveInteger(weight!, `${profile.id}.${id}`);
      if (!templateById.has(id as FormationTemplateId)) {
        throw new RangeError(`${profile.id} template must exist`);
      }
    }
    for (const [style, weight] of Object.entries(profile.styleWeights)) {
      positiveInteger(weight!, `${profile.id}.${style}`);
    }
    if (profile.proceduralWeight > 0 && Object.keys(profile.styleWeights).length === 0) {
      throw new RangeError(`${profile.id} procedural source needs a style`);
    }
  }

  const stageIds = new Set<string>();
  for (const stage of stages) {
    if (stageIds.has(stage.id)) throw new RangeError('stage IDs must be unique');
    stageIds.add(stage.id);
    positiveInteger(stage.number, `${stage.id}.number`);
    if (!Number.isFinite(stage.hpMultiplier) || stage.hpMultiplier <= 0) {
      throw new RangeError(`${stage.id}.hpMultiplier must be positive`);
    }
    if (!Number.isFinite(stage.descentSpeedMultiplier) || stage.descentSpeedMultiplier <= 0) {
      throw new RangeError(`${stage.id}.descentSpeedMultiplier must be positive`);
    }
    if (stage.phases.length === 0 || stage.phases[0]!.startsAtMs !== 0) {
      throw new RangeError(`${stage.id} must start at zero`);
    }
    let previousStart = -1;
    for (const stagePhase of stage.phases) {
      finiteNonNegative(stagePhase.startsAtMs, `${stage.id}.startsAtMs`);
      if (stagePhase.startsAtMs <= previousStart) {
        throw new RangeError(`${stage.id} phase times must increase`);
      }
      previousStart = stagePhase.startsAtMs;
      const profile = profileById.get(stagePhase.formationProfileId);
      if (!profile) throw new RangeError(`${stage.id} phase profile must exist`);
      if (stagePhase.activeCap < profile.cellMaximum) {
        throw new RangeError(`${stage.id} phase cap must fit its profile`);
      }
      if (!Number.isFinite(stagePhase.spawnIntervalMs) || stagePhase.spawnIntervalMs <= 0) {
        throw new RangeError(`${stage.id} spawn interval must be positive`);
      }
      if (eligibleEnemies(stage, profile, stagePhase, catalog).length === 0) {
        throw new RangeError(`${stage.id} phase needs an eligible enemy`);
      }
    }
  }
}

validateStageContent();
