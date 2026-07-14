# 코어 리디자인 프로토타입 승인 기록 — 2026-07-13

## 판정

- 자동 test suite: **통과**. 단위 테스트 74/74, 브라우저 E2E 8/8, production build가 통과했다. Spec 18.1은 12개 PASS, prototype 범위 밖인 항상 유지 능력 1개 PARTIAL이다.
- 코어 루프 재미 승인: **보류**. 사용자 직접 플레이가 없으므로 주관 점수와 수동 승인 기준은 평가하지 않았다.
- 이 기록의 `미측정`과 `미평가`는 현재 세션에서 결과를 얻을 수 없었다는 확정 기록이다.

## 측정 기준점

| 항목 | 기록 |
| --- | --- |
| 검증 대상 commit | `0c71cabd32d8f0c52c6cda61c66f4991816bbd9e` (`test: observe stable collision outcome`) |
| 호스트 | macOS 26.5.1 |
| 도구/브라우저 | Playwright 1.61.1, Chromium 149.0.7827.55 device descriptor |
| 데스크톱 | `desktop-chromium`, Desktop Chrome emulation, viewport `1280x720` |
| 모바일 자동 검증 | `mobile-chromium`, Pixel 7 emulation, viewport `412x839` |
| 논리 게임 화면 | `450x800`, 세로형 |
| 실제 휴대폰 | **미검증** — 사용 가능한 physical phone이 없었음 |
| 기본 실험값 | `passThroughOnKill=false`, `homeOnBottomHit=true`, `autoReturnAfterMs=null` |

Desktop Chrome과 Pixel 7은 macOS에서 실행한 Chromium emulation context다. Pixel 7 통과를 실제 Android 기기 통과로 해석하지 않는다.

## 자동 검증 결과

2026-07-13 문서 작성 후, commit 전 상태(`0c71cab` 코드 + untracked 승인 기록)에서 실행한 최종 evidence set:

| 검증 | 결과 | 확인 범위 |
| --- | --- | --- |
| `npm test` | PASS — 11 files, 74/74 tests | 이동 경계, 조준/반사선 계산, 구슬 상태·대기열·회수, 피해/반사, 적 상한, 입력 변환 등 |
| `npm run test:e2e` | PASS — 8/8 (`desktop-chromium` 7, `mobile-chromium` 1), 9.7s | 데스크톱 이동/조준/3구슬 cadence, 두 회수 경로, 두 처치 설정, 압박 상한, visibility, 피해/패배/재시작, emulated touch |
| `npm run build` | PASS — 20 modules, 475ms | TypeScript와 production bundle 생성 |
| production debug audit | PASS — `debugPlaceOrb`, `debugFreezeEnemies`, `debugSetHealth`, `debugDamage`가 `dist/`에 없음 | DEV helper production 유출 없음 |

Build는 Phaser bundle `1,220.48 kB`에 기존 500 kB chunk-size warning을 냈지만 exit code는 0이었다.

압박 E2E는 250ms 간격 20회, 총 5초의 accelerated-clock sample에서 실제 시간 진행과 최소 한 번의 shooter warning 또는 bullet을 확인했다. 테스트가 peak 값을 출력·보존하지 않으므로 관측 최대치를 만들지 않는다. 기록 가능한 결과는 `activeShooters <= 2`, `bullets <= 12` assertion 통과다.

Cadence E2E는 5ms polling과 첫 발사 90ms, 후속 단계 140ms timeout을 사용해 `1 active / 2 queued`, `2 / 1`, `3 / 0` 순서를 확인했다. 로컬에서 통과했으나 과부하 CI에서는 wall-clock bound가 민감할 수 있는 경미한 위험이 남는다.

Task 8의 agent visual observation: 당시 desktop/Pixel 7 emulation screenshot에서 세로 scaling, HP text, 20-enemy formation, player/enemy 색 구분, dashed first-bounce guide가 보이고 판독 가능했다. Screenshot은 보고 후 삭제됐으며, 이는 사용자 재미·조작 점수가 아니다.

## 정량 수동 결과

