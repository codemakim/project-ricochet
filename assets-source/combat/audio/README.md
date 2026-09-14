# Combat audio, first playable pass

Original procedural score and effects, rendered by `scripts/build_combat_audio.mjs`.
No external recordings or samples. Rebuild with `pnpm assets:audio` on Node 24+.

- 16 mono PCM WAV effects: launch, recover, ricochet, hit, break, explosion,
  charge, shot, warning, hurt, module, core, bossDefeat, reward, defeat, victory.
- Two 32-second, 120 BPM music stems: `music-combat` and `music-boss`.
  Identical sample lengths, 32000 Hz; tails wrap across the loop boundary.
- Normal combat: bass ostinato, restrained drums, minor-key synth motif.
  Boss layer: sixteenth-note arpeggio and heavier metallic percussion.
- `combat-preview.wav`: 16-second listening sample. The boss layer enters at 8s;
  representative SFX are overlaid. Runtime additionally uses a dynamics compressor.

Mix, cooldown, voice cap, synthesis and score tempo live in
`src/game/audio/audioTuning.ts`. Runtime audio is in `public/assets/combat/audio/`.
This is an integrated first audio pass; final timbre, repetition fatigue and
mix approval require listening during a full run with speakers and headphones.
