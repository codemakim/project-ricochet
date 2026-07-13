import { GAME_WIDTH } from '../constants';
import { normalize, type Vector } from '../math/vector';

export type PointerRole = 'move' | 'aim';

export function pointerRole(x: number): PointerRole {
  return x < GAME_WIDTH / 2 ? 'move' : 'aim';
}

export function stickVector(origin: Vector, current: Vector, radius: number): Vector {
  const displacement = {
    x: (current.x - origin.x) / radius,
    y: (current.y - origin.y) / radius,
  };

  return Math.hypot(displacement.x, displacement.y) > 1
    ? normalize(displacement)
    : displacement;
}
