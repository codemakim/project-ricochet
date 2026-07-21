import { GAME_TUNING } from '../config/gameTuning';
import { GAME_WIDTH } from '../constants';

const { body, weakpoint } = GAME_TUNING.boss;
const bodyHalfWidth = body.width / 2;
const bodyHalfHeight = body.height / 2;
const weakpointOffsetX = (body.width + weakpoint.visual.width) / 2 - weakpoint.edgeOverlap;
const collisionHalfWidth = weakpointOffsetX + weakpoint.hitbox.width / 2;
const collisionHalfHeight = Math.max(bodyHalfHeight, weakpoint.hitbox.height / 2);

export const BOSS_GEOMETRY = {
  bodyHalfWidth,
  bodyHalfHeight,
  weakpointOffsetX,
  collisionHalfWidth,
  collisionHalfHeight,
  movementBounds: { minimum: collisionHalfWidth, maximum: GAME_WIDTH - collisionHalfWidth },
} as const;
