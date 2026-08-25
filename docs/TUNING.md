# 튜닝 값 관리

밸런스 값을 새로 만들거나 바꿀 때 아래 세 파일 중 한 곳을 단일 원본으로 사용한다.

| 범위 | 단일 원본 | 예시 |
| --- | --- | --- |
| 전투 전반 | `src/game/config/gameTuning.ts`의 `GAME_TUNING` | 적 기본 체력·하강 속도, 능력 배율, 최대 구슬 수, 보상 간격 |
| 스테이지별 구성 | `src/game/encounters/stageDefinitions.ts`의 `STAGES` | 보스 진입 조건, 편성, 단계별 체력 배율·활성 상한·증원 간격·증원선·적 가중치 |
| 런 밖 경제 | `src/game/meta/metaTuning.ts`의 `META_TUNING` | 부품 보상, 코어 해금 비용 |

UI, 매니저, 규칙 코드에 같은 숫자를 다시 적지 않는다. UI 설명은 실제 `BuildState` 결과나 능력 정의를 읽고, 테스트의 숫자는 계약 검증용 기대값으로만 둔다.

## 자주 조정할 값

| 조정 목적 | 위치 |
| --- | --- |
| 영구 구슬 최대 수 | `GAME_TUNING.build.basicGrowth.maximumOrbs` |
| 보상 선택 사이 전투 재개 시간 | `GAME_TUNING.rewardFlow.resumeGameplayMs` |
| 레벨 구간별 구슬·능력 카드 비율 | `GAME_TUNING.rewardFlow.mixedCards` |
| 스테이지 목표 구슬 수 | `STAGES[].powerBand.expectedOrbCount` |
| 적 기본 하강 속도와 기본 체력 | `GAME_TUNING.enemies` |
| 단계별 체력 배율 | `STAGES[].powerBand.normalHpMultiplier`, `eliteHpMultiplier` |
| 증원 간격·활성 적 상한·증원선·슈터 가중치/상한 | `STAGES[].phases` |
| 페이즈·보스 진입 처치 점수 | `STAGES[].phases[].startsAtScore`, `STAGES[].boss.scoreTarget` |
| 빈 전장 재보급 지연·고속 진입 깊이/속도 | `GAME_TUNING.encounter.emptyRespawnMs`, `emergencyIngress` |
| 하이브 코어 이동·장애물 여유·펄스 | `GAME_TUNING.hiveBoss.core.enrage` |
| 하이브 격노 공격 간격·탄 수·탄 상한 | `GAME_TUNING.projectiles.hiveEnrage` |
| 일반 능력 수치 | `GAME_TUNING.build` |
| 코어 고유 수치·색상 | `GAME_TUNING.orbCores` |
| 코어 최대 레벨·설명 | `ORB_CORE_DEFINITIONS[*].maximumLevel`, `levelEffects` |
| 레벨별 반향·부식·전도·관성·분열·폭발 수치 | `GAME_TUNING.orbCores.*.*ByLevel` |
| 분열·폭발 공용 능력 결합 보정 | `GAME_TUNING.orbCores.split.genericSynergy`, `explosion.genericSynergy` |
| 임시 구슬·부식장 전역 상한 | `GAME_TUNING.temporaryOrbs.cap`, `orbCores.corrosion.globalFieldLimit` |
| 융합 구슬 9종 Lv1~Lv9 수치 | `GAME_TUNING.orbFusions` |
| 코어 호환 보스 유물 | `GAME_TUNING.relics` |
| 코어 해금 비용 | `META_TUNING.corePrices` |
| 액터 상태 프레임·속도·반복 | `src/game/visuals/actorVisualProfiles.ts`의 `ACTOR_SKIN_PROFILES` |
| 구슬 레이어 회전·맥동·궤도·프레임 속도 | `src/game/visuals/orbVisualProfiles.ts`의 `ORB_VISUAL_PROFILES` |
| 구슬 레이어·파티클·모바일 오브젝트 상한 | `GAME_TUNING.visual.orbAnimation` |
| 제작 VFX 투명도·전체 상한·최대 수명 | `GAME_TUNING.visual.productionVfx` |
| VFX별 수명·크기·동시 상한 | `src/game/visuals/combatVfxProfiles.ts`의 `COMBAT_VFX_PROFILES` |

현재 실제 게임 기준값은 일반 적 HP `3.9/5.2/9.1/2.6`, 장갑 적 HP `12`, 적 하강 `9.6px/s`, 영구 구슬 속도 `520px/s`다. 개발자 모드의 `1`은 이 기준값 그대로를 뜻한다.

## 모션·VFX 기본값

| 범위 | 값 |
| --- | --- |
| 액터 대기/이동 | `6fps`, 반복 |
| 액터 반응 상태 | `10fps`, 1회 재생; 2~4프레임이라 `0.2~0.4초` |
| 구슬 레이어 | 프로필별 회전 `0.7~2.2rad/s`, 맥동 `480~840ms`, 궤도 `680~760ms`, 프레임 `7~12fps` |
| 구슬 시각 상한 | 구슬당 레이어 4, 파티클 3, 모바일 전체 48 |
| 제작 VFX | 알파 `0.08~0.9`, 모바일 64, 데스크톱 96, 최대 수명 `2500ms` |
| VFX 프로필 | 일반 `320ms/동시 8`, 지속형 `640ms/동시 4`; 정식 8프레임 효과별 수명·크기는 `COMBAT_VFX_PROFILES` |

