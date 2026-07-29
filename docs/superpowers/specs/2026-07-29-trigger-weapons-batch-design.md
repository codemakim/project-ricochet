# Trigger Weapons Batch Design

## Scope

Implement the next approved general-ability batch:

- Horizontal Cutter: 15% permanent direct-hit proc.
- Vertical Cutter: 15% permanent direct-hit proc.
- Destruction Reaction: 25% permanent direct-kill explosion.
- Micro Missile: one guided secondary strike every six permanent direct hits.
- Recovery Shockwave: player-centered damage every four proximity recoveries, with two damage ranks.

This batch also finishes core readability:

- Conduction draws deterministic lightning segments from the primary hit to the actual secondary targets.
- Corrosion ticks show small green damage numbers at affected target positions.

## Rules

- Secondary damage never creates another direct hit or proc.
- Proc randomness remains deterministic and uses the existing failure-protection rule.
- All chances, counters, damage, size, timing, and visual values live in `GAME_TUNING`.
- Lasers damage a thin full-width or full-height strip through the impact point.
- The missile selects the nearest valid target and lands after a short visual travel delay. If no target exists, the counter is consumed without a strike.
- Boss parts and normal enemies use the same secondary-weapon rules.
- The 12-kind run cap remains unchanged; adding this batch makes the cap observable.

## Initial Tuning

- Laser: `15%`, `120ms` per-orb cooldown, `12px` thickness, `0.7` damage.
- Destruction Reaction: `25%`, `120ms` cooldown, `56px` radius, `0.8` damage.
- Micro Missile: every `6` hits, `180ms` travel, `1.2` damage.
- Recovery Shockwave: every `4` proximity recoveries, `72px` radius, `0.75 / 1.25` damage.

## Verification

- Unit-test ranks, option cap behavior, deterministic procs, counters, and target geometry.
- Browser-test visible laser, missile, shockwave, conduction line, and corrosion damage feedback.
- Run full unit, build, and desktop/mobile E2E once.
