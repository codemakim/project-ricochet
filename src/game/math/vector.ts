export interface Vector {
  x: number;
  y: number;
}

export function normalize(vector: Vector, fallback: Vector = { x: 0, y: -1 }): Vector {
  const length = Math.hypot(vector.x, vector.y);
  return length > 0 ? { x: vector.x / length, y: vector.y / length } : fallback;
}

export function reflect(vector: Vector, normal: Vector): Vector {
  const dot = vector.x * normal.x + vector.y * normal.y;
  return { x: vector.x - 2 * dot * normal.x, y: vector.y - 2 * dot * normal.y };
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
