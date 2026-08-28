import { GAME_TUNING } from '../config/gameTuning';
import type { FormationEnemySpec } from '../enemies/enemyRules';
import { AUTHORED_FORMATIONS, type ParagraphId } from './authoredFormations';
import { footprintWorldRect } from './formationGrid';
import {
  ENEMY_CATALOG,
  type StageDefinition,
  type StageParagraphDefinition,
} from './stageDefinitions';

export interface FormationResult {
  id: string;
  enemies: FormationEnemySpec[];
  populationCost: number;
}

export interface ResolvedStageFormation {
  id: string;
  paragraphId: ParagraphId;
  paragraphIndex: number;
  sequence: number;
}

function validateSeed(seed: number, name = 'seed'): void {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff) {
    throw new RangeError(`${name} must be an unsigned 32-bit integer`);
  }
}

function mix(seed: number, salt: number): number {
  let value = (seed ^ salt) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return (value ^ (value >>> 15)) >>> 0;
}

function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}

function shuffled<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex]!, result[index]!];
  }
  return result;
}

export function resolveStageFormationOrder(
  stage: StageDefinition,
  runSeed: number,
): ResolvedStageFormation[] {
  validateSeed(runSeed, 'runSeed');
  let sequence = 0;
  return stage.paragraphs.flatMap((paragraph, paragraphIndex) => {
    const fixedFinal = paragraph.id === 'climax' ? paragraph.formationIds.at(-1) : undefined;
    const candidates = fixedFinal
      ? paragraph.formationIds.slice(0, -1)
      : paragraph.formationIds;
    const ordered = shuffled(
      candidates,
      createRandom(mix(runSeed, stage.number * 31 + paragraphIndex)),
    );
    if (fixedFinal) ordered.push(fixedFinal);
    return ordered.map((id) => ({
      id,
      paragraphId: paragraph.id,
      paragraphIndex,
      sequence: sequence++,
    }));
  });
}

export function createAuthoredFormation(
  stage: StageDefinition,
  paragraph: StageParagraphDefinition,
  formationId: string,
): FormationResult {
  const formation = AUTHORED_FORMATIONS.find(({ id }) => id === formationId);
  if (!formation) throw new RangeError(`authored formation ${formationId} does not exist`);
  const catalogByKind = new Map(ENEMY_CATALOG.map((entry) => [entry.kind, entry]));
  const originY = -formation.rows * GAME_TUNING.encounter.grid.cellHeight;
  const enemies = formation.slots.map((slot): FormationEnemySpec => {
    const catalog = catalogByKind.get(slot.kind);
    if (!catalog) throw new RangeError(`${formationId} uses unknown enemy ${slot.kind}`);
    const footprint = {
      column: slot.column,
      row: slot.row,
      width: catalog.width,
      height: catalog.height,
    };
    const rect = footprintWorldRect(footprint, originY);
    const elite = catalog.width * catalog.height >= 4;
    return {
      ...footprint,
      formationId,
      kind: slot.kind,
      hp: GAME_TUNING.enemies.hp[slot.kind] * (
        elite
          ? stage.powerBand.eliteHpMultiplier * paragraph.eliteHpMultiplier
          : stage.powerBand.normalHpMultiplier * paragraph.normalHpMultiplier
      ),
      x: rect.x,
      y: rect.y,
      speed: GAME_TUNING.enemies.descentSpeed * stage.descentSpeedMultiplier,
    };
  });
  return {
    id: formationId,
    enemies,
    populationCost: enemies.reduce(
      (sum, enemy) => sum + enemy.width * enemy.height,
      0,
    ),
  };
}
