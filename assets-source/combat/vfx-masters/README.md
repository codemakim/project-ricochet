# Authored combat VFX masters

- `explosion-burst-grid.png`: 4×2 순서형 폭발 원화. 점화→화염핵→충격파→연기·불티→소멸.
- `conduction-arc-grid.png`: 4×2 순서형 전도 원화. 불규칙 분기 번개, 백색 코어, 청색 글로우.
- `enemy-hit-grid.png`: 금속 피격점에서 비대칭으로 튀는 청백색 충격·미세 불티.
- `orb-direct-hit-grid.png`: 접촉점에 고정된 구슬 압축·플라즈마 초승달·렌즈 잔상.
- `corrosion-cloud-grid.png`: 압축 분출부터 소멸까지 이어지는 산성 나노가스 난류.
- `split-burst-grid.png`: 마젠타 핵 균열과 여러 자식 에너지체의 짧은 분화.
- `boss-defeat-grid.png`: 보라색 원자로 붕괴에서 화염·연기·불티로 이어지는 대형 격파.
- `player-launch-grid.png`: 앰버 점화와 청색 플라즈마 압력 방출.
- `player-recover-grid.png`: 외곽 에너지 리본이 중심으로 압축되는 회수.
- `player-hit-grid.png`: 위험색 전기·충격·연기로 읽히는 플레이어 피격.
- `player-defeat-grid.png`: 청색·앰버 에너지 봉쇄가 깨지고 연기로 꺼지는 사망.
- `orb-ricochet-grid.png`: 청자색 전단 초승달과 반동 필라멘트로 보이는 벽 반사.
- `enemy-break-grid.png`: 금속 파편·주황 불티·청록 잔류 전기의 일반 적 파괴.
- `shooter-charge-grid.png`: 적색 필라멘트가 주황색 발사핵으로 압축되는 충전.
- `shooter-fire-grid.png`: 백색 섬광·주황 플라즈마·연기 반동으로 보이는 발사.
- `armored-brace-grid.png`: 청자색 반구 방어막의 응축·충격 변형·복원.
- `splitter-fracture-grid.png`: 산호색 에너지 덩어리가 두 불균형 잔체로 찢어지는 분열.
- `boss-module-break-grid.png`: 보라색 압력체·중금속 파편·화염이 섞인 대형 파츠 파괴.
- `boss-core-rage-grid.png`: 백색 핵과 적자색 전기 코로나가 지속되는 격노.
- `echo-ring-grid.png`: 청록색 파동이 일그러진 열린 고리로 퍼지고 잔광으로 사라지는 공명.
- `inertia-compression-grid.png`: 청자색 압력 리본이 어두운 중심으로 접히는 관성 압축.
- `photon-beam-grid.png`: 수평 청백색 광자 필라멘트의 발광·잔상·소멸.
- `photon-intersection-grid.png`: 청록·보라 광자 흐름이 충돌하는 불규칙한 섬광.
- `resonant-spawn-grid.png`: 마젠타·청록 에너지체가 가는 연결광을 남기며 분화.
- `resonant-final-grid.png`: 공명 에너지 구름이 찢어져 보랏빛 실가닥으로 소멸.
- `nano-seed-grid.png`: 자홍색 핵을 품은 녹색 액상 나노씨앗의 형성·파열.
- `nano-spread-grid.png`: 여러 나노씨앗이 녹색 난류와 액적으로 증식·확산.
- `mass-collapse-grid.png`: 청자색 나선이 어두운 중심으로 무너지고 잔입자로 소멸.
- `reactor-charge-grid.png`: 주황 플라즈마 흐름이 백색 반응핵으로 응축.
- `reactor-blast-grid.png`: 백색 점화핵에서 주황 화염과 연기가 팽창하는 반응로 폭발.
- `cluster-projectile-grid.png`: 오른쪽으로 향하는 주황 탄두와 뒤따르는 화염 꼬리.
- `cluster-impact-grid.png`: 주황·마젠타 자탄과 불티가 비대칭으로 흩어지는 착탄.
- `mirror-node-grid.png`: 청록·보라 리본이 얇은 굴절 렌즈로 응축했다 풀리는 거울.
- `mirror-intersection-grid.png`: 굴절된 청자색 흐름이 충돌해 부채꼴 잔광으로 퍼지는 교차.
- `meltdown-eruption-grid.png`: 주황 고열 액적과 녹색 가스가 뒤섞인 융해 분출.
- `vector-blade-grid.png`: 오른쪽으로 향하는 주황 전단 날과 보라색 유동 꼬리.

## 제작·내보내기

- 원화 36종 모두 검정 배경을 사용한다. `scripts/build_authored_vfx_sources.sh`가 광량을 알파로 바꾸고 8프레임 투명 시트를 만든다.
- `build_combat_vfx_sources.sh`는 같은 제작 경로를 호출한다. 기하 도형 대체 시트는 생성하지 않는다.
- 프레임 순서·격자·해상도를 바꾸지 않는다. 교체 원화도 `1536×1024`, 4열×2행을 유지한다.
- 배포 시트는 `2048×256`이며 `assets-source/combat/vfx/`에서 `public/assets/combat/vfx/`로 재샘플링 없이 복사한다.
- 2026-09-15 마지막 17종은 내장 `image_gen`으로 개별 생성했다. 실제 사용한 프롬프트와 ID는 [generation-prompts-2026-09-15.json](generation-prompts-2026-09-15.json)에 보존했다. 원자로 폭발·융해 분출의 사각 배경을 제거한 수정 프롬프트도 포함한다.
