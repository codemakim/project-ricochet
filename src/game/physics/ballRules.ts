export interface Vector {
  x: number;
  y: number;
}

const MAX_SPEED = 820;
const MIN_VERTICAL_RATIO = 0.25;

export function paddleBounce(offset: number, speed: number): Vector {
  const clamped = Math.max(-1, Math.min(1, offset));
  const x = speed * 0.9 * clamped;
  const minimumY = speed * MIN_VERTICAL_RATIO;
  const y = -Math.max(minimumY, Math.sqrt(Math.max(0, speed ** 2 - x ** 2)));
  const magnitude = Math.hypot(x, y);
  return { x: (x / magnitude) * speed, y: (y / magnitude) * speed };
}

export function grantCharges(offset: number): number {
  return Math.abs(offset) <= 0.2 ? 4 : 3;
}

export function consumeCharge(charges: number): { remaining: number; damageMultiplier: number } {
  return charges > 0
    ? { remaining: charges - 1, damageMultiplier: 1.5 }
    : { remaining: 0, damageMultiplier: 1 };
}

export function capSpeed(velocity: Vector): Vector {
  const speed = Math.hypot(velocity.x, velocity.y);
  if (speed <= MAX_SPEED) return velocity;
  const scale = MAX_SPEED / speed;
  return { x: velocity.x * scale, y: velocity.y * scale };
}
