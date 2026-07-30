import { GAME_TUNING } from '../config/gameTuning';

export interface GridFootprint {
  column: number;
  row: number;
  width: number;
  height: number;
}

export interface WorldRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const FORMATION_COLUMNS = GAME_TUNING.encounter.grid.columns;

export function validateFootprint(footprint: GridFootprint, rows: number): void {
  const { column, row, width, height } = footprint;
  if (
    ![column, row, width, height, rows].every(Number.isInteger)
    || column < 0
    || row < 0
    || width < 1
    || height < 1
    || rows < 1
    || column + width > FORMATION_COLUMNS
    || row + height > rows
  ) {
    throw new RangeError('formation footprint is outside the grid');
  }
}

export function occupyFootprint(
  occupied: Set<string>,
  footprint: GridFootprint,
  rows: number,
): void {
  validateFootprint(footprint, rows);
  const cells: string[] = [];
  for (let row = footprint.row; row < footprint.row + footprint.height; row += 1) {
    for (
      let column = footprint.column;
      column < footprint.column + footprint.width;
      column += 1
    ) {
      const cell = `${row}:${column}`;
      if (occupied.has(cell)) throw new RangeError('formation footprints overlap');
      cells.push(cell);
    }
  }
  cells.forEach((cell) => occupied.add(cell));
}

export function footprintWorldRect(
  footprint: GridFootprint,
  originY: number,
): WorldRect {
  const { left, cellWidth, cellHeight, gap } = GAME_TUNING.encounter.grid;
  return {
    x: left + footprint.column * cellWidth + footprint.width * cellWidth / 2,
    y: originY + footprint.row * cellHeight + footprint.height * cellHeight / 2,
    width: footprint.width * cellWidth - gap,
    height: footprint.height * cellHeight - gap,
  };
}
