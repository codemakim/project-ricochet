import { GAME_TUNING } from '../config/gameTuning';
import type { EnemyKind, FormationEnemySpec } from '../enemies/enemyRules';
import {
  FORMATION_COLUMNS,
  footprintWorldRect,
  occupyFootprint,
  type GridFootprint,
} from './formationGrid';
import {
  ENEMY_CATALOG,
  FORMATION_TEMPLATES,
  type BattlefieldId,
  type EnemyCatalogEntry,
  type EnemyTag,
  type FormationProfile,
  type FormationTemplate,
  type FormationTemplateId,
} from './stageDefinitions';

export type FormationStyle = 'cluster' | 'pockets' | 'bands' | 'scatter' | 'grid';

export interface FormationResult {
  id: string;
  style: FormationStyle;
  enemies: FormationEnemySpec[];
  populationCost: number;
}

export interface FormationRecipe {
  stageNumber: number;
  battlefield: BattlefieldId;
  profile: FormationProfile;
  allowedTags?: readonly EnemyTag[];
  excludedKinds?: readonly EnemyKind[];
  enemyWeightMultipliers?: Readonly<Partial<Record<EnemyKind, number>>>;
  maxPerFormationOverrides?: Readonly<Partial<Record<EnemyKind, number>>>;
  hpMultiplier: number;
  descentSpeedMultiplier: number;
}

interface Cell {
  row: number;
  column: number;
}

