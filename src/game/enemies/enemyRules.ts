export type EnemyKind = 'basic' | 'armored' | 'shooter';

export interface EnemySpec {
  kind: EnemyKind;
  hp: number;
  x: number;
  y: number;
  column: number;
  speed: number;
}

const ROWS: ReadonlyArray<{
  y: number;
  enemies: ReadonlyArray<readonly [column: number, kind: EnemyKind]>;
}> = [
  { y: 80, enemies: [[0, 'basic'], [2, 'armored'], [4, 'basic'], [6, 'shooter']] },
  { y: 122, enemies: [[1, 'basic'], [3, 'armored'], [5, 'basic'], [7, 'shooter']] },
  { y: 164, enemies: [[0, 'basic'], [3, 'basic'], [4, 'armored'], [7, 'shooter']] },
  { y: 206, enemies: [[1, 'basic'], [2, 'basic'], [5, 'basic'], [6, 'basic']] },
  { y: 248, enemies: [[0, 'basic'], [2, 'basic'], [5, 'basic'], [7, 'basic']] },
];

export function createPrototypeFormation(): EnemySpec[] {
  return ROWS.flatMap(({ y, enemies }) =>
    enemies.map(([column, kind]) => ({
      kind,
      hp: kind === 'armored' ? 3 : 1,
      x: 36 + column * 54,
      y,
      column,
      speed: 18,
    })),
  );
}

export function canFire(activeShooters: number, activeBullets: number): boolean {
  return activeShooters < 2 && activeBullets < 12;
}
