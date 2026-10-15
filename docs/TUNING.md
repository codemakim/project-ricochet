# 튜닝 값 관리

밸런스 값을 새로 만들거나 바꿀 때 아래 단일 원본을 사용한다.

| 범위 | 단일 원본 | 예시 |
| --- | --- | --- |
| 전투 전반 | `src/game/config/gameTuning.ts`의 `GAME_TUNING` | 적 기본 체력·하강 속도, 능력 배율, 최대 구슬 수, 보상 간격 |
| 편대 배치 | `src/game/encounters/authoredFormations.ts`의 `AUTHORED_FORMATIONS` | 6열 기반 적 종류·위치·크기 |
| 스테이지별 구성 | `src/game/encounters/stageDefinitions.ts`의 `STAGES` | 문단 순서, 편대 ID, 진입 깊이, 체력 배율·활성 상한, 보스 |
| 런 밖 경제 | `src/game/meta/metaTuning.ts`의 `META_TUNING` | 부품 보상, 코어 해금 비용 |
| 오디오 | `src/game/audio/audioTuning.ts`의 `AUDIO_TUNING`, `COMBAT_SOUNDS` | 음악·효과음 음량, 반복 제한, 동시 재생, 컴프레서, 합성 음색·템포 |

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
| 편대 배치와 문단 순서 | `AUTHORED_FORMATIONS`, `STAGES[].paragraphs[].formationIds` |
| 다음 편대 생존율·빈 전장 지연 | `GAME_TUNING.encounter.nextFormationRemainingRatio`, `emptyRespawnMs` |
| 문단별 진입 깊이·체력·활성 상한 | `STAGES[].paragraphs[]` |
| 고속 진입 속도 | `GAME_TUNING.encounter.emergencyIngress.speed` |
| 플레이어 외형·피격 반경 | `GAME_TUNING.player.visual` |
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
| 보스 진입 페이드 수명·시작 투명도 | 같은 파일의 `BOSS_ENTRANCE` |
| 구슬 레이어 회전·맥동·궤도·프레임 속도 | `src/game/visuals/orbVisualProfiles.ts`의 `ORB_VISUAL_PROFILES` |
| 구슬 레이어·파티클·모바일 오브젝트 상한 | `GAME_TUNING.visual.orbAnimation` |
| 제작 VFX 투명도·전체 상한·최대 수명 | `GAME_TUNING.visual.productionVfx` |
| VFX별 수명·크기·동시 상한 | `src/game/visuals/combatVfxProfiles.ts`의 `COMBAT_VFX_PROFILES` |
| HUD 안전 영역·간격·피격 강조 | `src/styles.css`의 `.combat-hud`, `src/game/ui/CombatHud.ts` |
| 적 공격 표시 순서 | `src/game/constants.ts`의 `HOSTILE_ACTION_DEPTH` |

현재 실제 게임 기준값은 일반 적 HP `3.9/5.2/9.1/2.6`, 장갑 적 HP `12`, 적 하강 `9.6px/s`, 영구 구슬 속도 `520px/s`다. 개발자 모드의 `1`은 이 기준값 그대로를 뜻한다.

## 모션·VFX 기본값

오디오: 기본 음량 `0.65`, 음악 `0.38`, 보스 레이어 `0.32`, 선택창 음악 배율 `0.3`,
효과음 동시 상한 `12`. 음색·템포 변경 시 `pnpm assets:audio`로 WAV를 재생성한다.
재생 음량·반복 제한만 바꾸면 재생성할 필요 없다. 종료음 재생을 위해 결과 화면은
오디오가 켜져 있을 때 최대 `900ms` 뒤 표시한다.

| 범위 | 값 |
| --- | --- |
| 액터 대기/이동 | `6fps`, 반복 |
| 액터 반응 상태 | `10fps`, 1회 재생; 2~4프레임이라 `0.2~0.4초` |
| 구슬 레이어 | 프로필별 회전 `0.7~2.2rad/s`, 맥동 `480~840ms`, 궤도 `680~760ms`, 프레임 `7~12fps` |
| 구슬 시각 상한 | 구슬당 레이어 4, 파티클 3, 모바일 전체 48 |
| 제작 VFX | 알파 `0.08~0.9`, 모바일 64, 데스크톱 96, 최대 수명 `2500ms` |
| VFX 프로필 | 36종 모두 8프레임. 일반 `320ms/동시 8`, 지속형 `640ms/동시 4`; 효과별 수명·크기는 `COMBAT_VFX_PROFILES` |

가독성 1차 조정: 발사 `240ms/배율 0.8/알파 0.45/동시 2`, 회수
`280ms/배율 1/알파 0.48/동시 2`, 직격·적 피격 `200ms/배율 0.9`.
기본 알파는 일반 `0.68`, 지속형 `0.38`; 보스 격파는 `0.82`를 유지한다.
적 탄·보스 공격 depth `8`, VFX `6`, 조준선 `9`. 물리 크기·피해·속도는 바꾸지 않는다.
HUD는 캔버스 밖 `84px` 행을 사용한다. 음소거는 HUD 안에 배치하며 터치 높이 `44px`를 유지한다.
피격 강조는 HUD만 `280ms` 동안 반응하며 `prefers-reduced-motion: reduce`에서는 생략한다.

