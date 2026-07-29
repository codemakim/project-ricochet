import { describe, expect, it } from 'vitest';
import { formatDisplayNumber } from './displayNumber';

describe('formatDisplayNumber', () => {
  it.each([
    [456.00000000000006, 1, '456'],
    [0.30000000000000004, 2, '0.3'],
    [1.234, 2, '1.23'],
  ] as const)('formats %s with at most %s decimals as %s', (value, digits, expected) => {
    expect(formatDisplayNumber(value, digits)).toBe(expected);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects non-finite value %s',
    (value) => expect(() => formatDisplayNumber(value)).toThrow(RangeError),
  );
});
