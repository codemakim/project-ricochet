import { GAME_TUNING } from './config/gameTuning';

export const GAME_WIDTH = GAME_TUNING.world.width;
export const GAME_HEIGHT = GAME_TUNING.world.height;
export const PLAYER_RADIUS = GAME_TUNING.player.visual.hurtRadius;
export const PLAYER_SPEED = 420;
export const PLAYER_MIN_Y = 98;

export const STARTING_ORB_COUNT = 1;
export const ORB_SPEED = 400;
export const ORB_RADIUS = GAME_TUNING.visual.friendly.permanentOrb.width / 2;
export const ORB_PICKUP_RADIUS = 50;
export const LAUNCH_INTERVAL_MS = 100;

export interface ExperimentSettings {
  passThroughOnKill: boolean;
  homeOnBottomHit: boolean;
  autoReturnAfterMs: number | null;
}

export const EXPERIMENT_DEFAULTS: ExperimentSettings = {
  passThroughOnKill: false,
  homeOnBottomHit: true,
  autoReturnAfterMs: null,
};