보스 진입은 `BOSS_ENTRANCE`의 `420ms/알파 0.7→1`을 사용하며, 위치·충돌·공격 시점은 유지한다.
reduced-motion에서는 진입 페이드와 HUD 진입 모션을 생략한다. 경고 진행률은 현재 스테이지의
`boss.warningMs`를 읽는다. 격파 효과는 프로필 `900ms/배율 3.75`로 재생을 마친 후 보상/결과를 연다.
숨긴 탭에서는 제작 VFX 애니메이션도 멈추고, 선택창에서는 애니메이션 완료 이벤트로 제거한다.
순간 선·고리·피해 숫자는 기존 `maximumDamageLabels = 18` 상한을 공유하고 선택창 진입 시 정리한다.
게임플레이 타이머와 이동 tween은 모든 전투 일시정지에서 함께 멈춘다.

독·나노·클러스터·융해의 지속 장판은 해당 `COMBAT_VFX_PROFILES`의 프레임 속도·크기 배율·알파를 사용한다.
표시 지름은 판정 반경 × 2 × 프로필 배율, depth는 `3`이다. 수명·개수 상한은 기존 장판 상태가 관리한다.
프레임과 부착 위치는 게임 시간으로 갱신하므로 선택창·숨긴 탭에서 멈춘다. 순간 VFX의 동시 상한과는 별개다.
기존 `visual.coreFeedback.corrosionFieldAlpha`, `corrosionLineAlpha`, `corrosionTickDurationMs`는 새 독 표현에 적용되지 않는다.
분열·공명 임시 자탄은 `ORB_VISUAL_PROFILES`의 본체 원화를 사용하며 표시 크기·충돌 반경·수명은 기존 자탄 튜닝을 유지한다.
광자·거울 지속 선은 `photon-beam`을 선분 중심·방향·길이에 맞춰 표시하고 장판과 같은 게임 시간으로 갱신한다.
광자·벡터 순간 효과는 길이 축만 늘린다. 클러스터 탄체는 제작 프로필 크기·알파를 사용하며 이동 tween 진행률에 맞춰 8프레임을 재생한다.

액터 모션과 VFX는 판정·피해·공격 발동 타이밍을 소유하지 않는다. 격파 뒤 보상 전환은 격파 VFX 완료를 기다린다. 밸런스는 기존 전투 소유자에서, 표현 상한과 수명만 위 위치에서 조정한다.

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
6. 최초 편성을 포함한 일반전은 `STAGES[].paragraphs[].formationIds`의 10개 편대를 사용한다.
7. 마지막 편대가 끝나고 일반 적이 모두 사라지면 보스 경고를 시작한다. 처치 점수·시간 게이트는 없다.

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
# 2026-09-17 전투 시험판

일반 출격은 `src/game/run/combatTrial.ts`의 단일 전투판 사용. 기존 3스테이지·메타는 개발용 메뉴 및 `?campaign=1`에 보존.

- 시작 3개, 최대 6개. 폭발·분열·부식 중 선택. 시험판은 메타 저장·부품 정산에 영향 없음.
- 일반 적 HP 1.482 → 후반 2.0748. 장갑 적 HP 6. 사격 적은 세 번째 편대부터 등장.
- 총 6편대. 잔여 적이 있을 때 증원 최소 10초, 최대 대기 20초 후 수용량 허용 시 증원. 전멸 뒤 1.2초 휴식.
- 보스는 마지막 편대 전멸 또는 전투 시간 120초에 예고. 시간 제한 시 잔여 적 철수. 보스전에는 강제 승리 타이머 없음. 약 3분은 목표 길이.
- SENTINEL 양쪽 약점 HP 각 12, 코어 30. 격파 즉시 이번 출격 완료.
- 경험치 요구량 4/8/12/16/20. 카드 한 번 선택으로 구슬 추가, 최대 개수에서는 선택 종류 전체 +1레벨. 융합·일반 능력은 시험판 제외.
- 근접 회수 반경 72, 회수 뒤 첫 타격 +50%. 처치 관통, 4.8초 비행 후 자동 복귀.
- 배경 밝기 38%, SENTINEL v3 큰 면·주황 약점. 고정된 idle과 크기 유지로 픽셀 흔들림 완화.
- 음악·반복 발사 재생 게인 감소. 음색 재제작·사람의 청음 평가는 이번 범위 밖.

## 2026-10-15 PC 아트 첫 적용