interface Placement extends GridFootprint {
  kind: Exclude<EnemyKind, 'fragment'>;
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

function weightedChoice<T>(
  values: readonly T[],
  weight: (value: T) => number,
  random: () => number,
): T | undefined {
  const total = values.reduce((sum, value) => sum + weight(value), 0);
  if (total <= 0) return undefined;
  let cursor = random() * total;
  for (const value of values) {
    cursor -= weight(value);
    if (cursor < 0) return value;
  }
  return values.at(-1);
}

function orderedCells(
  style: FormationStyle,
  rows: number,
  random: () => number,
): Cell[] {
  const cells = Array.from({ length: rows * FORMATION_COLUMNS }, (_, index) => ({
    row: Math.floor(index / FORMATION_COLUMNS),
    column: index % FORMATION_COLUMNS,
  }));
  if (style === 'grid') {
    const parity = random() < 0.5 ? 0 : 1;
    return [parity, 1 - parity].flatMap((value) =>
      shuffled(cells.filter(({ row, column }) => (row + column) % 2 === value), random));
  }
  if (style === 'scatter') return shuffled(cells, random);
  if (style === 'bands') {
    return shuffled(Array.from({ length: rows }, (_, row) => row), random)
      .flatMap((row) => {
        const start = Math.floor(random() * 4);
        const length = 3 + Math.floor(random() * 3);
        return Array.from({ length }, (_, offset) => ({ row, column: start + offset }));
      })
      .concat(shuffled(cells, random));
  }
  if (style === 'pockets') {
    const holes = shuffled(cells, random).slice(0, 2);
    return cells.map((cell) => ({
      cell,
      score: Math.min(...holes.map((hole) =>
        Math.hypot(cell.row - hole.row, cell.column - hole.column))) + random() * 0.2,
    })).sort((left, right) => right.score - left.score).map(({ cell }) => cell);
  }
  const anchors = shuffled(cells, random).slice(0, random() < 0.5 ? 2 : 3);
  return cells.map((cell) => ({
    cell,
    score: Math.min(...anchors.map((anchor) =>
      Math.hypot(cell.row - anchor.row, cell.column - anchor.column))) + random() * 0.2,
  })).sort((left, right) => left.score - right.score).map(({ cell }) => cell);
}

function eligibleCatalog(recipe: FormationRecipe): EnemyCatalogEntry[] {
  const allowedTags = [...recipe.profile.allowedTags, ...(recipe.allowedTags ?? [])];
  const excludedKinds = new Set([
    ...(recipe.profile.excludedKinds ?? []),
    ...(recipe.excludedKinds ?? []),
  ]);
  return ENEMY_CATALOG.filter((entry) => (
    entry.minStage <= recipe.stageNumber
    && entry.battlefields.includes(recipe.battlefield)
    && allowedTags.every((tag) => entry.tags.includes(tag))
    && !excludedKinds.has(entry.kind)
    && entry.weight * (recipe.enemyWeightMultipliers?.[entry.kind] ?? 1) > 0
    && (recipe.maxPerFormationOverrides?.[entry.kind]
      ?? entry.maxPerFormation
      ?? Number.POSITIVE_INFINITY) > 0
  ));
}

function capFor(entry: EnemyCatalogEntry, recipe: FormationRecipe): number {
  return recipe.maxPerFormationOverrides?.[entry.kind]
    ?? entry.maxPerFormation
    ?? Number.POSITIVE_INFINITY;
}

function canOccupy(
  occupied: ReadonlySet<string>,
  footprint: GridFootprint,
  rows: number,
): boolean {
  if (
    footprint.column < 0
    || footprint.row < 0
    || footprint.column + footprint.width > FORMATION_COLUMNS
    || footprint.row + footprint.height > rows
  ) return false;
  for (let row = footprint.row; row < footprint.row + footprint.height; row += 1) {
    for (
      let column = footprint.column;
      column < footprint.column + footprint.width;
      column += 1
    ) {
      if (occupied.has(`${row}:${column}`)) return false;
    }
  }
  return true;
}

function pickKind(
  candidates: readonly EnemyCatalogEntry[],
  counts: ReadonlyMap<EnemyKind, number>,
  recipe: FormationRecipe,
  random: () => number,
  footprint?: Pick<GridFootprint, 'width' | 'height'>,
): EnemyCatalogEntry | undefined {
  const available = candidates.filter((entry) => (
    (counts.get(entry.kind) ?? 0) < capFor(entry, recipe)
    && (!footprint || (entry.width === footprint.width && entry.height === footprint.height))
  ));
  return weightedChoice(
    available,
    (entry) => entry.weight * (recipe.enemyWeightMultipliers?.[entry.kind] ?? 1),
    random,
  );
}

function addPlacement(
  placements: Placement[],
  occupied: Set<string>,
  counts: Map<EnemyKind, number>,
  entry: EnemyCatalogEntry,
  footprint: GridFootprint,
  rows: number,
): void {
  occupyFootprint(occupied, footprint, rows);
  placements.push({ ...footprint, kind: entry.kind });
  counts.set(entry.kind, (counts.get(entry.kind) ?? 0) + 1);
}

function fillProcedural(
  placements: Placement[],
  occupied: Set<string>,
  counts: Map<EnemyKind, number>,
  recipe: FormationRecipe,
  rows: number,
  targetCells: number,
  style: FormationStyle,
  random: () => number,
): void {
  const catalog = eligibleCatalog(recipe);
  for (const anchor of orderedCells(style, rows, random)) {
    if (occupied.size >= targetCells) break;
    const fitting = catalog.filter((entry) => canOccupy(occupied, {
      ...anchor,
      width: entry.width,
      height: entry.height,
    }, rows));
    const entry = pickKind(fitting, counts, recipe, random);
    if (!entry) continue;
    addPlacement(placements, occupied, counts, entry, {
      ...anchor,
      width: entry.width,
      height: entry.height,
    }, rows);
  }
  if (occupied.size < recipe.profile.cellMinimum) {
    throw new RangeError('formation cannot fill its occupied-cell minimum');
  }
}

function eligibleTemplates(recipe: FormationRecipe): FormationTemplate[] {
  const catalogKinds = new Set(eligibleCatalog(recipe).map(({ kind }) => kind));
  return FORMATION_TEMPLATES.filter((template) => (
    template.minStage <= recipe.stageNumber
    && (recipe.profile.templateWeights[template.id as FormationTemplateId] ?? 0) > 0
    && (template.mode !== 'fixed'
      || template.slots.every(({ kind }) => kind && catalogKinds.has(kind)))
  ));
}

function selectSource(
  recipe: FormationRecipe,
  random: () => number,
): { type: 'procedural' } | { type: 'template'; template: FormationTemplate } {
  const templates = eligibleTemplates(recipe);
  const sources = [
    ...(recipe.profile.proceduralWeight > 0 ? [{ type: 'procedural' as const }] : []),
    ...templates.map((template) => ({ type: 'template' as const, template })),
  ];
  const source = weightedChoice(
    sources,
    (candidate) => candidate.type === 'procedural'
      ? recipe.profile.proceduralWeight
      : recipe.profile.templateWeights[candidate.template.id as FormationTemplateId]
        ?? candidate.template.weight,
    random,
  );
  if (!source) throw new RangeError('recipe profile needs a formation source');
  return source;
}

function placeTemplate(
  template: FormationTemplate,
  recipe: FormationRecipe,
  targetCells: number,
  style: FormationStyle,
  random: () => number,
): { placements: Placement[]; rows: number } {
  const rows = template.rows;
  const occupied = new Set<string>();
  const placements: Placement[] = [];
  const counts = new Map<EnemyKind, number>();
  const catalog = eligibleCatalog(recipe);
  const mirror = template.mode === 'mixed' && random() < 0.5;

  for (const slot of template.slots) {
    if (template.mode === 'mixed' && slot.optional && random() < 0.25) continue;
    const footprint = {
      column: mirror ? FORMATION_COLUMNS - slot.column - slot.width : slot.column,
      row: slot.row,
      width: slot.width,
      height: slot.height,
    };
    const entry = slot.kind
      ? catalog.find(({ kind }) => kind === slot.kind)
      : pickKind(catalog, counts, recipe, random, footprint);
    if (!entry || !canOccupy(occupied, footprint, rows)) continue;
    addPlacement(placements, occupied, counts, entry, footprint, rows);
  }
  if (template.mode === 'mixed') {
    fillProcedural(
      placements,
      occupied,
      counts,
      recipe,
      rows,
      targetCells,
      style,
      random,
    );
  }
  return { placements, rows };
}

function styleFor(
  profile: FormationProfile,
  sequence: number,
  runSeed: number,
): FormationStyle {
  const bag = Object.entries(profile.styleWeights).flatMap(([style, weight]) =>
    Array.from({ length: weight! }, () => style as FormationStyle));
  if (bag.length === 0) return 'grid';
  return shuffled(bag, createRandom(mix(runSeed, Math.floor(sequence / bag.length))))[
    sequence % bag.length
  ]!;
}

function emitEnemies(
  placements: readonly Placement[],
  originY: number,
  recipe: FormationRecipe,
): FormationEnemySpec[] {
  return placements.map((placement) => {
    const rect = footprintWorldRect(placement, originY);
    return {
      ...placement,
      hp: GAME_TUNING.enemies.hp[placement.kind] * recipe.hpMultiplier,
      x: rect.x,
      y: rect.y,
      speed: GAME_TUNING.enemies.descentSpeed * recipe.descentSpeedMultiplier,
    };
  });
}

function createFormation(
  recipe: FormationRecipe,
  sequence: number,
  runSeed: number,
  originY: number,
): FormationResult {
  const random = createRandom(mix(runSeed, sequence ^ 0x4c41594f));
  const style = styleFor(recipe.profile, sequence, runSeed);
  const targetCells = recipe.profile.cellMinimum
    + Math.floor(random() * (recipe.profile.cellMaximum - recipe.profile.cellMinimum + 1));
  const source = selectSource(recipe, random);
  let placements: Placement[];
  let rows: number;
  if (source.type === 'template') {
    ({ placements, rows } = placeTemplate(
      source.template,
      recipe,
      targetCells,
      style,
      random,
    ));
  } else {
    rows = recipe.profile.rowMinimum
      + Math.floor(random() * (recipe.profile.rowMaximum - recipe.profile.rowMinimum + 1));
    placements = [];
    fillProcedural(
      placements,
      new Set(),
      new Map(),
      recipe,
      rows,
      targetCells,
      style,
      random,
    );
  }
  const enemies = emitEnemies(placements, originY, recipe);
  const sourceId = source.type === 'template' ? source.template.id : style;
  return {
    id: `${runSeed}:${sequence}:${sourceId}`,
    style,
    enemies,
    populationCost: enemies.reduce(
      (sum, enemy) => sum + enemy.width * enemy.height,
      0,
    ),
  };
}

const INITIAL_PROFILE = {
  id: 'initial',
  styleWeights: { cluster: 1 },
  proceduralWeight: 0,
  templateWeights: { 'side-fort': 1 },
  cellMinimum: 14,
  cellMaximum: 18,
  rowMinimum: 3,
  rowMaximum: 4,
  allowedTags: [],
} as const satisfies FormationProfile;

export function createInitialFormation(runSeed: number): FormationResult {
  validateSeed(runSeed, 'runSeed');
  const result = createFormation({
    stageNumber: 1,
    battlefield: 'default',
    profile: INITIAL_PROFILE,
    enemyWeightMultipliers: { basic: 12, armored: 2, shooter: 2, splitter: 0 },
    maxPerFormationOverrides: { armored: 2, shooter: 2, splitter: 0 },
    hpMultiplier: 1,
    descentSpeedMultiplier: 1,
  }, 0, runSeed, 56);
  let shooters = result.enemies.filter(({ kind }) => kind === 'shooter').length;
  result.enemies = result.enemies.map((enemy) => {
    if (shooters >= 2 || enemy.kind !== 'basic') return enemy;
    shooters += 1;
    return { ...enemy, kind: 'shooter', hp: GAME_TUNING.enemies.hp.shooter };
  });
  return result;
}

export function createReinforcementFormation(
  recipe: FormationRecipe,
  sequence: number,
  runSeed: number,
): FormationResult {
  if (!Number.isInteger(sequence) || sequence < 0) {
    throw new RangeError('sequence must be a non-negative integer');
  }
  validateSeed(runSeed, 'runSeed');
  const originY = GAME_TUNING.encounter.reinforcementOriginY
    - GAME_TUNING.encounter.grid.cellHeight / 2;
  return createFormation(recipe, sequence, runSeed, originY);
}
