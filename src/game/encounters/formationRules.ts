import type { EnemyKind, EnemySpec } from '../enemies/enemyRules';
import type { ThreatPhase } from './encounterRules';

export type FormationStyle = 'cluster' | 'pockets' | 'bands' | 'scatter' | 'grid';

export interface FormationResult {
  id: string;
  style: FormationStyle;
  enemies: EnemySpec[];
}

interface Cell {
  row: number;
  column: number;
}

const COLUMNS = 8;
const SPEED = 18;
const BAG = [
  'cluster', 'cluster', 'pockets', 'pockets',
  'bands', 'bands', 'scatter', 'scatter', 'grid',
] as const;
const ORGANIC = ['cluster', 'pockets', 'bands', 'scatter'] as const;
const SIZE_RANGES = [[9, 11], [11, 13], [13, 15]] as const;

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
    const value = result[index]!;
    result[index] = result[swapIndex]!;
    result[swapIndex] = value;
  }
  return result;
}

function key(cell: Cell): string {
  return `${cell.row}:${cell.column}`;
}

function touches(left: Cell, right: Cell, diagonal = false): boolean {
  const rowDistance = Math.abs(left.row - right.row);
  const columnDistance = Math.abs(left.column - right.column);
  return diagonal
    ? rowDistance <= 1 && columnDistance <= 1 && rowDistance + columnDistance > 0
    : rowDistance + columnDistance === 1;
}

function appendUnused(target: Cell[], candidates: readonly Cell[]): void {
  const used = new Set(target.map(key));
  for (const cell of candidates) {
    if (!used.has(key(cell))) {
      target.push(cell);
      used.add(key(cell));
    }
  }
}

function clusterOrder(cells: readonly Cell[], random: () => number): Cell[] {
  const anchors: Cell[] = [];
  const candidates = shuffled(cells, random);
  const anchorCount = random() < 0.5 ? 2 : 3;
  for (const cell of candidates) {
    if (anchors.every((anchor) => Math.abs(anchor.row - cell.row) + Math.abs(anchor.column - cell.column) >= 3)) {
      anchors.push(cell);
      if (anchors.length === anchorCount) break;
    }
  }
  if (anchors.length === 0) anchors.push(candidates[0]!);

  const groups = anchors.map((anchor) => [anchor]);
  const result = [...anchors];
  const unused = new Map(cells.map((cell) => [key(cell), cell]));
  result.forEach((cell) => unused.delete(key(cell)));
  let cursor = 0;
  while (unused.size > 0) {
    const ungrownIndex = groups.findIndex((group) => group.length === 1);
    let activeIndex = ungrownIndex >= 0 ? ungrownIndex : cursor % groups.length;
    let neighbors = shuffled([...unused.values()].filter((cell) =>
      groups[activeIndex]!.some((member) => touches(member, cell, true))), random);
    if (neighbors.length === 0) {
      const expandable = shuffled(groups.map((_, index) => index), random)
        .find((index) => [...unused.values()].some((cell) =>
          groups[index]!.some((member) => touches(member, cell, true))));
      if (expandable === undefined) throw new Error('unable to grow cluster formation');
      activeIndex = expandable;
      neighbors = shuffled([...unused.values()].filter((cell) =>
        groups[activeIndex]!.some((member) => touches(member, cell, true))), random);
    }
    const next = neighbors[0]!;
    groups[activeIndex]!.push(next);
    result.push(next);
    unused.delete(key(next));
    cursor = random() < 0.7 ? activeIndex + 1 : activeIndex;
  }
  return result;
}

function pocketsOrder(cells: readonly Cell[], random: () => number): Cell[] {
  const holes = shuffled(cells, random).slice(0, 2);
  return cells.map((cell) => ({
    cell,
    score: Math.min(...holes.map((hole) =>
      Math.hypot(cell.row - hole.row, cell.column - hole.column))) + random() * 0.35,
  })).sort((left, right) => right.score - left.score).map(({ cell }) => cell);
}

function bandsOrder(cells: readonly Cell[], rows: number, random: () => number): Cell[] {
  const result: Cell[] = [];
  for (const row of shuffled(Array.from({ length: rows }, (_, index) => index), random)) {
    const length = 2 + Math.floor(random() * 4);
    const biasLeft = row % 2 === 0 ? random() < 0.75 : random() >= 0.75;
    const half = Math.floor(COLUMNS / 2);
    const minimumStart = biasLeft ? 0 : Math.min(half, COLUMNS - length);
    const maximumStart = biasLeft
      ? Math.min(half - 1, COLUMNS - length)
      : COLUMNS - length;
    const start = minimumStart + Math.floor(random() * (maximumStart - minimumStart + 1));
    for (let column = start; column < start + length; column += 1) {
      result.push({ row, column });
    }
  }
  appendUnused(result, shuffled(cells, random));
  return result;
}

