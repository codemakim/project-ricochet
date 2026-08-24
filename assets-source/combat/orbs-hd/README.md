# High-resolution Energy Orbs

Permanent orbs deliberately use smooth high-resolution VFX over chunky pixel-art bodies.
Each `256 × 256` transparent master exports to `64 × 64`; Phaser displays it at `42px`
with linear sampling. The inner sphere aligns with the `32px` collision diameter and the
remaining pixels form a non-colliding aura.

Every orb keeps one circular body, one broad highlight, one broad shadow, one bold identity
mark, and a restrained color aura. Tiny markings, filigree, loose fragments, and flat icons
are rejected because they disappear at game scale.

| Family | Identity marks |
| --- | --- |
| Base | echo crescents, corrosion band, lightning band, kinetic chevron, Y split, starburst |
| Fusion | photon ring, three nuclei, growth Y, gravity ring, reactor channels, three pods, mirror diamond, molten band, vector blade |

Generate direction: polished smooth raster game VFX, transparent background, clearly
spherical at `42px`, only three to five large visual masses, mechanical-occult palette.

## Source and runtime naming

- 원형 몸체: `assets-source/combat/orbs-hd/<orb-id>/body.png` → `public/assets/combat/orbs/<orb-id>/body.png`
- 시각 레이어: 같은 소스 폴더의 `<layer-id>.png` → 같은 런타임 폴더의 `<layer-id>.png`
- 4프레임 레이어는 `256 × 256` 프레임 네 장을 가로로 붙인 `1024 × 256` 소스이며 `256 × 64` 런타임 시트가 된다.
- 정적 레이어는 `256 × 256` 소스에서 `64 × 64`로 축소한다.
- `orbVisualProfiles.ts`가 몸체, 레이어 이름, 모션과 VFX 의미를 연결한다. 새 구슬은 이 프로필과 소스 폴더만 추가한다.
- 몸체만 충돌 구슬을 따라간다. 레이어·아우라·트레일은 항상 비물리 오브젝트다.
