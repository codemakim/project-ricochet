export interface ProgressionHudState {
  label: string;
  fillRatio: number;
}

export function progressionHudState(
  level: number,
  xp: number,
  xpRequired: number | null,
): ProgressionHudState {
  if (xpRequired === null) return { label: `LV ${level}  XP MAX`, fillRatio: 1 };
  return {
    label: `LV ${level}  XP ${xp}/${xpRequired}`,
    fillRatio: Math.max(0, Math.min(1, xp / xpRequired)),
  };
}
