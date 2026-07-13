import { GAME_HEIGHT, GAME_WIDTH } from '../constants';
import { normalize, reflect, type Vector } from '../math/vector';

interface Collision {
  distance: number;
  normal: Vector;
}

export function traceFirstBounce(
  origin: Vector,
  direction: Vector,
  inset: number,
  reflectionLength: number,
): [Vector, Vector, Vector] {
  if (inset < 0) throw new RangeError('inset must not be negative');
  if (reflectionLength <= 0) throw new RangeError('reflectionLength must be positive');

  const ray = normalize(direction);
  const collisions: Collision[] = [
    { distance: (inset - origin.x) / ray.x, normal: { x: 1, y: 0 } },
    { distance: (GAME_WIDTH - inset - origin.x) / ray.x, normal: { x: -1, y: 0 } },
    { distance: (inset - origin.y) / ray.y, normal: { x: 0, y: 1 } },
    { distance: (GAME_HEIGHT - inset - origin.y) / ray.y, normal: { x: 0, y: -1 } },
  ];
  const collision = collisions
    .filter(({ distance }) => Number.isFinite(distance) && distance > 0)
    .reduce((nearest, candidate) => (candidate.distance < nearest.distance ? candidate : nearest));
  const hit = {
    x: origin.x + ray.x * collision.distance,
    y: origin.y + ray.y * collision.distance,
  };
  const reflected = reflect(ray, collision.normal);

  return [
    origin,
    hit,
    {
      x: hit.x + reflected.x * reflectionLength,
      y: hit.y + reflected.y * reflectionLength,
    },
  ];
}
