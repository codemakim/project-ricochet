export function shouldFinalizeBossReward(
  bossDefeatPending: boolean,
  defeated: boolean,
  levelUpPaused: boolean,
): boolean {
  return bossDefeatPending && !defeated && !levelUpPaused;
}