function scatterOrder(cells: readonly Cell[], random: () => number): Cell[] {
  const result: Cell[] = [];
  const unused = new Map(cells.map((cell) => [key(cell), cell]));
  while (unused.size > 0) {
    const candidates = shuffled([...unused.values()], random);
    const preferTouching = result.length > 0 && result.length % 3 !== 0;
    const preferred = candidates.filter((cell) =>
      result.some((member) => touches(member, cell, true)) === preferTouching);
    const next = preferred[0] ?? candidates[0]!;
    result.push(next);
    unused.delete(key(next));
  }
  return result;
}

function gridOrder(cells: readonly Cell[], random: () => number): Cell[] {
  const parity = random() < 0.5 ? 0 : 1;
  return [parity, 1 - parity].flatMap((value) =>
    shuffled(cells.filter((cell) => (cell.row + cell.column) % 2 === value), random));
}

function orderedCells(
  style: FormationStyle,
  cells: readonly Cell[],
  rows: number,
  random: () => number,
): Cell[] {
  switch (style) {
    case 'cluster': return clusterOrder(cells, random);
    case 'pockets': return pocketsOrder(cells, random);
    case 'bands': return bandsOrder(cells, rows, random);
    case 'scatter': return scatterOrder(cells, random);
    case 'grid': return gridOrder(cells, random);
  }
}

function hasAdjacent(cells: readonly Cell[]): boolean {
  return cells.some((cell, index) => cells.slice(index + 1).some((other) => touches(cell, other)));
}

function hasNoIsolatedCell(cells: readonly Cell[]): boolean {
  return cells.every((cell, index) =>
    cells.some((other, otherIndex) => index !== otherIndex && touches(cell, other, true)));
}

function diagonalComponentCount(cells: readonly Cell[]): number {
  const remaining = new Set(cells);
  let components = 0;
  while (remaining.size > 0) {
    components += 1;
    const start = remaining.values().next().value as Cell;
    const queue = [start];
    remaining.delete(start);
    while (queue.length > 0) {
      const cell = queue.pop()!;
      for (const other of [...remaining]) {
        if (touches(cell, other, true)) {
          remaining.delete(other);
          queue.push(other);
        }
      }
    }
  }
  return components;
}

function hasCoherentCluster(cells: readonly Cell[]): boolean {
  return hasNoIsolatedCell(cells) && diagonalComponentCount(cells) <= 3;
}

function hasWideGap(cells: readonly Cell[]): boolean {
  return Array.from({ length: Math.max(...cells.map(({ row }) => row)) + 1 }, (_, row) =>
    cells.filter((cell) => cell.row === row).map(({ column }) => column).sort((a, b) => a - b))
    .some((columns) => columns.some((column, index) => index > 0 && column - columns[index - 1]! >= 3));
}

function preserveOrganicShape(
  selected: Cell[],
  all: readonly Cell[],
  random: () => number,
  preserveClusterCoherence: boolean,
): Cell[] {
  const result = [...selected];
  const replace = (candidate: Cell, predicate: (next: Cell[]) => boolean): boolean => {
    for (const index of shuffled(result.map((_, position) => position), random)) {
      const next = [...result];
      next[index] = candidate;
      if (new Set(next.map(key)).size === next.length && predicate(next)) {
        result.splice(0, result.length, ...next);
        return true;
      }
    }
    return false;
  };

  if (!hasAdjacent(result)) {
    for (const anchor of shuffled(result, random)) {
      const candidate = shuffled(all.filter((cell) => touches(anchor, cell)), random)[0];
      if (candidate && replace(candidate, (next) =>
        hasAdjacent(next) && (!preserveClusterCoherence || hasCoherentCluster(next)))) break;
    }
  }
  if (!hasWideGap(result)) {
    const rows = shuffled([...new Set(result.map(({ row }) => row))], random);
    for (const row of rows) {
      const occupied = result.filter((cell) => cell.row === row);
      const candidates = shuffled(all.filter((cell) =>
        cell.row === row && occupied.some((other) => Math.abs(other.column - cell.column) >= 3)), random);
      const replaced = candidates.some((candidate) => replace(candidate, (next) =>
        hasAdjacent(next)
        && hasWideGap(next)
        && (!preserveClusterCoherence || hasCoherentCluster(next))));
      if (replaced) break;
    }
  }
  return result;
}

function assignKinds(enemies: EnemySpec[], armored: number, shooters: number, seed: number): EnemySpec[] {
  const indices = shuffled(enemies.map((_, index) => index), createRandom(seed));
  const armoredIndices = new Set(indices.slice(0, armored));
  const shooterIndices = new Set(indices.slice(armored, armored + shooters));
  return enemies.map((enemy, index) => {
    const kind: EnemyKind = armoredIndices.has(index)
      ? 'armored'
      : shooterIndices.has(index) ? 'shooter' : 'basic';
    return { ...enemy, kind, hp: kind === 'armored' ? 3 : 1 };
  });
}