| 지표 | 결과 | 미측정 이유 | 다음 사용자 플레이 절차 |
| --- | --- | --- | --- |
| 첫 breach 전 20-enemy clear percentage | **미측정** | 사용자 숙련 플레이가 없었고, 현재 기본 대형은 14 basic/3 armored/3 shooter라 spec의 “공격하지 않는 약한 적 20마리”와 정확히 같지 않음 | 먼저 20 basic, 공격 비활성, 기존 위치·하강 속도 유지 fixture를 준비한다. 사용자가 조작 연습 후 3회 플레이하고 첫 breach 직전 제거 수를 기록한다. 각 run은 `제거 수 / 20 * 100`; 승인에는 80% 이상 필요 |
| 모든 구슬이 밖에 있는 최장 시간 | **미측정** | 실제 사용자 run의 연속 상태 시간을 수집하지 않았음 | 기본 설정 5분 run을 화면 녹화하거나 snapshot logger로 기록한다. 세 구슬이 모두 회수/대기 상태가 아닌 순간부터 하나가 회수될 때까지 각 구간을 재고 최댓값을 기록한다. 3초 초과 구간에서는 이동/회수로 흐름을 되찾았는지도 메모 |
| proximity/floor recovery ratio | **미측정** | 자동 테스트는 두 경로의 동작만 각각 증명하며 자연 플레이 빈도는 측정하지 않음 | 기본 설정 5분 run에서 recovery transition마다 `proximity` 또는 `floorRecall`을 1회 집계한다. `proximity:floorRecall` 개수와 각 비율을 기록 |
| 관측 peak activeShooters / bullets | **미측정** | E2E가 20개 sample에 상한 assertion을 적용했지만 `peakShooters`와 `peakBullets` 값을 출력하거나 artifact로 보존하지 않음 | focused pressure E2E가 두 peak를 출력하거나 artifact로 첨부하게 한 뒤 같은 20회 x 250ms sample을 실행한다. 생성된 두 값을 이 기록에 그대로 복사한다 |
| physical phone behavior | **미측정** | physical phone 없음; Pixel 7 emulation만 실행 | 같은 Wi-Fi의 실제 휴대폰에서 dev server LAN URL을 연다. 두 엄지 동시 이동/조준, aim 유지, 첫 반사선, 3구슬 순환, 회수, 패배/재시작, background/resume를 5분 확인하고 기기/OS/브라우저/viewport를 기록 |
| sound/feel | **미측정** | 정식 사운드는 prototype 범위 밖이며 사용자 hands-on 감각 평가도 없었음 | 헤드폰 또는 기기 speaker 상태를 기록하고 5분 플레이한다. 현재 무음 여부와 타격·회수·피격의 감각 피드백 충분성을 별도 메모 |

## 1–5 사용자 평가

모든 항목은 사용자 hands-on 결과가 필요하다. Agent visual observation이나 자동 assertion을 점수로 변환하지 않는다.

| 항목 | 점수 | 상태/이유 | 다음 절차 |
| --- | --- | --- | --- |
| 조준 신뢰도 | — | **미평가** — 조준 의도와 체감 결과는 사용자 판단 필요 | desktop 5분과 phone 5분 뒤 “의도한 진입 방향과 실제 방향이 일치했는가”를 1–5로 채점 |
| 이동 피로도 | — | **미평가** — desktop 및 mobile 지속 조작 필요 | 각 입력 방식 5분 연속 플레이 직후 피로도를 1–5로 채점 |
| 회수 만족감 | — | **미평가** — 자연 발생 proximity/floor recovery 체감 필요 | 기본값 5분 run 뒤 직접 회수와 floor recall 체감을 함께 고려해 1–5로 채점 |
| 기다림 정도 | — | **미평가** — 실제 all-orbs-out 구간 체감 필요 | 최장 all-orbs-out 시간을 측정한 같은 run 직후 기다림 허용도를 1–5로 채점 |
| 연쇄 반사 볼거리 | — | **미평가** — 사용자 전투 run 필요 | 첫 breach까지 3회 run 뒤 연쇄 반사의 가독성과 볼거리를 1–5로 채점 |
| 압박 공정성 | — | **미평가** — shooter/bullet 상한 통과만으로 공정성을 판정할 수 없음 | 기본값 5분 run 3회 뒤 회피 가능성과 사전 경고를 기준으로 1–5 채점 |
| 한 판 더 하고 싶은 정도 | — | **미평가** — 사용자 의향 질문 필요 | 측정 session 종료 직후 추가 run 의향을 1–5로 직접 기록 |

