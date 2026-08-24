# Authored combat VFX masters

- `explosion-burst-grid.png`: 4×2 순서형 폭발 원화. 점화→화염핵→충격파→연기·불티→소멸.
- `conduction-arc-grid.png`: 4×2 순서형 전도 원화. 불규칙 분기 번개, 백색 코어, 청색 글로우.
- `enemy-hit-grid.png`: 금속 피격점에서 비대칭으로 튀는 청백색 충격·미세 불티.
- `orb-direct-hit-grid.png`: 접촉점에 고정된 구슬 압축·플라즈마 초승달·렌즈 잔상.
- `corrosion-cloud-grid.png`: 압축 분출부터 소멸까지 이어지는 산성 나노가스 난류.
- `split-burst-grid.png`: 마젠타 핵 균열과 여러 자식 에너지체의 짧은 분화.
- `boss-defeat-grid.png`: 보라색 원자로 붕괴에서 화염·연기·불티로 이어지는 대형 격파.
- 두 원화는 순수 검정 배경을 사용한다. `scripts/build_authored_vfx_sources.sh`가 광량을 알파로 바꾸고 8프레임 투명 시트를 만든다.
- 프레임 순서·격자·해상도를 바꾸지 않는다. 교체 원화도 `1536×1024`, 4열×2행을 유지한다.
