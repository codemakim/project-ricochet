import { GAME_WIDTH } from '../constants';
import { GAME_TUNING } from '../config/gameTuning';
import { clamp, type Vector } from '../math/vector';
import type { EnemyKind } from './enemyRules';

export interface FragmentSpec {
  kind: 'fragment';
  hp: number;
  x: number;
  y: number;
  column: number;
  speed: number;
}

export function fragmentSpecsAt(position: Vector, speed: number): readonly [FragmentSpec, FragmentSpec] {
  const halfWidth = GAME_TUNING.enemies.fragment.width / 2;
  const xs = [
    position.x - GAME_TUNING.enemies.splitter.fragmentOffsetX,
    position.x + GAME_TUNING.enemies.splitter.fragmentOffsetX,
  ];
  return xs.map((x) => ({
    kind: 'fragment',
    hp: GAME_TUNING.enemies.hp.fragment,
    x: clamp(x, halfWidth, GAME_WIDTH - halfWidth),
    y: position.y,
    column: -1,
    speed,
  })) as [FragmentSpec, FragmentSpec];
}

export function populationCostForEnemy(kind: EnemyKind): number {
  switch (kind) {
    case 'splitter': return GAME_TUNING.enemies.splitter.populationCost;
    case 'fragment': return GAME_TUNING.enemies.fragment.populationCost;
    default: return 1;
  }
}
