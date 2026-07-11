import { describe, expect, it } from 'vitest';
import { moveByDelta, moveByDirection } from './horizontalInput';

describe('horizontal input', () => {
  it('applies relative drag and clamps to the playfield', () => {
    expect(moveByDelta(225, 50, 96)).toBe(275);
    expect(moveByDelta(440, 50, 96)).toBe(402);
    expect(moveByDelta(10, -50, 96)).toBe(48);
  });

  it('moves keyboard input at 420 pixels per second', () => {
    expect(moveByDirection(225, 1, 100, 96)).toBe(267);
  });
});
