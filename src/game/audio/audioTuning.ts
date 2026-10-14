// Playback levels and authored synthesis parameters share one source of truth.
export const AUDIO_TUNING = {
  storageKey: 'project-ricochet.audio-muted',
  masterGain: 0.65,
  musicGain: 0.26,
  bossGain: 0.24,
  menuMusicScale: 0.3,
  fadeSeconds: 0.12,
  maximumVoices: 12,
  musicLeadSeconds: 0.04,
  terminalHoldMs: 900,
  compressor: { threshold: -10, knee: 6, ratio: 8, attack: 0.003, release: 0.12 },
  sampleRate: 32000,
  bpm: 120,
  bars: 16,
} as const;

export const COMBAT_SOUNDS = {
  launch: { gain: 0.32, cooldownMs: 100, priority: 0, hz: 620, endHz: 160, seconds: 0.18, noise: 0.16 },
  recover: { gain: 0.38, cooldownMs: 120, priority: 0, hz: 320, endHz: 880, seconds: 0.22, noise: 0.02 },
  ricochet: { gain: 0.25, cooldownMs: 80, priority: 0, hz: 1100, endHz: 640, seconds: 0.1, noise: 0.08 },
  hit: { gain: 0.4, cooldownMs: 65, priority: 0, hz: 220, endHz: 65, seconds: 0.12, noise: 0.42 },
  break: { gain: 0.5, cooldownMs: 100, priority: 0, hz: 130, endHz: 38, seconds: 0.3, noise: 0.7 },
  explosion: { gain: 0.42, cooldownMs: 180, priority: 0, hz: 90, endHz: 30, seconds: 0.45, noise: 0.8 },
  charge: { gain: 0.22, cooldownMs: 250, priority: 0, hz: 210, endHz: 680, seconds: 0.35, noise: 0.04 },
  shot: { gain: 0.28, cooldownMs: 120, priority: 0, hz: 520, endHz: 110, seconds: 0.16, noise: 0.25 },
  warning: { gain: 0.6, cooldownMs: 1000, priority: 2, hz: 440, endHz: 660, seconds: 0.85, noise: 0.02 },
  hurt: { gain: 0.65, cooldownMs: 300, priority: 2, hz: 150, endHz: 50, seconds: 0.32, noise: 0.35 },
  module: { gain: 0.6, cooldownMs: 140, priority: 1, hz: 110, endHz: 35, seconds: 0.48, noise: 0.65 },
  core: { gain: 0.55, cooldownMs: 800, priority: 1, hz: 180, endHz: 740, seconds: 0.7, noise: 0.12 },
  bossDefeat: { gain: 0.7, cooldownMs: 1000, priority: 2, hz: 100, endHz: 25, seconds: 0.85, noise: 0.7 },
  reward: { gain: 0.4, cooldownMs: 150, priority: 1, hz: 440, endHz: 880, seconds: 0.4, noise: 0 },
  defeat: { gain: 0.6, cooldownMs: 1000, priority: 2, hz: 300, endHz: 55, seconds: 0.8, noise: 0.1 },
  victory: { gain: 0.6, cooldownMs: 1000, priority: 2, hz: 330, endHz: 990, seconds: 0.85, noise: 0.01 },
} as const;

export type CombatSoundId = keyof typeof COMBAT_SOUNDS;
export const MUSIC_KEYS = ['music-combat', 'music-boss'] as const;
