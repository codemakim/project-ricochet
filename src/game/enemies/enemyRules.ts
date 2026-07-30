import { GAME_TUNING } from '../config/gameTuning';

export type EnemyKind = 'basic' | 'armored' | 'shooter' | 'splitter' | 'fragment';
export type FragmentSide = 'left' | 'right';

export interface EnemySpec {
  kind: EnemyKind;
  hp: number;
  x: number;
  y: number;
  column: number;
  row?: number;
  width?: number;
  height?: number;
  speed: number;
  side?: FragmentSide;
}

export interface FormationEnemySpec extends EnemySpec {
  row: number;
  width: number;
  height: number;
}

export function canFire(
  activeShooters: number,
  activeBullets: number,
  hostileCap: number = GAME_TUNING.projectiles.hostileCap,
): boolean {
  return activeShooters < 2 && activeBullets < hostileCap;
}
