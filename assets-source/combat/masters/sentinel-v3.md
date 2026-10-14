# Sentinel v3

Generated with the built-in `image_gen` tool, 2026-09-16. Master: `sentinel-parts-v3.png`.
Original generation retained at `/Users/jhkim/.codex/generated_images/01a0a262-cec8-7d30-9d90-7eff4c758500/exec-bc67eda3-1d06-43a0-a620-75779bf75e69.png`.

## Generation prompt

Use case: stylized-concept. Production game asset: a transparent pixel-art sprite parts sheet for SENTINEL, an industrial fortress boss in a top-down 2D arcade game. 1536x512 canvas, divided into exactly three equal 512x512 cells, no visible grid. Cell 1 centered: a wide low fortress chassis facing DOWN toward player, width about 440, height about 250. Clear chunky broad shoulder wings, dark slate armor, restrained muted teal bevels, large central dark octagonal socket for a separate core. No turret modules attached to it. Cell 2 centered: one detachable tall gun pod/weakpoint facing DOWN, width about 170 height about 380, dark slate casing and one large warm orange energy window, one muzzle at its bottom. Cell 3 centered: a compact octagonal energy core, about 280x280, simple dark steel rim and bold warm orange center. All three assets detached and centered within their own cells, generous transparent padding, no overlaps, real transparent background. Professional low resolution pixel art, visible large pixel clusters, approximate logical 128x128 grid PER CELL. Extremely readable at game size of chassis 252x144, pod 56x120, core64x64. Consistent palette with 8-10 flat colors, subtle top-left light. Strong silhouette and broad quiet armor surfaces. NO intricate patterning, NO gold filigree, NO tiny rivets, NO dithering, NO scratches, NO grain, NO outlines made of sparkles, NO text, NO glow outside the silhouette, NO shadow on background, NO perspective or isometric view, NO environmental background. Intended to replace overly intricate visually noisy boss assets. Crisp classic arcade sprite, neither photorealistic nor smooth vector.

## Export

The generator returned 2172×724 with unequal spacing. Crops: body 1010×724+0+0,
pod 440×724+1010+0, core 722×724+1450+0. Trim transparent padding, point-resize to
126×72, 28×60, 32×32, quantize to 12 colors without dithering. Save as `pixel/sentinel-*-v3.png`.
`build_default_actor_animation_sources.sh` reads these masters. Export actor-boss scope
with `render_gbc_combat_art.sh`. Static fallback sprites use the same masters at 200%.
Rigid armor retains its size across frames; idle uses one stable frame. Attack and damage
use whole-pixel displacement and tint. This is not a fully hand-animated boss.
