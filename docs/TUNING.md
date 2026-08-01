# 튜닝 값 관리

밸런스 값을 새로 만들거나 바꿀 때 아래 세 파일 중 한 곳을 단일 원본으로 사용한다.

| 범위 | 단일 원본 | 예시 |
| --- | --- | --- |
| 전투 전반 | `src/game/config/gameTuning.ts`의 `GAME_TUNING` | 적 체력·속도, 능력 배율, 최대 구슬 수, 보상 간격 |
| 스테이지별 구성 | `src/game/encounters/stageDefinitions.ts`의 `STAGES` | 보스 진입 조건, 편성, 파워 밴드 |
| 런 밖 경제 | `src/game/meta/metaTuning.ts`의 `META_TUNING` | 부품 보상, 코어 해금 비용 |

UI, 매니저, 규칙 코드에 같은 숫자를 다시 적지 않는다. UI 설명은 실제 `BuildState` 결과나 능력 정의를 읽고, 테스트의 숫자는 계약 검증용 기대값으로만 둔다.

## 자주 조정할 값

| 조정 목적 | 위치 |
| --- | --- |
| 영구 구슬 최대 수 | `GAME_TUNING.build.basicGrowth.maximumOrbs` |
| 보상 선택 사이 전투 재개 시간 | `GAME_TUNING.rewardFlow.resumeGameplayMs` |
| 레벨 구간별 구슬·능력 카드 비율 | `GAME_TUNING.rewardFlow.mixedCards` |
| 스테이지 목표 구슬 수 | `STAGES[].powerBand.expectedOrbCount` |
| 적 하강 속도와 체력 | `GAME_TUNING.enemies` |
| 증원 간격·활성 적 상한 | `STAGES[].phases` |
| 보스 진입 시간·처치 점수 | `STAGES[].boss` |
| 일반 능력 수치 | `GAME_TUNING.build` |
| 코어 고유 수치·색상 | `GAME_TUNING.orbCores` |
| 코어 최대 레벨·설명 | `ORB_CORE_DEFINITIONS[*].maximumLevel`, `levelEffects` |
| 레벨별 반향·부식·전도·관성·분열·폭발 수치 | `GAME_TUNING.orbCores.*.*ByLevel` |
| 분열·폭발 공용 능력 결합 보정 | `GAME_TUNING.orbCores.split.genericSynergy`, `explosion.genericSynergy` |
| 임시 구슬·부식장 전역 상한 | `GAME_TUNING.temporaryOrbs.cap`, `orbCores.corrosion.globalFieldLimit` |
| 코어 호환 보스 유물 | `GAME_TUNING.relics` |
| 코어 해금 비용 | `META_TUNING.corePrices` |

## 변경 규칙

1. 공통 수치는 `GAME_TUNING`, 특정 스테이지만 다른 수치는 `STAGES`에 둔다.
2. 새 값은 같은 파일의 검증 함수와 테스트를 함께 추가한다.
3. 5단계 코어 배열은 정확히 다섯 값을 두고 같은 단계에서 감소하지 않게 한다.
4. `expectedOrbCount`는 혼합 XP 보상의 목표 구슬 성장 속도를 반영한다.
5. 수치 변경 뒤 단위 테스트, 빌드, 관련 E2E 순서로 검증한다.