점수 기준: 1은 매우 나쁨/매우 피로함/매우 불공정함, 5는 매우 좋음/거의 피로하지 않음/매우 공정함으로 질문 문구를 항목에 맞춰 고정한다.

## 사용자 입력표

다음 play session 직후 작성한다.

| 환경/지표 | 입력 |
| --- | --- |
| 기기 / OS / 브라우저 / viewport |  |
| run 길이 / 연습 run 수 / 측정 run 수 |  |
| 첫 breach 전 제거 수와 percentage (각 run) |  |
| 최장 all-orbs-out 시간 / 3초 초과 후 회복 여부 |  |
| proximity 횟수 / floorRecall 횟수 / 비율 |  |
| peak activeShooters / peak bullets artifact 값 |  |
| 조준 신뢰도 / 이동 피로도 / 회수 만족감 (각 1–5) |  |
| 기다림 / 연쇄 반사 볼거리 / 압박 공정성 (각 1–5) |  |
| 한 판 더 하고 싶은 정도 (1–5) |  |
| sound/feel 메모 |  |
| 관측 문제와 재현 단계 |  |

## 재현 URL

### Mac 로컬 desktop

```bash
npm run dev -- --host 127.0.0.1 --port 4173
```

- 기본값: <http://127.0.0.1:4173/> 또는 <http://localhost:4173/>
- `passThroughOnKill`만 변경: <http://127.0.0.1:4173/?passThroughOnKill=true> 또는 <http://localhost:4173/?passThroughOnKill=true>
- `homeOnBottomHit`만 변경: <http://127.0.0.1:4173/?homeOnBottomHit=false> 또는 <http://localhost:4173/?homeOnBottomHit=false>

### Physical phone

2026-07-13 확인한 Mac `en0` LAN IP는 `192.168.35.31`이다. IP는 DHCP/network 변경 후 달라질 수 있으므로 session 시작 전에 `ipconfig getifaddr en0`로 다시 확인한다.

```bash
npm run dev -- --host 0.0.0.0 --port 4173
```

- 기본값: <http://192.168.35.31:4173/>
- `passThroughOnKill`만 변경: <http://192.168.35.31:4173/?passThroughOnKill=true>
- `homeOnBottomHit`만 변경: <http://192.168.35.31:4173/?homeOnBottomHit=false>

Phone과 Mac은 같은 Wi-Fi/LAN에 있어야 한다. 접속 실패 시 macOS firewall의 Node 허용과 AP client isolation/VPN을 확인한다.

한 비교에서는 URL 한 항목만 바꾸고 대형, 속도, 구슬 수, 플레이 시간을 유지한다. `autoReturnAfterMs`는 현재 parser가 항상 `null`로 고정하므로 query 비교 대상이 아니다.

## Spec 18.1 자동 검증 매핑

