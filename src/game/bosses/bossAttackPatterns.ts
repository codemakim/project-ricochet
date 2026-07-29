import { normalize, type Vector } from '../math/vector';

export interface DirectedShot {
  direction: Vector;
  speed: number;
}

export interface MovingLaserSpec {
  startX: number;
  endX: number;
  speed: number;
  warningMs: number;
  activeMs: number;
  width: number;
}

function finite(value: number, name: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
}

function positiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) throw new RangeError(`${name} must be a positive integer`);
}

function vector(value: Vector, name: string): void {
  finite(value.x, `${name}.x`);
  finite(value.y, `${name}.y`);
}

function rotate(direction: Vector, degrees: number): Vector {
  const radians = degrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const x = direction.x * cosine + direction.y * sine;
  const y = -direction.x * sine + direction.y * cosine;
  return { x: x === 0 ? 0 : x, y: y === 0 ? 0 : y };
}

export function aimedShot(
  origin: Vector,
  target: Vector,
  speed: number,
  fallback: Vector,
): DirectedShot {
  vector(origin, 'origin');
  vector(target, 'target');
  vector(fallback, 'fallback');
  finite(speed, 'speed');
  if (speed <= 0) throw new RangeError('speed must be positive');
  const fallbackDirection = normalize(fallback);
  if (Math.hypot(fallbackDirection.x, fallbackDirection.y) === 0) {
    throw new RangeError('fallback must be non-zero');
  }
  return {
    direction: normalize({ x: target.x - origin.x, y: target.y - origin.y }, fallbackDirection),
    speed,
  };
}

export function aimedBurst(
  origin: Vector,
  target: Vector,
  speed: number,
  count: number,
  spreadDegrees: number,
  fallback: Vector,
): DirectedShot[] {
  const aimed = aimedShot(origin, target, speed, fallback);
  return fanShots(aimed.direction, speed, count, -spreadDegrees);
}

export function fanShots(
  baseDirection: Vector,
  speed: number,
  count: number,
  arcDegrees: number,
  offsetDegrees = 0,
): DirectedShot[] {
  vector(baseDirection, 'baseDirection');
  finite(speed, 'speed');
  finite(arcDegrees, 'arcDegrees');
  finite(offsetDegrees, 'offsetDegrees');
  if (speed <= 0) throw new RangeError('speed must be positive');
  positiveInteger(count, 'count');
  const base = normalize(baseDirection);
  const step = count === 1 ? 0 : arcDegrees / (count - 1);
  const start = offsetDegrees - arcDegrees / 2;
  return Array.from({ length: count }, (_, index) => ({
    direction: rotate(base, start + step * index),
    speed,
  }));
}

export function fallingOrigins(
  anchorX: number,
  left: number,
  right: number,
  offsets: readonly number[],
): number[] {
  finite(anchorX, 'anchorX');
  finite(left, 'left');
  finite(right, 'right');
  if (left > right) throw new RangeError('left must not exceed right');
  return offsets.map((offset) => {
    finite(offset, 'offset');
    return Math.max(left, Math.min(right, anchorX + offset));
  });
}

export function movingVerticalLaser(
  startX: number,
  direction: -1 | 1,
  bounds: { minimum: number; maximum: number },
  speed: number,
  warningMs: number,
  activeMs: number,
  width: number,
): MovingLaserSpec {
  for (const [value, name] of [
    [startX, 'laser start'],
    [bounds.minimum, 'laser minimum'],
    [bounds.maximum, 'laser maximum'],
    [speed, 'laser speed'],
    [warningMs, 'laser warning'],
    [activeMs, 'laser active time'],
    [width, 'laser width'],
  ] as const) finite(value, name);
  if (bounds.minimum > bounds.maximum) throw new RangeError('laser minimum must not exceed maximum');
  if (speed <= 0) throw new RangeError('laser speed must be positive');
  if (warningMs < 0 || activeMs <= 0 || width <= 0) {
    throw new RangeError('laser timing and width must be valid');
  }
  const clampedStart = Math.max(bounds.minimum, Math.min(bounds.maximum, startX));
  return {
    startX: clampedStart,
    endX: Math.max(
      bounds.minimum,
      Math.min(bounds.maximum, clampedStart + direction * speed * activeMs / 1000),
    ),
    speed,
    warningMs,
    activeMs,
    width,
  };
}
