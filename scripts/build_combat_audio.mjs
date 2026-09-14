import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { AUDIO_TUNING, COMBAT_SOUNDS } from '../src/game/audio/audioTuning.ts';

// Original synthesized score and SFX. No recordings, downloads, or third-party samples.
const output = fileURLToPath(new URL('../public/assets/combat/audio/', import.meta.url));
mkdirSync(output, { recursive: true });
const rate = AUDIO_TUNING.sampleRate;
let seed = 0x5249434f;
const noise = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x80000000 - 1; };
const sine = (phase) => Math.sin(phase * Math.PI * 2);
const noteHz = (midi) => 440 * 2 ** ((midi - 69) / 12);

function writeWav(name, samples, directory = output) {
  const peak = samples.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
  assert(Number.isFinite(peak) && peak > 0.01, `${name}: invalid or silent audio`);
  const gain = Math.min(1, 0.88 / peak);
  const wav = Buffer.alloc(44 + samples.length * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36);
  wav.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((value, index) => wav.writeInt16LE(Math.round(value * gain * 32767), 44 + index * 2));
  writeFileSync(`${directory}${name}.wav`, wav);
  return samples.map((value) => value * gain);
}

const effects = {};
for (const [id, spec] of Object.entries(COMBAT_SOUNDS)) {
  let phase = 0;
  let lowNoise = 0;
  const samples = Float32Array.from({ length: Math.round(spec.seconds * rate) }, (_, index) => {
    const time = index / rate;
    const progress = time / spec.seconds;
    let hz = spec.hz * (spec.endHz / spec.hz) ** progress;
    if (id === 'warning') hz = Math.floor(time * 6) % 2 ? spec.endHz : spec.hz;
    if (id === 'reward' || id === 'victory') hz = spec.hz * 2 ** ([0, 4, 7, 12][Math.min(3, Math.floor(progress * 4))] / 12);
    phase += hz / rate;
    const tone = sine(phase) * 0.65 + sine(phase * 2) * 0.2 + sine(phase * 3.01) * 0.15;
    lowNoise = lowNoise * 0.65 + noise() * 0.35;
    const envelope = Math.min(1, time / 0.004) * (1 - progress) ** 1.8;
    const pulse = id === 'warning' ? 0.6 + 0.4 * sine(time * 6) : 1;
    return (tone * (1 - spec.noise) + lowNoise * spec.noise * 2) * envelope * pulse * 0.8;
  });
  effects[id] = writeWav(`sfx-${id}`, samples);
}

const beat = 60 / AUDIO_TUNING.bpm;
const length = Math.round(AUDIO_TUNING.bars * 4 * beat * rate);
const base = new Float32Array(length);
const boss = new Float32Array(length);
function add(track, start, duration, voice) {
  const offset = Math.round(start * rate);
  const count = Math.round(duration * rate);
  for (let i = 0; i < count; i++) {
    // Wrap tails across the loop boundary; both stems have identical sample lengths.
    const index = (offset + i) % length;
    const edge = Math.min(1, i / (rate * 0.002), (count - 1 - i) / (rate * 0.006));
    track[index] += voice(i / rate, i / count) * edge;
  }
}
function pluck(track, start, midi, duration, gain, metallic = false) {
  const hz = noteHz(midi);
  add(track, start, duration, (time, p) => {
    const attack = Math.min(1, time / 0.008);
    const wave = sine(time * hz) + 0.25 * sine(time * hz * 2) + (metallic ? 0.16 * sine(time * hz * 3.01) : 0);
    return wave * attack * (1 - p) ** 2 * gain;
  });
}
// D minor / Bb / F / C, four-bar motif with a second-half response.
const roots = [38, 34, 41, 36];
const motif = [0, 7, 12, 10, 7, 3, 5, 7];
for (let bar = 0; bar < AUDIO_TUNING.bars; bar++) {
  const root = roots[Math.floor(bar / 2) % roots.length];
  const chord = [root + 24, root + 27 + (root === 38 ? 0 : 1), root + 31];
  chord.forEach((midi, index) => {
    add(base, bar * 4 * beat, 4 * beat, (time, p) =>
      sine(time * noteHz(midi) * (1 + index * 0.0006)) * Math.sin(Math.PI * p) ** 2 * 0.055);
  });
  for (let step = 0; step < 8; step++) {
    const start = (bar * 4 + step / 2) * beat;
    pluck(base, start, root + (step % 4 === 3 ? 12 : 0), beat * 0.65, 0.17);
    if (step % 2 === 0) {
      add(base, start, 0.2, (time, p) => sine(48 * time + 1.8 * (1 - Math.exp(-time * 30))) * (1 - p) ** 3 * 0.32);
    }
    add(base, start, 0.055, (time, p) => noise() * (1 - p) ** 4 * (step % 2 ? 0.035 : 0.022));
    if (step === 2 || step === 6) add(base, start, 0.14, (time, p) => (noise() * 0.16 + sine(time * 175) * 0.1) * (1 - p) ** 3);
    if (step % 2 === 0 || bar % 4 === 3) {
      pluck(base, start, 62 + motif[(step + (bar >= 8 ? 2 : 0)) % 8], beat * 0.9, 0.055, true);
    }
    // Boss stem: faster ostinato and heavier percussion, same transport and harmony.
    for (let half = 0; half < 2; half++) {
      pluck(boss, start + half * beat / 4, chord[(step + half) % 3], beat * 0.4, 0.075, true);
    }
    if (step % 2 === 0) add(boss, start, 0.23, (time, p) => (sine(time * 62) * 0.3 + noise() * 0.15) * (1 - p) ** 3);
    if (bar % 4 === 3 && step >= 6) pluck(boss, start, 50 + step, 0.16, 0.16, true);
  }
}
assert.equal(base.length, boss.length);
for (const track of [base, boss]) {
  assert(Math.abs(track[0] - track[track.length - 1]) < 0.01, 'music loop boundary must not click');
}
const baseMix = writeWav('music-combat', base);
const bossMix = writeWav('music-boss', boss);
const previewDirectory = fileURLToPath(new URL('../assets-source/combat/audio/', import.meta.url));
mkdirSync(previewDirectory, { recursive: true });
const preview = Float32Array.from({ length: 16 * rate }, (_, index) =>
  (baseMix[index] * AUDIO_TUNING.musicGain + (index >= 8 * rate ? bossMix[index] * AUDIO_TUNING.bossGain : 0)) * AUDIO_TUNING.masterGain);
for (const [time, id] of [[1, 'launch'], [2, 'ricochet'], [3, 'hit'], [4, 'break'], [5, 'recover'], [6, 'hurt'], [7, 'warning'], [9, 'charge'], [10, 'shot'], [11, 'module'], [12, 'core'], [14, 'bossDefeat']]) {
  const offset = Math.round(time * rate);
  effects[id].forEach((value, index) => {
    if (offset + index < preview.length) preview[offset + index] += value * COMBAT_SOUNDS[id].gain * AUDIO_TUNING.masterGain;
  });
}
writeWav('combat-preview', preview, previewDirectory);
console.log(`Rendered ${Object.keys(COMBAT_SOUNDS).length} SFX + 2 synchronized ${length / rate}s music stems to ${output}`);
