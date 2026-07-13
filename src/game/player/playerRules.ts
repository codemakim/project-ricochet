import { GAME_HEIGHT, GAME_WIDTH, PLAYER_MIN_Y, PLAYER_RADIUS, PLAYER_SPEED } from '../constants';
import { clamp, normalize, type Vector } from '../math/vector';

export function movePlayer(position: Vector, input: Vector, deltaMs: number): Vector {
  const direction = Math.hypot(input.x, input.y) > 1 ? normalize(input) : input;
  const distance = PLAYER_SPEED * deltaMs / 1000;
  return {
    x: clamp(position.x + direction.x * distance, PLAYER_RADIUS, GAME_WIDTH - PLAYER_RADIUS),
    y: clamp(position.y + direction.y * distance, PLAYER_MIN_Y, GAME_HEIGHT - PLAYER_RADIUS),
  };
}

export function resolveAim(previous: Vector, candidate: Vector): Vector {
  return Math.hypot(candidate.x, candidate.y) < 0.001 ? previous : normalize(candidate);
}
