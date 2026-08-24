# Authored combat VFX masters

- `explosion-burst-grid.png`: 4×2 순서형 폭발 원화. 점화→화염핵→충격파→연기·불티→소멸.
- `conduction-arc-grid.png`: 4×2 순서형 전도 원화. 불규칙 분기 번개, 백색 코어, 청색 글로우.
- 두 원화는 순수 검정 배경을 사용한다. `scripts/build_authored_vfx_sources.sh`가 광량을 알파로 바꾸고 8프레임 투명 시트를 만든다.
- 프레임 순서·격자·해상도를 바꾸지 않는다. 교체 원화도 `1536×1024`, 4열×2행을 유지한다.