액터 모션과 VFX는 판정·피해·발동 타이밍을 소유하지 않는다. 밸런스는 기존 전투 소유자에서, 표현 상한과 수명만 위 위치에서 조정한다.

## 2026-08-10 플레이 조정 기준

| 효과 | 중앙 위치 | 피해 값 |
| --- | --- | --- |
| 부식 틱 | `GAME_TUNING.orbCores.corrosion.damagePerTickByLevel` | `[0.28, 0.34, 0.42, 0.5, 0.62]` |
| 광자 궤도 | `orbFusions.photonOrbit`의 `beamDamageByLevel`, `trail.damageByLevel`, `intersection.damage` | `[0.8, 0.9, 1, 1.1, 1.2, 1.35, 1.5, 1.7, 2]`, `[0, 0, 0, 0.22, 0.26, 0.3, 0.36, 0.42, 0.5]`, `1.6` |
| 공명 군체 | `orbFusions.resonantSwarm`의 `damageByLevel`, `finalDamageByLevel` | `[0.36, 0.4, 0.44, 0.48, 0.54, 0.6, 0.68, 0.78, 0.9]`, `[0.35, 0.4, 0.45, 0.5, 0.58, 0.66, 0.76, 0.88, 1.05]` |
| 나노 증식체 | `orbFusions.nanoProliferator.damageByLevel` | `[0.22, 0.24, 0.27, 0.3, 0.34, 0.38, 0.43, 0.5, 0.6]` |
| 질량 붕괴탄 | `orbFusions.massCollapse.collapseDamageByLevel` | `[1.5, 1.7, 1.9, 2.1, 2.4, 2.7, 3.1, 3.6, 4.4]` |
| 반응로 구슬 | `orbFusions.reactorOrb.damagePerChargeByLevel` | `[0.36, 0.4, 0.44, 0.48, 0.54, 0.6, 0.66, 0.72, 0.82]` |
| 성단 폭격체 | `orbFusions.clusterBombardment`의 `damageByLevel`, `lingeringDamageByLevel` | `[0.6, 0.66, 0.72, 0.8, 0.88, 0.98, 1.1, 1.24, 1.4]`, `[0, 0, 0, 0, 0, 0, 0.18, 0.22, 0.28]` |
| 거울 회로 | `orbFusions.mirrorCircuit`의 `damageByLevel`, `intersectionDamage` | `[0.22, 0.24, 0.27, 0.31, 0.36, 0.41, 0.47, 0.55, 0.65]`, `1.4` |
| 융해 코어 | `orbFusions.meltdownCore`의 `damageByLevel`, `meltdownDamageByLevel` | `[0.18, 0.2, 0.22, 0.25, 0.29, 0.34, 0.4, 0.48, 0.58]`, `[1.6, 1.8, 2, 2.2, 2.5, 2.8, 3.2, 3.7, 4.4]` |
| 벡터 블레이드 | `orbFusions.vectorBlade.damageByLevel` | `[0.75, 0.82, 0.9, 1, 1.1, 1.22, 1.36, 1.52, 1.75]` |

- 보조 피해 라벨 상한은 `GAME_TUNING.visual.coreFeedback.maximumDamageLabels = 18`, 수명은 `damageNumberDurationMs = 260`이다.
- 첫 레벨 XP는 `src/game/progression/progressionRules.ts`의 `xpRequiredForLevel(0) = 5`다. 이후 곡선은 `12 + level * 5`다.

## 변경 규칙

1. 공통 수치는 `GAME_TUNING`, 특정 스테이지만 다른 수치는 `STAGES`에 둔다.
2. 새 값은 같은 파일의 검증 함수와 테스트를 함께 추가한다.
3. 기본 코어 배열은 5개, 융합 구슬 배열은 9개 값을 둔다.
4. `expectedOrbCount`는 혼합 XP 보상의 목표 구슬 성장 속도를 반영한다.
5. 수치 변경 뒤 단위 테스트, 빌드, 관련 E2E 순서로 검증한다.
6. 최초 편성은 별도 레시피를 사용하므로 단계별 증원 수치 변경의 영향을 받지 않는다.
7. 일반전 페이즈와 보스 진입은 시간 제한 없이 처치 점수만 사용한다. 기본 적 `1`, 장갑·슈터·분열 적 `2`, 분열 잔체 `0`점이다.

## 융합 레시피

| 재료 | 결과 |
| --- | --- |
| 관성 + 전도 | 광자 궤도 |
| 전도 + 분열 | 공명 군체 |
| 부식 + 분열 | 나노 증식체 |
| 부식 + 관성 | 질량 붕괴탄 |
| 반향 + 폭발 | 반응로 구슬 |
| 폭발 + 분열 | 성단 폭격체 |
| 반향 + 전도 | 거울 회로 |
| 폭발 + 부식 | 융해 코어 |
| 관성 + 반향 | 벡터 블레이드 |
