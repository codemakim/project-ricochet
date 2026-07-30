import { GAME_WIDTH } from '../constants';
import { GAME_TUNING } from '../config/gameTuning';
import { clamp } from '../math/vector';
import { footprintWorldRect } from '../encounters/formationGrid';
import type { EnemyKind, EnemySpec, FragmentSide } from './enemyRules';

export interface FragmentSpec {
  kind: 'fragment';
  hp: number;
  x: number;
  y: number;
  column: number;
  row: number;
  width: 1;
  height: 1;
  speed: number;
  side: FragmentSide;
}

export function fragmentSpecsFor(
  parent: Pick<EnemySpec, 'x' | 'y' | 'column' | 'row' | 'speed'>,
): readonly [FragmentSpec, FragmentSpec] {
  if ((parent.row ?? -1) < 0) {
    const halfWidth = GAME_TUNING.enemies.fragment.width / 2;
    return [-1, 1].map((direction, index) => ({
      kind: 'fragment',
      side: index === 0 ? 'left' : 'right',
      hp: GAME_TUNING.enemies.hp.fragment,
      x: clamp(
        parent.x + direction * GAME_TUNING.enemies.splitter.fragmentOffsetX,
        halfWidth,
        GAME_WIDTH - halfWidth,
      ),
      y: parent.y,
      column: -1,
      row: -1,
      width: 1,
      height: 1,
      speed: parent.speed,
    })) as [FragmentSpec, FragmentSpec];
  }
  const firstColumn = clamp(parent.column, 0, 6);
  return [firstColumn, firstColumn + 1].map((column, index) => ({
    kind: 'fragment',
    side: index === 0 ? 'left' : 'right',
    hp: GAME_TUNING.enemies.hp.fragment,
    x: clamp(footprintWorldRect({
      column,
      row: 0,
      width: 1,
      height: 1,
    }, 0).x, GAME_TUNING.encounter.grid.cellWidth / 2, GAME_WIDTH - GAME_TUNING.encounter.grid.cellWidth / 2),
    y: parent.y,
    column,
    row: parent.row ?? -1,
    width: 1,
    height: 1,
    speed: parent.speed,
  })) as [FragmentSpec, FragmentSpec];
}

export function populationCostForEnemy(kind: EnemyKind): number {
  switch (kind) {
    case 'splitter': return GAME_TUNING.enemies.splitter.populationCost;
    case 'fragment': return GAME_TUNING.enemies.fragment.populationCost;
    default: return 1;
  }
}