| 검증 항목 | 상태 | 자동 근거 / test module | gap |
| --- | --- | --- | --- |
| 2D 이동 경계와 상단 진입 제한 | **PASS** | `src/game/player/playerRules.test.ts`: diagonal speed, spawn exclusion clamp; `e2e/combat.spec.ts`: desktop two-axis movement | Browser E2E는 모든 경계를 순회하지 않으며 pure rule test가 경계를 담당 |
| 마지막 유효 조준 방향 유지 | **PASS** | `src/game/player/playerRules.test.ts`: zero vector retains aim; `e2e/combat.spec.ts`: desktop mouse/mobile touch release 후 aim 유지 | 사용자 조준 신뢰도는 수동 |
| 첫 벽 반사 조준선 계산 | **PASS** | `src/game/aim/trajectory.test.ts`: top-first와 side-first reflected segment | 실제 화면 판독성은 agent visual observation만 있고 사용자 평가는 없음 |
| 발사 대기열 순서와 간격 | **PASS** | `src/game/orbs/launchQueue.test.ts`: unique IDs, 100ms, absolute deadlines; `e2e/combat.spec.ts`: `1/2`, `2/1`, `3/0` cadence | E2E wall-clock bound의 경미한 CI 민감성 |
| 구슬 상태 전환과 중복 등록 방지 | **PASS** | `src/game/orbs/orbRules.test.ts`: illegal transition rejection; `src/game/orbs/OrbManager.test.ts`: three permanent orbs queued once | 장시간 자연 플레이 중복 여부는 별도 endurance test 없음 |
| 직접 흡수 거리·시야 조건 | **PASS** | `src/game/orbs/OrbManager.test.ts`: inside 50px + fixed-terrain LOS 조건, stale body-center 방어 | E2E proximity는 deterministic 5px placement이며 자연 빈도는 미측정 |
| 바닥 귀환의 무충돌·무공격 상태 | **PASS** | `src/game/orbs/OrbManager.test.ts`: world-bound recall 즉시 body disable; `e2e/combat.spec.ts`: returning collision/damage false | Physical phone에서의 체감은 미검증 |
| 회수 원인별 보너스 발동 여부 | **PASS** | `src/game/orbs/orbRules.test.ts`: pickup bonus는 proximity만 허용; `src/game/orbs/OrbManager.test.ts`: recovery source/charge restore | 실제 ability content는 prototype 범위 밖 |
| 충전 횟수, 직접 피해 배율, 항상 유지 효과 | **PARTIAL** | `src/game/orbs/orbRules.test.ts`: 3-charge direct hit 1.5 damage, uncharged 1 damage; `e2e/combat.spec.ts`: charge `3 -> 2` | 충전 횟수와 직접 피해는 PASS. 항상 유지 능력은 prototype 범위 밖이고 runtime representation/test가 없어 미검증 |
| 처치 후 반사 설정과 관통 우선순위 | **PASS** | `src/game/orbs/orbRules.test.ts`: kill setting과 piercing override; `e2e/combat.spec.ts`: default/`passThroughOnKill=true` 실제 Arcade 방향 | 완성판 관통 능력은 범위 밖 |
| 동시 공격자와 탄환 수 상한 | **PASS** | `src/game/enemies/enemyRules.test.ts`, `src/game/enemies/EnemyManager.test.ts`; `e2e/combat.spec.ts`: 20 x 250ms sample에서 `<=2`, `<=12` | 실제 peak 숫자는 출력/보존되지 않아 미측정 |
| 체력, 무적 시간, 돌파 피해 | **PASS** | `src/game/combat/health.test.ts`: health/shield/defeat/breach/invulnerability; `src/game/enemies/EnemyManager.test.ts`: breach kind; `e2e/combat.spec.ts`: live 600ms invulnerability/defeat/restart | 5분 압박 공정성은 수동 |
| 데스크톱과 모바일 입력 변환 | **PASS** | `src/game/input/pointerRoles.test.ts`: dual-stick role/normalization; `e2e/combat.spec.ts`: real keyboard/mouse와 emulated touch | Physical phone 미검증 |

13/13 항목을 매핑했다. 결과는 12 PASS, 1 PARTIAL이다. 통과한 기능 assertion도 코어 루프 재미 승인이 아니다.

## Spec 18.2 직접 검증 매핑

