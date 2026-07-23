import { GAME_TUNING, type RangeTuning } from '../config/gameTuning';

export interface HiveBodyGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HiveReflectorGeometry extends Omit<HiveBodyGeometry, 'x'> {
  travel: RangeTuning;
}

const { core, shooter, reflector } = GAME_TUNING.hiveBoss;
const shooterOffsetX = core.visualSize / 2 + shooter.width / 2;
const shooterY = core.y - core.visualSize / 2 - shooter.height / 2;
const recalledReflectorOffsetX = core.visualSize / 2 + reflector.width / 2;
const recalledReflectorY = core.y + core.visualSize / 2 + reflector.height / 2;

export const HIVE_BOSS_GEOMETRY = Object.freeze({
  core: Object.freeze({
    x: core.x,
    y: core.y,
    width: core.hitboxSize,
    height: core.hitboxSize,
  }),
  shooters: Object.freeze({
    leftShooter: Object.freeze({
      x: core.x - shooterOffsetX,
      y: shooterY,
      width: shooter.width,
      height: shooter.height,
    }),
    rightShooter: Object.freeze({
      x: core.x + shooterOffsetX,
      y: shooterY,
      width: shooter.width,
      height: shooter.height,
    }),
  }),
  recalled: Object.freeze({
    leftShooter: Object.freeze({ x: core.x - shooterOffsetX, y: core.y }),
    rightShooter: Object.freeze({ x: core.x + shooterOffsetX, y: core.y }),
    leftReflector: Object.freeze({
      x: core.x - recalledReflectorOffsetX,
      y: recalledReflectorY,
    }),
    rightReflector: Object.freeze({
      x: core.x + recalledReflectorOffsetX,
      y: recalledReflectorY,
    }),
  }),
  reflectors: Object.freeze({
    leftReflector: Object.freeze({
      y: reflector.y,
      width: reflector.width,
      height: reflector.height,
      travel: Object.freeze({ ...reflector.leftTravel }),
    }),
    rightReflector: Object.freeze({
      y: reflector.y,
      width: reflector.width,
      height: reflector.height,
      travel: Object.freeze({ ...reflector.rightTravel }),
    }),
  }),
  minimumCorridorWidth: reflector.minimumCorridorWidth,
});

export function bodyBounds(body: HiveBodyGeometry): {
  left: number;
  right: number;
  top: number;
  bottom: number;
} {
  return {
    left: body.x - body.width / 2,
    right: body.x + body.width / 2,
    top: body.y - body.height / 2,
    bottom: body.y + body.height / 2,
  };
}

export function bodiesOverlap(left: HiveBodyGeometry, right: HiveBodyGeometry): boolean {
  const leftBounds = bodyBounds(left);
  const rightBounds = bodyBounds(right);
  return leftBounds.left < rightBounds.right
    && leftBounds.right > rightBounds.left
    && leftBounds.top < rightBounds.bottom
    && leftBounds.bottom > rightBounds.top;
}

export function reflectorCorridorWidth(leftX: number, rightX: number): number {
  return rightX - reflector.width / 2 - (leftX + reflector.width / 2);
}
