# 코어 리디자인 프로토타입 승인 기록 — 2026-07-13

## 판정

- 자동 승인: **통과**. 단위 테스트 74/74, 브라우저 E2E 8/8, production build가 통과했다.
- 코어 루프 재미 승인: **보류**. 사용자 직접 플레이가 없으므로 주관 점수와 수동 승인 기준은 평가하지 않았다.
- 이 기록의 `미측정`과 `미평가`는 TODO 자리가 아니라, 현재 세션에서 결과를 얻을 수 없었다는 확정 기록이다.

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

2026-07-13 fresh 실행:

| 검증 | 결과 | 확인 범위 |
| --- | --- | --- |
| `npm test` | PASS — 11 files, 74/74 tests | 이동 경계, 조준/반사선 계산, 구슬 상태·대기열·회수, 피해/반사, 적 상한, 입력 변환 등 |
| `npm run test:e2e` | PASS — 8/8 (`desktop-chromium` 7, `mobile-chromium` 1), 9.6s | 데스크톱 이동/조준/3구슬 cadence, 두 회수 경로, 두 처치 설정, 압박 상한, visibility, 피해/패배/재시작, emulated touch |
| `npm run build` | PASS — 20 modules, 472ms | TypeScript와 production bundle 생성 |
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
| physical phone behavior | **미측정** | physical phone 없음; Pixel 7 emulation만 실행 | 같은 Wi-Fi의 실제 휴대폰에서 dev server LAN URL을 연다. 두 엄지 동시 이동/조준, aim 유지, 첫 반사선, 3구슬 순환, 회수, 패배/재시작, background/resume를 5분 확인하고 기기/OS/브라우저/viewport를 기록 |
| sound/feel | **미측정** | 정식 사운드는 prototype 범위 밖이며 사용자 hands-on 감각 평가도 없었음 | 헤드폰 또는 기기 speaker 상태를 기록하고 5분 플레이한다. 현재 무음 여부와 타격·회수·피격의 감각 피드백 충분성을 별도 메모 |

## 1–5 사용자 평가

모든 항목은 사용자 hands-on 결과가 필요하다. Agent visual observation이나 자동 assertion을 점수로 변환하지 않는다.

| 항목 | 점수 | 상태/이유 |
| --- | --- | --- |
| 조준 신뢰도 | — | **미평가** — 조준 의도와 체감 결과는 사용자 판단 필요 |
| 이동 피로도 | — | **미평가** — desktop 및 mobile 지속 조작 필요 |
| 회수 만족감 | — | **미평가** — 자연 발생 proximity/floor recovery 체감 필요 |
| 기다림 정도 | — | **미평가** — 실제 all-orbs-out 구간 체감 필요 |
| 연쇄 반사 볼거리 | — | **미평가** — 사용자 전투 run 필요 |
| 압박 공정성 | — | **미평가** — shooter/bullet 상한 통과만으로 공정성을 판정할 수 없음 |
| 한 판 더 하고 싶은 정도 | — | **미평가** — 사용자 의향 질문 필요 |

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
| 조준 신뢰도 / 이동 피로도 / 회수 만족감 (각 1–5) |  |
| 기다림 / 연쇄 반사 볼거리 / 압박 공정성 (각 1–5) |  |
| 한 판 더 하고 싶은 정도 (1–5) |  |
| sound/feel 메모 |  |
| 관측 문제와 재현 단계 |  |

## 재현 URL

로컬 실행:

```bash
npm run dev -- --host 127.0.0.1 --port 4173
```

- 기본값: <http://127.0.0.1:4173/>
- `passThroughOnKill`만 변경: <http://127.0.0.1:4173/?passThroughOnKill=true>
- `homeOnBottomHit`만 변경: <http://127.0.0.1:4173/?homeOnBottomHit=false>

한 비교에서는 URL 한 항목만 바꾸고 대형, 속도, 구슬 수, 플레이 시간을 유지한다. `autoReturnAfterMs`는 현재 parser가 항상 `null`로 고정하므로 query 비교 대상이 아니다.

## Spec 18 승인 상태

| 승인 기준 | 자동 근거 | 현재 판정 |
| --- | --- | --- |
| 조준 방향과 구슬 진입 방향 일치 | desktop/mobile aim 유지와 launch, collision 방향 E2E 통과 | **자동 통과**; 사용자 조준 신뢰도는 수동 보류 |
| 공격하지 않는 약한 적 20마리의 80%를 첫 breach 전 제거 | 해당 정확한 fixture와 사용자 run 없음 | **수동 미측정** |
| breach 전 대응 시간 존재 | 자동화가 하강은 확인했지만 사용자 대응 시간은 측정하지 않음 | **수동 미평가** |
| 회수와 재발사의 빠른 순환 | 100ms queue cadence와 proximity/floor recovery E2E 통과 | **기능 자동 통과**; 체감 속도는 수동 보류 |
| 실험 변경 차이를 즉시 비교 가능 | query parsing과 두 `passThroughOnKill` collision E2E 통과; 비교 URL 제공 | **기능 자동 통과**; 차이의 체감 명확성은 수동 보류 |
| 모바일/데스크톱 조작 이해 가능 | 두 입력 경로 E2E 통과 | **입력 자동 통과**; 실제 이해도와 physical phone은 수동 보류 |
| 코어 루프 승인 전 로그라이트/보스 미구현 | 현재 prototype 범위에 없음 | **범위 준수**; 코어 루프 승인은 보류 |

## 관측 문제와 다음 결정

현재 자동 실행에서 새 기능 결함은 관측되지 않았다. 알려진 검증 위험은 cadence의 좁은 wall-clock CI bound, physical phone 미검증, production chunk-size warning이다.

다음 결정은 사용자 play session 데이터 뒤에만 한다. 우선순위는 정확한 20-basic/non-attacking acceptance fixture 확보, physical phone 확인, 위 표의 정량값과 1–5 점수 수집이다. 그 전에는 tuning 제안, 로그라이트 콘텐츠, boss 구현으로 넘어가지 않는다.
