import type { EnemyKind } from '../enemies/enemyRules';

export type ParagraphId = 'opening' | 'pressure' | 'climax';

export interface AuthoredFormationSlot {
  kind: Exclude<EnemyKind, 'fragment'>;
  column: number;
  row: number;
}

export interface AuthoredFormation {
  id: string;
  rows: number;
  role: 'corridor' | 'pockets' | 'crossfire' | 'wall';
  slots: readonly AuthoredFormationSlot[];
}

export const AUTHORED_FORMATIONS = [
  {
    id: 's1-opening-gate', rows: 3, role: 'corridor',
    slots: [
      { kind: 'basic', column: 0, row: 0 }, { kind: 'basic', column: 2, row: 0 },
      { kind: 'shooter', column: 4, row: 0 }, { kind: 'basic', column: 1, row: 1 },
      { kind: 'basic', column: 3, row: 1 }, { kind: 'basic', column: 5, row: 1 },
      { kind: 'basic', column: 0, row: 2 }, { kind: 'basic', column: 4, row: 2 },
      { kind: 'shooter', column: 5, row: 2 },
    ],
  },
  {
    id: 's1-opening-banks', rows: 3, role: 'pockets',
    slots: [
      { kind: 'basic', column: 0, row: 0 }, { kind: 'basic', column: 1, row: 0 },
      { kind: 'basic', column: 4, row: 0 }, { kind: 'basic', column: 5, row: 0 },
      { kind: 'shooter', column: 0, row: 1 }, { kind: 'basic', column: 2, row: 1 },
      { kind: 'shooter', column: 5, row: 1 }, { kind: 'basic', column: 1, row: 2 },
      { kind: 'basic', column: 3, row: 2 }, { kind: 'basic', column: 4, row: 2 },
    ],
  },
  {
    id: 's1-opening-pocket', rows: 4, role: 'pockets',
    slots: [
      { kind: 'armored', column: 0, row: 0 }, { kind: 'basic', column: 2, row: 0 },
      { kind: 'basic', column: 4, row: 0 }, { kind: 'basic', column: 2, row: 1 },
      { kind: 'basic', column: 4, row: 1 }, { kind: 'shooter', column: 5, row: 1 },
      { kind: 'basic', column: 0, row: 2 }, { kind: 'basic', column: 2, row: 2 },
      { kind: 'basic', column: 5, row: 2 }, { kind: 'shooter', column: 1, row: 3 },
      { kind: 'basic', column: 3, row: 3 }, { kind: 'basic', column: 4, row: 3 },
    ],
  },
  {
    id: 's1-pressure-right-fort', rows: 4, role: 'corridor',
    slots: [
      { kind: 'basic', column: 0, row: 0 }, { kind: 'shooter', column: 2, row: 0 },
      { kind: 'armored', column: 4, row: 0 }, { kind: 'basic', column: 1, row: 1 },
      { kind: 'basic', column: 2, row: 1 }, { kind: 'basic', column: 0, row: 2 },
      { kind: 'basic', column: 3, row: 2 }, { kind: 'shooter', column: 5, row: 2 },
      { kind: 'shooter', column: 1, row: 3 }, { kind: 'basic', column: 2, row: 3 },
      { kind: 'basic', column: 3, row: 3 }, { kind: 'basic', column: 5, row: 3 },
    ],
  },
  {
    id: 's1-pressure-center-guard', rows: 4, role: 'corridor',
    slots: [
      { kind: 'basic', column: 0, row: 0 }, { kind: 'basic', column: 2, row: 0 },
      { kind: 'shooter', column: 5, row: 0 }, { kind: 'basic', column: 1, row: 1 },
      { kind: 'armored', column: 2, row: 1 }, { kind: 'basic', column: 4, row: 1 },
      { kind: 'shooter', column: 0, row: 2 }, { kind: 'basic', column: 5, row: 2 },
      { kind: 'basic', column: 0, row: 3 }, { kind: 'basic', column: 1, row: 3 },
      { kind: 'basic', column: 4, row: 3 },
    ],
  },
  {
    id: 's1-pressure-twin-fort', rows: 4, role: 'pockets',
    slots: [
      { kind: 'armored', column: 0, row: 0 }, { kind: 'basic', column: 2, row: 0 },
      { kind: 'armored', column: 4, row: 0 }, { kind: 'basic', column: 2, row: 1 },
      { kind: 'basic', column: 0, row: 2 }, { kind: 'shooter', column: 2, row: 2 },
      { kind: 'basic', column: 4, row: 2 }, { kind: 'basic', column: 1, row: 3 },
      { kind: 'basic', column: 2, row: 3 }, { kind: 'shooter', column: 4, row: 3 },
      { kind: 'basic', column: 5, row: 3 },
    ],
  },
  {
    id: 's1-pressure-broken-wall', rows: 4, role: 'wall',
    slots: [
      { kind: 'basic', column: 0, row: 0 }, { kind: 'basic', column: 1, row: 0 },
      { kind: 'shooter', column: 3, row: 0 }, { kind: 'basic', column: 4, row: 0 },
      { kind: 'basic', column: 5, row: 0 }, { kind: 'basic', column: 0, row: 1 },
      { kind: 'basic', column: 3, row: 1 }, { kind: 'shooter', column: 5, row: 1 },
      { kind: 'shooter', column: 1, row: 2 }, { kind: 'basic', column: 2, row: 2 },
      { kind: 'basic', column: 3, row: 2 }, { kind: 'basic', column: 0, row: 3 },
      { kind: 'basic', column: 2, row: 3 }, { kind: 'basic', column: 4, row: 3 },
      { kind: 'basic', column: 5, row: 3 },
    ],
  },
  {
    id: 's1-climax-zigzag', rows: 5, role: 'corridor',
    slots: [
      { kind: 'armored', column: 0, row: 0 }, { kind: 'basic', column: 2, row: 0 },
      { kind: 'basic', column: 4, row: 0 }, { kind: 'shooter', column: 5, row: 0 },
      { kind: 'basic', column: 3, row: 1 }, { kind: 'basic', column: 5, row: 1 },
      { kind: 'basic', column: 0, row: 2 }, { kind: 'shooter', column: 1, row: 2 },
      { kind: 'basic', column: 2, row: 2 }, { kind: 'basic', column: 4, row: 2 },
      { kind: 'basic', column: 1, row: 3 }, { kind: 'armored', column: 3, row: 3 },
      { kind: 'shooter', column: 0, row: 4 }, { kind: 'basic', column: 1, row: 4 },
    ],
  },
  {
    id: 's1-climax-crossfire', rows: 5, role: 'crossfire',
    slots: [
      { kind: 'shooter', column: 0, row: 0 }, { kind: 'basic', column: 1, row: 0 },
      { kind: 'basic', column: 2, row: 0 }, { kind: 'basic', column: 4, row: 0 },
      { kind: 'shooter', column: 5, row: 0 }, { kind: 'basic', column: 0, row: 1 },
      { kind: 'armored', column: 2, row: 1 }, { kind: 'basic', column: 4, row: 1 },
      { kind: 'basic', column: 1, row: 2 }, { kind: 'basic', column: 5, row: 2 },
      { kind: 'basic', column: 0, row: 3 }, { kind: 'shooter', column: 1, row: 3 },
      { kind: 'shooter', column: 4, row: 3 }, { kind: 'basic', column: 5, row: 3 },
      { kind: 'basic', column: 1, row: 4 }, { kind: 'basic', column: 2, row: 4 },
      { kind: 'basic', column: 4, row: 4 },
    ],
  },
  {
    id: 's1-climax-final', rows: 5, role: 'wall',
    slots: [
      { kind: 'armored', column: 0, row: 0 }, { kind: 'basic', column: 2, row: 0 },
      { kind: 'basic', column: 3, row: 0 }, { kind: 'armored', column: 4, row: 0 },
      { kind: 'shooter', column: 0, row: 2 }, { kind: 'basic', column: 1, row: 2 },
      { kind: 'basic', column: 2, row: 2 }, { kind: 'basic', column: 3, row: 2 },
      { kind: 'basic', column: 4, row: 2 }, { kind: 'shooter', column: 5, row: 2 },
      { kind: 'basic', column: 0, row: 3 }, { kind: 'armored', column: 2, row: 3 },
      { kind: 'basic', column: 4, row: 3 }, { kind: 'basic', column: 1, row: 4 },
      { kind: 'basic', column: 5, row: 4 },
    ],
  },
  {
    id: 's2-opening-split-lanes', rows: 4, role: 'corridor',
    slots: [
      { kind: 'splitter', column: 0, row: 0 }, { kind: 'basic', column: 2, row: 0 }, { kind: 'shooter', column: 5, row: 0 },
      { kind: 'basic', column: 1, row: 1 }, { kind: 'splitter', column: 3, row: 1 },
      { kind: 'shooter', column: 0, row: 2 }, { kind: 'basic', column: 2, row: 2 }, { kind: 'basic', column: 5, row: 2 },
      { kind: 'basic', column: 1, row: 3 }, { kind: 'basic', column: 2, row: 3 }, { kind: 'basic', column: 4, row: 3 },
    ],
  },
  {
    id: 's2-opening-armored-gap', rows: 4, role: 'corridor',
    slots: [
      { kind: 'armored', column: 0, row: 0 }, { kind: 'basic', column: 2, row: 0 }, { kind: 'splitter', column: 4, row: 0 },
      { kind: 'basic', column: 4, row: 1 },
      { kind: 'basic', column: 0, row: 2 }, { kind: 'shooter', column: 2, row: 2 }, { kind: 'basic', column: 5, row: 2 },
      { kind: 'basic', column: 1, row: 3 }, { kind: 'splitter', column: 3, row: 3 },
    ],
  },
  {
    id: 's2-opening-crossfire', rows: 4, role: 'crossfire',
    slots: [
      { kind: 'shooter', column: 0, row: 0 }, { kind: 'splitter', column: 2, row: 0 }, { kind: 'shooter', column: 5, row: 0 },
      { kind: 'basic', column: 0, row: 1 }, { kind: 'basic', column: 1, row: 1 }, { kind: 'basic', column: 4, row: 1 }, { kind: 'basic', column: 5, row: 1 },
      { kind: 'armored', column: 1, row: 2 }, { kind: 'basic', column: 3, row: 2 },
      { kind: 'basic', column: 4, row: 3 }, { kind: 'shooter', column: 5, row: 3 },
    ],
  },
  {
    id: 's2-pressure-left-pocket', rows: 5, role: 'pockets',
    slots: [
      { kind: 'armored', column: 0, row: 0 }, { kind: 'basic', column: 2, row: 0 }, { kind: 'splitter', column: 4, row: 0 },
      { kind: 'basic', column: 2, row: 1 }, { kind: 'shooter', column: 5, row: 1 },
      { kind: 'splitter', column: 0, row: 2 }, { kind: 'basic', column: 2, row: 2 }, { kind: 'basic', column: 4, row: 2 },
      { kind: 'shooter', column: 1, row: 3 }, { kind: 'basic', column: 3, row: 3 }, { kind: 'basic', column: 4, row: 3 },
      { kind: 'basic', column: 0, row: 4 }, { kind: 'splitter', column: 3, row: 4 }, { kind: 'basic', column: 5, row: 4 },
    ],
  },
  {
    id: 's2-pressure-split-gate', rows: 5, role: 'corridor',
    slots: [
      { kind: 'splitter', column: 0, row: 0 }, { kind: 'shooter', column: 2, row: 0 }, { kind: 'splitter', column: 4, row: 0 },
      { kind: 'basic', column: 1, row: 1 }, { kind: 'basic', column: 5, row: 1 },
      { kind: 'basic', column: 0, row: 2 }, { kind: 'armored', column: 2, row: 2 }, { kind: 'basic', column: 4, row: 2 },
      { kind: 'shooter', column: 0, row: 3 }, { kind: 'shooter', column: 5, row: 3 },
      { kind: 'basic', column: 1, row: 4 }, { kind: 'basic', column: 4, row: 4 },
    ],
  },
  {
    id: 's2-pressure-twin-armor', rows: 5, role: 'pockets',
    slots: [
      { kind: 'armored', column: 0, row: 0 }, { kind: 'basic', column: 2, row: 0 }, { kind: 'armored', column: 4, row: 0 },
      { kind: 'splitter', column: 0, row: 2 }, { kind: 'shooter', column: 2, row: 2 }, { kind: 'basic', column: 4, row: 2 },
      { kind: 'basic', column: 1, row: 3 }, { kind: 'splitter', column: 3, row: 3 }, { kind: 'shooter', column: 5, row: 3 },
      { kind: 'basic', column: 0, row: 4 }, { kind: 'basic', column: 3, row: 4 },
    ],
  },
  {
    id: 's2-pressure-battery', rows: 5, role: 'crossfire',
    slots: [
      { kind: 'shooter', column: 0, row: 0 }, { kind: 'basic', column: 1, row: 0 }, { kind: 'basic', column: 2, row: 0 }, { kind: 'basic', column: 4, row: 0 }, { kind: 'shooter', column: 5, row: 0 },
      { kind: 'splitter', column: 0, row: 1 }, { kind: 'splitter', column: 4, row: 1 },
      { kind: 'basic', column: 1, row: 2 }, { kind: 'armored', column: 2, row: 2 }, { kind: 'basic', column: 4, row: 2 },
      { kind: 'shooter', column: 0, row: 3 }, { kind: 'basic', column: 5, row: 3 },
      { kind: 'basic', column: 1, row: 4 }, { kind: 'splitter', column: 3, row: 4 },
    ],
  },
  {
    id: 's2-climax-channel', rows: 5, role: 'corridor',
    slots: [
      { kind: 'armored', column: 0, row: 0 }, { kind: 'splitter', column: 3, row: 0 },
      { kind: 'basic', column: 2, row: 1 }, { kind: 'shooter', column: 5, row: 1 },
      { kind: 'splitter', column: 0, row: 2 }, { kind: 'basic', column: 2, row: 2 }, { kind: 'armored', column: 4, row: 2 },
      { kind: 'shooter', column: 1, row: 3 },
      { kind: 'basic', column: 0, row: 4 }, { kind: 'basic', column: 1, row: 4 }, { kind: 'splitter', column: 3, row: 4 },
    ],
  },
  {
    id: 's2-climax-overlap', rows: 5, role: 'pockets',
    slots: [
      { kind: 'splitter', column: 0, row: 0 }, { kind: 'shooter', column: 2, row: 0 }, { kind: 'armored', column: 4, row: 0 },
      { kind: 'basic', column: 0, row: 1 }, { kind: 'basic', column: 3, row: 1 },
      { kind: 'armored', column: 0, row: 2 }, { kind: 'basic', column: 2, row: 2 }, { kind: 'splitter', column: 4, row: 2 },
      { kind: 'shooter', column: 3, row: 3 }, { kind: 'basic', column: 5, row: 3 },
      { kind: 'basic', column: 1, row: 4 }, { kind: 'splitter', column: 3, row: 4 },
    ],
  },
  {
    id: 's2-climax-final', rows: 5, role: 'wall',
    slots: [
      { kind: 'armored', column: 0, row: 0 }, { kind: 'splitter', column: 2, row: 0 }, { kind: 'armored', column: 4, row: 0 },
      { kind: 'basic', column: 2, row: 1 }, { kind: 'basic', column: 3, row: 1 },
      { kind: 'shooter', column: 0, row: 2 }, { kind: 'splitter', column: 2, row: 2 }, { kind: 'shooter', column: 5, row: 2 },
      { kind: 'armored', column: 0, row: 3 }, { kind: 'basic', column: 2, row: 3 }, { kind: 'basic', column: 4, row: 3 },
      { kind: 'splitter', column: 3, row: 4 }, { kind: 'shooter', column: 5, row: 4 },
    ],
  },
  {
    id: 's3-opening-fork', rows: 5, role: 'corridor',
    slots: [
      { kind: 'splitter', column: 0, row: 0 }, { kind: 'shooter', column: 2, row: 0 }, { kind: 'splitter', column: 4, row: 0 },
      { kind: 'basic', column: 0, row: 1 }, { kind: 'armored', column: 2, row: 1 }, { kind: 'basic', column: 4, row: 1 },
      { kind: 'basic', column: 1, row: 2 }, { kind: 'shooter', column: 5, row: 2 },
      { kind: 'armored', column: 0, row: 3 }, { kind: 'splitter', column: 4, row: 3 },
      { kind: 'basic', column: 2, row: 4 }, { kind: 'basic', column: 4, row: 4 },
    ],
  },
  {
    id: 's3-opening-pockets', rows: 5, role: 'pockets',
    slots: [
      { kind: 'armored', column: 0, row: 0 }, { kind: 'splitter', column: 3, row: 0 },
      { kind: 'shooter', column: 2, row: 1 }, { kind: 'basic', column: 5, row: 1 },
      { kind: 'splitter', column: 0, row: 2 }, { kind: 'basic', column: 2, row: 2 }, { kind: 'armored', column: 4, row: 2 },
      { kind: 'basic', column: 1, row: 3 },
      { kind: 'shooter', column: 0, row: 4 }, { kind: 'splitter', column: 2, row: 4 }, { kind: 'basic', column: 4, row: 4 },
    ],
  },
  {
    id: 's3-opening-crossfire', rows: 5, role: 'crossfire',
    slots: [
      { kind: 'shooter', column: 0, row: 0 }, { kind: 'splitter', column: 1, row: 0 }, { kind: 'splitter', column: 3, row: 0 }, { kind: 'shooter', column: 5, row: 0 },
      { kind: 'basic', column: 0, row: 1 }, { kind: 'basic', column: 5, row: 1 },
      { kind: 'armored', column: 0, row: 2 }, { kind: 'basic', column: 2, row: 2 }, { kind: 'armored', column: 4, row: 2 },
      { kind: 'shooter', column: 2, row: 3 },
      { kind: 'basic', column: 1, row: 4 }, { kind: 'splitter', column: 3, row: 4 },
    ],
  },
  {
    id: 's3-pressure-maze', rows: 5, role: 'corridor',
    slots: [
      { kind: 'armored', column: 0, row: 0 }, { kind: 'basic', column: 2, row: 0 }, { kind: 'splitter', column: 4, row: 0 },
      { kind: 'shooter', column: 4, row: 1 },
      { kind: 'splitter', column: 0, row: 2 }, { kind: 'basic', column: 2, row: 2 }, { kind: 'armored', column: 4, row: 2 },
      { kind: 'shooter', column: 1, row: 3 },
      { kind: 'basic', column: 0, row: 4 }, { kind: 'basic', column: 1, row: 4 }, { kind: 'splitter', column: 3, row: 4 }, { kind: 'basic', column: 5, row: 4 },
    ],
  },
  {
    id: 's3-pressure-turrets', rows: 5, role: 'crossfire',
    slots: [
      { kind: 'shooter', column: 0, row: 0 }, { kind: 'armored', column: 2, row: 0 }, { kind: 'shooter', column: 5, row: 0 },
      { kind: 'basic', column: 0, row: 1 }, { kind: 'basic', column: 5, row: 1 },
      { kind: 'splitter', column: 0, row: 2 }, { kind: 'basic', column: 2, row: 2 }, { kind: 'basic', column: 3, row: 2 }, { kind: 'splitter', column: 4, row: 2 },
      { kind: 'armored', column: 0, row: 3 }, { kind: 'shooter', column: 2, row: 3 }, { kind: 'armored', column: 4, row: 3 },
      { kind: 'basic', column: 2, row: 4 },
    ],
  },
  {
    id: 's3-pressure-fortress', rows: 5, role: 'pockets',
    slots: [
      { kind: 'armored', column: 0, row: 0 }, { kind: 'splitter', column: 2, row: 0 }, { kind: 'armored', column: 4, row: 0 },
      { kind: 'basic', column: 0, row: 2 }, { kind: 'shooter', column: 2, row: 2 }, { kind: 'basic', column: 4, row: 2 },
      { kind: 'splitter', column: 0, row: 3 }, { kind: 'armored', column: 3, row: 3 },
      { kind: 'shooter', column: 0, row: 4 }, { kind: 'basic', column: 1, row: 4 },
    ],
  },
  {
    id: 's3-pressure-broken-grid', rows: 5, role: 'wall',
    slots: [
      { kind: 'basic', column: 0, row: 0 }, { kind: 'splitter', column: 1, row: 0 }, { kind: 'splitter', column: 3, row: 0 }, { kind: 'shooter', column: 5, row: 0 },
      { kind: 'armored', column: 0, row: 1 }, { kind: 'basic', column: 2, row: 1 }, { kind: 'armored', column: 4, row: 1 },
      { kind: 'shooter', column: 0, row: 3 }, { kind: 'splitter', column: 1, row: 3 }, { kind: 'basic', column: 3, row: 3 }, { kind: 'shooter', column: 5, row: 3 },
      { kind: 'basic', column: 0, row: 4 }, { kind: 'splitter', column: 3, row: 4 }, { kind: 'basic', column: 5, row: 4 },
    ],
  },
  {
    id: 's3-climax-serpent', rows: 5, role: 'corridor',
    slots: [
      { kind: 'armored', column: 0, row: 0 }, { kind: 'splitter', column: 3, row: 0 }, { kind: 'shooter', column: 5, row: 0 },
      { kind: 'basic', column: 2, row: 1 },
      { kind: 'splitter', column: 0, row: 2 }, { kind: 'shooter', column: 2, row: 2 }, { kind: 'armored', column: 4, row: 2 },
      { kind: 'basic', column: 0, row: 3 },
      { kind: 'shooter', column: 0, row: 4 }, { kind: 'splitter', column: 2, row: 4 }, { kind: 'basic', column: 4, row: 4 },
    ],
  },
  {
    id: 's3-climax-killbox', rows: 5, role: 'crossfire',
    slots: [
      { kind: 'shooter', column: 0, row: 0 }, { kind: 'armored', column: 1, row: 0 }, { kind: 'armored', column: 3, row: 0 },
      { kind: 'basic', column: 0, row: 1 }, { kind: 'basic', column: 5, row: 1 },
      { kind: 'splitter', column: 0, row: 2 }, { kind: 'basic', column: 2, row: 2 }, { kind: 'basic', column: 3, row: 2 }, { kind: 'splitter', column: 4, row: 2 },
      { kind: 'armored', column: 0, row: 3 }, { kind: 'shooter', column: 2, row: 3 }, { kind: 'armored', column: 4, row: 3 },
      { kind: 'basic', column: 2, row: 4 },
    ],
  },
  {
    id: 's3-climax-final', rows: 5, role: 'wall',
    slots: [
      { kind: 'armored', column: 0, row: 0 }, { kind: 'splitter', column: 2, row: 0 }, { kind: 'armored', column: 4, row: 0 },
      { kind: 'basic', column: 2, row: 1 }, { kind: 'basic', column: 3, row: 1 },
      { kind: 'shooter', column: 0, row: 2 }, { kind: 'splitter', column: 1, row: 2 }, { kind: 'splitter', column: 3, row: 2 }, { kind: 'shooter', column: 5, row: 2 },
      { kind: 'armored', column: 0, row: 3 }, { kind: 'basic', column: 2, row: 3 }, { kind: 'basic', column: 3, row: 3 }, { kind: 'armored', column: 4, row: 3 },
      { kind: 'shooter', column: 2, row: 4 }, { kind: 'shooter', column: 3, row: 4 },
    ],
  },
] as const satisfies readonly AuthoredFormation[];
