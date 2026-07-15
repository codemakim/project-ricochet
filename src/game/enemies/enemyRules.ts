export type EnemyKind = 'basic' | 'armored' | 'shooter';

export interface EnemySpec {
  kind: EnemyKind;
  hp: number;
  x: number;
  y: number;
  column: number;
  speed: number;
}

export function canFire(activeShooters: number, activeBullets: number): boolean {
  return activeShooters < 2 && activeBullets < 12;
}