function generateWithPressure(
  style: FormationStyle,
  count: number,
  seed: number,
  originY: number,
  armored: number,
  shooters: number,
  kindSeed: number,
): EnemySpec[] {
  const rows = Math.max(3, Math.ceil(count / COLUMNS) + 2);
  const cells = Array.from({ length: rows * COLUMNS }, (_, index) => ({
    row: Math.floor(index / COLUMNS),
    column: index % COLUMNS,
  }));
  const coordinateRandom = createRandom(seed);
  const ordered = orderedCells(style, cells, rows, coordinateRandom);
  appendUnused(ordered, shuffled(cells, coordinateRandom));
  let selected = ordered.slice(0, count);
  if (style !== 'grid') {
    selected = preserveOrganicShape(selected, cells, coordinateRandom, style === 'cluster');
  }

  const offsetRandom = createRandom(mix(seed, 0x4f464653));
  const mirror = offsetRandom() < 0.5;
  const rowOffsets = Array.from({ length: rows }, () => [-10, 0, 10][Math.floor(offsetRandom() * 3)]!);
  const enemies = selected.map((cell) => {
    const column = mirror ? COLUMNS - 1 - cell.column : cell.column;
    const x = Math.max(36, Math.min(414, 36 + column * 54 + rowOffsets[cell.row]!));
    return { kind: 'basic' as const, hp: 1, x, y: originY + cell.row * 42, column, speed: SPEED };
  });
  return assignKinds(enemies, armored, shooters, kindSeed);
}

export function generateFormation(
  style: FormationStyle,
  count: number,
  seed: number,
  originY: number,
): EnemySpec[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError('count must be a positive integer');
  }
  validateSeed(seed);
  return generateWithPressure(style, count, seed, originY, 3, 3, mix(seed, 0x4b494e44));
}

function createBag(runSeed: number, cycle: number, previous?: FormationStyle): FormationStyle[] {
  const random = createRandom(mix(runSeed, cycle));
  const solve = (remaining: FormationStyle[], result: FormationStyle[]): FormationStyle[] | null => {
    if (remaining.length === 0) return result;
    const last = result.at(-1) ?? previous;
    for (const style of shuffled([...new Set(remaining)], random)) {
      if (style === last) continue;
      const index = remaining.indexOf(style);
      const next = [...remaining];
      next.splice(index, 1);
      const solved = solve(next, [...result, style]);
      if (solved) return solved;
    }
    return null;
  };
  const result = solve([...BAG], []);
  if (!result) throw new Error('unable to arrange formation bag');
  return result;
}

function styleAt(runSeed: number, sequence: number): FormationStyle {
  const cycle = Math.floor(sequence / BAG.length);
  let previous: FormationStyle | undefined;
  let bag: FormationStyle[] = [];
  for (let index = 0; index <= cycle; index += 1) {
    bag = createBag(runSeed, index, previous);
    previous = bag[bag.length - 1];
  }
  return bag[sequence % BAG.length]!;
}

export function createInitialFormation(runSeed: number): FormationResult {
  validateSeed(runSeed, 'runSeed');
  const style = ORGANIC[mix(runSeed, 0x494e4954) % ORGANIC.length]!;
  const layoutSeed = mix(runSeed, 0x4c41594f);
  const enemies = generateWithPressure(
    style, 20, layoutSeed, 80, 3, 3, mix(runSeed, 0x4b494e44),
  );
  return { id: `${runSeed}:initial:${style}:${layoutSeed}`, style, enemies };
}

export function createReinforcementFormation(
  phase: ThreatPhase,
  sequence: number,
  runSeed: number,
): FormationResult {
  if (!Number.isInteger(sequence) || sequence < 0) {
    throw new RangeError('sequence must be a non-negative integer');
  }
  validateSeed(runSeed, 'runSeed');
  const style = styleAt(runSeed, sequence);
  const [minimum, maximum] = SIZE_RANGES[phase];
  const countSeed = mix(runSeed, sequence ^ 0x53495a45);
  const count = minimum + countSeed % (maximum - minimum + 1);
  const layoutSeed = mix(runSeed, sequence ^ 0x4c41594f);
  const specialPressure = [[1, 0], [1, 1], [2, 2]] as const;
  const [armored, shooters] = specialPressure[phase];
  const enemies = generateWithPressure(
    style, count, layoutSeed, -28, armored, shooters, mix(runSeed, sequence ^ 0x4b494e44),
  );
  return { id: `${runSeed}:${sequence}:${style}:${layoutSeed}`, style, enemies };
}
