import { GAME_WIDTH } from '../constants';

const KEYBOARD_SPEED = 420;

function clampX(x: number, objectWidth: number): number {
  const half = objectWidth / 2;
  return Math.max(half, Math.min(GAME_WIDTH - half, x));
}

export function moveByDelta(currentX: number, deltaX: number, objectWidth: number): number {
  return clampX(currentX + deltaX, objectWidth);
}

export function moveByDirection(
  currentX: number,
  direction: -1 | 0 | 1,
  deltaMs: number,
  objectWidth: number,
): number {
  return clampX(currentX + direction * KEYBOARD_SPEED * (deltaMs / 1000), objectWidth);
}
