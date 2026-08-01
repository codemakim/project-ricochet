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

export function distanceToSegment(point: Vector, start: Vector, end: Vector): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const progress = clamp(
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,
    0,
    1,
  );
  return Math.hypot(
    point.x - (start.x + dx * progress),
    point.y - (start.y + dy * progress),
  );
}

export function segmentIntersection(
  firstStart: Vector,
  firstEnd: Vector,
  secondStart: Vector,
  secondEnd: Vector,
): Vector | null {
  const first = { x: firstEnd.x - firstStart.x, y: firstEnd.y - firstStart.y };
  const second = { x: secondEnd.x - secondStart.x, y: secondEnd.y - secondStart.y };
  const cross = first.x * second.y - first.y * second.x;
  if (Math.abs(cross) < Number.EPSILON) return null;
  const offset = { x: secondStart.x - firstStart.x, y: secondStart.y - firstStart.y };
  const firstProgress = (offset.x * second.y - offset.y * second.x) / cross;
  const secondProgress = (offset.x * first.y - offset.y * first.x) / cross;
  if (firstProgress < 0 || firstProgress > 1 || secondProgress < 0 || secondProgress > 1) {
    return null;
  }
  return {
    x: firstStart.x + first.x * firstProgress,
    y: firstStart.y + first.y * firstProgress,
  };
}
