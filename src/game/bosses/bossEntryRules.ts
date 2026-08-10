import { GAME_TUNING, type BossKind } from '../config/gameTuning';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants';
import { BOSS_GEOMETRY } from './bossGeometry';
import { HIVE_BOSS_GEOMETRY, bodyBounds, type HiveBodyGeometry } from './hiveBossGeometry';

export interface BossEntryCorridor {
  left: number;
  right: number;
  bottom: number;
}

export function bossEntryCorridor(kind: BossKind): BossEntryCorridor {
  const padding = GAME_TUNING.encounter.bossEntry.padding;
  if (kind !== 'hive') {
    const centerX = GAME_WIDTH / 2;
    return {
      left: Math.max(0, centerX - BOSS_GEOMETRY.collisionHalfWidth - padding),
      right: Math.min(GAME_WIDTH, centerX + BOSS_GEOMETRY.collisionHalfWidth + padding),
      bottom: Math.min(
        GAME_HEIGHT,
        GAME_TUNING.boss.y + BOSS_GEOMETRY.collisionHalfHeight + padding,
      ),
    };
  }

  const { shooters, reflectors, core } = HIVE_BOSS_GEOMETRY;
  const bodies: HiveBodyGeometry[] = [
    core,
    {
      ...shooters.leftShooter,
    },
    {
      ...shooters.rightShooter,
    },
    {
      ...reflectors.leftReflector,
      x: (reflectors.leftReflector.travel.minimum + reflectors.leftReflector.travel.maximum) / 2,
    },
    {
      ...reflectors.rightReflector,
      x: (reflectors.rightReflector.travel.minimum + reflectors.rightReflector.travel.maximum) / 2,
    },
  ];
  const bounds = bodies.map(bodyBounds);
  return {
    left: Math.max(0, Math.min(...bounds.map(({ left }) => left)) - padding),
    right: Math.min(GAME_WIDTH, Math.max(...bounds.map(({ right }) => right)) + padding),
    bottom: Math.min(GAME_HEIGHT, Math.max(...bounds.map(({ bottom }) => bottom)) + padding),
  };
}

export function bossEntryCleanup(
  kind: BossKind,
  mode: 'corridor' | 'all',
): { mode: 'all' } | { mode: 'corridor'; corridor: BossEntryCorridor } {
  return mode === 'all'
    ? { mode: 'all' }
    : { mode: 'corridor', corridor: bossEntryCorridor(kind) };
}
