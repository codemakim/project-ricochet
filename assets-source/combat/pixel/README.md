# Authored Combat Pixel Masters

These PNGs are final source art, manually re-authored from approved concept masters. They are not automatic downscales.

`scripts/render_gbc_combat_art.sh` exports each master at exactly `200%` with nearest-neighbor sampling. `scripts/verify_gbc_combat_art.sh` checks dimensions, palette size, alpha, `2×` pixel blocks, and collision-filling opaque bounds.

| Key | Master | Runtime |
| --- | ---: | ---: |
| `player` | `41 × 41` | `82 × 82px` |
| `enemy-basic` | `35 × 30` | `70 × 60px` |
| `enemy-shooter` | `35 × 30` | `70 × 60px` |
| `enemy-armored` | `70 × 60` | `140 × 120px` |
| `enemy-splitter` | `70 × 30` | `140 × 60px` |
| `enemy-fragment-left` | `35 × 30` | `70 × 60px` |
| `enemy-fragment-right` | `35 × 30` | `70 × 60px` |

Run all registered assets:

```bash
rtk bash scripts/render_gbc_combat_art.sh
rtk bash scripts/verify_gbc_combat_art.sh
```

Run an in-progress subset:

```bash
rtk bash scripts/render_gbc_combat_art.sh player enemy-basic
rtk bash scripts/verify_gbc_combat_art.sh player enemy-basic
```

Unknown and duplicate keys fail. The no-argument form never skips missing masters.
