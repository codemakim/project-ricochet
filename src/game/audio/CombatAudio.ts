import type Phaser from 'phaser';
import { AUDIO_TUNING as T, COMBAT_SOUNDS, MUSIC_KEYS, type CombatSoundId } from './audioTuning';

interface Voice {
  id: CombatSoundId;
  source: AudioBufferSourceNode;
  gain: GainNode;
}

export class CombatAudio {
  private readonly context?: AudioContext;
  private readonly output?: GainNode;
  private readonly compressor?: DynamicsCompressorNode;
  private readonly musicGains: GainNode[] = [];
  private readonly voices = new Set<Voice>();
  private readonly lastPlayed = new Map<CombatSoundId, number>();
  private readonly playedCounts: Partial<Record<CombatSoundId, number>> = {};
  private readonly button = document.createElement('button');
  private musicSources: AudioBufferSourceNode[] = [];
  private musicStart = 0;
  private musicOffset = 0;
  private muted = false;
  private paused = false;
  private hidden = document.hidden;
  private boss = false;
  private bossPhase: string | null = null;
  private bossParts: Record<string, number> = {};
  private ended = false;
  private destroyed = false;
  private finishTimer?: ReturnType<typeof setTimeout>;

  constructor(private readonly scene: Phaser.Scene) {
    const manager = scene.sound;
    if ('context' in manager && manager.context.state !== 'closed') {
      this.context = manager.context;
      this.output = this.context.createGain();
      this.output.gain.value = 0;
      this.compressor = this.context.createDynamicsCompressor();
      for (const [key, value] of Object.entries(T.compressor)) {
        this.compressor[key as keyof typeof T.compressor].value = value;
      }
      this.output.connect(this.compressor);
      this.compressor.connect(manager.destination);
      for (const _key of MUSIC_KEYS) {
        const gain = this.context.createGain();
        gain.gain.value = 0;
        gain.connect(this.output);
        this.musicGains.push(gain);
      }
    }
    try { this.muted = localStorage.getItem(T.storageKey) === 'true'; } catch { /* Storage may be disabled. */ }
    this.button.type = 'button';
    this.button.className = 'combat-audio-toggle';
    this.button.addEventListener('click', this.toggleMute);
    this.button.addEventListener('pointerdown', (event) => event.stopPropagation());
    this.button.addEventListener('pointerup', (event) => event.stopPropagation());
    const viewport = this.scene.game.canvas.parentElement;
    (viewport?.previousElementSibling ?? viewport)?.append(this.button);
    document.addEventListener('pointerdown', this.unlock, true);
    document.addEventListener('keydown', this.handleKey);
    this.context?.addEventListener('statechange', this.handleContextState);
    this.refresh();
    this.startMusic();
  }

  private readonly unlock = (event?: Event): void => {
    if (event?.target === this.button) return;
    if (this.destroyed || this.hidden || !this.context || this.context.state === 'closed') return;
    void this.context.resume().then(() => {
      if (!this.destroyed) { this.startMusic(); this.refresh(); }
    }).catch(() => { if (!this.destroyed) this.refresh(); });
  };

  private readonly handleKey = (event: KeyboardEvent): void => {
    if (event.target instanceof HTMLElement && event.target.closest('input, select, textarea, [contenteditable="true"]')) return;
    if (event.target === this.button && event.code !== 'KeyM') return;
    if (event.code === 'KeyM' && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      this.toggleMute();
    } else this.unlock();
  };

  private readonly toggleMute = (): void => {
    if (!this.muted && this.context?.state !== 'running') { this.unlock(); return; }
    this.muted = !this.muted;
    try { localStorage.setItem(T.storageKey, String(this.muted)); } catch { /* Keep the session preference. */ }
    this.refresh();
    this.unlock();
  };

  private readonly handleContextState = (): void => {
    if (this.destroyed) return;
    if (this.context?.state === 'running') this.startMusic();
    this.refresh();
  };

