import type { BossKind } from '../config/gameTuning';
import type { EnemyKind } from '../enemies/enemyRules';
import {
  AUTHORED_FORMATIONS,
  type AuthoredFormation,
  type ParagraphId,
} from './authoredFormations';
import { FORMATION_COLUMNS, occupyFootprint } from './formationGrid';

export type BattlefieldId = 'default';
export type StageId = 'default-1' | 'default-2' | 'default-3';
export type EnemyTag = 'standard' | 'armored' | 'shooter' | 'splitter';

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

export interface StageParagraphDefinition {
  id: ParagraphId;
  formationIds: readonly string[];
  activeCap: number;
  targetDepthRatio: number;
  normalHpMultiplier: number;
  eliteHpMultiplier: number;
}

export interface StageBossDefinition {
  kind: BossKind;
  warningMs: number;
}

export interface StagePowerBand {
  expectedOrbCount: number;
  normalHpMultiplier: number;
  eliteHpMultiplier: number;
  largeEnemyRatio: number;
}

export interface StageDefinition {
  id: StageId;
  number: number;
  battlefield: BattlefieldId;
  powerBand: StagePowerBand;
  descentSpeedMultiplier: number;
  paragraphs: readonly StageParagraphDefinition[];
  boss: StageBossDefinition;
}

export const ENEMY_CATALOG = [
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
] as const satisfies readonly EnemyCatalogEntry[];

const paragraph = (
  id: ParagraphId,
  formationIds: readonly string[],
  activeCap: number,
  targetDepthRatio: number,
  normalHpMultiplier: number,
  eliteHpMultiplier: number,
): StageParagraphDefinition => ({
  id,
  formationIds,
  activeCap,
  targetDepthRatio,
  normalHpMultiplier,
  eliteHpMultiplier,
});

export const STAGES = [
  {
    id: 'default-1',
    number: 1,
    battlefield: 'default',
    powerBand: {
      expectedOrbCount: 3,
      normalHpMultiplier: 1.3,
      eliteHpMultiplier: 1.5,
      largeEnemyRatio: 0.12,
    },
    descentSpeedMultiplier: 1,
    paragraphs: [
      paragraph('opening', [
        's1-opening-gate', 's1-opening-banks', 's1-opening-pocket',
      ], 16, 0.3, 1, 1),
      paragraph('pressure', [
        's1-pressure-right-fort', 's1-pressure-center-guard',
        's1-pressure-twin-fort', 's1-pressure-broken-wall',
      ], 22, 0.4, 1.6, 1.4),
      paragraph('climax', [
        's1-climax-zigzag', 's1-climax-crossfire', 's1-climax-final',
      ], 26, 0.5, 2.1, 1.8),
    ],
    boss: { kind: 'sentinel', warningMs: 2_000 },
  },
  {
    id: 'default-2',
    number: 2,
    battlefield: 'default',
    powerBand: {
      expectedOrbCount: 6,
      normalHpMultiplier: 1.9,
      eliteHpMultiplier: 2.2,
      largeEnemyRatio: 0.22,
    },
    descentSpeedMultiplier: 1,
    paragraphs: [
      paragraph('opening', [
        's2-opening-split-lanes', 's2-opening-armored-gap', 's2-opening-crossfire',
      ], 26, 0.3, 1, 1),
      paragraph('pressure', [
        's2-pressure-left-pocket', 's2-pressure-split-gate',
        's2-pressure-twin-armor', 's2-pressure-battery',
      ], 30, 0.4, 1.6, 1.4),
      paragraph('climax', [
        's2-climax-channel', 's2-climax-overlap', 's2-climax-final',
      ], 30, 0.5, 2.1, 1.8),
    ],
    boss: { kind: 'hive', warningMs: 2_000 },
  },
  {
    id: 'default-3',
    number: 3,
    battlefield: 'default',
    powerBand: {
      expectedOrbCount: 6,
      normalHpMultiplier: 2.4,
      eliteHpMultiplier: 2.8,
      largeEnemyRatio: 0.32,
    },
    descentSpeedMultiplier: 1,
    paragraphs: [
      paragraph('opening', [
        's3-opening-fork', 's3-opening-pockets', 's3-opening-crossfire',
      ], 28, 0.3, 1, 1),
      paragraph('pressure', [
        's3-pressure-maze', 's3-pressure-turrets',
        's3-pressure-fortress', 's3-pressure-broken-grid',
      ], 32, 0.4, 1.6, 1.4),
      paragraph('climax', [
        's3-climax-serpent', 's3-climax-killbox', 's3-climax-final',
      ], 34, 0.5, 2.1, 1.8),
    ],
    boss: { kind: 'siege', warningMs: 2_000 },
  },
] as const satisfies readonly StageDefinition[];

function positiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer`);
  }
}

function positive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be finite and positive`);
  }
}

export function validateStageContent(
  stages: readonly StageDefinition[] = STAGES,
  formations: readonly AuthoredFormation[] = AUTHORED_FORMATIONS,
  catalog: readonly EnemyCatalogEntry[] = ENEMY_CATALOG,
): void {
  const catalogByKind = new Map(catalog.map((entry) => [entry.kind, entry]));
  if (catalogByKind.size !== catalog.length) {
    throw new RangeError('enemy catalog kinds must be unique');
  }
  for (const entry of catalog) {
    positiveInteger(entry.minStage, `${entry.kind}.minStage`);
    positiveInteger(entry.width, `${entry.kind}.width`);
    positiveInteger(entry.height, `${entry.kind}.height`);
    if (entry.width > FORMATION_COLUMNS) {
      throw new RangeError(`${entry.kind}.width must fit the grid`);
    }
  }

  const formationById = new Map(formations.map((formation) => [formation.id, formation]));
  if (formationById.size !== formations.length) {
    throw new RangeError('formation IDs must be unique');
  }
  for (const formation of formations) {
    positiveInteger(formation.rows, `${formation.id}.rows`);
    const occupied = new Set<string>();
    for (const slot of formation.slots) {
      const entry = catalogByKind.get(slot.kind);
      if (!entry) throw new RangeError(`${formation.id} uses unknown enemy ${slot.kind}`);
      try {
        occupyFootprint(occupied, {
          column: slot.column,
          row: slot.row,
          width: entry.width,
          height: entry.height,
        }, formation.rows);
      } catch (error) {
        throw new RangeError(`${formation.id}: ${(error as Error).message}`);
      }
    }
  }

  const allReferences: string[] = [];
  for (const stage of stages) {
    positiveInteger(stage.number, `${stage.id}.number`);
    positive(stage.descentSpeedMultiplier, `${stage.id}.descentSpeedMultiplier`);
    if (stage.paragraphs.length !== 3
      || stage.paragraphs.map(({ id }) => id).join(',') !== 'opening,pressure,climax') {
      throw new RangeError(`${stage.id} paragraphs must be opening, pressure, climax`);
    }
    const stageReferences = stage.paragraphs.flatMap(({ formationIds }) => formationIds);
    if (new Set(stageReferences).size !== stageReferences.length) {
      throw new RangeError(`${stage.id} formation references must be unique`);
    }
    for (const [index, stageParagraph] of stage.paragraphs.entries()) {
      const requiredCount = index === 1 ? 4 : 3;
      if (stageParagraph.formationIds.length !== requiredCount) {
        throw new RangeError(
          `${stage.id} ${stageParagraph.id} must contain ${requiredCount} formations`,
        );
      }
      positiveInteger(stageParagraph.activeCap, `${stage.id}.${stageParagraph.id}.activeCap`);
      if (!Number.isFinite(stageParagraph.targetDepthRatio)
        || stageParagraph.targetDepthRatio <= 0
        || stageParagraph.targetDepthRatio >= 1) {
        throw new RangeError(`${stage.id}.${stageParagraph.id}.targetDepthRatio must be inside 0..1`);
      }
      positive(stageParagraph.normalHpMultiplier, `${stage.id}.${stageParagraph.id}.normalHpMultiplier`);
      positive(stageParagraph.eliteHpMultiplier, `${stage.id}.${stageParagraph.id}.eliteHpMultiplier`);
      for (const formationId of stageParagraph.formationIds) {
        const formation = formationById.get(formationId);
        if (!formation) throw new RangeError(`${stage.id} references missing formation ${formationId}`);
        for (const slot of formation.slots) {
          const entry = catalogByKind.get(slot.kind)!;
          if (entry.minStage > stage.number) {
            throw new RangeError(
              `${formation.id} cannot use ${entry.kind} in stage ${stage.number}`,
            );
          }
          if (!entry.battlefields.includes(stage.battlefield)) {
            throw new RangeError(`${formation.id} cannot use ${entry.kind} on ${stage.battlefield}`);
          }
        }
        allReferences.push(formationId);
      }
    }
    const climaxFinal = stage.paragraphs[2]!.formationIds.at(-1);
    if (climaxFinal !== `s${stage.number}-climax-final`) {
      throw new RangeError(`${stage.id} climax final formation must be last`);
    }
  }
  if (new Set(allReferences).size !== allReferences.length) {
    throw new RangeError('formation references must be globally unique');
  }
  if (allReferences.length !== formations.length) {
    throw new RangeError('every authored formation must be referenced exactly once');
  }
}

validateStageContent();
