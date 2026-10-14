import { afterEach, describe, expect, it, vi } from 'vitest';
import { CombatAudio } from './CombatAudio';
import { AUDIO_TUNING as T } from './audioTuning';

function setup(state = 'running') {
  const sources: Array<ReturnType<typeof source>> = [];
  const gains: Array<ReturnType<typeof gain>> = [];
  function source() { return { connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null, buffer: null, loop: false }; }
  function gain() { return { connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1, setTargetAtTime: vi.fn() } }; }
  const button = Object.assign(new EventTarget(), { setAttribute: vi.fn(), remove: vi.fn(), disabled: false });
  const document = Object.assign(new EventTarget(), { hidden: false, createElement: () => button });
  const storage = new Map<string, string>();
  vi.stubGlobal('document', document);
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key), setItem: (key: string, value: string) => storage.set(key, value) });
  const context = Object.assign(new EventTarget(), {
    state, currentTime: 0,
    createGain: () => { const node = gain(); gains.push(node); return node; },
    createDynamicsCompressor: () => ({
      connect: vi.fn(), disconnect: vi.fn(), threshold: { value: 0 }, knee: { value: 0 },
      ratio: { value: 0 }, attack: { value: 0 }, release: { value: 0 },
    }),
    createBufferSource: () => { const node = source(); sources.push(node); return node; },
    resume: vi.fn(async () => { context.state = 'running'; }),
  });
  const scene = {
    sound: { context, destination: {} },
    cache: { audio: { get: vi.fn(() => ({ duration: 32 })) } },
    game: { canvas: { parentElement: { append: vi.fn() } } },
  };
  const audio = new CombatAudio(scene as never);
  return { audio, scene, context, document, button, sources, gains, storage };
}

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('combat audio lifecycle', () => {
  it('unlocks on input and starts both stems on one clock; hiding resumes the same loop offset', async () => {
    const { audio, context, document, sources, gains } = setup('suspended');
    expect(sources).toHaveLength(0);
    expect(audio.play('hit')).toBe(false);
    document.dispatchEvent(new Event('pointerdown'));
    await Promise.resolve();
    expect(sources).toHaveLength(2);
    expect(sources[0]!.start).toHaveBeenCalledWith(T.musicLeadSeconds, 0);
    expect(sources[1]!.start.mock.calls).toEqual(sources[0]!.start.mock.calls);
    audio.setBoss(true);
    expect(gains[2]!.gain.setTargetAtTime).toHaveBeenLastCalledWith(T.bossGain, 0, T.fadeSeconds);
    audio.setPaused(true, false, false);
    expect(sources).toHaveLength(2);
    expect(audio.play('hit')).toBe(false);
    context.currentTime = 5 + T.musicLeadSeconds;
    audio.setPaused(true, true, false);
    expect(audio.play('warning')).toBe(false);
    expect(sources[0]!.stop).toHaveBeenCalledOnce();
    context.currentTime = 9;
    audio.setPaused(false, false, false);
    expect(sources[2]!.start).toHaveBeenCalledWith(9 + T.musicLeadSeconds, 5);
    expect(sources[3]!.start.mock.calls).toEqual(sources[2]!.start.mock.calls);
    audio.destroy();
  });

  it('limits dense hits, reserves priority for warnings, persists mute, and cleans up on shutdown', () => {
    const { audio, context, button, sources, gains, storage } = setup();
    expect(audio.play('hit')).toBe(true);
    expect(audio.play('hit')).toBe(false);
    for (let i = 1; i < T.maximumVoices; i++) {
      context.currentTime += 0.1;
      expect(audio.play('hit')).toBe(true);
    }
    context.currentTime += 1;
    expect(audio.play('hit')).toBe(false);
    expect(audio.play('warning')).toBe(true);
    expect(audio.getSnapshot().activeVoices).toBe(T.maximumVoices);
    expect(sources[2]!.stop).toHaveBeenCalledOnce();
    button.dispatchEvent(new Event('click'));
    expect(storage.get(T.storageKey)).toBe('true');
    expect(audio.play('hurt')).toBe(false);
    expect(gains[0]!.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, context.currentTime, T.fadeSeconds);
    audio.destroy(); audio.destroy();
    expect(audio.getSnapshot().activeVoices).toBe(0);
    expect(audio.getSnapshot().musicTracks).toBe(0);
    expect(button.remove).toHaveBeenCalledOnce();
    expect(sources.every((node) => node.disconnect.mock.calls.length === 1)).toBe(true);
  });

  it('signals module/core transitions once and cancels a pending result callback on shutdown', () => {
    vi.useFakeTimers();
    const { audio } = setup();
    audio.setBoss(true);
    audio.observeBoss('shielded', { core: 100, left: 10, right: 10 });
    audio.observeBoss('core', { core: 100, left: 0, right: 0 });
    audio.observeBoss('core', { core: 100, left: 0, right: 0 });
    expect(audio.getSnapshot().played).toMatchObject({ module: 1, core: 1 });
    const finished = vi.fn();
    audio.setPaused(true, false, true);
    audio.finish(true, finished);
    expect(audio.getSnapshot().played.victory).toBe(1);
    expect(finished).not.toHaveBeenCalled();
    audio.destroy();
    vi.runAllTimers();
    expect(finished).not.toHaveBeenCalled();
  });

  it('waits for the siege defense module before sounding core exposure', () => {
    const { audio } = setup();
    audio.setBoss(true);
    audio.observeBoss('core', { core: 36, defenseModule: 20 });
    expect(audio.getSnapshot().played.core).toBeUndefined();
    audio.observeBoss('core', { core: 36, defenseModule: 0 });
    expect(audio.getSnapshot().played.core).toBe(1);
    audio.destroy();
  });
});
