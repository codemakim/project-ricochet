export const GAME_WIDTH = 450;
export const GAME_HEIGHT = 800;
export const PLAYER_RADIUS = 18;
export const PLAYER_SPEED = 420;
export const PLAYER_MIN_Y = 98;

export const STARTING_ORB_COUNT = 3;
export const ORB_SPEED = 400;
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