  play(id: CombatSoundId): boolean {
    const context = this.context;
    if (this.destroyed || this.hidden || this.muted || !context || !this.output || context.state !== 'running') return false;
    if (this.paused && COMBAT_SOUNDS[id].priority === 0) return false;
    const profile = COMBAT_SOUNDS[id];
    const now = context.currentTime;
    if (now - (this.lastPlayed.get(id) ?? -Infinity) < profile.cooldownMs / 1000) return false;
    const buffer = this.scene.cache.audio.get(`sfx-${id}`) as AudioBuffer | undefined;
    if (!buffer) return false;
    if (this.voices.size >= T.maximumVoices) {
      const expendable = [...this.voices].find((voice) => COMBAT_SOUNDS[voice.id].priority < profile.priority);
      if (!expendable) return false;
      this.removeVoice(expendable);
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    gain.gain.value = profile.gain;
    source.connect(gain);
    gain.connect(this.output);
    const voice = { id, source, gain };
    source.onended = () => this.removeVoice(voice);
    this.voices.add(voice);
    source.start();
    this.lastPlayed.set(id, now);
    this.playedCounts[id] = (this.playedCounts[id] ?? 0) + 1;
    return true;
  }

  setBoss(active: boolean): void {
    this.boss = active;
    this.bossPhase = null;
    this.bossParts = {};
    this.refresh();
  }

  observeBoss(phase: string | null, parts: Record<string, number>): void {
    if (!this.boss) return;
    for (const [part, hp] of Object.entries(parts)) {
      if (part !== 'core' && hp === 0 && (this.bossParts[part] ?? 0) > 0) this.play('module');
    }
    if (phase !== this.bossPhase && (phase === 'core' || phase === 'permanentlyExposed')) this.play('core');
    this.bossPhase = phase;
    this.bossParts = { ...parts };
  }

  setPaused(paused: boolean, hidden: boolean, ended: boolean): void {
    this.paused = paused;
    this.hidden = hidden;
    this.ended = ended;
    if (hidden || ended) this.stopMusic();
    if (hidden) for (const voice of [...this.voices]) this.removeVoice(voice);
    this.refresh();
    if (!hidden && !ended) this.startMusic();
  }

  finish(success: boolean, onFinished: () => void): void {
    this.play(success ? 'victory' : 'defeat');
    this.finishTimer = setTimeout(onFinished, this.context?.state === 'running' && !this.muted ? T.terminalHoldMs : 0);
  }

  getSnapshot() {
    return {
      available: Boolean(this.context),
      contextState: this.context?.state ?? 'unavailable',
      muted: this.muted, paused: this.paused, hidden: this.hidden, boss: this.boss,
      musicTracks: this.musicSources.length, musicStart: this.musicStart, musicOffset: this.musicOffset,
      activeVoices: this.voices.size, played: { ...this.playedCounts },
    };
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    clearTimeout(this.finishTimer);
    this.stopMusic();
    for (const voice of [...this.voices]) this.removeVoice(voice);
    for (const gain of this.musicGains) gain.disconnect();
    this.output?.disconnect();
    this.compressor?.disconnect();
    this.context?.removeEventListener('statechange', this.handleContextState);
    document.removeEventListener('pointerdown', this.unlock, true);
    document.removeEventListener('keydown', this.handleKey);
    this.button.remove();
  }

  private startMusic(): void {
    const context = this.context;
    if (this.destroyed || this.hidden || this.ended || !context || context.state !== 'running' || this.musicSources.length) return;
    const buffers = MUSIC_KEYS.map((key) => this.scene.cache.audio.get(key) as AudioBuffer | undefined);
    if (buffers.some((buffer) => !buffer)) return;
    this.musicStart = context.currentTime + T.musicLeadSeconds;
    this.musicSources = buffers.map((buffer, index) => {
      const source = context.createBufferSource();
      source.buffer = buffer!;
      source.loop = true;
      source.connect(this.musicGains[index]!);
      source.start(this.musicStart, this.musicOffset);
      return source;
    });
  }

  private stopMusic(): void {
    const duration = this.musicSources[0]?.buffer?.duration;
    if (duration && this.context) this.musicOffset = (this.musicOffset + Math.max(0, this.context.currentTime - this.musicStart)) % duration;
    for (const source of this.musicSources) { source.stop(); source.disconnect(); }
    this.musicSources = [];
  }

  private removeVoice(voice: Voice): void {
    if (!this.voices.delete(voice)) return;
    voice.source.onended = null;
    voice.source.stop();
    voice.source.disconnect();
    voice.gain.disconnect();
  }

  private refresh(): void {
    const now = this.context?.currentTime ?? 0;
    const setGain = (gain: GainNode | undefined, value: number) => {
      gain?.gain.setTargetAtTime(value, now, T.fadeSeconds);
    };
    setGain(this.output, this.muted || this.hidden ? 0 : T.masterGain);
    const scale = this.paused ? T.menuMusicScale : 1;
    setGain(this.musicGains[0], T.musicGain * scale);
    setGain(this.musicGains[1], this.boss ? T.bossGain * scale : 0);
    this.button.disabled = !this.context;
    this.button.textContent = !this.context ? '오디오 미지원' : this.muted ? '소리 꺼짐' : this.context.state === 'running' ? '소리 켜짐' : '소리 켜기';
    this.button.setAttribute('aria-label', '음소거');
    this.button.setAttribute('aria-pressed', String(this.muted));
    this.button.title = '음소거 전환 (M)';
  }
}
