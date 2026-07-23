import { GAME_TUNING } from '../config/gameTuning';

export type EnemyKind = 'basic' | 'armored' | 'shooter' | 'splitter' | 'fragment';

export interface EnemySpec {
  kind: EnemyKind;
  hp: number;
  x: number;
  y: number;
  column: number;
  speed: number;
}

export function canFire(
  activeShooters: number,
  activeBullets: number,
  hostileCap: number = GAME_TUNING.projectiles.hostileCap,
): boolean {
  return activeShooters < 2 && activeBullets < hostileCap;
}