| 직접 검증 항목 | 자동 support evidence | 수동 상태 | 다음 사용자 절차 |
| --- | --- | --- | --- |
| 모바일 두 엄지 조작 피로도 | Pixel 7 emulation에서 stable pointer ID 두 개의 동시 이동/조준 E2E 통과 | **미평가** — physical phone hands-on 없음 | LAN URL로 실제 phone에서 5분 연속 조작 후 피로도 1–5와 불편한 엄지/동작 기록 |
| 캐릭터와 구슬 동시 추적 가능 여부 | E2E snapshot에 player와 3 orb가 동시에 존재함을 확인; 자동화는 시선 추적을 판단하지 않음 | **미평가** — 시선 추적/사용자 판단 없음 | desktop과 phone 각 5분 플레이 후 놓친 player/orb 상황과 빈도를 기록 |
| 원하는 적 대형을 조준해 공략 가능 여부 | desktop aim/launch와 지정 basic enemy collision E2E 통과 | **미평가** — deterministic target은 사용자 선택이 아님 | 사용자가 시작 전 목표 column/row를 정해 3회 시도하고 의도한 첫 진입 및 제거 성공 여부 기록 |
| 약한 적 대형의 연쇄 반사 붕괴 | 20-enemy formation unit test와 단일 collision 안정성 E2E 통과 | **미측정** — exact weak/non-attacking fixture run 없음 | 20 basic/non-attacking fixture에서 첫 breach까지 3회 run, 제거 순서와 percentage를 녹화/기록 |
| 직접 회수를 위한 자연스러운 이동 | 5px deterministic proximity recovery E2E와 50px/LOS unit test 통과 | **미평가** — 자연 이동 회수 빈도 없음 | 기본값 5분 run에서 의도적으로 직접 회수하러 이동한 횟수와 포기한 횟수, 체감 이유 기록 |
| 바닥 귀환 ON에서도 직접 회수 가치 유지 | proximity와 floorRecall 기능 E2E, `homeOnBottomHit=false` parser/unit support | **미평가** — 두 설정의 사용자 비교 없음 | 기본값과 `homeOnBottomHit=false`를 각 5분, 순서 교차해 플레이하고 회수 ratio·만족도·흐름 단절 비교 |
| all-orbs-out 3초 초과 시 흐름 회복 | 회수/재발사 state와 두 recovery path 자동 통과 | **미측정** — 연속 duration 없음 | snapshot logger/녹화로 기본값 5분 run의 모든 all-orbs-out 구간을 재고, 3초 초과마다 회복 방법과 시간을 기록 |
| 5분 동안 필연적 죽음 느낌 없음 | shooter/bullet caps, 600ms invulnerability, defeat/restart E2E 통과 | **미평가** — 생존 가능성과 공정성은 자동 상한으로 판정 불가 | 기본값 5분 run 3회 후 사망 시각/원인, 회피 가능성, 압박 공정성 1–5 기록 |

8/8 항목 모두 사용자 직접 결과가 남아 있다. 자동 evidence는 절차가 작동함을 지원할 뿐 직접 검증을 대체하지 않는다.

## Spec 18.3 리디자인 프로토타입 승인 상태

| 승인 기준 | 자동 근거 | 현재 판정 |
| --- | --- | --- |
| 조준 방향과 구슬 진입 방향 일치 | desktop/mobile aim 유지와 launch, collision 방향 E2E 통과 | **자동 통과**; 사용자 조준 신뢰도는 수동 보류 |
| 공격하지 않는 약한 적 20마리의 80%를 첫 breach 전 제거 | 해당 정확한 fixture와 사용자 run 없음 | **수동 미측정** |
| breach 전 대응 시간 존재 | 자동화가 하강은 확인했지만 사용자 대응 시간은 측정하지 않음 | **수동 미평가** |
| 회수와 재발사의 빠른 순환 | 100ms queue cadence와 proximity/floor recovery E2E 통과 | **기능 자동 통과**; 체감 속도는 수동 보류 |
| 실험 변경 차이를 즉시 비교 가능 | query parsing과 두 `passThroughOnKill` collision E2E 통과; 비교 URL 제공 | **기능 자동 통과**; 차이의 체감 명확성은 수동 보류 |
| 모바일/데스크톱 조작 이해 가능 | 두 입력 경로 E2E 통과 | **입력 자동 통과**; 실제 이해도와 physical phone은 수동 보류 |
| 코어 루프 승인 전 로그라이트/보스 미구현 | 현재 prototype 범위에 없음 | **범위 준수**; 코어 루프 승인은 보류 |

## 관측 문제

현재 자동 실행에서 새 기능 결함은 관측되지 않았다. 알려진 검증 위험은 cadence의 좁은 wall-clock CI bound, physical phone 미검증, production chunk-size warning이다.

## Next decision

