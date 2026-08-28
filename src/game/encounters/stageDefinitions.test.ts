import { describe, expect, it } from 'vitest';
import { FORMATION_COLUMNS } from './formationGrid';
import {
  AUTHORED_FORMATIONS,
  type AuthoredFormation,
} from './authoredFormations';
import {
  ENEMY_CATALOG,
  STAGES,
  validateStageContent,
} from './stageDefinitions';

describe('authored stage content', () => {
  it('defines three ten-formation stage scripts with central paragraph tuning', () => {
    expect(STAGES.map((stage) => stage.paragraphs.map((paragraph) => ({
      id: paragraph.id,
      count: paragraph.formationIds.length,
      activeCap: paragraph.activeCap,
      targetDepthRatio: paragraph.targetDepthRatio,
      normalHpMultiplier: paragraph.normalHpMultiplier,
      eliteHpMultiplier: paragraph.eliteHpMultiplier,
    })))).toEqual([
      [
        { id: 'opening', count: 3, activeCap: 16, targetDepthRatio: 0.3, normalHpMultiplier: 1, eliteHpMultiplier: 1 },
        { id: 'pressure', count: 4, activeCap: 22, targetDepthRatio: 0.4, normalHpMultiplier: 1.6, eliteHpMultiplier: 1.4 },
        { id: 'climax', count: 3, activeCap: 26, targetDepthRatio: 0.5, normalHpMultiplier: 2.1, eliteHpMultiplier: 1.8 },
      ],
      [
        { id: 'opening', count: 3, activeCap: 26, targetDepthRatio: 0.3, normalHpMultiplier: 1, eliteHpMultiplier: 1 },
        { id: 'pressure', count: 4, activeCap: 30, targetDepthRatio: 0.4, normalHpMultiplier: 1.6, eliteHpMultiplier: 1.4 },
        { id: 'climax', count: 3, activeCap: 30, targetDepthRatio: 0.5, normalHpMultiplier: 2.1, eliteHpMultiplier: 1.8 },
      ],
      [
        { id: 'opening', count: 3, activeCap: 28, targetDepthRatio: 0.3, normalHpMultiplier: 1, eliteHpMultiplier: 1 },
        { id: 'pressure', count: 4, activeCap: 32, targetDepthRatio: 0.4, normalHpMultiplier: 1.6, eliteHpMultiplier: 1.4 },
        { id: 'climax', count: 3, activeCap: 34, targetDepthRatio: 0.5, normalHpMultiplier: 2.1, eliteHpMultiplier: 1.8 },
      ],
    ]);
    expect(STAGES.map(({ id, number, boss }) => [id, number, boss.kind])).toEqual([
      ['default-1', 1, 'sentinel'],
      ['default-2', 2, 'hive'],
      ['default-3', 3, 'siege'],
    ]);
    expect(STAGES.every(({ descentSpeedMultiplier }) => descentSpeedMultiplier === 1)).toBe(true);
    expect(AUTHORED_FORMATIONS).toHaveLength(30);
    expect(new Set(AUTHORED_FORMATIONS.map(({ id }) => id)).size).toBe(30);
    const references = STAGES.flatMap(({ paragraphs }) => (
      paragraphs.flatMap(({ formationIds }) => formationIds)
    ));
    expect(references).toHaveLength(30);
    expect(new Set(references).size).toBe(30);
    expect(() => validateStageContent()).not.toThrow();
  });

  it('keeps catalog footprints on the six-column grid', () => {
    expect(FORMATION_COLUMNS).toBe(6);
    expect(Object.fromEntries(ENEMY_CATALOG.map(({ kind, width, height }) => (
      [kind, `${width}×${height}`]
    )))).toEqual({
      basic: '1×1',
      armored: '2×2',
      shooter: '1×1',
      splitter: '2×1',
    });
  });

  it.each([
    ['duplicate formation ID', (formations: readonly AuthoredFormation[]) => [
      ...formations,
      formations[0]!,
    ], 'formation IDs must be unique'],
    ['out-of-grid slot', (formations: readonly AuthoredFormation[]) => [
      { ...formations[0]!, id: 'bad-grid', slots: [{ kind: 'basic' as const, column: 6, row: 0 }] },
      ...formations.slice(1),
    ], 'bad-grid'],
    ['overlapping footprints', (formations: readonly AuthoredFormation[]) => [
      {
        ...formations[0]!,
        id: 'bad-overlap',
        slots: [
          { kind: 'armored' as const, column: 0, row: 0 },
          { kind: 'basic' as const, column: 1, row: 1 },
        ],
      },
      ...formations.slice(1),
    ], 'bad-overlap'],
  ] as const)('rejects %s', (_label, mutate, message) => {
    expect(() => validateStageContent(STAGES, mutate(AUTHORED_FORMATIONS), ENEMY_CATALOG))
      .toThrow(message);
  });

  it('rejects missing and duplicate script references', () => {
    const missing = [{
      ...STAGES[0]!,
      paragraphs: [{
        ...STAGES[0]!.paragraphs[0]!,
        formationIds: ['missing', ...STAGES[0]!.paragraphs[0]!.formationIds.slice(1)],
      }, ...STAGES[0]!.paragraphs.slice(1)],
    }, ...STAGES.slice(1)];
    expect(() => validateStageContent(missing, AUTHORED_FORMATIONS, ENEMY_CATALOG))
      .toThrow('missing');

    const duplicate = [{
      ...STAGES[0]!,
      paragraphs: [{
        ...STAGES[0]!.paragraphs[0]!,
        formationIds: [
          STAGES[0]!.paragraphs[0]!.formationIds[0]!,
          STAGES[0]!.paragraphs[0]!.formationIds[0]!,
          STAGES[0]!.paragraphs[0]!.formationIds[2]!,
        ],
      }, ...STAGES[0]!.paragraphs.slice(1)],
    }, ...STAGES.slice(1)];
    expect(() => validateStageContent(duplicate, AUTHORED_FORMATIONS, ENEMY_CATALOG))
      .toThrow('default-1 formation references must be unique');
  });

  it('rejects illegal stage enemies and malformed paragraph scripts', () => {
    const stageOneSplitter = AUTHORED_FORMATIONS.map((formation, index) => index === 0 ? {
      ...formation,
      slots: [{ kind: 'splitter' as const, column: 0, row: 0 }],
    } : formation);
    expect(() => validateStageContent(STAGES, stageOneSplitter, ENEMY_CATALOG))
      .toThrow('s1-opening-gate cannot use splitter in stage 1');

    const shortOpening = [{
      ...STAGES[0]!,
      paragraphs: [{
        ...STAGES[0]!.paragraphs[0]!,
        formationIds: STAGES[0]!.paragraphs[0]!.formationIds.slice(0, 2),
      }, ...STAGES[0]!.paragraphs.slice(1)],
    }, ...STAGES.slice(1)];
    expect(() => validateStageContent(shortOpening, AUTHORED_FORMATIONS, ENEMY_CATALOG))
      .toThrow('default-1 opening must contain 3 formations');

    const wrongFinal = [{
      ...STAGES[0]!,
      paragraphs: [...STAGES[0]!.paragraphs.slice(0, 2), {
        ...STAGES[0]!.paragraphs[2]!,
        formationIds: [
          's1-climax-final',
          ...STAGES[0]!.paragraphs[2]!.formationIds.slice(0, 2),
        ],
      }],
    }, ...STAGES.slice(1)];
    expect(() => validateStageContent(wrongFinal, AUTHORED_FORMATIONS, ENEMY_CATALOG))
      .toThrow('default-1 climax final formation must be last');
  });
});
