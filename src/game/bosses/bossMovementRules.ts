export interface HorizontalInterval {
  minimum: number;
  maximum: number;
}

export interface BossMotion {
  x: number;
  direction: -1 | 0 | 1;
}

const DEFAULT_BOUNDS: HorizontalInterval = { minimum: 60, maximum: 390 };
const BOSS_SPEED_PX_PER_SECOND = 55;

export function updateBossMotion(
  current: BossMotion,
  deltaMs: number,
  obstacles: readonly HorizontalInterval[],
  bounds: HorizontalInterval = DEFAULT_BOUNDS,
): BossMotion {
  const freeIntervals = subtractIntervals(bounds, mergeIntervals(obstacles, bounds));
  const range = freeIntervals.find(
    ({ minimum, maximum }) => current.x >= minimum && current.x <= maximum,
  );

  if (!range || range.minimum === range.maximum) {
    return { x: current.x, direction: 0 };
  }

  let direction = current.direction;
  if (direction === 0) {
    direction = current.x < range.maximum ? 1 : -1;
  } else if (direction === 1 && current.x >= range.maximum) {
    direction = -1;
  } else if (direction === -1 && current.x <= range.minimum) {
    direction = 1;
  }

  const width = range.maximum - range.minimum;
  const offset = current.x - range.minimum;
  const phase = direction === 1 ? offset : 2 * width - offset;
  const distance = (deltaMs / 1000) * BOSS_SPEED_PX_PER_SECOND;
  const wrapped = (phase + distance) % (2 * width);

  if (wrapped < width) {
    return { x: range.minimum + wrapped, direction: 1 };
  }
  return { x: range.maximum - (wrapped - width), direction: -1 };
}

function mergeIntervals(
  intervals: readonly HorizontalInterval[],
  bounds: HorizontalInterval,
): HorizontalInterval[] {
  const clipped = intervals
    .map(({ minimum, maximum }) => ({
      minimum: Math.max(bounds.minimum, Math.min(minimum, maximum)),
      maximum: Math.min(bounds.maximum, Math.max(minimum, maximum)),
    }))
    .filter(({ minimum, maximum }) => minimum < maximum)
    .sort((left, right) => left.minimum - right.minimum || left.maximum - right.maximum);

  const merged: HorizontalInterval[] = [];
  for (const interval of clipped) {
    const previous = merged[merged.length - 1];
    if (!previous || interval.minimum > previous.maximum) {
      merged.push({ ...interval });
    } else {
      previous.maximum = Math.max(previous.maximum, interval.maximum);
    }
  }
  return merged;
}

function subtractIntervals(
  bounds: HorizontalInterval,
  obstacles: readonly HorizontalInterval[],
): HorizontalInterval[] {
  const free: HorizontalInterval[] = [];
  let cursor = bounds.minimum;

  for (const obstacle of obstacles) {
    if (obstacle.minimum > cursor) {
      free.push({ minimum: cursor, maximum: obstacle.minimum });
    }
    cursor = Math.max(cursor, obstacle.maximum);
  }

  if (cursor < bounds.maximum) {
    free.push({ minimum: cursor, maximum: bounds.maximum });
  }
  return free;
}