다음 결정은 사용자 play session 데이터 뒤에만 한다. 우선순위는 정확한 20-basic/non-attacking acceptance fixture 확보, physical phone 확인, 위 표의 정량값과 1–5 점수 수집이다. 그 전에는 tuning 제안, 로그라이트 콘텐츠, boss 구현으로 넘어가지 않는다.

## 2026-07-14 Continuous ingress automation

- Initial formation: 20
- Reinforcement: 6 enemies after 8 seconds after four enemies are removed, leaving six capacity slots
- Original and reinforcement IDs coexist: verified by Playwright
- Unit tests: 14 files, 93/93 tests passed
- Desktop/mobile E2E: 9/9 passed (`desktop-chromium` 8, `mobile-chromium` 1)
- Production build: `tsc --noEmit && vite build` exit 0, 23 modules transformed
- Physical-device density and aim-fatigue check: pending user playtest

## 2026-07-14 Level-up power growth acceptance

Commit 전 Task 9 acceptance 상태에서 실행한 fresh evidence:

| 검증 | 결과 | 확인 범위 |
| --- | --- | --- |
| `npm test` | **PASS** — 20 files, 126/126 tests | XP와 레벨, 선택지, 네 능력의 1~5등급 수치, 합성 pause, 폭발, 분열, 기존 전투 규칙 |
| `npm run test:e2e -- --grep "level-up\|temporary split\|explosion damage"` | **PASS** — 7/7 | desktop 레벨업/pause/폭발/분열 6개와 Pixel 7 emulation 카드 탭 1개 |
| `npm run test:e2e` | **PASS** — 16/16 | `desktop-chromium` 14개, `mobile-chromium` 2개. 기존 ingress, 회수, 충돌, 체력, 입력과 성장 acceptance |
| `npm run build` | **PASS** — TypeScript 성공, Vite 29 modules transformed | production bundle 생성. 기존 `1,235.50 kB` chunk-size warning은 유지되며 exit code 0 |
| production DEV audit | **PASS** — mutation helper 6개와 `__RICHOCHET_GAME__` match 없음 | `debugGrantXp`, `debugChooseAbility`, `debugUpgradeAbility`, `debugSetEnemy`, `debugPlaceOrb`, `debugRemoveEnemies`, game global 미노출 |

첫 레벨 목표는 평균 **15~20초**다. 초기 능력 풀은 `화력 증폭`, `운동 에너지`, `폭발`, `분열` 네 개이며 첫 선택 화면은 중복 없는 최대 3개와 `폭발` 또는 `분열` 최소 하나를 보장한다. 자동 테스트는 8 XP 레벨업 정지, 숫자 선택, Pixel 7 emulation 카드 탭, 복수 pending 선택, visibility와 level-up 중첩, max-rank XP 중단, defeat/restart 초기화를 확인했다. 숨김 해제 직후 첫 resume delta 폐기 뒤 정상 진행도 condition polling으로 확인했다.

폭발 자동 결과: 직접 적중 주 대상은 범위 피해에서 제외되고, 반경 안 다른 적만 한 번 피해를 받으며, 범위 밖 적은 유지되고, 폭발 처치 XP가 1회 지급됐다. 분열 자동 결과: 충전 영구 구슬이 임시 구슬을 만들고, 재귀 분열 없이 폭발을 적용하며, 활성 수 12개 상한을 지켰다. 레벨업 pause 중 1,600ms wall time에는 수명이 줄지 않았고, 재개 뒤 남은 gameplay lifetime 경계에서 제거됐으며 defeat 시 즉시 0개가 됐다.

다음 항목은 자동 통과로 판정하지 않는다. 사용자 직접 플레이 전까지 **pending**이다.

- 첫 레벨이 실제 자연 플레이 평균 15~20초에 도달하는지
- 선택이 흐름 방해보다 짧은 보상으로 느껴지는지
- 분열과 폭발 조합이 만족스러운 순간 화력을 만드는지
- physical phone에서 임시 구슬 12개가 읽기 쉽고 성능을 유지하는지
- 1~3분 동안 성장 속도와 적 압박이 균형을 유지하는지

`mobile-chromium` 결과는 Pixel 7 emulation이다. physical phone 결과가 아니다.
