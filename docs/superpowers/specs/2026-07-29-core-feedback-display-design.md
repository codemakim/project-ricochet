# Core Feedback and Display Number Design

## Problem

Corrosion and conduction already apply gameplay effects, but neither produces visible feedback. Players therefore cannot tell when either core activates. Level-up text also interpolates raw JavaScript floating-point values, exposing artifacts such as `456.00000000000006`.

## Approved Design

- Corrosion activation creates a translucent green field for the same lifetime and radius as the damaging field.
- Each corrosion damage tick creates a short green pulse.
- Conduction discharge creates a bright cyan double-ring pulse at the primary impact.
- Visuals are feedback only. Existing proc chance, hit counter, radius, damage, and target selection remain unchanged.
- Active corrosion visuals are keyed by field ID and synchronized with `CorrosionFieldState`, so evicted or expired fields disappear promptly.
- Combat visual values remain in `GAME_TUNING`; core colors reuse the existing core colors.
- Level-up numeric text uses one display formatter. It removes binary floating-point noise and limits decimals without changing gameplay values.

## Verification

- Unit-test display formatting.
- Keep existing corrosion/conduction mechanic tests.
- Add a focused browser check that named corrosion and conduction feedback objects appear and expire.
- Run the full unit suite, production build, and existing desktop/mobile E2E suite.