- 배경은 우주 반사 경계로 교체하고 알파 1을 사용한다. 위 시험판의 38% 값은 이전 아트 기준이다.
- 플레이어·기본 적은 smooth 256×256 / 280×240 프레임을 사용한다. 표시 크기와 월드 판정은 그대로다: 플레이어 원 지름 40, 기본 적 70×60.
- 시험판 구슬 3종은 256px 프레임 안의 160px 중심핵과 에너지 테두리로 표현한다. 표시 외곽 42px와 판정 지름 32px는 유지한다.
- 부식 효과는 평면 나노 입자장 8프레임, 알파 0.6·표현 배율 1.1이다. 피해 범위·틱·수명은 유지한다.
- 원화·프롬프트와 출력 방법은 `assets-source/combat/pc/README.md`, 중심핵 크기는 `scripts/build_pc_combat_art.sh`의 `ORB_BODY_SIZE`에 둔다.

## 2026-10-15 개발 전투 테스트실 및 PC 확장

- 적 1체·고정 밀집 편대·SENTINEL 직접 시작. 자동 증원·XP 성장·메타 정산은 적용하지 않는다.
- 구슬 15종, 1~6개, 기본 1~5/융합 1~9레벨. HP 배율 0.1~100, uint32 시드. 기본 폭발3개/1레벨/HP×1/시드42/무적 ON.
- HP·피해·발동 확률은 시험판 규칙을 사용한다. 일반 적 위치 고정, 사수와 보스 공격은 유지한다.
- 장갑 적·사수·SENTINEL 소스 해상도를 늘리고 linear sampling 사용. 월드 판정은 장갑140×120, 사수70×60, 본체252×144, 약점56×120, 코어56×56 유지.

## 2026-10-15 기본 구슬6종 PC 통일

- 반향: 푸른 단일 렌즈·파동, 에너지720ms 맥동. 전도: 보라 마름모 핵·전기 아크, 에너지340ms 점멸. 관성: 호박색 고밀도 핵·적도 띠, 에너지 반시계2.2rad/s.
- 기본6종 모두 256px 본체/에너지 각1장, 중심핵160px 출력, 표시42px/판정32px 유지. 피해·발동·성장·저장은 변경하지 않는다.
- 정확한 생성 프롬프트는 `assets-source/combat/pc/base-orb-prompts.md`. 기존 변환기로 출력하며 융합9종·발동 VFX는 이번 범위 밖이다.

## 2026-10-15 융합 구슬9종 PC 통일

- 융합도256px 본체/에너지 각1장·중심핵160px·표시42px/판정32px 사용. 레이어는2장에서1장으로 감소. 실제 피해·발동·융합 조합·레벨·저장은 유지한다.
- 회전: 광자 시계1.8rad/s, 공명 반시계1.3rad/s, 성단 시계0.8rad/s, 융해 시계1.1rad/s. 맥동: 나노840ms, 질량620ms, 반응로540ms, 거울900ms, 벡터380ms.
- 질량의 밝은 외곽은 본체에 포함해 에너지 최소 알파에서도 위치를 읽게 한다. 광자는 큰 둥근 렌즈를 제거했고, 벡터 에너지층의 중앙은 비워 과노출을 줄였다.
- 원본·생성/수정 프롬프트는 `assets-source/combat/pc/fusion-orb-prompts.md`, 종류별 형태는 같은 폴더 `README.md`에 기록한다. 발동 VFX와 legacy 물리 소유 스프라이트는 별도 경로다.

## 2026-10-15 분열 적/조각 PC 교체

- 모체는560×240/14프레임, 좌우 조각은280×240/7프레임. 정규화한 모체 원화에서 중앙 결합부28px씩을 제외하고 좌우 기체를 추출한다. 정적 폴백과 액터 시트 모두 linear sampling 적용.
- 모체 fracture3–5프레임은 알파75/50/25%, split6–9는80/60/40/20%. 모체 잔상이 새 조각을 가리지 않도록 짧게 사라진다.
- 월드 판정은 모체140×60, 조각 각각70×60 유지. 분열 위치·체력·속도·개체 수·XP 보상은 기존 규칙 그대로다.

## 2026-10-15 Hive/Siege PC 교체

- Hive 코어448×448/14프레임, 사격부280×224/14, 반사판144×768/12. 표시112×112·70×56·36×192, 판정96×96·70×56·36×192 유지.
- Hive 생성 시 소스 프레임→월드 판정 배율을 보정하고 즉시 body를 동기화한다. 광폭화의 기존±10% 맥동은 기본 표시 배율0.25에 곱한다. 표시/판정이 소스448px로 커지지 않는다.
- Siege 본체504×288/12, 약점112×240/11, 코어256×256/14. 표시252×144·56×120·64×64, 코어 판정56×56 유지. 장갑 파괴 전 코어 비활성, 피해 배율0.45·체력·공격 규칙 유지.
- 좌우 사격부·반사판·포격부는 미러 출력. 정확한 프롬프트는 `assets-source/combat/pc/boss-expansion-prompts.md`. 기존 고정 포즈·피격 tint·파괴 fade를 재사용한다.
- Hive/Siege는5% 알파 경계로 희미한 외곽 잔픽셀을 제외하고 기존 파츠 비율에 맞춰4px 여백으로 정규화한다. 가시 실루엣이 프레임 가로/세로90% 이상을 차지하는지 출력기에서 검사한다.
