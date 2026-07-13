import { EXPERIMENT_DEFAULTS, type ExperimentSettings } from '../constants';

export function parseExperimentSettings(search: string): ExperimentSettings {
  const query = new URLSearchParams(search);
  return {
    passThroughOnKill: parseBoolean(query.get('passThroughOnKill'), EXPERIMENT_DEFAULTS.passThroughOnKill),
    homeOnBottomHit: parseBoolean(query.get('homeOnBottomHit'), EXPERIMENT_DEFAULTS.homeOnBottomHit),
    autoReturnAfterMs: null,
  };
}

function parseBoolean(value: string | null, fallback: boolean): boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}
