import { describe, expect, it } from 'vitest';
import { LaunchQueue } from './launchQueue';

describe('launch queue', () => {
  it('releases unique IDs one at a time every 100ms', () => {
    const queue = new LaunchQueue(100);
    queue.enqueue(2);
    queue.enqueue(2);
    queue.enqueue(5);
    expect(queue.drain(0)).toEqual([2]);
    expect(queue.drain(99)).toEqual([]);
    expect(queue.drain(100)).toEqual([5]);
  });

  it('releases a new item immediately after becoming empty', () => {
    const queue = new LaunchQueue(100);
    queue.enqueue(2);
    expect(queue.drain(50)).toEqual([2]);
    queue.enqueue(5);
    expect(queue.drain(50)).toEqual([5]);
  });

  it('clear removes queued IDs and resets the release timer', () => {
    const queue = new LaunchQueue(100);
    queue.enqueue(2);
    queue.enqueue(5);
    expect(queue.drain(0)).toEqual([2]);
    queue.clear();
    queue.enqueue(7);
    expect(queue.drain(1)).toEqual([7]);
  });
});
