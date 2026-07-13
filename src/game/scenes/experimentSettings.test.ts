import { describe, expect, it } from 'vitest';
import { EXPERIMENT_DEFAULTS } from '../constants';
import { parseExperimentSettings } from './experimentSettings';

describe('experiment settings query parser', () => {
  it('accepts only literal true and false values', () => {
    expect(parseExperimentSettings('?passThroughOnKill=true&homeOnBottomHit=false')).toEqual({
      passThroughOnKill: true,
      homeOnBottomHit: false,
      autoReturnAfterMs: null,
    });
  });

  it('preserves defaults for absent or invalid values', () => {
    expect(parseExperimentSettings('?passThroughOnKill=1&homeOnBottomHit=TRUE'))
      .toEqual(EXPERIMENT_DEFAULTS);
    expect(parseExperimentSettings('')).toEqual(EXPERIMENT_DEFAULTS);
  });
});
